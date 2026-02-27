package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
)

// stellarAddressRegex validates a Stellar public key (G + 55 uppercase base32 chars).
var stellarAddressRegex = regexp.MustCompile(`^G[A-Z2-7]{55}$`)

// getSourceSecret reads the signing key from the SOURCE_SECRET environment
// variable.  This prevents accidental secret leakage in version control.
func getSourceSecret() string {
	secret := os.Getenv("SOURCE_SECRET")
	if secret == "" {
		log.Fatal("FATAL: SOURCE_SECRET environment variable is not set. " +
			"Export it before starting the server:\n" +
			"  export SOURCE_SECRET=S...\n")
	}
	return secret
}

// ---------- Request / Response types ----------

// TransferRequest represents the JSON body for /api/send.
type TransferRequest struct {
	Recipient string `json:"recipient"`
	Amount    string `json:"amount"`
}

// APIError is a structured JSON error response.
type APIError struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

// ---------- Validation helpers ----------

// validateStellarAddress returns an error string if addr is not a valid
// Stellar public key (ed25519).
func validateStellarAddress(addr string) string {
	if addr == "" {
		return "recipient address is required"
	}
	if !strings.HasPrefix(addr, "G") {
		return "recipient address must start with 'G'"
	}
	if len(addr) != 56 {
		return fmt.Sprintf("recipient address must be 56 characters (got %d)", len(addr))
	}
	if !stellarAddressRegex.MatchString(addr) {
		return "recipient address contains invalid characters (expected base32)"
	}
	return ""
}

// validateAmount returns an error string if amount is not a positive,
// finite decimal number within a sane range.
func validateAmount(raw string) string {
	if raw == "" {
		return "amount is required"
	}
	val, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return "amount must be a valid number"
	}
	if val <= 0 {
		return "amount must be greater than zero"
	}
	if val > 1_000_000_000 {
		return "amount exceeds the maximum allowed (1,000,000,000)"
	}
	return ""
}

// ---------- JSON helpers ----------

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, APIError{Error: msg, Code: code})
}

// ---------- CORS middleware ----------

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "http://localhost:3000,http://localhost:5173"
		}

		origin := r.Header.Get("Origin")
		allowOrigin := ""

		for _, o := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(o) == origin {
				allowOrigin = origin
				break
			}
		}

		if allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ---------- Handlers ----------

func sendLumens(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "only POST is accepted")
		return
	}

	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON")
		return
	}

	// --- Input validation ---
	if msg := validateStellarAddress(req.Recipient); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_RECIPIENT", msg)
		return
	}
	if msg := validateAmount(req.Amount); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_AMOUNT", msg)
		return
	}

	// --- Build & submit transaction ---
	sourceSecret := getSourceSecret()
	sourceKP, err := keypair.ParseFull(sourceSecret)
	if err != nil {
		log.Printf("ERROR: invalid source key: %v", err)
		writeError(w, http.StatusInternalServerError, "CONFIG_ERROR", "server signing key is misconfigured")
		return
	}

	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: sourceKP.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	if err != nil {
		log.Printf("ERROR: cannot load source account: %v", err)
		writeError(w, http.StatusInternalServerError, "NETWORK_ERROR", "cannot load source account from Stellar network")
		return
	}

	paymentOp := txnbuild.Payment{
		Destination: req.Recipient,
		Amount:      req.Amount,
		Asset:       txnbuild.NativeAsset{},
	}

	txParams := txnbuild.TransactionParams{
		SourceAccount:        &sourceAccount,
		IncrementSequenceNum: true,
		BaseFee:              txnbuild.MinBaseFee,
		Operations:           []txnbuild.Operation{&paymentOp},
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(300)},
	}

	tx, err := txnbuild.NewTransaction(txParams)
	if err != nil {
		log.Printf("ERROR: transaction build failed: %v", err)
		writeError(w, http.StatusInternalServerError, "TX_BUILD_ERROR", "failed to build transaction")
		return
	}

	signedTx, err := tx.Sign(network.TestNetworkPassphrase, sourceKP)
	if err != nil {
		log.Printf("ERROR: transaction signing failed: %v", err)
		writeError(w, http.StatusInternalServerError, "TX_SIGN_ERROR", "failed to sign transaction")
		return
	}

	resp, err := client.SubmitTransaction(signedTx)
	if err != nil {
		log.Printf("ERROR: transaction submission failed: %v", err)
		writeError(w, http.StatusBadGateway, "TX_SUBMIT_ERROR",
			fmt.Sprintf("transaction failed on Stellar network: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Transaction successful",
		"hash":    resp.Hash,
	})
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"network": "testnet",
	})
}

// ---------- Main ----------

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/send", sendLumens)
	mux.HandleFunc("/api/health", healthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 StellarPay API running at http://localhost:%s\n", port)
	fmt.Println("📡 Endpoints:")
	fmt.Println("   POST /api/send   - Send XLM to recipient")
	fmt.Println("   GET  /api/health - Health check")

	log.Fatal(http.ListenAndServe(":"+port, enableCORS(mux)))
}

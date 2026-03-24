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
	"time"

	"github.com/joho/godotenv"
	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
)

// stellarAddressRegex validates a Stellar public key (G + 55 uppercase base32 chars).
var stellarAddressRegex = regexp.MustCompile(`^G[A-Z2-7]{55}$`)

// ---------- Request / Response types ----------

type TransferRequest struct {
	Recipient   string `json:"recipient"`
	Amount      string `json:"amount"`
	AssetCode   string `json:"asset_code"`   // "XLM", "USDC", etc. Empty = native XLM
	AssetIssuer string `json:"asset_issuer"` // Required for non-native assets
}

type APIError struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

// ---------- Validation helpers ----------

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
			allowedOrigins = "http://localhost:5173,http://localhost:3000"
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
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ---------- API key auth middleware ----------

func apiKeyAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		apiKey := os.Getenv("API_KEY")
		if apiKey == "" {
			next(w, r)
			return
		}
		provided := r.Header.Get("X-API-Key")
		if provided != apiKey {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or missing API key")
			return
		}
		next(w, r)
	}
}

// ---------- Handlers ----------

func sendAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "only POST is accepted")
		return
	}

	sourceSecret := os.Getenv("STELLAR_SOURCE_SECRET")
	if sourceSecret == "" {
		writeError(w, http.StatusInternalServerError, "CONFIG_ERROR", "server signing key is not configured")
		return
	}

	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON")
		return
	}

	if msg := validateStellarAddress(req.Recipient); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_RECIPIENT", msg)
		return
	}
	if msg := validateAmount(req.Amount); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_AMOUNT", msg)
		return
	}

	var asset txnbuild.Asset
	if req.AssetCode == "" || req.AssetCode == "XLM" {
		asset = txnbuild.NativeAsset{}
	} else {
		if req.AssetIssuer == "" {
			writeError(w, http.StatusBadRequest, "INVALID_ASSET", "asset_issuer required for non-native assets")
			return
		}
		asset = txnbuild.CreditAsset{
			Code:   req.AssetCode,
			Issuer: req.AssetIssuer,
		}
	}

	sourceKP, err := keypair.ParseFull(sourceSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CONFIG_ERROR", "server signing key is misconfigured")
		return
	}

	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: sourceKP.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "NETWORK_ERROR", "cannot load source account from Stellar network")
		return
	}

	paymentOp := txnbuild.Payment{
		Destination: req.Recipient,
		Amount:      req.Amount,
		Asset:       asset,
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
		writeError(w, http.StatusInternalServerError, "TX_BUILD_ERROR", "failed to build transaction")
		return
	}

	signedTx, err := tx.Sign(network.TestNetworkPassphrase, sourceKP)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "TX_SIGN_ERROR", "failed to sign transaction")
		return
	}

	resp, err := client.SubmitTransaction(signedTx)
	if err != nil {
		writeError(w, http.StatusBadGateway, "TX_SUBMIT_ERROR", fmt.Sprintf("transaction failed: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message":   "Transaction successful",
		"hash":      resp.Hash,
		"asset":     req.AssetCode,
		"amount":    req.Amount,
		"recipient": req.Recipient,
	})
}

func getAccountBalances(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	if accountID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "account_id query param required")
		return
	}

	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: accountID}
	account, err := client.AccountDetail(ar)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "NETWORK_ERROR", fmt.Sprintf("cannot load account: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"account_id": accountID,
		"balances":   account.Balances,
	})
}

// healthCheck hem API'nin hem de Stellar ağ bağlantısının durumunu kontrol eder.
func healthCheck(w http.ResponseWriter, r *http.Request) {
	client := horizonclient.DefaultTestNetClient
	
	// Stellar Horizon ağının durumunu kontrol et
	root, err := client.Root()
	
	status := "ok"
	networkStatus := "connected"
	var details interface{} = nil

	if err != nil {
		status = "degraded"
		networkStatus = "disconnected"
		details = err.Error()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":          status,
		"network":         "testnet",
		"stellar_status":  networkStatus,
		"horizon_version": root.HorizonVersion,
		"core_version":    root.StellarCoreVersion,
		"error_details":   details,
		"timestamp":       time.Now().Format(time.RFC3339),
	})
}

// ---------- Main ----------

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found or could not be loaded")
	}

	if os.Getenv("STELLAR_SOURCE_SECRET") == "" {
		log.Fatal("❌ STELLAR_SOURCE_SECRET env var is required.")
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/send", apiKeyAuth(sendAsset))
	mux.HandleFunc("/api/balances", getAccountBalances)
	mux.HandleFunc("/api/health", healthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 StellarPay API running at http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, enableCORS(mux)))
}

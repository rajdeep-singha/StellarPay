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

// ---------- Request / Response types ----------

// TransferRequest supports multi-asset transfers
type TransferRequest struct {
	Recipient   string `json:"recipient"`
	Amount      string `json:"amount"`
	AssetCode   string `json:"asset_code"`   // "XLM", "USDC", etc. Empty = native XLM
	AssetIssuer string `json:"asset_issuer"` // Required for non-native assets
}

// APIError is a structured JSON error response.
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
			// No API key configured — skip auth in dev
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

// sendAsset handles both XLM and custom asset transfers
func sendAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "only POST is accepted")
		return
	}

	// Load secret from env — never hardcode
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

	// --- Input validation ---
	if msg := validateStellarAddress(req.Recipient); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_RECIPIENT", msg)
		return
	}
	if msg := validateAmount(req.Amount); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_AMOUNT", msg)
		return
	}

	// Determine asset type
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
		"message":   "Transaction successful",
		"hash":      resp.Hash,
		"asset":     req.AssetCode,
		"amount":    req.Amount,
		"recipient": req.Recipient,
	})
}

// getAccountBalances fetches all balances for an account via Horizon
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

	type Balance struct {
		AssetType   string `json:"asset_type"`
		AssetCode   string `json:"asset_code,omitempty"`
		AssetIssuer string `json:"asset_issuer,omitempty"`
		Balance     string `json:"balance"`
		Limit       string `json:"limit,omitempty"`
	}

	var balances []Balance
	for _, b := range account.Balances {
		balances = append(balances, Balance{
			AssetType:   b.Type,
			AssetCode:   b.Code,
			AssetIssuer: b.Issuer,
			Balance:     b.Balance,
			Limit:       b.Limit,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"account_id": accountID,
		"balances":   balances,
	})
}

// Health check
func healthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"network": "testnet",
	})
}

// ---------- Main ----------

func main() {
	// Validate required env vars on startup
	if os.Getenv("STELLAR_SOURCE_SECRET") == "" {
		log.Fatal("❌ STELLAR_SOURCE_SECRET env var is required. Set it in your .env file.")
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/send", apiKeyAuth(sendAsset))   // protected
	mux.HandleFunc("/api/balances", getAccountBalances)   // public read-only
	mux.HandleFunc("/api/health", healthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 StellarPay API running at http://localhost:%s\n", port)
	fmt.Println("📡 Endpoints:")
	fmt.Println("   POST /api/send     - Send XLM or custom asset (requires X-API-Key header)")
	fmt.Println("   GET  /api/balances - Get account balances")
	fmt.Println("   GET  /api/health   - Health check")

	log.Fatal(http.ListenAndServe(":"+port, enableCORS(mux)))
}

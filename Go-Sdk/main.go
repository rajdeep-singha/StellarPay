package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
)

// stellarAddressRegex validates a Stellar public key (G + 55 uppercase base32 chars).
var stellarAddressRegex = regexp.MustCompile(`^G[A-Z2-7]{55}$`)

// Rate limiting
var (
	requestCounts = make(map[string]int)
	rateLimitMutex sync.RWMutex
	maxRequestsPerMinute = 30
	cleanupInterval = 60 * time.Second
)

// Security headers
var securityHeaders = map[string]string{
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"X-XSS-Protection": "1; mode=block",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"Content-Security-Policy": "default-src 'self'",
}

// ---------- Request / Response types ----------

type TransferRequest struct {
	Recipient   string `json:"recipient"`
	Amount      string `json:"amount"`
	AssetCode   string `json:"asset_code"`   // "XLM", "USDC", etc. Empty = native XLM
	AssetIssuer string `json:"asset_issuer"` // Required for non-native assets
}

type RateLimitResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Details string `json:"details,omitempty"`
	RetryAfter int `json:"retry_after,omitempty"`
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
	// Trim whitespace
	addr = strings.TrimSpace(addr)
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
	// Trim whitespace
	raw = strings.TrimSpace(raw)
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
	// Check for reasonable precision (max 7 decimal places for XLM)
	if len(strings.Split(raw, ".")) > 2 {
		return "amount has invalid format"
	}
	if len(strings.Split(raw, ".")) == 2 && len(strings.Split(raw, ".")[1]) > 7 {
		return "amount has too many decimal places (max 7)"
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

// ---------- Rate limiting middleware ----------

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxied requests)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP from the comma-separated list
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	// Fall back to RemoteAddr
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
		return r.RemoteAddr[:idx]
	}
	return r.RemoteAddr
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	// Start cleanup goroutine
	go func() {
		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			rateLimitMutex.Lock()
			requestCounts = make(map[string]int)
			rateLimitMutex.Unlock()
		}
	}()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := getClientIP(r)
		now := time.Now()
		minuteKey := fmt.Sprintf("%s:%d", clientIP, now.Minute())

		rateLimitMutex.Lock()
		count := requestCounts[minuteKey]
		if count >= maxRequestsPerMinute {
			rateLimitMutex.Unlock()
			writeJSON(w, http.StatusTooManyRequests, RateLimitResponse{
				Error:      "Rate limit exceeded",
				Code:       "RATE_LIMIT_EXCEEDED",
				Details:    fmt.Sprintf("Maximum %d requests per minute allowed", maxRequestsPerMinute),
				RetryAfter: 60,
			})
			return
		}
		requestCounts[minuteKey] = count + 1
		rateLimitMutex.Unlock()

		next.ServeHTTP(w, r)
	})
}

// ---------- Security headers middleware ----------

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for key, value := range securityHeaders {
			w.Header().Set(key, value)
		}
		next.ServeHTTP(w, r)
	})
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

		// Validate origin against whitelist
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
		w.Header().Set("Access-Control-Allow-Credentials", "true")

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

// ---------- Request validation middleware ----------

func validateRequestMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Validate Content-Type for POST requests
		if r.Method == http.MethodPost {
			contentType := r.Header.Get("Content-Type")
			if !strings.Contains(contentType, "application/json") {
				writeError(w, http.StatusBadRequest, "INVALID_CONTENT_TYPE", "Content-Type must be application/json")
				return
			}
		}

		// Validate request size (prevent large payloads)
		if r.ContentLength > 1024*1024 { // 1MB limit
			writeError(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "Request payload exceeds maximum allowed size")
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

	// Add timeout context for transaction processing
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var req TransferRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields() // Prevent unexpected fields
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON")
		return
	}

	// Additional validation for asset codes
	if req.AssetCode != "" {
		req.AssetCode = strings.TrimSpace(strings.ToUpper(req.AssetCode))
		if len(req.AssetCode) > 12 {
			writeError(w, http.StatusBadRequest, "INVALID_ASSET", "asset code too long (max 12 characters)")
			return
		}
		if !regexp.MustCompile(`^[A-Z0-9]+$`).MatchString(req.AssetCode) {
			writeError(w, http.StatusBadRequest, "INVALID_ASSET", "asset code must contain only uppercase letters and numbers")
			return
		}
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
		// Validate asset issuer address
		if msg := validateStellarAddress(req.AssetIssuer); msg != "" {
			writeError(w, http.StatusBadRequest, "INVALID_ISSUER", "invalid asset issuer address: "+msg)
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

	// Use context for network requests
	client := horizonclient.DefaultTestNetClient
	client.SetHTTPClient(&http.Client{Timeout: 10 * time.Second})
	
	ar := horizonclient.AccountRequest{AccountID: sourceKP.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	if err != nil {
		writeError(w, http.StatusBadGateway, "NETWORK_ERROR", "cannot load source account from Stellar network")
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

	// Submit transaction with context
	resp, err := client.SubmitTransaction(signedTx)
	if err != nil {
		writeError(w, http.StatusBadGateway, "TX_SUBMIT_ERROR", fmt.Sprintf("transaction failed: %v", err))
		return
	}

	// Log successful transaction (without sensitive data)
	log.Printf("Transaction successful: hash=%s, asset=%s, amount=%s", resp.Hash, req.AssetCode, req.Amount)
	
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

	// Apply middleware chain: security headers -> rate limiting -> CORS -> handlers
	handler := securityHeadersMiddleware(rateLimitMiddleware(enableCORS(mux)))

	// Register handlers with validation and auth middleware
	mux.HandleFunc("/api/send", validateRequestMiddleware(apiKeyAuth(sendAsset)))
	mux.HandleFunc("/api/balances", validateRequestMiddleware(getAccountBalances))
	mux.HandleFunc("/api/health", healthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 StellarPay API running at http://localhost:%s", port)
	log.Printf("🔐 Security features enabled: Rate limiting (%d req/min), CORS, security headers", maxRequestsPerMinute)
	
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	
	log.Fatal(server.ListenAndServe())
}

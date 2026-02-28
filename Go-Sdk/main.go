package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
)

// Global configuration loaded from environment
var (
	sourceSecret      string
	stellarNetwork    string
	serverPort        string
	horizonClient     *horizonclient.Client
	networkPassphrase string
)

type TransferRequest struct {
	Recipient string `json:"recipient"`
	Amount    string `json:"amount"`
}

// init loads environment variables and initializes configuration
func init() {
	// Load .env file if it exists (ignore error in production with real env vars)
	_ = godotenv.Load()

	// Load required environment variables
	sourceSecret = os.Getenv("STELLAR_PRIVATE_KEY")
	if sourceSecret == "" {
		log.Fatal("❌ STELLAR_PRIVATE_KEY environment variable is required")
	}

	// Load optional configuration with defaults
	stellarNetwork = os.Getenv("STELLAR_NETWORK")
	if stellarNetwork == "" {
		stellarNetwork = "testnet"
	}

	serverPort = os.Getenv("PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	// Initialize Stellar client based on network
	if stellarNetwork == "mainnet" {
		horizonClient = horizonclient.DefaultPublicNetClient
		networkPassphrase = network.PublicNetworkPassphrase
	} else {
		horizonClient = horizonclient.DefaultTestNetClient
		networkPassphrase = network.TestNetworkPassphrase
	}

	log.Printf("🔐 Environment loaded successfully")
	log.Printf("🌐 Network: %s", stellarNetwork)
	log.Printf("📡 Port: %s", serverPort)
}

// CORS middleware
// CORS middleware
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get allowed origins from environment variable
		allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "http://localhost:3000" // Default for local react dev
		}

		origin := r.Header.Get("Origin")
		allowOrigin := ""

		// Check if the request origin is allowed
		for _, o := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(o) == origin {
				allowOrigin = origin
				break
			}
		}

		// If origin is allowed, set the header
		if allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		}
		
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func sendLumens(w http.ResponseWriter, r *http.Request) {
	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Recipient == "" || req.Amount == "" {
		http.Error(w, "Missing recipient or amount", http.StatusBadRequest)
		return
	}

	// Validate amount is positive
	amount, err := strconv.ParseFloat(req.Amount, 64)
	if err != nil || amount <= 0 {
		http.Error(w, "Invalid amount: must be a positive number", http.StatusBadRequest)
		return
	}

	// Validate recipient address format
	if _, err := keypair.ParseAddress(req.Recipient); err != nil {
		http.Error(w, "Invalid recipient address format", http.StatusBadRequest)
		return
	}

	sourceKP, err := keypair.ParseFull(sourceSecret)
	if err != nil {
		log.Printf("❌ Error parsing source key: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	sourceAddress := sourceKP.Address()
	client := horizonClient

	ar := horizonclient.AccountRequest{AccountID: sourceAddress}
	sourceAccount, err := client.AccountDetail(ar)
	if err != nil {
		http.Error(w, "Cannot load source account", http.StatusInternalServerError)
		return
	}

	paymentOp := txnbuild.Payment{
		Destination: req.Recipient,
		Amount:      req.Amount,
		Asset:       txnbuild.NativeAsset{},
	}

	timeout := txnbuild.NewTimeout(300)

	txParams := txnbuild.TransactionParams{
		SourceAccount:        &sourceAccount,
		IncrementSequenceNum: true,
		BaseFee:              txnbuild.MinBaseFee,
		Operations:           []txnbuild.Operation{&paymentOp},
		Preconditions:        txnbuild.Preconditions{TimeBounds: timeout},
	}
	tx, err := txnbuild.NewTransaction(txParams)
	if err != nil {
		http.Error(w, "Transaction build failed", http.StatusInternalServerError)
		return
	}

	signedTx, err := tx.Sign(networkPassphrase, sourceKP)
	if err != nil {
		log.Printf("❌ Error signing transaction: %v", err)
		http.Error(w, "Signing failed", http.StatusInternalServerError)
		return
	}

	resp, err := client.SubmitTransaction(signedTx)
	if err != nil {
		http.Error(w, fmt.Sprintf("Transaction failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Transaction successful",
		"hash":    resp.Hash,
	})
}

// Health check endpoint
func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"network": stellarNetwork,
	})
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/send", sendLumens)
	mux.HandleFunc("/api/health", healthCheck)

	addr := ":" + serverPort
	fmt.Printf("🚀 StellarPay API running at http://localhost:%s\n", serverPort)
	fmt.Println("📡 Endpoints:")
	fmt.Println("   POST /api/send   - Send XLM to recipient")
	fmt.Println("   GET  /api/health - Health check")

	log.Fatal(http.ListenAndServe(addr, enableCORS(mux)))
}

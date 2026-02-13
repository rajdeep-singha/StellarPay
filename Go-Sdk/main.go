package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
)

const sourceSecret = "SBACJ6NGHW6NQZ47KE7IFF4Z5VWT4SDS3MXTDID6VV5Q2YQ2DPPXNTWU"

type TransferRequest struct {
	Recipient string `json:"recipient"`
	Amount    string `json:"amount"`
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

	if req.Recipient == "" || req.Amount == "" {
		http.Error(w, "Missing recipient or amount", http.StatusBadRequest)
		return
	}

	sourceKP, err := keypair.ParseFull(sourceSecret)
	if err != nil {
		http.Error(w, "Invalid source key", http.StatusInternalServerError)
		return
	}
	sourceAddress := sourceKP.Address()
	client := horizonclient.DefaultTestNetClient

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

	signedTx, err := tx.Sign(network.TestNetworkPassphrase, sourceKP)
	if err != nil {
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
		"network": "testnet",
	})
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/send", sendLumens)
	mux.HandleFunc("/api/health", healthCheck)

	fmt.Println("🚀 StellarPay API running at http://localhost:8080")
	fmt.Println("📡 Endpoints:")
	fmt.Println("   POST /api/send   - Send XLM to recipient")
	fmt.Println("   GET  /api/health - Health check")

	log.Fatal(http.ListenAndServe(":8080", enableCORS(mux)))
}

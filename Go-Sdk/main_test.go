package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func init() {
	os.Setenv("STELLAR_SOURCE_SECRET", "SDXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZ")
}

// ============================================================
// Validation Unit Tests
// ============================================================

func TestValidateStellarAddress(t *testing.T) {
	tests := []struct {
		name    string
		addr    string
		wantErr bool
		errMsg  string
	}{
		{"valid address", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", false, ""},
		{"empty", "", true, "recipient address is required"},
		{"wrong prefix", "SBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", true, "must start with 'G'"},
		{"too short", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT", true, "must be 56 characters"},
		{"too long", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLAXYZ", true, "must be 56 characters"},
		{"invalid chars", "G000000000000000000000000000000000000000000000000000000a", true, "invalid characters"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := validateStellarAddress(tc.addr)
			if tc.wantErr && result == "" {
				t.Errorf("expected error containing %q, got empty", tc.errMsg)
			}
			if !tc.wantErr && result != "" {
				t.Errorf("expected no error, got %q", result)
			}
			if tc.wantErr && result != "" && tc.errMsg != "" {
				if !strContains(result, tc.errMsg) {
					t.Errorf("expected error containing %q, got %q", tc.errMsg, result)
				}
			}
		})
	}
}

func TestValidateAmount(t *testing.T) {
	tests := []struct {
		name    string
		amount  string
		wantErr bool
	}{
		{"valid integer", "100", false},
		{"valid decimal", "10.5", false},
		{"valid small", "0.0000001", false},
		{"empty", "", true},
		{"not a number", "abc", true},
		{"zero", "0", true},
		{"negative", "-50", true},
		{"too large", "9999999999", true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := validateAmount(tc.amount)
			if tc.wantErr && result == "" {
				t.Errorf("expected validation error, got none")
			}
			if !tc.wantErr && result != "" {
				t.Errorf("expected no error, got %q", result)
			}
		})
	}
}

// ============================================================
// CORS Middleware Tests
// ============================================================

func TestEnableCORS(t *testing.T) {
	os.Setenv("ALLOWED_ORIGINS", "http://example.com,http://localhost:3000")
	defer os.Unsetenv("ALLOWED_ORIGINS")

	var nextCalled bool
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})
	handler := enableCORS(next)

	t.Run("sets CORS header for allowed origin", func(t *testing.T) {
		nextCalled = false
		req, _ := http.NewRequest("GET", "/api/test", nil)
		req.Header.Set("Origin", "http://example.com")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://example.com" {
			t.Errorf("expected http://example.com, got %q", got)
		}
		if !nextCalled {
			t.Error("next handler should have been called")
		}
	})

	t.Run("does not set CORS for disallowed origin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/test", nil)
		req.Header.Set("Origin", "http://evil.com")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("expected empty Allow-Origin, got %q", got)
		}
	})

	t.Run("OPTIONS preflight returns 200 and does not call next", func(t *testing.T) {
		nextCalled = false
		req, _ := http.NewRequest("OPTIONS", "/api/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
		if nextCalled {
			t.Error("next handler should NOT be called for OPTIONS")
		}
		want := "Content-Type, Authorization, X-API-Key"
		if got := rr.Header().Get("Access-Control-Allow-Headers"); got != want {
			t.Errorf("expected %q, got %q", want, got)
		}
	})
}

// ============================================================
// API Key Auth Middleware Tests
// ============================================================

func TestApiKeyAuth(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("passes through when API_KEY not set", func(t *testing.T) {
		os.Unsetenv("API_KEY")
		req, _ := http.NewRequest("GET", "/api/balances", nil)
		rr := httptest.NewRecorder()
		apiKeyAuth(next)(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
	})

	t.Run("rejects missing key", func(t *testing.T) {
		os.Setenv("API_KEY", "secret123")
		defer os.Unsetenv("API_KEY")
		req, _ := http.NewRequest("GET", "/api/balances", nil)
		rr := httptest.NewRecorder()
		apiKeyAuth(next)(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
		var apiErr APIError
		json.NewDecoder(rr.Body).Decode(&apiErr)
		if apiErr.Code != "UNAUTHORIZED" {
			t.Errorf("expected UNAUTHORIZED, got %q", apiErr.Code)
		}
	})

	t.Run("rejects wrong key", func(t *testing.T) {
		os.Setenv("API_KEY", "secret123")
		defer os.Unsetenv("API_KEY")
		req, _ := http.NewRequest("GET", "/api/balances", nil)
		req.Header.Set("X-API-Key", "wrongkey")
		rr := httptest.NewRecorder()
		apiKeyAuth(next)(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("allows correct key", func(t *testing.T) {
		os.Setenv("API_KEY", "secret123")
		defer os.Unsetenv("API_KEY")
		req, _ := http.NewRequest("GET", "/api/balances", nil)
		req.Header.Set("X-API-Key", "secret123")
		rr := httptest.NewRecorder()
		apiKeyAuth(next)(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
	})
}

// ============================================================
// Handler Tests
// ============================================================

func TestHealthCheck(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/health", nil)
	rr := httptest.NewRecorder()
	healthCheck(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	// healthCheck returns a mixed-type object; decode into interface{} map.
	var body map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}

	if body["status"] != "ok" && body["status"] != "degraded" {
		t.Errorf("unexpected status value: %v", body["status"])
	}
	if body["network"] != "testnet" {
		t.Errorf("expected network=testnet, got %v", body["network"])
	}
	// status is "ok" when Horizon is reachable, "degraded" in offline/CI environments
	status, ok := body["status"].(string)
	if !ok || (status != "ok" && status != "degraded") {
		t.Errorf("expected status ok or degraded, got %v", body["status"])
	}
	if _, exists := body["timestamp"]; !exists {
		t.Error("expected timestamp field in response")
	}
}

func TestSendAsset_InvalidMethod(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/send", nil)
	rr := httptest.NewRecorder()

	sendAsset(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", rr.Code)
	}
	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "METHOD_NOT_ALLOWED" {
		t.Errorf("expected METHOD_NOT_ALLOWED, got %q", apiErr.Code)
	}
}

func TestSendAsset_MissingSourceSecret(t *testing.T) {
	os.Unsetenv("STELLAR_SOURCE_SECRET")
	body, _ := json.Marshal(TransferRequest{
		Recipient: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		Amount:    "100",
	})
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	sendAsset(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", rr.Code)
	}
	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "CONFIG_ERROR" {
		t.Errorf("expected CONFIG_ERROR, got %q", apiErr.Code)
	}
}

func TestSendAsset_InvalidJSON(t *testing.T) {
	os.Setenv("STELLAR_SOURCE_SECRET", "SCZANGBA5RLMPI7JMTP2BYASZVIL7XQ4BQJVZRPNZXCQFZXHTT7JSIK")
	defer os.Unsetenv("STELLAR_SOURCE_SECRET")
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBufferString("not json"))
	rr := httptest.NewRecorder()
	sendAsset(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "INVALID_JSON" {
		t.Errorf("expected INVALID_JSON, got %q", apiErr.Code)
	}
}

func TestSendAsset_MissingRecipient(t *testing.T) {
	os.Setenv("STELLAR_SOURCE_SECRET", "SCZANGBA5RLMPI7JMTP2BYASZVIL7XQ4BQJVZRPNZXCQFZXHTT7JSIK")
	defer os.Unsetenv("STELLAR_SOURCE_SECRET")
	body, _ := json.Marshal(TransferRequest{Recipient: "", Amount: "100"})
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	sendAsset(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "INVALID_RECIPIENT" {
		t.Errorf("expected INVALID_RECIPIENT, got %q", apiErr.Code)
	}
}

func TestSendAsset_InvalidRecipient(t *testing.T) {
	os.Setenv("STELLAR_SOURCE_SECRET", "SCZANGBA5RLMPI7JMTP2BYASZVIL7XQ4BQJVZRPNZXCQFZXHTT7JSIK")
	defer os.Unsetenv("STELLAR_SOURCE_SECRET")
	body, _ := json.Marshal(TransferRequest{Recipient: "INVALID", Amount: "100"})
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	sendAsset(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "INVALID_RECIPIENT" {
		t.Errorf("expected INVALID_RECIPIENT, got %q", apiErr.Code)
	}
}

func TestSendAsset_InvalidAmount(t *testing.T) {
	os.Setenv("STELLAR_SOURCE_SECRET", "SCZANGBA5RLMPI7JMTP2BYASZVIL7XQ4BQJVZRPNZXCQFZXHTT7JSIK")
	defer os.Unsetenv("STELLAR_SOURCE_SECRET")
	validAddr := "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
	cases := []struct {
		name   string
		amount string
	}{
		{"empty", ""},
		{"negative", "-10"},
		{"zero", "0"},
		{"non-numeric", "abc"},
		{"too large", "99999999999"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(TransferRequest{Recipient: validAddr, Amount: tc.amount})
			req, _ := http.NewRequest("POST", "/api/send", bytes.NewBuffer(body))
			rr := httptest.NewRecorder()
			sendAsset(rr, req)
			if rr.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", rr.Code)
			}
			var apiErr APIError
			json.NewDecoder(rr.Body).Decode(&apiErr)
			if apiErr.Code != "INVALID_AMOUNT" {
				t.Errorf("expected INVALID_AMOUNT, got %q", apiErr.Code)
			}
		})
	}
}

// TestGetAccountBalances_RequiresAuth verifies that /api/balances rejects
// requests that do not supply a valid API key when one is configured.
func TestGetAccountBalances_RequiresAuth(t *testing.T) {
	os.Setenv("API_KEY", "test-secret-key")
	defer os.Unsetenv("API_KEY")

	req, _ := http.NewRequest("GET", "/api/balances?account_id=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", nil)
	rr := httptest.NewRecorder()

	// Call through the auth middleware, exactly as the router does.
	apiKeyAuth(getAccountBalances)(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without API key, got %d", rr.Code)
	}

	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "UNAUTHORIZED" {
		t.Errorf("expected code UNAUTHORIZED, got %v", apiErr.Code)
	}
}

func TestSendAsset_NonNativeAssetMissingIssuer(t *testing.T) {
	os.Setenv("STELLAR_SOURCE_SECRET", "SCZANGBA5RLMPI7JMTP2BYASZVIL7XQ4BQJVZRPNZXCQFZXHTT7JSIK")
	defer os.Unsetenv("STELLAR_SOURCE_SECRET")
	body, _ := json.Marshal(TransferRequest{
		Recipient: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		Amount:    "10",
		AssetCode: "USDC",
		// AssetIssuer intentionally omitted
	})
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	sendAsset(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "INVALID_ASSET" {
		t.Errorf("expected INVALID_ASSET, got %q", apiErr.Code)
	}
}

// TestGetAccountBalances_MissingAccountID verifies the handler rejects
// requests that omit the required account_id query parameter.
func TestGetAccountBalances_MissingAccountID(t *testing.T) {
	// No API_KEY set — middleware passes through.
	os.Unsetenv("API_KEY")

	req, _ := http.NewRequest("GET", "/api/balances", nil)
	rr := httptest.NewRecorder()
	getAccountBalances(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing account_id, got %d", rr.Code)
	}

	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "INVALID_REQUEST" {
		t.Errorf("expected code INVALID_REQUEST, got %v", apiErr.Code)
	}
}

// ============================================================
// Helpers
// ============================================================

func strContains(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

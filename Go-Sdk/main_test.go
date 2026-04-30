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
				if !contains(result, tc.errMsg) {
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
		errMsg  string
	}{
		{"valid integer", "100", false, ""},
		{"valid decimal", "10.5", false, ""},
		{"valid small", "0.0000001", false, ""},
		{"empty", "", true, "required"},
		{"not a number", "abc", true, "valid number"},
		{"zero", "0", true, "greater than zero"},
		{"negative", "-50", true, "greater than zero"},
		{"too large", "9999999999", true, "exceeds the maximum"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := validateAmount(tc.amount)
			if tc.wantErr && result == "" {
				t.Errorf("expected error containing %q, got empty", tc.errMsg)
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

	var nextHandlerCalled bool
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextHandlerCalled = true
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	handler := enableCORS(nextHandler)

	t.Run("Sets CORS headers on GET request from allowed origin", func(t *testing.T) {
		nextHandlerCalled = false
		req, _ := http.NewRequest("GET", "/api/test", nil)
		req.Header.Set("Origin", "http://example.com")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://example.com" {
			t.Errorf("Access-Control-Allow-Origin: expected %v, got %v", "http://example.com", got)
		}
		if !nextHandlerCalled {
			t.Error("next handler should have been called")
		}
	})

	t.Run("Does not set CORS for disallowed origin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/test", nil)
		req.Header.Set("Origin", "http://evil.com")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("expected empty Allow-Origin, got %v", got)
		}
	})

	t.Run("OPTIONS preflight returns 200 without calling next handler", func(t *testing.T) {
		nextHandlerCalled = false
		req, _ := http.NewRequest("OPTIONS", "/api/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "POST")
		req.Header.Set("Access-Control-Request-Headers", "Content-Type, Authorization")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
		if nextHandlerCalled {
			t.Error("next handler should NOT be called for OPTIONS")
		}

		expectedHeaders := "Content-Type, Authorization, X-API-Key"
		if got := rr.Header().Get("Access-Control-Allow-Headers"); got != expectedHeaders {
			t.Errorf("Access-Control-Allow-Headers: expected %q, got %q", expectedHeaders, got)
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

	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", body["status"])
	}
	if body["network"] != "testnet" {
		t.Errorf("expected network=testnet, got %v", body["network"])
	}
}

func TestSendLumens_InvalidMethod(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/send", nil)
	rr := httptest.NewRecorder()

	sendAsset(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", rr.Code)
	}
}

func TestSendLumens_InvalidJSON(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBufferString("not json"))
	rr := httptest.NewRecorder()

	sendAsset(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}

	var apiErr APIError
	json.NewDecoder(rr.Body).Decode(&apiErr)
	if apiErr.Code != "INVALID_JSON" {
		t.Errorf("expected code INVALID_JSON, got %v", apiErr.Code)
	}
}



func TestSendLumens_MissingRecipient(t *testing.T) {
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
		t.Errorf("expected code INVALID_RECIPIENT, got %v", apiErr.Code)
	}
}

func TestSendLumens_InvalidRecipient(t *testing.T) {
	body, _ := json.Marshal(TransferRequest{Recipient: "INVALID", Amount: "100"})
	req, _ := http.NewRequest("POST", "/api/send", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()

	sendAsset(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSendLumens_InvalidAmount(t *testing.T) {
	validAddr := "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

	tests := []struct {
		name   string
		amount string
	}{
		{"empty amount", ""},
		{"negative", "-10"},
		{"zero", "0"},
		{"non-numeric", "abc"},
		{"too large", "99999999999"},
	}

	for _, tc := range tests {
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
				t.Errorf("expected code INVALID_AMOUNT, got %v", apiErr.Code)
			}
		})
	}
}

// ============================================================
// Helpers
// ============================================================

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
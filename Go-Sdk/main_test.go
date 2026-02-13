package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestEnableCORS(t *testing.T) {
	// Set allowed origins for testing
	os.Setenv("ALLOWED_ORIGINS", "http://example.com,http://localhost:3000")
	defer os.Unsetenv("ALLOWED_ORIGINS")

	// Create a dummy handler to act as the next handler in the chain
	var nextHandlerCalled bool
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextHandlerCalled = true
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap the dummy handler with the CORS middleware
	handler := enableCORS(nextHandler)

	t.Run("Sets CORS headers on GET request from allowed origin", func(t *testing.T) {
		nextHandlerCalled = false
		req, err := http.NewRequest("GET", "/api/test", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", "http://example.com")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		// Check Access-Control-Allow-Origin
		expectedOrigin := "http://example.com"
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != expectedOrigin {
			t.Errorf("Access-Control-Allow-Origin: expected %v, got %v", expectedOrigin, got)
		}

		// Check Access-Control-Allow-Methods
		expectedMethods := "GET, POST, OPTIONS"
		if got := rr.Header().Get("Access-Control-Allow-Methods"); got != expectedMethods {
			t.Errorf("Access-Control-Allow-Methods: expected %v, got %v", expectedMethods, got)
		}

		// Check Access-Control-Allow-Headers
		expectedHeaders := "Content-Type, Authorization"
		if got := rr.Header().Get("Access-Control-Allow-Headers"); got != expectedHeaders {
			t.Errorf("Access-Control-Allow-Headers: expected %v, got %v", expectedHeaders, got)
		}

		// verify status code matches the next handler
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
		}
		
		if !nextHandlerCalled {
			t.Error("next handler should have been called")
		}
	})

	t.Run("Does not set CORS headers on GET request from disallowed origin", func(t *testing.T) {
		nextHandlerCalled = false
		req, err := http.NewRequest("GET", "/api/test", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", "http://evil.com")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		// Check Access-Control-Allow-Origin should be empty
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Access-Control-Allow-Origin: expected empty, got %v", got)
		}
		
		if !nextHandlerCalled {
			t.Error("next handler should have been called even for disallowed origin (CORS prevents browser read, not server execution)")
		}
	})

	t.Run("Handle OPTIONS preflight request", func(t *testing.T) {
		nextHandlerCalled = false
		req, err := http.NewRequest("OPTIONS", "/api/test", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", "http://localhost:3000")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		// Preflight should return 200 OK
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code for OPTIONS: got %v want %v", status, http.StatusOK)
		}

		// Headers should still be present
		expectedOrigin := "http://localhost:3000"
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != expectedOrigin {
			t.Errorf("Access-Control-Allow-Origin: expected %v, got %v", expectedOrigin, got)
		}

		// Verify next handler was NOT called
		if nextHandlerCalled {
			t.Error("next handler should NOT have been called for OPTIONS request")
		}
	})
}

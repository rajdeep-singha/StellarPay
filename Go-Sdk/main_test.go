package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnableCORS(t *testing.T) {
	// Create a dummy handler to act as the next handler in the chain
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap the dummy handler with the CORS middleware
	handler := enableCORS(nextHandler)

	t.Run("Sets CORS headers on GET request", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/test", nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		// Check Access-Control-Allow-Origin
		expectedOrigin := "*"
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
	})

	t.Run("Handle OPTIONS preflight request", func(t *testing.T) {
		req, err := http.NewRequest("OPTIONS", "/api/test", nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		// Preflight should return 200 OK
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code for OPTIONS: got %v want %v", status, http.StatusOK)
		}

		// Headers should still be present
		expectedOrigin := "*"
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != expectedOrigin {
			t.Errorf("Access-Control-Allow-Origin: expected %v, got %v", expectedOrigin, got)
		}
	})
}

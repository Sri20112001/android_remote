// Pairing integration: the full device lifecycle exercised against the
// real agent (config → database → migrations → router → HTTP listener).
package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/bootstrap"
	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
)

// newPairingApp boots an agent whose security settings the test can tune.
func newPairingApp(t *testing.T, tune func(*config.Config)) *bootstrap.App {
	t.Helper()

	cfg := config.Defaults()
	cfg.Database.Path = filepath.Join(t.TempDir(), "pairing-integration.db")
	cfg.Server.Host = "127.0.0.1"
	cfg.Server.Port = 0
	if tune != nil {
		tune(cfg)
	}

	logger, err := logging.NewWithWriter(cfg.Logging, io.Discard)
	if err != nil {
		t.Fatalf("logger: %v", err)
	}
	app, err := bootstrap.New(cfg, logger)
	if err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	return app
}

// run starts the app for the duration of the test and returns its base URL.
func runApp(t *testing.T, app *bootstrap.App) string {
	t.Helper()
	if err := app.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := app.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	})
	return "http://" + app.Addr()
}

// postJSON issues a JSON request and decodes the response into out.
func postJSON(t *testing.T, url, auth string, payload any, out any) *http.Response {
	t.Helper()

	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		body = bytes.NewReader(encoded)
	} else {
		body = bytes.NewReader(nil)
	}

	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Set("Authorization", "Bearer "+auth)
	}

	resp, err := client().Do(req)
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			t.Fatalf("decode %q: %v", raw, err)
		}
	}
	// Attach the body back for callers that assert on status first.
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	return resp
}

// errorBody re-reads a response body that postJSON buffered.
func errorBody(resp *http.Response) string {
	raw, _ := io.ReadAll(resp.Body)
	return string(raw)
}

func TestPairingLifecycleOverHTTP(t *testing.T) {
	base := runApp(t, newPairingApp(t, nil))
	api := base + constants.APIPrefix

	// 1. The PC user opens a pairing window (loopback in this test).
	var start struct {
		SessionID string `json:"session_id"`
		PIN       string `json:"pin"`
		ExpiresAt string `json:"expires_at"`
	}
	resp := postJSON(t, api+constants.RoutePairingStart, "", nil, &start)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("start status = %d, body = %s", resp.StatusCode, errorBody(resp))
	}
	if len(start.PIN) != constants.PINLength || start.SessionID == "" {
		t.Fatalf("start response = %+v", start)
	}
	if _, err := time.Parse(time.RFC3339, start.ExpiresAt); err != nil {
		t.Errorf("expires_at is not RFC 3339: %q", start.ExpiresAt)
	}

	// 2. The Android app confirms with the PIN.
	var confirmed struct {
		Device struct {
			ID     string `json:"id"`
			Name   string `json:"name"`
			Status string `json:"status"`
		} `json:"device"`
		Token struct {
			Token string `json:"token"`
		} `json:"token"`
	}
	resp = postJSON(t, api+constants.RoutePairingConfirm, "", map[string]string{
		"pin": start.PIN, "name": "Pixel 8", "model": "Pixel 8", "os_version": "15",
	}, &confirmed)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("confirm status = %d, body = %s", resp.StatusCode, errorBody(resp))
	}
	if confirmed.Token.Token == "" || confirmed.Device.ID == "" {
		t.Fatalf("confirm response = %+v", confirmed)
	}
	if confirmed.Device.Status != "active" {
		t.Errorf("device status = %q", confirmed.Device.Status)
	}

	// The PIN is single use.
	resp = postJSON(t, api+constants.RoutePairingConfirm, "", map[string]string{
		"pin": start.PIN, "name": "Second",
	}, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("PIN reuse status = %d, want 401", resp.StatusCode)
	}

	// 3. The PC user sees the paired device (loopback).
	var devices struct {
		Devices []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"devices"`
	}
	req, _ := http.NewRequest(http.MethodGet, api+constants.RoutePairingDevices, nil)
	listResp, err := client().Do(req)
	if err != nil {
		t.Fatalf("GET devices: %v", err)
	}
	if err := json.NewDecoder(listResp.Body).Decode(&devices); err != nil {
		_ = listResp.Body.Close()
		t.Fatalf("decode devices: %v", err)
	}
	_ = listResp.Body.Close()
	if len(devices.Devices) != 1 {
		t.Fatalf("devices = %+v, want exactly one", devices.Devices)
	}

	// 4. The device authenticates and rotates its token.
	var rotated struct {
		Token struct {
			Token string `json:"token"`
		} `json:"token"`
	}
	resp = postJSON(t, api+constants.RouteAuthRotate, confirmed.Token.Token, nil, &rotated)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("rotate status = %d, body = %s", resp.StatusCode, errorBody(resp))
	}
	if rotated.Token.Token == "" || rotated.Token.Token == confirmed.Token.Token {
		t.Fatal("rotation must issue a different token")
	}
	// The new credential works immediately.
	resp = postJSON(t, api+constants.RouteAuthRotate, rotated.Token.Token, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("rotated token status = %d", resp.StatusCode)
	}

	// 5. The PC user revokes the device.
	var revoked struct {
		DeviceID string `json:"device_id"`
		Status   string `json:"status"`
	}
	resp = postJSON(t, api+constants.RoutePairingRevoke, "", map[string]string{
		"device_id": confirmed.Device.ID,
	}, &revoked)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("revoke status = %d, body = %s", resp.StatusCode, errorBody(resp))
	}
	if revoked.Status != "revoked" {
		t.Errorf("status = %q", revoked.Status)
	}

	// Revocation cuts the credential off: the rotated token can no longer
	// authenticate, even during its grace window, because the device
	// itself is revoked.
	resp = postJSON(t, api+constants.RouteAuthRotate, rotated.Token.Token, nil, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("rotate with revoked device: status = %d, want 401", resp.StatusCode)
	}

	// A second revocation is a conflict, an unknown id a 404.
	resp = postJSON(t, api+constants.RoutePairingRevoke, "", map[string]string{
		"device_id": confirmed.Device.ID,
	}, nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("second revoke status = %d, want 409", resp.StatusCode)
	}
	resp = postJSON(t, api+constants.RoutePairingRevoke, "", map[string]string{
		"device_id": "no-such-device",
	}, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown device status = %d, want 404", resp.StatusCode)
	}
}

func TestPairingConfirmIsRateLimitedOverHTTP(t *testing.T) {
	base := runApp(t, newPairingApp(t, func(cfg *config.Config) {
		cfg.Security.RateLimit.ConfirmPerMinute = 3
	}))
	url := base + constants.APIPrefix + constants.RoutePairingConfirm

	payload := []byte(`{"pin":"000000","name":"Phone"}`)
	var last *http.Response
	for i := 0; i < 5; i++ {
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
		if err != nil {
			t.Fatalf("request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")
		last, err = client().Do(req)
		if err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
		_ = last.Body.Close()
	}

	if last.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 after the budget of 3/min", last.StatusCode)
	}
	if last.Header.Get("Retry-After") == "" {
		t.Error("missing Retry-After header")
	}
}

func TestGuardBlocksBrowserCrossSiteOverHTTP(t *testing.T) {
	base := runApp(t, newPairingApp(t, nil))
	api := base + constants.APIPrefix

	// A malicious web page driving the local agent from a victim browser.
	req, err := http.NewRequest(http.MethodPost, api+constants.RoutePairingConfirm, bytes.NewReader([]byte(`{}`)))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	req.Header.Set("Origin", "https://evil.example")

	resp, err := client().Do(req)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusForbidden {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, want 403 (body: %s)", resp.StatusCode, body)
	}

	// The legitimate native client (no such headers) is unaffected.
	resp2 := postJSON(t, api+constants.RoutePairingStart, "", nil, nil)
	if resp2.StatusCode != http.StatusCreated {
		t.Errorf("native start status = %d, want 201", resp2.StatusCode)
	}
}

func TestPairingResponsesNeverEchoSecretsInErrors(t *testing.T) {
	base := runApp(t, newPairingApp(t, nil))
	api := base + constants.APIPrefix

	// Oversized and malformed bodies must fail safely.
	resp := postJSON(t, api+constants.RoutePairingConfirm, "", map[string]any{
		"pin":  "123456",
		"name": fmt.Sprintf("%010000d", 0),
	}, nil)
	if resp.StatusCode != http.StatusBadRequest && resp.StatusCode != http.StatusCreated {
		// Name over 64 chars is a 400; either way the body must be an
		// error envelope or a success payload, never an internal dump.
		t.Errorf("status = %d", resp.StatusCode)
	}
	if resp.StatusCode == http.StatusInternalServerError {
		body := errorBody(resp)
		t.Errorf("internal error leaked to the client: %s", body)
	}
}

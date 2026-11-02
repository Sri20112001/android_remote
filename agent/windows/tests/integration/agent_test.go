// Package integration_test boots the real agent (config → database →
// migrations → modules → router → HTTP listener) and exercises it over a
// real socket.
package integration_test

import (
	"context"
	"encoding/json"
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

// newTestApp builds a full agent bound to an ephemeral loopback port with a
// temporary database.
func newTestApp(t *testing.T) *bootstrap.App {
	t.Helper()

	cfg := config.Defaults()
	cfg.Database.Path = filepath.Join(t.TempDir(), "integration.db")
	cfg.Server.Host = "127.0.0.1"
	cfg.Server.Port = 0 // ephemeral: tests must never collide

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

// client returns an HTTP client with a sane test timeout.
func client() *http.Client {
	return &http.Client{Timeout: 5 * time.Second}
}

func TestAgentServesAPIOverHTTP(t *testing.T) {
	app := newTestApp(t)
	if err := app.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := app.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	}()

	base := "http://" + app.Addr()

	t.Run("health", func(t *testing.T) {
		resp, err := client().Get(base + constants.APIPrefix + constants.RouteHealth)
		if err != nil {
			t.Fatalf("GET health: %v", err)
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}

		var body struct {
			Status  string `json:"status"`
			Version string `json:"version"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body.Status != "ok" || body.Version != constants.AppVersion {
			t.Errorf("body = %+v", body)
		}
		if resp.Header.Get(constants.RequestIDHeader) == "" {
			t.Error("missing X-Request-ID header")
		}
	})

	t.Run("system info", func(t *testing.T) {
		resp, err := client().Get(base + constants.APIPrefix + constants.RouteSystemInfo)
		if err != nil {
			t.Fatalf("GET system/info: %v", err)
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("status = %d, body = %s", resp.StatusCode, body)
		}

		var body struct {
			Hostname string   `json:"hostname"`
			OS       string   `json:"os"`
			IPs      []string `json:"ip_addresses"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body.Hostname == "" || body.OS == "" {
			t.Errorf("identity missing: %+v", body)
		}
	})

	t.Run("system status", func(t *testing.T) {
		resp, err := client().Get(base + constants.APIPrefix + constants.RouteSystemStatus)
		if err != nil {
			t.Fatalf("GET system/status: %v", err)
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d, want 200 while the database is up", resp.StatusCode)
		}
	})

	t.Run("unknown endpoint is a JSON 404", func(t *testing.T) {
		resp, err := client().Get(base + "/api/v1/nope")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d", resp.StatusCode)
		}

		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body.Error.Code != string(constants.CodeNotFound) {
			t.Errorf("code = %q", body.Error.Code)
		}
	})
}

func TestGracefulShutdownStopsListener(t *testing.T) {
	app := newTestApp(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- app.Run(ctx) }()

	// Wait until the listener is bound.
	deadline := time.Now().Add(5 * time.Second)
	for app.Addr() == "" {
		if time.Now().After(deadline) {
			t.Fatal("server did not bind within 5s")
		}
		time.Sleep(10 * time.Millisecond)
	}
	addr := app.Addr()

	resp, err := client().Get("http://" + addr + constants.APIPrefix + constants.RouteHealth)
	if err != nil {
		t.Fatalf("GET health before shutdown: %v", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run must return nil on graceful shutdown, got: %v", err)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("Run did not return after cancellation")
	}

	// The port must no longer accept connections.
	if _, err := client().Get("http://" + addr + constants.APIPrefix + constants.RouteHealth); err == nil {
		t.Fatal("listener still accepting connections after shutdown")
	}
}

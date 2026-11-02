package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
	"github.com/tuf-remote/agent/internal/modules/health"
	"github.com/tuf-remote/agent/internal/platform"
	"github.com/tuf-remote/agent/internal/server"
)

// stubSysInfo is a minimal platform provider for router tests.
type stubSysInfo struct{}

func (stubSysInfo) Collect(context.Context) (platform.Info, error) {
	return platform.Info{
		Hostname:    "test-host",
		OS:          "windows",
		IPAddresses: []string{},
	}, nil
}

// nopStore satisfies health.Store without a database.
type nopStore struct{}

func (nopStore) PingContext(context.Context) error { return nil }

// newRouter builds the real router with a health controller backed by
// fakes, plus a log buffer for assertions.
func newRouter(t *testing.T) (*gin.Engine, *bytes.Buffer) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var logBuf bytes.Buffer
	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "debug", Format: "text"}, &logBuf)
	if err != nil {
		t.Fatalf("logger: %v", err)
	}

	cfg := config.Defaults()
	service := health.NewService(time.Now(), stubSysInfo{}, nopStore{})
	controller := health.NewController(service, logger)

	engine := server.NewRouter(server.RouterDependencies{
		Config: cfg,
		Logger: logger,
		Health: controller,
	})
	return engine, &logBuf
}

// newRequest builds a request the way a real client does: with a Host
// header pointing at the agent (the default httptest target yields
// "example.com", which the host guard must reject).
func newRequest(method, target string, body io.Reader) *http.Request {
	req := httptest.NewRequest(method, target, body)
	req.Host = "127.0.0.1:8765"
	return req
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("body is not JSON: %q", rec.Body.String())
	}
	errObj, ok := payload["error"].(map[string]any)
	if !ok {
		t.Fatalf("missing error envelope: %v", payload)
	}
	return errObj
}

func TestRouterServesHealth(t *testing.T) {
	engine, _ := newRouter(t)

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, newRequest(http.MethodGet, constants.APIPrefix+constants.RouteHealth, nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), constants.AppVersion) {
		t.Errorf("body missing version: %s", rec.Body.String())
	}
}

func TestRouterUnknownPathReturnsJSON404(t *testing.T) {
	engine, _ := newRouter(t)

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, newRequest(http.MethodGet, "/api/v1/does-not-exist", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeError(t, rec)["code"]; got != string(constants.CodeNotFound) {
		t.Errorf("code = %v", got)
	}
}

func TestRouterWrongMethodReturns405(t *testing.T) {
	engine, _ := newRouter(t)

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, newRequest(http.MethodPost, constants.APIPrefix+constants.RouteHealth, nil))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeError(t, rec)["code"]; got != string(constants.CodeMethodNotAllowed) {
		t.Errorf("code = %v", got)
	}
}

func TestRouterAttachesRequestIDToErrorResponses(t *testing.T) {
	engine, _ := newRouter(t)

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, newRequest(http.MethodGet, "/nope", nil))

	if rec.Header().Get(constants.RequestIDHeader) == "" {
		t.Error("error responses must still carry X-Request-ID")
	}
}

func TestRouterRejectsRebindingHost(t *testing.T) {
	engine, _ := newRouter(t)

	// A domain rebound to loopback must not reach any handler, including
	// the unknown-path handler (which would otherwise confirm routing).
	req := newRequest(http.MethodGet, constants.APIPrefix+constants.RouteHealth, nil)
	req.Host = "attacker.example:8765"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403 for a rebinding Host", rec.Code)
	}
}

func TestRouterAcceptsTheMachinesOwnHostname(t *testing.T) {
	engine, _ := newRouter(t)

	hostname, err := os.Hostname()
	if err != nil {
		t.Skipf("hostname unavailable: %v", err)
	}

	req := newRequest(http.MethodGet, constants.APIPrefix+constants.RouteHealth, nil)
	req.Host = hostname + ":8765"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("own hostname %q: status = %d, body = %s", hostname, rec.Code, rec.Body.String())
	}
}
func TestRouterIgnoresForwardedForSpoofing(t *testing.T) {
	engine, logBuf := newRouter(t)

	req := newRequest(http.MethodGet, constants.APIPrefix+constants.RouteHealth, nil)
	// httptest defaults RemoteAddr to 192.0.2.1:1234; a forged forwarded
	// header must not win.
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.Header.Set("X-Real-IP", "5.6.7.8")

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	logs := logBuf.String()
	if !strings.Contains(logs, "client_ip=192.0.2.1") {
		t.Errorf("client_ip must come from the socket, log: %q", logs)
	}
	if strings.Contains(logs, "1.2.3.4") || strings.Contains(logs, "5.6.7.8") {
		t.Errorf("spoofed forwarded headers leaked into logs: %q", logs)
	}
}

package pairing_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/pairing"
)

// testEngine wires the pairing routes exactly as the production router
// does (minus the global middleware, which the router package tests).
type testEngine struct {
	engine  *gin.Engine
	service *pairing.Service
	logBuf  *bytes.Buffer
}

// newTestEngine builds the pairing routes with a small confirm budget so
// rate limiting is observable.
func newTestEngine(t *testing.T, confirmPerMinute int) *testEngine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var logBuf bytes.Buffer
	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "debug", Format: "text"}, &logBuf)
	if err != nil {
		t.Fatalf("logger: %v", err)
	}

	svc, _, _, _ := newTestService(t)
	controller := pairing.NewController(svc, logger)
	limiter := middleware.NewRateLimiter(confirmPerMinute, time.Minute)

	engine := gin.New()
	engine.Use(middleware.RequestID(), middleware.Guard(logger))
	pairing.RegisterRoutes(engine.Group(constants.APIPrefix), pairing.RouteDeps{
		Controller:     controller,
		Validator:      svc,
		Logger:         logger,
		ConfirmLimiter: limiter.Middleware(middleware.ClientIPKey),
	})

	return &testEngine{engine: engine, service: svc, logBuf: &logBuf}
}

// send issues a request. remoteAddr overrides the peer address; the
// httptest default (192.0.2.1) is a non-loopback LAN client.
func (e *testEngine) send(t *testing.T, method, path, body, remoteAddr string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.RemoteAddr = remoteAddr
	// Real clients address the agent explicitly; httptest would otherwise
	// send "example.com", which the host guard rejects.
	req.Host = "127.0.0.1:8765"
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	e.engine.ServeHTTP(rec, req)
	return rec
}

func (e *testEngine) api(path string) string { return constants.APIPrefix + path }

const (
	localAddr  = "127.0.0.1:51000"
	remoteAddr = "192.0.2.1:41000"
)

func decodeErrorBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
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

// doPairing performs start + confirm from the given addresses and returns
// the raw token.
func (e *testEngine) doPairing(t *testing.T, name string) (pairing.ConfirmResponse, string) {
	t.Helper()

	rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingStart), "", localAddr, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("start status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var start pairing.StartResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &start); err != nil {
		t.Fatalf("decode start: %v", err)
	}

	body, err := json.Marshal(pairing.ConfirmRequest{PIN: start.PIN, Name: name})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	rec = e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm), string(body), remoteAddr, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("confirm status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var confirmed pairing.ConfirmResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &confirmed); err != nil {
		t.Fatalf("decode confirm: %v", err)
	}
	return confirmed, confirmed.Token.Token
}

func TestStartIsLoopbackOnly(t *testing.T) {
	e := newTestEngine(t, 20)

	rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingStart), "", remoteAddr, nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 for a LAN client", rec.Code)
	}
	if got := decodeErrorBody(t, rec)["code"]; got != string(constants.CodeForbidden) {
		t.Errorf("code = %v", got)
	}

	rec = e.send(t, http.MethodPost, e.api(constants.RoutePairingStart), "", localAddr, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("loopback start status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(e.logBuf.String(), "pin=") || strings.Contains(e.logBuf.String(), "pin\"") {
		t.Errorf("PIN leaked into logs: %q", e.logBuf.String())
	}
}

func TestDevicesAndRevokeAreLoopbackOnly(t *testing.T) {
	e := newTestEngine(t, 20)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, constants.RoutePairingDevices},
		{http.MethodPost, constants.RoutePairingRevoke},
	} {
		rec := e.send(t, tc.method, e.api(tc.path), `{}`, remoteAddr, nil)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s from LAN: status = %d, want 403", tc.path, rec.Code)
		}
		rec = e.send(t, tc.method, e.api(tc.path), `{}`, localAddr, nil)
		if rec.Code == http.StatusForbidden {
			t.Errorf("%s from loopback must be allowed, got 403", tc.path)
		}
	}
}

func TestPairingFlowOverHTTP(t *testing.T) {
	e := newTestEngine(t, 20)

	confirmed, token := e.doPairing(t, "Pixel 8")
	if token == "" {
		t.Fatal("no token issued")
	}
	if confirmed.Device.ID == "" || confirmed.Device.Status != pairing.StatusActive {
		t.Errorf("device = %+v", confirmed.Device)
	}

	// The token authenticates against the strict rotation endpoint.
	rec := e.send(t, http.MethodPost, e.api(constants.RouteAuthRotate), "", remoteAddr, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("rotate status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// A missing credential must be rejected with the standard envelope.
	rec = e.send(t, http.MethodPost, e.api(constants.RouteAuthRotate), "", remoteAddr, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("rotate without token: status = %d", rec.Code)
	}
}

func TestConfirmRejectsBadInput(t *testing.T) {
	e := newTestEngine(t, 20)

	t.Run("malformed json", func(t *testing.T) {
		rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm), `{"pin":`, remoteAddr, nil)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d", rec.Code)
		}
	})

	t.Run("unknown field", func(t *testing.T) {
		rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm),
			`{"pin":"123456","name":"x","admin":true}`, remoteAddr, nil)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400 for unknown fields", rec.Code)
		}
	})

	t.Run("wrong pin", func(t *testing.T) {
		rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingStart), "", localAddr, nil)
		if rec.Code != http.StatusCreated {
			t.Fatalf("start status = %d", rec.Code)
		}
		var start pairing.StartResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &start); err != nil {
			t.Fatalf("decode: %v", err)
		}
		wrong := differ(start.PIN)

		body, _ := json.Marshal(pairing.ConfirmRequest{PIN: wrong, Name: "Phone"})
		rec = e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm), string(body), remoteAddr, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
		if got := decodeErrorBody(t, rec)["code"]; got != string(constants.CodeUnauthorized) {
			t.Errorf("code = %v", got)
		}
		// The response must not say which session or which digit failed.
		if strings.Contains(rec.Body.String(), start.PIN) || strings.Contains(rec.Body.String(), wrong) {
			t.Errorf("response leaks a PIN: %s", rec.Body.String())
		}
	})

	t.Run("bad pin format", func(t *testing.T) {
		rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm),
			`{"pin":"abc","name":"Phone"}`, remoteAddr, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401 (same as a wrong PIN)", rec.Code)
		}
	})
}

func TestConfirmIsRateLimited(t *testing.T) {
	e := newTestEngine(t, 3)

	body := `{"pin":"000000","name":"Phone"}`
	var last *httptest.ResponseRecorder
	for i := 0; i < 5; i++ {
		last = e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm), body, remoteAddr, nil)
	}

	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 after the budget", last.Code)
	}
	if last.Header().Get("Retry-After") == "" {
		t.Error("429 must carry Retry-After")
	}
	if got := decodeErrorBody(t, last)["code"]; got != string(constants.CodeRateLimited) {
		t.Errorf("code = %v", got)
	}
}

func TestGuardBlocksCrossSiteBrowserRequests(t *testing.T) {
	e := newTestEngine(t, 20)

	rec := e.send(t, http.MethodPost, e.api(constants.RoutePairingConfirm), `{}`, remoteAddr, map[string]string{
		"Sec-Fetch-Site": "cross-site",
	})
	if rec.Code != http.StatusForbidden {
		t.Errorf("cross-site status = %d, want 403", rec.Code)
	}

	// A same-origin browser request still passes through to the handler.
	rec = e.send(t, http.MethodPost, e.api(constants.RoutePairingStart), "", localAddr, map[string]string{
		"Sec-Fetch-Site": "same-origin",
	})
	if rec.Code != http.StatusCreated {
		t.Errorf("same-origin status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// A native client sends neither header and is unaffected.
	rec = e.send(t, http.MethodGet, e.api(constants.RoutePairingDevices), "", localAddr, nil)
	if rec.Code != http.StatusOK {
		t.Errorf("native client status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

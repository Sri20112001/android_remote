package health_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
	"github.com/tuf-remote/agent/internal/modules/health"
	"github.com/tuf-remote/agent/internal/platform"
)

// errFake stands in for a failing dependency in controller tests.
var errFake = errors.New("fake failure")

// newTestEngine builds a Gin engine with the health routes registered, the
// same way the real router does.
func newTestEngine(t *testing.T, sysInfo health.SystemInfoProvider, store health.Store) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "debug", Format: "text"}, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("logger: %v", err)
	}

	service := health.NewService(time.Now().Add(-time.Minute), sysInfo, store)
	controller := health.NewController(service, logger)

	engine := gin.New()
	health.RegisterRoutes(engine.Group(constants.APIPrefix), controller)
	return engine
}

func getJSON(t *testing.T, engine *gin.Engine, path string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

	var payload map[string]any
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("response is not JSON (%q): %v", rec.Body.String(), err)
		}
	}
	return rec, payload
}

func TestHealthEndpoint(t *testing.T) {
	engine := newTestEngine(t, fakeSysInfo{}, fakeStore{})

	rec, payload := getJSON(t, engine, constants.APIPrefix+constants.RouteHealth)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if payload["status"] != health.StatusOK {
		t.Errorf("status = %v", payload["status"])
	}
	if payload["version"] != constants.AppVersion {
		t.Errorf("version = %v", payload["version"])
	}
}

func TestSystemInfoEndpoint(t *testing.T) {
	provider := fakeSysInfo{info: platform.Info{
		Hostname:    "tuf-laptop",
		OS:          "windows",
		IPAddresses: []string{"10.0.0.7"},
	}}
	engine := newTestEngine(t, provider, fakeStore{})

	rec, payload := getJSON(t, engine, constants.APIPrefix+constants.RouteSystemInfo)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if payload["hostname"] != "tuf-laptop" {
		t.Errorf("hostname = %v", payload["hostname"])
	}
	if _, present := payload["os_version"]; present {
		t.Error("os_version must be omitted when unavailable")
	}
}

func TestSystemInfoUnavailableReturns503Envelope(t *testing.T) {
	engine := newTestEngine(t, fakeSysInfo{err: errFake}, fakeStore{})

	rec, payload := getJSON(t, engine, constants.APIPrefix+constants.RouteSystemInfo)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", rec.Code)
	}
	errObj, ok := payload["error"].(map[string]any)
	if !ok {
		t.Fatalf("missing error envelope: %v", payload)
	}
	if errObj["code"] != string(constants.CodeUnavailable) {
		t.Errorf("code = %v", errObj["code"])
	}
}

func TestSystemStatusReturns503WhenDegraded(t *testing.T) {
	engine := newTestEngine(t, fakeSysInfo{}, fakeStore{err: errFake})

	rec, payload := getJSON(t, engine, constants.APIPrefix+constants.RouteSystemStatus)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	if payload["status"] != health.StatusDegraded {
		t.Errorf("status = %v", payload["status"])
	}
	db, _ := payload["database"].(map[string]any)
	if db["status"] != health.StatusDegraded {
		t.Errorf("database = %v", db["status"])
	}
}

func TestSystemStatusReturns200WhenHealthy(t *testing.T) {
	engine := newTestEngine(t, fakeSysInfo{}, fakeStore{})

	rec, payload := getJSON(t, engine, constants.APIPrefix+constants.RouteSystemStatus)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if payload["status"] != health.StatusOK {
		t.Errorf("status = %v", payload["status"])
	}
}

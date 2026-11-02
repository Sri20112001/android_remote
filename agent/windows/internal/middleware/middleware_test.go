package middleware_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
	"github.com/tuf-remote/agent/internal/middleware"
)

func testEngine(t *testing.T, logOutput *bytes.Buffer) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "debug", Format: "text"}, logOutput)
	if err != nil {
		t.Fatalf("logger: %v", err)
	}

	engine := gin.New()
	engine.Use(middleware.RequestID())
	engine.Use(middleware.Logging(logger))
	engine.Use(middleware.Recovery(logger))
	return engine
}

func TestRecoveryTurnsPanicIntoJSON500(t *testing.T) {
	var log bytes.Buffer
	engine := testEngine(t, &log)

	engine.GET("/boom", func(*gin.Context) { panic("secret internal detail") })

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}

	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	if body.Error.Code != string(constants.CodeInternal) {
		t.Errorf("code = %q", body.Error.Code)
	}
	if body.Error.Message != "internal server error" {
		t.Errorf("message = %q, panic details must not leak", body.Error.Message)
	}
	if strings.Contains(rec.Body.String(), "secret internal detail") {
		t.Error("panic value leaked to the client")
	}
	if !strings.Contains(log.String(), "panic recovered") {
		t.Error("panic was not logged")
	}
}

func TestLoggingRecordsStatusAndRequestID(t *testing.T) {
	var log bytes.Buffer
	engine := testEngine(t, &log)

	engine.GET("/things", func(c *gin.Context) { c.Status(http.StatusCreated) })

	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/things", nil))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d", rec.Code)
	}

	requestID := rec.Header().Get(constants.RequestIDHeader)
	if requestID == "" {
		t.Fatal("response must carry an X-Request-ID header")
	}

	out := log.String()
	if !strings.Contains(out, "http request") {
		t.Errorf("log line missing: %q", out)
	}
	if !strings.Contains(out, "status=201") {
		t.Errorf("log line missing status: %q", out)
	}
	if !strings.Contains(out, "request_id="+requestID) {
		t.Errorf("log line missing request id %q: %q", requestID, out)
	}
}

func TestRequestIDPreservesIncomingValue(t *testing.T) {
	var log bytes.Buffer
	engine := testEngine(t, &log)

	engine.GET("/echo", func(c *gin.Context) {
		c.String(http.StatusOK, middleware.RequestIDFromContext(c))
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	req.Header.Set(constants.RequestIDHeader, "client-correlation-1")
	engine.ServeHTTP(rec, req)

	if got := rec.Header().Get(constants.RequestIDHeader); got != "client-correlation-1" {
		t.Errorf("X-Request-ID = %q", got)
	}
	if rec.Body.String() != "client-correlation-1" {
		t.Errorf("handler saw %q", rec.Body.String())
	}
}

func TestRequestIDRejectsOversizedIncomingValue(t *testing.T) {
	var log bytes.Buffer
	engine := testEngine(t, &log)

	engine.GET("/echo", func(c *gin.Context) {
		c.String(http.StatusOK, middleware.RequestIDFromContext(c))
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	req.Header.Set(constants.RequestIDHeader, strings.Repeat("x", constants.MaxRequestIDLength+1))
	engine.ServeHTTP(rec, req)

	if got := rec.Header().Get(constants.RequestIDHeader); len(got) > constants.MaxRequestIDLength {
		t.Errorf("oversized incoming id was echoed back: %d bytes", len(got))
	}
}

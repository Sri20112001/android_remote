package discovery_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
	"github.com/tuf-remote/agent/internal/modules/discovery"
	"github.com/tuf-remote/agent/internal/platform"
)

type fakeSysInfo struct{}

func (f *fakeSysInfo) Collect(ctx context.Context) (platform.Info, error) {
	return platform.Info{
		Hostname:    "test-pc",
		IPAddresses: []string{"192.168.1.100"},
	}, nil
}

func TestDiscoveryEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger, _ := logging.New(config.LoggingConfig{Level: "error", Format: "text"})
	cfg := config.Defaults()
	cfg.Agent.Name = "Test PC"

	svc := discovery.NewService(cfg, &fakeSysInfo{}, logger)
	ctl := discovery.NewController(svc, 8765, logger)

	r := gin.New()
	api := r.Group(constants.APIPrefix)
	discovery.RegisterRoutes(api, ctl)

	t.Run("discovery info", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteDiscoveryInfo, nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}

		var info discovery.InfoResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if info.AgentName != "Test PC" || info.Port != 8765 || len(info.Addresses) != 1 {
			t.Errorf("unexpected info response: %+v", info)
		}
	})

	t.Run("discovery qr from loopback", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteDiscoveryQR+"?session_id=s123&pin=123456", nil)
		req.RemoteAddr = "127.0.0.1:45678"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}

		var qr discovery.QRPayload
		if err := json.Unmarshal(rec.Body.Bytes(), &qr); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if qr.SessionID != "s123" || qr.PIN != "123456" || qr.Hostname != "test-pc" {
			t.Errorf("unexpected qr response: %+v", qr)
		}
	})

	t.Run("discovery qr rejected from non-loopback", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteDiscoveryQR, nil)
		req.RemoteAddr = "192.168.1.50:45678"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
	})
}

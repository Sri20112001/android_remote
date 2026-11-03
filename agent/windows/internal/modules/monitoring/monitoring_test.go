package monitoring_test

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
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/monitoring"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

type fakeMetricsProvider struct{}

func (f *fakeMetricsProvider) CollectMetrics(ctx context.Context) (monitoring.SystemMetrics, error) {
	return monitoring.SystemMetrics{
		CPU: monitoring.CPUMetrics{UsagePercent: 15.5},
		Memory: monitoring.MemoryMetrics{
			TotalBytes:     16000000000,
			AvailableBytes: 8000000000,
			UsedBytes:      8000000000,
			UsagePercent:   50.0,
		},
		Battery: monitoring.BatteryMetrics{
			Present:    true,
			Charging:   true,
			Percentage: 85,
		},
	}, nil
}

func (f *fakeMetricsProvider) GetProcesses(ctx context.Context) ([]monitoring.ProcessInfo, error) {
	return []monitoring.ProcessInfo{
		{PID: 1001, Name: "chrome.exe", MemoryMB: 320.5},
		{PID: 1002, Name: "code.exe", MemoryMB: 215.0},
	}, nil
}

func (f *fakeMetricsProvider) KillProcess(pid int) error {
	return nil
}

type fakeTokenValidator struct{}

func (f *fakeTokenValidator) ValidateToken(ctx context.Context, token string) (middleware.Identity, error) {
	if token == "valid-token" {
		return middleware.Identity{DeviceID: "dev-1"}, nil
	}
	return middleware.Identity{}, middleware.ErrInvalidToken
}

func TestMonitoring(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger, _ := logging.New(config.LoggingConfig{Level: "error", Format: "text"})
	provider := &fakeMetricsProvider{}
	hub := ws.NewHub(logger)
	svc := monitoring.NewService(provider, hub, logger)
	ctl := monitoring.NewController(svc, logger)
	validator := &fakeTokenValidator{}

	r := gin.New()
	api := r.Group(constants.APIPrefix)
	monitoring.RegisterRoutes(api, ctl, validator, logger)

	t.Run("GET /monitoring/system from loopback", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteMonitoringSystem, nil)
		req.RemoteAddr = "127.0.0.1:54321"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}

		var metrics monitoring.SystemMetrics
		if err := json.Unmarshal(rec.Body.Bytes(), &metrics); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if metrics.CPU.UsagePercent != 15.5 || metrics.Battery.Percentage != 85 {
			t.Errorf("unexpected metrics: %+v", metrics)
		}
	})

	t.Run("GET /monitoring/system with bearer token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteMonitoringSystem, nil)
		req.RemoteAddr = "192.168.1.10:54321"
		req.Header.Set("Authorization", "Bearer valid-token")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
	})

	t.Run("GET /monitoring/system unauthorized without token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteMonitoringSystem, nil)
		req.RemoteAddr = "192.168.1.10:54321"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("WebSocket command registration", func(t *testing.T) {
		registry := ws.NewRegistry()
		svc.RegisterWS(registry)

		resp := registry.Dispatch(context.Background(), middleware.Identity{DeviceID: "dev-1"}, &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "req-1",
			Module: "monitoring",
			Action: "metrics",
		})

		if resp == nil || resp.Success == nil || !*resp.Success {
			t.Fatalf("dispatch error: %+v", resp)
		}
	})
}

package power_test

import (
	"bytes"
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
	"github.com/tuf-remote/agent/internal/modules/power"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

type fakePowerExecutor struct {
	locked    bool
	slept     bool
	restarted bool
	shutdown  bool
}

func (f *fakePowerExecutor) Lock() error {
	f.locked = true
	return nil
}

func (f *fakePowerExecutor) Sleep() error {
	f.slept = true
	return nil
}

func (f *fakePowerExecutor) Hibernate() error {
	f.slept = true
	return nil
}

func (f *fakePowerExecutor) Restart() error {
	f.restarted = true
	return nil
}

func (f *fakePowerExecutor) Shutdown() error {
	f.shutdown = true
	return nil
}

type fakeTokenValidator struct{}

func (f *fakeTokenValidator) ValidateToken(ctx context.Context, token string) (middleware.Identity, error) {
	if token == "valid-token" {
		return middleware.Identity{DeviceID: "dev-test"}, nil
	}
	return middleware.Identity{}, middleware.ErrInvalidToken
}

func TestPowerModule(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger, _ := logging.New(config.LoggingConfig{Level: "error", Format: "text"})
	executor := &fakePowerExecutor{}
	svc := power.NewService(executor, nil, logger)
	ctl := power.NewController(svc, logger)
	validator := &fakeTokenValidator{}

	r := gin.New()
	api := r.Group(constants.APIPrefix)
	power.RegisterRoutes(api, ctl, validator, logger)

	t.Run("lock workstation", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RoutePowerLock, nil)
		req.RemoteAddr = "127.0.0.1:50000"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if !executor.locked {
			t.Errorf("executor.Lock() was not called")
		}
	})

	t.Run("two-step confirmation flow", func(t *testing.T) {
		// 1. Request
		reqBody, _ := json.Marshal(power.RequestPayload{Action: "restart"})
		req := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RoutePowerRequest, bytes.NewReader(reqBody))
		req.RemoteAddr = "192.168.1.100:50000"
		req.Header.Set("Authorization", "Bearer valid-token")
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request status = %d, body = %s", rec.Code, rec.Body.String())
		}

		var reqResp power.RequestResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &reqResp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if reqResp.ConfirmationToken == "" || reqResp.Action != "restart" {
			t.Errorf("unexpected reqResp: %+v", reqResp)
		}

		// 2. Confirm
		confirmBody, _ := json.Marshal(power.ConfirmPayload{ConfirmationToken: reqResp.ConfirmationToken})
		confReq := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RoutePowerConfirm, bytes.NewReader(confirmBody))
		confReq.RemoteAddr = "192.168.1.100:50000"
		confReq.Header.Set("Authorization", "Bearer valid-token")
		confReq.Header.Set("Content-Type", "application/json")
		confRec := httptest.NewRecorder()
		r.ServeHTTP(confRec, confReq)

		if confRec.Code != http.StatusOK {
			t.Fatalf("confirm status = %d, body = %s", confRec.Code, confRec.Body.String())
		}
		if !executor.restarted {
			t.Errorf("executor.Restart() was not called")
		}

		// 3. Confirm again with used token must fail
		confRec2 := httptest.NewRecorder()
		confReq2 := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RoutePowerConfirm, bytes.NewReader(confirmBody))
		confReq2.RemoteAddr = "192.168.1.100:50000"
		confReq2.Header.Set("Authorization", "Bearer valid-token")
		confReq2.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(confRec2, confReq2)

		if confRec2.Code != http.StatusBadRequest {
			t.Errorf("re-using token must fail with 400, got %d", confRec2.Code)
		}
	})

	t.Run("WebSocket registration", func(t *testing.T) {
		reg := ws.NewRegistry()
		svc.RegisterWS(reg)

		resp := reg.Dispatch(context.Background(), middleware.Identity{DeviceID: "dev-test"}, &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "ws-1",
			Module: "power",
			Action: "lock",
		})
		if resp == nil || resp.Success == nil || !*resp.Success {
			t.Errorf("ws dispatch failed: %+v", resp)
		}
	})
}

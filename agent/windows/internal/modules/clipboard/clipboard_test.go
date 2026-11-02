package clipboard_test

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
	"github.com/tuf-remote/agent/internal/modules/clipboard"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

type fakeClipboard struct {
	text string
}

func (f *fakeClipboard) GetText() (string, error) {
	return f.text, nil
}

func (f *fakeClipboard) SetText(text string) error {
	f.text = text
	return nil
}

type fakeTokenValidator struct{}

func (f *fakeTokenValidator) ValidateToken(ctx context.Context, token string) (middleware.Identity, error) {
	if token == "valid-token" {
		return middleware.Identity{DeviceID: "dev-test"}, nil
	}
	return middleware.Identity{}, middleware.ErrInvalidToken
}

func TestClipboardModule(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger, _ := logging.New(config.LoggingConfig{Level: "error", Format: "text"})
	clip := &fakeClipboard{text: "initial text"}
	svc := clipboard.NewService(clip, logger)
	ctl := clipboard.NewController(svc, logger)
	validator := &fakeTokenValidator{}

	r := gin.New()
	api := r.Group(constants.APIPrefix)
	clipboard.RegisterRoutes(api, ctl, validator, logger)

	t.Run("GET /clipboard", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteClipboard, nil)
		req.RemoteAddr = "127.0.0.1:50000"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}

		var payload clipboard.Payload
		_ = json.Unmarshal(rec.Body.Bytes(), &payload)
		if payload.Text != "initial text" {
			t.Errorf("expected 'initial text', got '%s'", payload.Text)
		}
	})

	t.Run("POST /clipboard", func(t *testing.T) {
		body, _ := json.Marshal(clipboard.Payload{Text: "updated text"})
		req := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RouteClipboard, bytes.NewReader(body))
		req.RemoteAddr = "127.0.0.1:50000"
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if clip.text != "updated text" {
			t.Errorf("expected 'updated text', got '%s'", clip.text)
		}
	})

	t.Run("WebSocket registration", func(t *testing.T) {
		reg := ws.NewRegistry()
		svc.RegisterWS(reg)

		resp := reg.Dispatch(context.Background(), middleware.Identity{DeviceID: "dev-test"}, &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "clip-1",
			Module: "clipboard",
			Action: "get",
		})
		if resp == nil || resp.Success == nil || !*resp.Success {
			t.Fatalf("dispatch error: %+v", resp)
		}
	})
}

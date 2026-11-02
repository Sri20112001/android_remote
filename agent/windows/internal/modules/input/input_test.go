package input_test

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
	"github.com/tuf-remote/agent/internal/modules/input"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

type fakeInjector struct {
	lastDX, lastDY int
	lastBtn        string
	lastText       string
	lastKey        string
}

func (f *fakeInjector) MouseMove(dx, dy int) error {
	f.lastDX = dx
	f.lastDY = dy
	return nil
}

func (f *fakeInjector) MouseMoveAbsolute(x, y int) error { return nil }
func (f *fakeInjector) MouseDown(button string) error    { return nil }
func (f *fakeInjector) MouseUp(button string) error      { return nil }
func (f *fakeInjector) MouseClick(button string, double bool) error {
	f.lastBtn = button
	return nil
}
func (f *fakeInjector) MouseScroll(dy int) error { return nil }
func (f *fakeInjector) KeyDown(key string) error { return nil }
func (f *fakeInjector) KeyUp(key string) error   { return nil }
func (f *fakeInjector) KeyTap(key string, modifiers []string) error {
	f.lastKey = key
	return nil
}
func (f *fakeInjector) TypeText(text string) error {
	f.lastText = text
	return nil
}

type fakeTokenValidator struct{}

func (f *fakeTokenValidator) ValidateToken(ctx context.Context, token string) (middleware.Identity, error) {
	if token == "valid-token" {
		return middleware.Identity{DeviceID: "dev-test"}, nil
	}
	return middleware.Identity{}, middleware.ErrInvalidToken
}

func TestInputModule(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger, _ := logging.New(config.LoggingConfig{Level: "error", Format: "text"})
	inj := &fakeInjector{}
	svc := input.NewService(inj, logger)
	ctl := input.NewController(svc, logger)
	validator := &fakeTokenValidator{}

	r := gin.New()
	api := r.Group(constants.APIPrefix)
	input.RegisterRoutes(api, ctl, validator, logger)

	t.Run("POST /input/mouse", func(t *testing.T) {
		payload, _ := json.Marshal(input.MousePayload{
			Action: input.MouseActionMove,
			DX:     25,
			DY:     -10,
		})
		req := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RouteInputMouse, bytes.NewReader(payload))
		req.RemoteAddr = "127.0.0.1:50000"
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if inj.lastDX != 25 || inj.lastDY != -10 {
			t.Errorf("expected dx=25, dy=-10; got dx=%d, dy=%d", inj.lastDX, inj.lastDY)
		}
	})

	t.Run("POST /input/keyboard", func(t *testing.T) {
		payload, _ := json.Marshal(input.KeyboardPayload{
			Action: input.KeyActionText,
			Text:   "hello",
		})
		req := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RouteInputKeyboard, bytes.NewReader(payload))
		req.RemoteAddr = "127.0.0.1:50000"
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if inj.lastText != "hello" {
			t.Errorf("expected text 'hello', got '%s'", inj.lastText)
		}
	})

	t.Run("WebSocket registration", func(t *testing.T) {
		reg := ws.NewRegistry()
		svc.RegisterWS(reg)

		resp := reg.Dispatch(context.Background(), middleware.Identity{DeviceID: "dev-test"}, &ws.Frame{
			Type:    ws.TypeCommand,
			ID:      "in-1",
			Module:  "input",
			Action:  "key_tap",
			Payload: json.RawMessage(`{"key":"enter"}`),
		})
		if resp == nil || resp.Success == nil || !*resp.Success {
			t.Fatalf("dispatch error: %+v", resp)
		}
		if inj.lastKey != "enter" {
			t.Errorf("expected enter key, got '%s'", inj.lastKey)
		}
	})
}

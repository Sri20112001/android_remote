package audio_test

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
	"github.com/tuf-remote/agent/internal/modules/audio"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

type fakeAudioController struct {
	level int
	muted bool
}

func (f *fakeAudioController) GetVolume() (int, bool, error) {
	return f.level, f.muted, nil
}

func (f *fakeAudioController) SetVolume(level int) error {
	f.level = level
	return nil
}

func (f *fakeAudioController) SetMute(muted bool) error {
	f.muted = muted
	return nil
}

func (f *fakeAudioController) ToggleMute() (bool, error) {
	f.muted = !f.muted
	return f.muted, nil
}

type fakeTokenValidator struct{}

func (f *fakeTokenValidator) ValidateToken(ctx context.Context, token string) (middleware.Identity, error) {
	if token == "valid-token" {
		return middleware.Identity{DeviceID: "dev-test"}, nil
	}
	return middleware.Identity{}, middleware.ErrInvalidToken
}

func TestAudioModule(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger, _ := logging.New(config.LoggingConfig{Level: "error", Format: "text"})
	deviceCtrl := &fakeAudioController{level: 60, muted: false}
	svc := audio.NewService(deviceCtrl, logger)
	ctl := audio.NewController(svc, logger)
	validator := &fakeTokenValidator{}

	r := gin.New()
	api := r.Group(constants.APIPrefix)
	audio.RegisterRoutes(api, ctl, validator, logger)

	t.Run("GET /audio/volume", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, constants.APIPrefix+constants.RouteAudioVolume, nil)
		req.RemoteAddr = "127.0.0.1:50000"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}

		var st audio.VolumeStatus
		_ = json.Unmarshal(rec.Body.Bytes(), &st)
		if st.Level != 60 || st.Muted {
			t.Errorf("unexpected status: %+v", st)
		}
	})

	t.Run("PUT /audio/volume", func(t *testing.T) {
		payload, _ := json.Marshal(audio.SetVolumePayload{Level: 80})
		req := httptest.NewRequest(http.MethodPut, constants.APIPrefix+constants.RouteAudioVolume, bytes.NewReader(payload))
		req.RemoteAddr = "127.0.0.1:50000"
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if deviceCtrl.level != 80 {
			t.Errorf("expected level 80, got %d", deviceCtrl.level)
		}
	})

	t.Run("POST /audio/mute", func(t *testing.T) {
		payload, _ := json.Marshal(audio.SetMutePayload{Muted: true})
		req := httptest.NewRequest(http.MethodPost, constants.APIPrefix+constants.RouteAudioMute, bytes.NewReader(payload))
		req.RemoteAddr = "127.0.0.1:50000"
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if !deviceCtrl.muted {
			t.Errorf("expected muted true")
		}
	})

	t.Run("WebSocket registration", func(t *testing.T) {
		reg := ws.NewRegistry()
		svc.RegisterWS(reg)

		resp := reg.Dispatch(context.Background(), middleware.Identity{DeviceID: "dev-1"}, &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "a-1",
			Module: "audio",
			Action: "toggle_mute",
		})

		if resp == nil || resp.Success == nil || !*resp.Success {
			t.Fatalf("dispatch error: %+v", resp)
		}
	})
}

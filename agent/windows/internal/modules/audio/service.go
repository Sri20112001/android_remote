package audio

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

// Service coordinates audio endpoints and WebSocket audio commands.
type Service struct {
	ctrl   DeviceController
	logger *slog.Logger
}

// NewService constructs an audio service.
func NewService(ctrl DeviceController, logger *slog.Logger) *Service {
	return &Service{
		ctrl:   ctrl,
		logger: logger,
	}
}

// GetStatus returns the current volume and mute state.
func (s *Service) GetStatus() (VolumeStatus, error) {
	level, muted, err := s.ctrl.GetVolume()
	if err != nil {
		return VolumeStatus{}, err
	}
	return VolumeStatus{
		Level: level,
		Muted: muted,
	}, nil
}

// SetVolume updates the master volume level.
func (s *Service) SetVolume(level int) error {
	return s.ctrl.SetVolume(level)
}

// SetMute sets the mute state.
func (s *Service) SetMute(muted bool) error {
	return s.ctrl.SetMute(muted)
}

// ToggleMute toggles the mute state.
func (s *Service) ToggleMute() (bool, error) {
	return s.ctrl.ToggleMute()
}

// RegisterWS registers audio commands with the WebSocket registry.
func (s *Service) RegisterWS(registry *ws.Registry) {
	registry.Register("audio", "get_volume", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		return s.GetStatus()
	})

	registry.Register("audio", "set_volume", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req SetVolumePayload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		if err := s.SetVolume(req.Level); err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return s.GetStatus()
	})

	registry.Register("audio", "set_mute", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req SetMutePayload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		if err := s.SetMute(req.Muted); err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return s.GetStatus()
	})

	registry.Register("audio", "toggle_mute", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		_, err := s.ToggleMute()
		if err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return s.GetStatus()
	})
}

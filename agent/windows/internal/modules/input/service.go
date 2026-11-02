package input

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

// Service coordinates mouse and keyboard input injection.
type Service struct {
	injector Injector
	logger   *slog.Logger
}

// NewService constructs an input service.
func NewService(injector Injector, logger *slog.Logger) *Service {
	return &Service{
		injector: injector,
		logger:   logger,
	}
}

// InjectMouse applies mouse motion, button click or scroll wheel action.
func (s *Service) InjectMouse(req MousePayload) error {
	switch req.Action {
	case MouseActionMove:
		if req.Absolute {
			return s.injector.MouseMoveAbsolute(req.X, req.Y)
		}
		return s.injector.MouseMove(req.DX, req.DY)
	case MouseActionClick:
		return s.injector.MouseClick(req.Button, req.Double)
	case MouseDown:
		return s.injector.MouseDown(req.Button)
	case MouseUp:
		return s.injector.MouseUp(req.Button)
	case MouseActionScroll:
		return s.injector.MouseScroll(req.DY)
	default:
		// Default to relative move if dx/dy are provided
		if req.DX != 0 || req.DY != 0 {
			return s.injector.MouseMove(req.DX, req.DY)
		}
		if req.Button != "" {
			return s.injector.MouseClick(req.Button, req.Double)
		}
		return nil
	}
}

// InjectKeyboard applies keystrokes, combinations or typed text.
func (s *Service) InjectKeyboard(req KeyboardPayload) error {
	switch req.Action {
	case KeyActionTap:
		return s.injector.KeyTap(req.Key, req.Modifiers)
	case KeyActionDown:
		return s.injector.KeyDown(req.Key)
	case KeyActionUp:
		return s.injector.KeyUp(req.Key)
	case KeyActionText:
		return s.injector.TypeText(req.Text)
	default:
		if req.Text != "" {
			return s.injector.TypeText(req.Text)
		}
		if req.Key != "" {
			return s.injector.KeyTap(req.Key, req.Modifiers)
		}
		return nil
	}
}

// RegisterWS registers input commands with the WebSocket registry.
func (s *Service) RegisterWS(registry *ws.Registry) {
	registry.Register("input", "mouse", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req MousePayload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		if err := s.InjectMouse(req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return map[string]bool{"success": true}, nil
	})

	registry.Register("input", "mouse_move", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req MousePayload
		_ = json.Unmarshal(payload, &req)
		req.Action = MouseActionMove
		_ = s.InjectMouse(req)
		return nil, nil
	})

	registry.Register("input", "mouse_click", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req MousePayload
		_ = json.Unmarshal(payload, &req)
		req.Action = MouseActionClick
		_ = s.InjectMouse(req)
		return map[string]bool{"success": true}, nil
	})

	registry.Register("input", "mouse_scroll", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req MousePayload
		_ = json.Unmarshal(payload, &req)
		req.Action = MouseActionScroll
		_ = s.InjectMouse(req)
		return nil, nil
	})

	registry.Register("input", "keyboard", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req KeyboardPayload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		if err := s.InjectKeyboard(req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return map[string]bool{"success": true}, nil
	})

	registry.Register("input", "key_tap", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req KeyboardPayload
		_ = json.Unmarshal(payload, &req)
		req.Action = KeyActionTap
		_ = s.InjectKeyboard(req)
		return map[string]bool{"success": true}, nil
	})

	registry.Register("input", "type_text", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req KeyboardPayload
		_ = json.Unmarshal(payload, &req)
		req.Action = KeyActionText
		_ = s.InjectKeyboard(req)
		return map[string]bool{"success": true}, nil
	})
}

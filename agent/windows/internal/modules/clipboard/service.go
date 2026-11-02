package clipboard

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

// Service manages clipboard retrieval and assignment.
type Service struct {
	clip   Clipboard
	logger *slog.Logger
}

// NewService constructs a clipboard service.
func NewService(clip Clipboard, logger *slog.Logger) *Service {
	return &Service{
		clip:   clip,
		logger: logger,
	}
}

// GetText retrieves text from the system clipboard.
func (s *Service) GetText() (string, error) {
	return s.clip.GetText()
}

// SetText replaces the system clipboard text content.
func (s *Service) SetText(text string) error {
	return s.clip.SetText(text)
}

// RegisterWS registers clipboard commands with the WebSocket registry.
func (s *Service) RegisterWS(registry *ws.Registry) {
	registry.Register("clipboard", "get", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		text, err := s.GetText()
		if err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return Payload{Text: text}, nil
	})

	registry.Register("clipboard", "set", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req Payload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		if err := s.SetText(req.Text); err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return map[string]bool{"success": true}, nil
	})
}

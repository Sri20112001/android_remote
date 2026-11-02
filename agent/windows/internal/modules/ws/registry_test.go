package ws_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

func TestRegistry(t *testing.T) {
	reg := ws.NewRegistry()

	reg.Register("media", "play", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		return map[string]string{"state": "playing"}, nil
	})

	reg.Register("media", "fail", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		return nil, ws.NewCommandError(constants.CodeConflict, "no active player")
	})

	reg.Register("media", "crash", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		return nil, errors.New("unexpected crash")
	})

	ctx := context.Background()
	id := middleware.Identity{DeviceID: "dev-1"}

	t.Run("successful execution", func(t *testing.T) {
		req := &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "100",
			Module: "media",
			Action: "play",
		}
		resp := reg.Dispatch(ctx, id, req)
		if resp == nil || resp.ID != "100" || resp.Success == nil || !*resp.Success {
			t.Fatalf("unexpected response: %+v", resp)
		}
	})

	t.Run("unsupported action", func(t *testing.T) {
		req := &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "101",
			Module: "media",
			Action: "unknown",
		}
		resp := reg.Dispatch(ctx, id, req)
		if resp.Success == nil || *resp.Success || resp.Error.Code != constants.CodeUnsupported {
			t.Errorf("expected unsupported code, got %+v", resp)
		}
	})

	t.Run("typed command error", func(t *testing.T) {
		req := &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "102",
			Module: "media",
			Action: "fail",
		}
		resp := reg.Dispatch(ctx, id, req)
		if resp.Success == nil || *resp.Success || resp.Error.Code != constants.CodeConflict {
			t.Errorf("expected conflict code, got %+v", resp)
		}
	})

	t.Run("internal crash error", func(t *testing.T) {
		req := &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "103",
			Module: "media",
			Action: "crash",
		}
		resp := reg.Dispatch(ctx, id, req)
		if resp.Success == nil || *resp.Success || resp.Error.Code != constants.CodeInternal {
			t.Errorf("expected internal error, got %+v", resp)
		}
	})
}

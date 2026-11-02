package ws_test

import (
	"encoding/json"
	"testing"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

func TestFrameSerialization(t *testing.T) {
	t.Run("ping pong", func(t *testing.T) {
		ping := ws.NewPingFrame()
		if ping.Type != ws.TypePing || ping.Timestamp == 0 {
			t.Errorf("invalid ping frame: %+v", ping)
		}

		pong := ws.NewPongFrame(ping.Timestamp)
		if pong.Type != ws.TypePong || pong.Timestamp != ping.Timestamp {
			t.Errorf("invalid pong frame: %+v", pong)
		}
	})

	t.Run("command response success", func(t *testing.T) {
		resp := ws.NewResponseSuccess("req-1", map[string]string{"status": "ok"})
		data, err := json.Marshal(resp)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded ws.Frame
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if decoded.ID != "req-1" || decoded.Success == nil || !*decoded.Success {
			t.Errorf("unexpected decoded frame: %+v", decoded)
		}
	})

	t.Run("command response error", func(t *testing.T) {
		resp := ws.NewResponseError("req-2", constants.CodeInvalidRequest, "missing field")
		if resp.Error == nil || resp.Error.Code != constants.CodeInvalidRequest {
			t.Errorf("unexpected error frame: %+v", resp)
		}
	})

	t.Run("event frame", func(t *testing.T) {
		ev := ws.NewEventFrame("telemetry.sample", map[string]int{"cpu": 25})
		if ev.Type != ws.TypeEvent || ev.Event != "telemetry.sample" {
			t.Errorf("unexpected event frame: %+v", ev)
		}
	})
}

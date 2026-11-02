package integration_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/modules/pairing"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

func TestWebSocketLifecycle(t *testing.T) {
	app := newPairingApp(t, nil)
	baseURL := runApp(t, app)
	api := baseURL + constants.APIPrefix

	// 1. Pair a test device to obtain a valid bearer token
	var startResp pairing.StartResponse
	postJSON(t, api+constants.RoutePairingStart, "", nil, &startResp)

	var confirmResp pairing.ConfirmResponse
	postJSON(t, api+constants.RoutePairingConfirm, "", pairing.ConfirmRequest{
		PIN:  startResp.PIN,
		Name: "Test Pixel",
	}, &confirmResp)

	token := confirmResp.Token.Token
	if token == "" {
		t.Fatal("empty token received from pairing")
	}

	wsURL := strings.Replace(baseURL, "http://", "ws://", 1) + constants.APIPrefix + constants.RouteWebSocket

	t.Run("reject connection without token", func(t *testing.T) {
		// Non-loopback dialing simulation via header or bad query param
		dialer := websocket.DefaultDialer
		_, resp, err := dialer.Dial(wsURL+"?token=invalid_token", nil)
		if err == nil {
			t.Fatal("expected dial error with invalid token, got success")
		}
		if resp != nil && resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", resp.StatusCode)
		}
	})

	t.Run("connect and exchange ping pong", func(t *testing.T) {
		dialer := websocket.DefaultDialer
		conn, resp, err := dialer.Dial(wsURL+"?token="+token, nil)
		if err != nil {
			t.Fatalf("ws dial failed: %v, resp: %+v", err, resp)
		}
		defer func() { _ = conn.Close() }()

		// Send ping
		ping := ws.NewPingFrame()
		if err := conn.WriteJSON(ping); err != nil {
			t.Fatalf("write ping: %v", err)
		}

		_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("read pong: %v", err)
		}

		var pong ws.Frame
		if err := json.Unmarshal(msg, &pong); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pong.Type != ws.TypePong {
			t.Errorf("expected type 'pong', got '%s'", pong.Type)
		}

		// Send unknown command, expect correlated response with 'unsupported'
		cmd := &ws.Frame{
			Type:   ws.TypeCommand,
			ID:     "req-999",
			Module: "testmod",
			Action: "testact",
		}
		if err := conn.WriteJSON(cmd); err != nil {
			t.Fatalf("write cmd: %v", err)
		}

		_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		_, msg, err = conn.ReadMessage()
		if err != nil {
			t.Fatalf("read cmd response: %v", err)
		}

		var cmdResp ws.Frame
		if err := json.Unmarshal(msg, &cmdResp); err != nil {
			t.Fatalf("unmarshal cmd response: %v", err)
		}
		if cmdResp.ID != "req-999" || cmdResp.Success == nil || *cmdResp.Success {
			t.Errorf("expected failure response for unknown command, got: %+v", cmdResp)
		}
		if cmdResp.Error == nil || cmdResp.Error.Code != constants.CodeUnsupported {
			t.Errorf("expected error code unsupported, got: %+v", cmdResp.Error)
		}
	})
}

package ws

import (
	"encoding/json"
	"time"

	"github.com/tuf-remote/agent/internal/constants"
)

// Frame types defined by the WebSocket protocol.
const (
	TypeCommand  = "command"
	TypeResponse = "response"
	TypeEvent    = "event"
	TypePing     = "ping"
	TypePong     = "pong"
	TypeError    = "error"
)

// FrameError describes an error carried in a response or error frame.
type FrameError struct {
	Code    constants.ErrorCode `json:"code"`
	Message string              `json:"message"`
}

// Frame represents a single WebSocket message frame.
type Frame struct {
	Type      string          `json:"type"`
	ID        string          `json:"id,omitempty"`
	Module    string          `json:"module,omitempty"`
	Action    string          `json:"action,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Success   *bool           `json:"success,omitempty"`
	Data      any             `json:"data,omitempty"`
	Error     *FrameError     `json:"error,omitempty"`
	Event     string          `json:"event,omitempty"`
	Timestamp int64           `json:"ts,omitempty"`
}

// NewPingFrame creates an application-level ping frame.
func NewPingFrame() *Frame {
	return &Frame{
		Type:      TypePing,
		Timestamp: time.Now().UTC().UnixMilli(),
	}
}

// NewPongFrame creates a pong response to an inbound ping frame.
func NewPongFrame(ts int64) *Frame {
	if ts == 0 {
		ts = time.Now().UTC().UnixMilli()
	}
	return &Frame{
		Type:      TypePong,
		Timestamp: ts,
	}
}

// NewResponseSuccess builds a correlated success response frame.
func NewResponseSuccess(id string, data any) *Frame {
	t := true
	return &Frame{
		Type:    TypeResponse,
		ID:      id,
		Success: &t,
		Data:    data,
	}
}

// NewResponseError builds a correlated failure response frame.
func NewResponseError(id string, code constants.ErrorCode, message string) *Frame {
	f := false
	return &Frame{
		Type:    TypeResponse,
		ID:      id,
		Success: &f,
		Error: &FrameError{
			Code:    code,
			Message: message,
		},
	}
}

// NewEventFrame creates an unsolicited server-push event frame.
func NewEventFrame(event string, data any) *Frame {
	return &Frame{
		Type:  TypeEvent,
		Event: event,
		Data:  data,
	}
}

// NewProtocolErrorFrame builds an uncorrelated error frame for protocol violations.
func NewProtocolErrorFrame(code constants.ErrorCode, message string) *Frame {
	return &Frame{
		Type: TypeError,
		Error: &FrameError{
			Code:    code,
			Message: message,
		},
	}
}

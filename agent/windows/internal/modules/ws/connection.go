package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// Connection encapsulates an active WebSocket connection and handles reading,
// writing, heartbeat management and command dispatching.
type Connection struct {
	id        string
	identity  middleware.Identity
	conn      *websocket.Conn
	hub       *Hub
	registry  *Registry
	logger    *slog.Logger
	send      chan *Frame
	cmdCh     chan *Frame
	closeChan chan struct{}
	closeOnce sync.Once
	closed    atomic.Bool
}

// NewConnection creates a new managed WebSocket connection.
func NewConnection(
	id string,
	identity middleware.Identity,
	conn *websocket.Conn,
	hub *Hub,
	registry *Registry,
	logger *slog.Logger,
) *Connection {
	return &Connection{
		id:        id,
		identity:  identity,
		conn:      conn,
		hub:       hub,
		registry:  registry,
		logger:    logger,
		send:      make(chan *Frame, 256),
		cmdCh:     make(chan *Frame, 256),
		closeChan: make(chan struct{}),
	}
}

// Send queues a frame to be written to the connection. Non-blocking; if full or closed, drops or closes.
func (c *Connection) Send(frame *Frame) bool {
	if c.closed.Load() {
		return false
	}
	select {
	case c.send <- frame:
		return true
	default:
		c.logger.Warn("ws send buffer full; dropping frame or closing",
			"conn_id", c.id, "device_id", c.identity.DeviceID)
		return false
	}
}

// Close closes the connection cleanly.
func (c *Connection) Close(code constants.ErrorCode, reason string) {
	c.closeOnce.Do(func() {
		c.closed.Store(true)
		close(c.closeChan)

		// Send an error frame explaining the close if possible
		if code != "" {
			_ = c.conn.SetWriteDeadline(time.Now().Add(time.Second))
			_ = c.conn.WriteJSON(NewProtocolErrorFrame(code, reason))
		}

		_ = c.conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, reason),
			time.Now().Add(time.Second),
		)
		_ = c.conn.Close()
		c.hub.Unregister(c)
	})
}

// ReadPump listens for inbound frames from the client.
func (c *Connection) ReadPump() {
	defer func() {
		c.Close(constants.CodeShutdown, "connection terminated")
	}()

	c.conn.SetReadLimit(constants.MaxWebSocketFrameBytes)
	_ = c.conn.SetReadDeadline(time.Now().Add(constants.WebSocketPingInterval + constants.WebSocketPongTimeout))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(constants.WebSocketPingInterval + constants.WebSocketPongTimeout))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				c.logger.Debug("ws read error", "conn_id", c.id, "error", err)
			}
			break
		}

		// Reset deadline on any valid message received
		_ = c.conn.SetReadDeadline(time.Now().Add(constants.WebSocketPingInterval + constants.WebSocketPongTimeout))

		var frame Frame
		if err := json.Unmarshal(message, &frame); err != nil {
			c.Send(NewProtocolErrorFrame(constants.CodeInvalidRequest, "invalid json payload"))
			continue
		}

		switch frame.Type {
		case TypePing:
			c.Send(NewPongFrame(frame.Timestamp))

		case TypePong:
			// Heartbeat acknowledged

		case TypeCommand:
			// Hand off to the worker instead of dispatching here: handlers
			// such as clipboard and audio shell out to PowerShell for
			// hundreds of milliseconds, and dispatching inline would stall
			// the read loop — every mouse move queued behind it would wait.
			// A single FIFO channel keeps command order intact.
			select {
			case c.cmdCh <- &frame:
			case <-c.closeChan:
				return
			}

		default:
			c.Send(NewProtocolErrorFrame(constants.CodeInvalidRequest, "unknown message type"))
		}
	}
}

// CommandPump dispatches queued commands in FIFO order on its own goroutine,
// so a slow handler can never block ReadPump (and therefore can never delay
// the mouse and keyboard frames behind it).
func (c *Connection) CommandPump(ctx context.Context) {
	for {
		select {
		case <-c.closeChan:
			return

		case frame := <-c.cmdCh:
			resp := c.registry.Dispatch(ctx, c.identity, frame)
			if resp != nil {
				c.Send(resp)
			}
		}
	}
}

// WritePump writes queued frames and periodic ping heartbeats to the client.
func (c *Connection) WritePump() {
	ticker := time.NewTicker(constants.WebSocketPingInterval)
	defer func() {
		ticker.Stop()
		c.Close(constants.CodeShutdown, "writer closed")
	}()

	for {
		select {
		case <-c.closeChan:
			return

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(constants.WebSocketWriteTimeout))
			if err := c.conn.WriteJSON(NewPingFrame()); err != nil {
				c.logger.Debug("ws ping write failed", "conn_id", c.id, "error", err)
				return
			}

		case frame, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(constants.WebSocketWriteTimeout))
			if !ok {
				return
			}
			if err := c.conn.WriteJSON(frame); err != nil {
				c.logger.Debug("ws frame write failed", "conn_id", c.id, "error", err)
				return
			}
		}
	}
}

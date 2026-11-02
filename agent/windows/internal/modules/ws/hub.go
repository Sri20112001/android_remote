package ws

import (
	"fmt"
	"log/slog"
	"sync"

	"github.com/tuf-remote/agent/internal/constants"
)

// Hub manages active WebSocket connections and handles event routing and broadcast.
type Hub struct {
	mu          sync.RWMutex
	connections map[*Connection]bool
	byDevice    map[string][]*Connection
	logger      *slog.Logger
}

// NewHub initializes a WebSocket Hub.
func NewHub(logger *slog.Logger) *Hub {
	return &Hub{
		connections: make(map[*Connection]bool),
		byDevice:    make(map[string][]*Connection),
		logger:      logger,
	}
}

// Register adds a connection to the hub, enforcing total and per-device limits.
func (h *Hub) Register(conn *Connection) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.connections) >= constants.MaxTotalWebSocketConnections {
		return fmt.Errorf("server connection limit reached")
	}

	deviceID := conn.identity.DeviceID
	if deviceID != "" {
		existing := h.byDevice[deviceID]
		if len(existing) >= constants.MaxWebSocketConnectionsPerDevice {
			// Evict the oldest connection
			oldest := existing[0]
			h.logger.Info("evicting older ws connection for device",
				"device_id", deviceID, "old_conn_id", oldest.id, "new_conn_id", conn.id)
			go oldest.Close(constants.CodeReplaced, "connection replaced by newer connection")
			h.byDevice[deviceID] = existing[1:]
		}
		h.byDevice[deviceID] = append(h.byDevice[deviceID], conn)
	}

	h.connections[conn] = true
	h.logger.Debug("ws client registered", "conn_id", conn.id, "device_id", deviceID, "total", len(h.connections))
	return nil
}

// Unregister removes a connection from the hub.
func (h *Hub) Unregister(conn *Connection) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if !h.connections[conn] {
		return
	}
	delete(h.connections, conn)

	deviceID := conn.identity.DeviceID
	if deviceID != "" {
		existing := h.byDevice[deviceID]
		filtered := make([]*Connection, 0, len(existing))
		for _, c := range existing {
			if c != conn {
				filtered = append(filtered, c)
			}
		}
		if len(filtered) == 0 {
			delete(h.byDevice, deviceID)
		} else {
			h.byDevice[deviceID] = filtered
		}
	}
	h.logger.Debug("ws client unregistered", "conn_id", conn.id, "device_id", deviceID, "total", len(h.connections))
}

// Broadcast sends an event frame to all connected clients.
func (h *Hub) Broadcast(event string, data any) {
	frame := NewEventFrame(event, data)
	h.mu.RLock()
	defer h.mu.RUnlock()

	for conn := range h.connections {
		conn.Send(frame)
	}
}

// SendToDevice sends an event frame to all active connections of a specific device.
func (h *Hub) SendToDevice(deviceID string, event string, data any) {
	frame := NewEventFrame(event, data)
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, conn := range h.byDevice[deviceID] {
		conn.Send(frame)
	}
}

// CloseAll terminates all active connections with a shutdown message.
func (h *Hub) CloseAll(reason string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for conn := range h.connections {
		go conn.Close(constants.CodeShutdown, reason)
	}
	h.connections = make(map[*Connection]bool)
	h.byDevice = make(map[string][]*Connection)
}

// ConnectionCount returns the number of active connections.
func (h *Hub) ConnectionCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.connections)
}

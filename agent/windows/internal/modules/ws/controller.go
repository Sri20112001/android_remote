package ws

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller handles the HTTP upgrade to WebSocket.
type Controller struct {
	hub       *Hub
	registry  *Registry
	validator middleware.TokenValidator
	logger    *slog.Logger
	upgrader  websocket.Upgrader
}

// NewController builds a new WebSocket controller.
func NewController(
	hub *Hub,
	registry *Registry,
	validator middleware.TokenValidator,
	logger *slog.Logger,
) *Controller {
	return &Controller{
		hub:       hub,
		registry:  registry,
		validator: validator,
		logger:    logger,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin: func(r *http.Request) bool {
				// Origin and DNS rebinding protections are already enforced by middleware.Guard
				return true
			},
		},
	}
}

// Connect handles GET /ws or GET /api/v1/ws.
func (ctl *Controller) Connect(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		authHeader := c.GetHeader("Authorization")
		const prefix = "Bearer "
		if len(authHeader) > len(prefix) && strings.EqualFold(authHeader[:len(prefix)], prefix) {
			token = strings.TrimSpace(authHeader[len(prefix):])
		}
	}

	if token == "" {
		utils.RespondError(c, http.StatusUnauthorized, constants.CodeUnauthorized, "device token required")
		return
	}

	identity, err := ctl.validator.ValidateToken(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, middleware.ErrInvalidToken) {
			utils.RespondError(c, http.StatusUnauthorized, constants.CodeUnauthorized, "invalid or expired token")
			return
		}
		ctl.logger.Error("ws token validation error", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "authentication check failed")
		return
	}

	conn, err := ctl.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		ctl.logger.Warn("ws upgrade failed", "error", err)
		return
	}

	connID := generateConnID()
	wsConn := NewConnection(connID, identity, conn, ctl.hub, ctl.registry, ctl.logger)

	if err := ctl.hub.Register(wsConn); err != nil {
		wsConn.Close(constants.CodeUnavailable, "server connection limit reached")
		return
	}

	go wsConn.WritePump()
	wsConn.ReadPump(c.Request.Context())
}

func generateConnID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

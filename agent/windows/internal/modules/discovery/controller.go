package discovery

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller exposes discovery endpoints over HTTP.
type Controller struct {
	svc    *Service
	port   int
	logger *slog.Logger
}

// NewController builds a discovery controller.
func NewController(svc *Service, port int, logger *slog.Logger) *Controller {
	return &Controller{
		svc:    svc,
		port:   port,
		logger: logger,
	}
}

// Info handles GET /discovery/info.
func (ctl *Controller) Info(c *gin.Context) {
	info, err := ctl.svc.GetInfo(c.Request.Context(), ctl.port)
	if err != nil {
		ctl.logger.Error("failed to get discovery info", "error", err)
		utils.RespondError(c, http.StatusServiceUnavailable, constants.CodeUnavailable, "system info unavailable")
		return
	}
	c.JSON(http.StatusOK, info)
}

// QR handles GET /discovery/qr (loopback only).
func (ctl *Controller) QR(c *gin.Context) {
	sessionID := c.Query("session_id")
	pin := c.Query("pin")

	payload, err := ctl.svc.GetQRPayload(c.Request.Context(), ctl.port, sessionID, pin)
	if err != nil {
		ctl.logger.Error("failed to get qr payload", "error", err)
		utils.RespondError(c, http.StatusServiceUnavailable, constants.CodeUnavailable, "system info unavailable")
		return
	}
	c.JSON(http.StatusOK, payload)
}

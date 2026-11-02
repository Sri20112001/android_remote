package health

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller translates HTTP requests into service calls and maps failures
// to the standard error envelope. It holds no business logic.
type Controller struct {
	service *Service
	logger  *slog.Logger
}

// NewController wires the health controller.
func NewController(service *Service, logger *slog.Logger) *Controller {
	return &Controller{service: service, logger: logger}
}

// Health answers GET /health.
func (c *Controller) Health(ctx *gin.Context) {
	utils.RespondJSON(ctx, http.StatusOK, c.service.Health())
}

// SystemInfo answers GET /system/info.
func (c *Controller) SystemInfo(ctx *gin.Context) {
	resp, err := c.service.SystemInfo(ctx.Request.Context())
	if err != nil {
		c.logger.Error("system information unavailable",
			"error", err,
			"request_id", middleware.RequestIDFromContext(ctx),
		)
		utils.RespondError(ctx, http.StatusServiceUnavailable, constants.CodeUnavailable, "system information is unavailable")
		return
	}
	utils.RespondJSON(ctx, http.StatusOK, resp)
}

// SystemStatus answers GET /system/status. A degraded system yields HTTP 503
// with a body that explains which component is failing.
func (c *Controller) SystemStatus(ctx *gin.Context) {
	resp, err := c.service.SystemStatus(ctx.Request.Context())
	if err != nil {
		c.logger.Warn("system status degraded",
			"error", err,
			"request_id", middleware.RequestIDFromContext(ctx),
		)
	}
	if resp.Status != StatusOK {
		utils.RespondJSON(ctx, http.StatusServiceUnavailable, resp)
		return
	}
	utils.RespondJSON(ctx, http.StatusOK, resp)
}

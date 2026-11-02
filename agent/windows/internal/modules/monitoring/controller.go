package monitoring

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller exposes system monitoring endpoints.
type Controller struct {
	svc    *Service
	logger *slog.Logger
}

// NewController builds a monitoring controller.
func NewController(svc *Service, logger *slog.Logger) *Controller {
	return &Controller{
		svc:    svc,
		logger: logger,
	}
}

// System handles GET /monitoring/system.
func (ctl *Controller) System(c *gin.Context) {
	metrics, err := ctl.svc.GetMetrics(c.Request.Context())
	if err != nil {
		ctl.logger.Error("failed to collect system metrics", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to collect system metrics")
		return
	}
	c.JSON(http.StatusOK, metrics)
}

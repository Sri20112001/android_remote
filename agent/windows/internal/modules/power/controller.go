package power

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller exposes power endpoints.
type Controller struct {
	svc    *Service
	logger *slog.Logger
}

// NewController builds a power controller.
func NewController(svc *Service, logger *slog.Logger) *Controller {
	return &Controller{
		svc:    svc,
		logger: logger,
	}
}

// Lock handles POST /power/lock.
func (ctl *Controller) Lock(c *gin.Context) {
	id := middleware.IdentityFromContext(c)
	if err := ctl.svc.Lock(c.Request.Context(), id); err != nil {
		ctl.logger.Error("power lock failed", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to lock workstation")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "locked"})
}

// Request handles POST /power/request.
func (ctl *Controller) Request(c *gin.Context) {
	id := middleware.IdentityFromContext(c)
	var req RequestPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json request body")
		return
	}

	resp, err := ctl.svc.RequestConfirmation(c.Request.Context(), id, req.Action)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Confirm handles POST /power/confirm.
func (ctl *Controller) Confirm(c *gin.Context) {
	id := middleware.IdentityFromContext(c)
	var req ConfirmPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json request body")
		return
	}

	resp, err := ctl.svc.Confirm(c.Request.Context(), id, req.ConfirmationToken)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, resp)
}

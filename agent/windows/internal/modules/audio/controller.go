package audio

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller handles audio HTTP requests.
type Controller struct {
	svc    *Service
	logger *slog.Logger
}

// NewController builds an audio controller.
func NewController(svc *Service, logger *slog.Logger) *Controller {
	return &Controller{
		svc:    svc,
		logger: logger,
	}
}

// GetVolume handles GET /audio/volume.
func (ctl *Controller) GetVolume(c *gin.Context) {
	status, err := ctl.svc.GetStatus()
	if err != nil {
		ctl.logger.Error("failed to get audio status", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to get audio status")
		return
	}
	c.JSON(http.StatusOK, status)
}

// SetVolume handles PUT /audio/volume.
func (ctl *Controller) SetVolume(c *gin.Context) {
	var req SetVolumePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json payload")
		return
	}

	if err := ctl.svc.SetVolume(req.Level); err != nil {
		ctl.logger.Error("failed to set volume", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to set volume")
		return
	}

	status, _ := ctl.svc.GetStatus()
	c.JSON(http.StatusOK, status)
}

// SetMute handles POST /audio/mute.
func (ctl *Controller) SetMute(c *gin.Context) {
	var req SetMutePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json payload")
		return
	}

	if err := ctl.svc.SetMute(req.Muted); err != nil {
		ctl.logger.Error("failed to set mute", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to set mute")
		return
	}

	status, _ := ctl.svc.GetStatus()
	c.JSON(http.StatusOK, status)
}

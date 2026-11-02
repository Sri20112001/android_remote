package input

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller handles mouse and keyboard HTTP endpoints.
type Controller struct {
	svc    *Service
	logger *slog.Logger
}

// NewController builds an input controller.
func NewController(svc *Service, logger *slog.Logger) *Controller {
	return &Controller{
		svc:    svc,
		logger: logger,
	}
}

// Mouse handles POST /input/mouse.
func (ctl *Controller) Mouse(c *gin.Context) {
	var req MousePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json payload")
		return
	}

	if err := ctl.svc.InjectMouse(req); err != nil {
		ctl.logger.Error("mouse injection failed", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to inject mouse event")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Keyboard handles POST /input/keyboard.
func (ctl *Controller) Keyboard(c *gin.Context) {
	var req KeyboardPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json payload")
		return
	}

	if err := ctl.svc.InjectKeyboard(req); err != nil {
		ctl.logger.Error("keyboard injection failed", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to inject keyboard event")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

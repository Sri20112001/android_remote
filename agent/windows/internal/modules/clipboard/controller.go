package clipboard

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller handles clipboard HTTP endpoints.
type Controller struct {
	svc    *Service
	logger *slog.Logger
}

// NewController builds a clipboard controller.
func NewController(svc *Service, logger *slog.Logger) *Controller {
	return &Controller{
		svc:    svc,
		logger: logger,
	}
}

// Get handles GET /clipboard.
func (ctl *Controller) Get(c *gin.Context) {
	text, err := ctl.svc.GetText()
	if err != nil {
		ctl.logger.Error("failed to get clipboard text", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to get clipboard text")
		return
	}
	c.JSON(http.StatusOK, Payload{Text: text})
}

// Set handles POST /clipboard.
func (ctl *Controller) Set(c *gin.Context) {
	var req Payload
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "invalid json payload")
		return
	}

	if err := ctl.svc.SetText(req.Text); err != nil {
		ctl.logger.Error("failed to set clipboard text", "error", err)
		utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to set clipboard text")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

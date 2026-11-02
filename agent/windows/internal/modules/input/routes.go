package input

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RegisterRoutes registers input endpoints on the router group.
func RegisterRoutes(rg gin.IRoutes, ctl *Controller, validator middleware.TokenValidator, logger *slog.Logger) {
	auth := middleware.RequireAuth(validator, logger)

	rg.POST(constants.RouteInputMouse, auth, ctl.Mouse)
	rg.POST(constants.RouteInputKeyboard, auth, ctl.Keyboard)
}

package clipboard

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RegisterRoutes registers clipboard endpoints on the router group.
func RegisterRoutes(rg gin.IRoutes, ctl *Controller, validator middleware.TokenValidator, logger *slog.Logger) {
	auth := middleware.RequireAuth(validator, logger)

	rg.GET(constants.RouteClipboard, auth, ctl.Get)
	rg.POST(constants.RouteClipboard, auth, ctl.Set)
}

package monitoring

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RegisterRoutes registers monitoring routes on the router group.
func RegisterRoutes(rg gin.IRoutes, ctl *Controller, validator middleware.TokenValidator, logger *slog.Logger) {
	rg.GET(constants.RouteMonitoringSystem, middleware.RequireAuth(validator, logger), ctl.System)
}

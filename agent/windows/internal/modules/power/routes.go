package power

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RegisterRoutes registers power routes on the router group.
func RegisterRoutes(rg gin.IRoutes, ctl *Controller, validator middleware.TokenValidator, logger *slog.Logger) {
	auth := middleware.RequireAuth(validator, logger)

	rg.POST(constants.RoutePowerLock, auth, ctl.Lock)
	rg.POST(constants.RoutePowerRequest, auth, ctl.Request)
	rg.POST(constants.RoutePowerConfirm, auth, ctl.Confirm)
}

package audio

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RegisterRoutes registers audio endpoints on the router group.
func RegisterRoutes(rg gin.IRoutes, ctl *Controller, validator middleware.TokenValidator, logger *slog.Logger) {
	auth := middleware.RequireAuth(validator, logger)

	rg.GET(constants.RouteAudioVolume, auth, ctl.GetVolume)
	rg.PUT(constants.RouteAudioVolume, auth, ctl.SetVolume)
	rg.POST(constants.RouteAudioMute, auth, ctl.SetMute)
}

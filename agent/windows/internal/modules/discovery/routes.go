package discovery

import (
	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RegisterRoutes attaches discovery endpoints to the router group.
func RegisterRoutes(rg gin.IRoutes, ctl *Controller) {
	rg.GET(constants.RouteDiscoveryInfo, ctl.Info)
	rg.GET(constants.RouteDiscoveryQR, middleware.RequireLocal(), ctl.QR)
}

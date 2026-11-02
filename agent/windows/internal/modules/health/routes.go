package health

import (
	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
)

// RegisterRoutes exposes the health endpoints on the API group. Route paths
// come from the central constants package; this function contains no
// business logic.
func RegisterRoutes(rg gin.IRoutes, controller *Controller) {
	rg.GET(constants.RouteHealth, controller.Health)
	rg.GET(constants.RouteSystemInfo, controller.SystemInfo)
	rg.GET(constants.RouteSystemStatus, controller.SystemStatus)
}

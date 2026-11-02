package ws

import (
	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
)

// RegisterRoutes registers the WebSocket upgrade route on the router group.
func RegisterRoutes(rg gin.IRoutes, controller *Controller) {
	rg.GET(constants.RouteWebSocket, controller.Connect)
}

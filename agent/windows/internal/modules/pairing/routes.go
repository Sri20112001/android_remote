package pairing

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// RouteDeps carries everything route registration needs. Keeping the
// middleware choice here (rather than in the controller) makes the
// protection of each endpoint visible at a glance.
type RouteDeps struct {
	Controller *Controller
	// Validator authenticates bearer tokens for the rotation endpoint.
	Validator middleware.TokenValidator
	// Logger is handed to the token middleware for infrastructure errors.
	Logger *slog.Logger
	// ConfirmLimiter caps pairing confirmations per client IP.
	ConfirmLimiter gin.HandlerFunc
}

// RegisterRoutes exposes the pairing endpoints on the API group. Route
// paths come from the central constants package; this function contains
// no business logic.
//
// Protection summary:
//   - start/devices/revoke: loopback only (the PC user acts locally);
//   - confirm: LAN facing, rate limited, PIN checked in constant time;
//   - rotate: strict bearer (proving possession of the credential).
func RegisterRoutes(rg gin.IRoutes, deps RouteDeps) {
	rg.POST(constants.RoutePairingStart,
		middleware.RequireLocal(), deps.Controller.Start)

	rg.POST(constants.RoutePairingConfirm,
		deps.ConfirmLimiter, deps.Controller.Confirm)

	rg.GET(constants.RoutePairingDevices,
		middleware.RequireLocal(), deps.Controller.Devices)

	rg.POST(constants.RoutePairingRevoke,
		middleware.RequireLocal(), deps.Controller.Revoke)

	rg.POST(constants.RouteAuthRotate,
		middleware.RequireToken(deps.Validator, deps.Logger), deps.Controller.Rotate)
}

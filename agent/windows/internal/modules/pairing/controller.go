package pairing

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/utils"
)

// Controller translates HTTP requests into service calls and maps failures
// onto the standard error envelope. It holds no business logic.
type Controller struct {
	service *Service
	logger  *slog.Logger
}

// NewController wires the pairing controller.
func NewController(service *Service, logger *slog.Logger) *Controller {
	return &Controller{service: service, logger: logger}
}

// Start answers POST /pairing/start (loopback only, enforced by
// RequireLocal). The PIN travels only in this response body.
func (c *Controller) Start(ctx *gin.Context) {
	resp, err := c.service.StartPairing(ctx.Request.Context())
	switch {
	case errors.Is(err, ErrTooManySessions):
		utils.RespondError(ctx, http.StatusConflict, constants.CodeConflict,
			"too many pairing sessions are open; close one or wait for one to expire")
		return
	case err != nil:
		c.fail(ctx, "pairing start", err)
		return
	}
	utils.RespondJSON(ctx, http.StatusCreated, resp)
}

// Confirm answers POST /pairing/confirm (device facing, rate limited).
func (c *Controller) Confirm(ctx *gin.Context) {
	var req ConfirmRequest
	if err := utils.DecodeJSON(ctx, &req, constants.DefaultMaxRequestBytes); err != nil {
		utils.RespondError(ctx, http.StatusBadRequest, constants.CodeInvalidRequest, err.Error())
		return
	}

	resp, err := c.service.ConfirmPairing(ctx.Request.Context(), req)
	switch {
	case errors.Is(err, ErrPINInvalid):
		// One generic answer for unknown, expired and burned sessions:
		// the caller cannot probe which.
		utils.RespondError(ctx, http.StatusUnauthorized, constants.CodeUnauthorized,
			"invalid or expired pairing PIN")
		return
	case errors.Is(err, ErrInvalidRequest):
		utils.RespondError(ctx, http.StatusBadRequest, constants.CodeInvalidRequest,
			"name is required and must be at most 64 characters")
		return
	case err != nil:
		c.fail(ctx, "pairing confirm", err)
		return
	}
	utils.RespondJSON(ctx, http.StatusCreated, resp)
}

// Devices answers GET /pairing/devices (loopback only).
func (c *Controller) Devices(ctx *gin.Context) {
	resp, err := c.service.ListDevices(ctx.Request.Context())
	if err != nil {
		c.fail(ctx, "list devices", err)
		return
	}
	utils.RespondJSON(ctx, http.StatusOK, resp)
}

// Revoke answers POST /pairing/revoke (loopback only).
func (c *Controller) Revoke(ctx *gin.Context) {
	var req RevokeRequest
	if err := utils.DecodeJSON(ctx, &req, constants.DefaultMaxRequestBytes); err != nil {
		utils.RespondError(ctx, http.StatusBadRequest, constants.CodeInvalidRequest, err.Error())
		return
	}

	resp, err := c.service.RevokeDevice(ctx.Request.Context(), req.DeviceID)
	switch {
	case errors.Is(err, ErrDeviceNotFound):
		utils.RespondError(ctx, http.StatusNotFound, constants.CodeNotFound, "device not found")
		return
	case errors.Is(err, ErrAlreadyRevoked):
		utils.RespondError(ctx, http.StatusConflict, constants.CodeConflict, "device is already revoked")
		return
	case errors.Is(err, ErrInvalidRequest):
		utils.RespondError(ctx, http.StatusBadRequest, constants.CodeInvalidRequest,
			"device_id is required")
		return
	case err != nil:
		c.fail(ctx, "revoke device", err)
		return
	}
	utils.RespondJSON(ctx, http.StatusOK, resp)
}

// Rotate answers POST /auth/rotate (strict bearer, enforced by
// RequireToken).
func (c *Controller) Rotate(ctx *gin.Context) {
	resp, err := c.service.RotateToken(ctx.Request.Context(), middleware.IdentityFromContext(ctx))
	switch {
	case errors.Is(err, middleware.ErrInvalidToken):
		utils.RespondError(ctx, http.StatusUnauthorized, constants.CodeUnauthorized,
			"invalid or expired token")
		return
	case err != nil:
		c.fail(ctx, "rotate token", err)
		return
	}
	utils.RespondJSON(ctx, http.StatusOK, resp)
}

// fail logs an unexpected failure with the request id and answers with a
// generic 500 so internals never reach the client.
func (c *Controller) fail(ctx *gin.Context, operation string, err error) {
	c.logger.Error("pairing operation failed",
		"operation", operation,
		"error", err,
		"request_id", middleware.RequestIDFromContext(ctx),
	)
	utils.RespondError(ctx, http.StatusInternalServerError, constants.CodeInternal,
		"internal server error")
}

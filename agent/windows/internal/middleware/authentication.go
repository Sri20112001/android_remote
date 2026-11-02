package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// ErrInvalidToken is returned by TokenValidator when a token is unknown,
// expired or revoked. Infrastructure failures must be wrapped differently
// so the middleware can distinguish 401 from 500.
var ErrInvalidToken = errors.New("authentication: invalid or expired token")

const identityContextKey = "auth_identity"

// Identity is the authenticated caller attached to a request. Local is true
// for requests that originated on this PC (loopback), which the agent
// treats as the machine's own user.
type Identity struct {
	DeviceID   string
	DeviceName string
	TokenID    string
	Local      bool
}

// TokenValidator resolves a raw bearer token to a device identity.
// Implemented by the pairing service.
type TokenValidator interface {
	ValidateToken(ctx context.Context, token string) (Identity, error)
}

// SetIdentity stores the authenticated caller in the request context.
func SetIdentity(c *gin.Context, id Identity) {
	c.Set(identityContextKey, id)
}

// IdentityFromContext returns the authenticated caller, or the zero value
// when the request was not authenticated.
func IdentityFromContext(c *gin.Context) Identity {
	if value, ok := c.Get(identityContextKey); ok {
		if id, ok := value.(Identity); ok {
			return id
		}
	}
	return Identity{}
}

// IsLoopback reports whether the request arrived from this machine.
func IsLoopback(c *gin.Context) bool {
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		host = c.Request.RemoteAddr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// RequireLocal restricts an endpoint to requests originating on this PC.
// It is the gate for pairing administration and other local-only actions.
func RequireLocal() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsLoopback(c) {
			utils.RespondError(c, 403, constants.CodeForbidden,
				"this endpoint is only available from the PC itself")
			c.Abort()
			return
		}
		SetIdentity(c, Identity{Local: true})
		c.Next()
	}
}

// RequireAuth accepts either a valid bearer token or a loopback caller
// (the machine's own user). Use it for feature endpoints from milestone 3
// onwards.
func RequireAuth(validator TokenValidator, logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		if IsLoopback(c) {
			SetIdentity(c, Identity{Local: true})
			c.Next()
			return
		}
		authenticate(c, validator, logger)
	}
}

// RequireToken demands a valid bearer token even from loopback: the caller
// must prove possession of the credential (used for token rotation).
func RequireToken(validator TokenValidator, logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		authenticate(c, validator, logger)
	}
}

// authenticate resolves the Authorization header or aborts the request.
func authenticate(c *gin.Context, validator TokenValidator, logger *slog.Logger) {
	raw, ok := bearerToken(c.GetHeader("Authorization"))
	if !ok {
		utils.RespondError(c, 401, constants.CodeUnauthorized, "authentication required")
		c.Abort()
		return
	}

	id, err := validator.ValidateToken(c.Request.Context(), raw)
	switch {
	case errors.Is(err, ErrInvalidToken):
		utils.RespondError(c, 401, constants.CodeUnauthorized, "invalid or expired token")
		c.Abort()
	case err != nil:
		// Infrastructure failure: log it (never the token) and fail closed.
		logger.Error("token validation failed",
			"error", err,
			"path", c.Request.URL.Path,
			"request_id", RequestIDFromContext(c),
		)
		utils.RespondError(c, 500, constants.CodeInternal, "internal server error")
		c.Abort()
	default:
		SetIdentity(c, id)
		c.Next()
	}
}

// bearerToken extracts the credential from an Authorization header.
func bearerToken(header string) (string, bool) {
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	if token == "" {
		return "", false
	}
	return token, true
}

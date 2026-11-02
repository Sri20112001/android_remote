package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
)

// RequestID guarantees that every request carries a correlation ID: an
// incoming X-Request-ID is reused (bounded in length), otherwise a
// cryptographically random one is generated. The ID is stored in the
// context, echoed in the response header and included in log lines.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(constants.RequestIDHeader)
		if id == "" || len(id) > constants.MaxRequestIDLength {
			id = newRequestID()
		}
		c.Set(constants.RequestIDContextKey, id)
		c.Header(constants.RequestIDHeader, id)
		c.Next()
	}
}

// RequestIDFromContext returns the correlation ID of the current request, or
// an empty string when the middleware is not installed.
func RequestIDFromContext(c *gin.Context) string {
	if value, ok := c.Get(constants.RequestIDContextKey); ok {
		if id, ok := value.(string); ok {
			return id
		}
	}
	return ""
}

// newRequestID renders 128 bits of cryptographic randomness as hex.
func newRequestID() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		// crypto/rand has no documented failure mode on Windows; fall back
		// to a nanosecond timestamp so the request is never dropped.
		return "t" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(buf[:])
}

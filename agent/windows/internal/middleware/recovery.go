package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Recovery converts a panic into a standard JSON 500 response, logs the
// stack trace with the request context and keeps the process alive. The
// panic value itself is never sent to the client.
func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.LogAttrs(c.Request.Context(), slog.LevelError, "panic recovered",
					slog.String("error", fmt.Sprint(recovered)),
					slog.String("stack", string(debug.Stack())),
					slog.String("method", c.Request.Method),
					slog.String("path", c.Request.URL.Path),
					slog.String("request_id", RequestIDFromContext(c)),
				)
				utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "internal server error")
				c.Abort()
			}
		}()
		c.Next()
	}
}

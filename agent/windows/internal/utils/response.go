// Package utils holds small transport-level helpers shared by every module.
package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
)

// errorDetail is the machine-readable part of a failed response.
type errorDetail struct {
	Code    constants.ErrorCode `json:"code"`
	Message string              `json:"message"`
}

// errorEnvelope is the standard shape of every failed API response.
type errorEnvelope struct {
	Error errorDetail `json:"error"`
}

// RespondJSON writes a success payload with the given status code.
func RespondJSON(c *gin.Context, status int, payload any) {
	c.JSON(status, payload)
}

// RespondError writes the standard error envelope and aborts the handler
// chain so no further handler can overwrite the response.
func RespondError(c *gin.Context, status int, code constants.ErrorCode, message string) {
	c.AbortWithStatusJSON(status, errorEnvelope{
		Error: errorDetail{Code: code, Message: message},
	})
}

// StatusForErrorCode maps well-known error codes to HTTP statuses. Modules
// can pass an explicit status instead when the mapping is context specific.
func StatusForErrorCode(code constants.ErrorCode) int {
	switch code {
	case constants.CodeInvalidRequest:
		return http.StatusBadRequest
	case constants.CodeUnauthorized:
		return http.StatusUnauthorized
	case constants.CodeForbidden:
		return http.StatusForbidden
	case constants.CodeNotFound:
		return http.StatusNotFound
	case constants.CodeMethodNotAllowed:
		return http.StatusMethodNotAllowed
	case constants.CodeConflict:
		return http.StatusConflict
	case constants.CodeRateLimited:
		return http.StatusTooManyRequests
	case constants.CodeUnsupported:
		return http.StatusNotImplemented
	case constants.CodeUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

// DecodeJSON parses a request body into dst with strict rules:
// the body is capped at maxBytes, unknown fields are rejected and exactly
// one JSON value is expected. The returned error is safe to show to the
// client.
func DecodeJSON(c *gin.Context, dst any, maxBytes int64) error {
	if maxBytes > 0 {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
	}
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		var sizeErr *http.MaxBytesError
		if errors.As(err, &sizeErr) {
			return fmt.Errorf("request body exceeds the %d byte limit", maxBytes)
		}
		return fmt.Errorf("malformed JSON body: %w", err)
	}
	// Reject trailing content such as "{} {}" or a second value.
	if err := decoder.Decode(&json.RawMessage{}); err != io.EOF {
		return fmt.Errorf("request body must contain exactly one JSON object")
	}
	return nil
}

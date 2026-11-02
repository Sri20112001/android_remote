package constants

// ErrorCode is a stable, machine-readable identifier carried in API error
// responses. Clients must switch on the code, never on the message.
type ErrorCode string

const (
	// CodeInvalidRequest marks a malformed or semantically invalid request.
	CodeInvalidRequest ErrorCode = "invalid_request"
	// CodeUnauthorized marks a missing or invalid credential.
	CodeUnauthorized ErrorCode = "unauthorized"
	// CodeForbidden marks a valid credential lacking permission.
	CodeForbidden ErrorCode = "forbidden"
	// CodeNotFound marks an unknown endpoint or resource.
	CodeNotFound ErrorCode = "not_found"
	// CodeMethodNotAllowed marks an HTTP method the endpoint does not accept.
	CodeMethodNotAllowed ErrorCode = "method_not_allowed"
	// CodeConflict marks a request conflicting with current state.
	CodeConflict ErrorCode = "conflict"
	// CodeRateLimited marks a client that exceeded its request budget.
	CodeRateLimited ErrorCode = "rate_limited"
	// CodeUnsupported marks a valid request the platform cannot serve.
	CodeUnsupported ErrorCode = "unsupported"
	// CodeUnavailable marks a temporarily unavailable dependency.
	CodeUnavailable ErrorCode = "unavailable"
	// CodeInternal marks an unexpected server-side failure.
	CodeInternal ErrorCode = "internal_error"

	// CodeMessageTooBig marks an inbound frame exceeding the frame size limit.
	CodeMessageTooBig ErrorCode = "message_too_big"
	// CodeAuthFailed marks a WebSocket connection where authentication failed.
	CodeAuthFailed ErrorCode = "auth_failed"
	// CodeReplaced marks an older connection closed because a newer connection arrived.
	CodeReplaced ErrorCode = "replaced"
	// CodeShutdown marks a connection closed during agent shutdown.
	CodeShutdown ErrorCode = "shutdown"
)

package constants

import "time"

// Server, database and request limits. These are *defaults*; every value can
// be overridden through the configuration file or the environment.
const (
	// DefaultReadHeaderTimeout bounds reading request headers.
	DefaultReadHeaderTimeout = 5 * time.Second
	// DefaultReadTimeout bounds reading the whole request.
	DefaultReadTimeout = 15 * time.Second
	// DefaultWriteTimeout bounds writing a response.
	DefaultWriteTimeout = 30 * time.Second
	// DefaultIdleTimeout bounds keep-alive connections.
	DefaultIdleTimeout = 60 * time.Second
	// DefaultMaxRequestBytes caps a request body (1 MiB).
	DefaultMaxRequestBytes = int64(1 << 20)
	// DefaultMaxHeaderBytes caps request header size (1 MiB).
	DefaultMaxHeaderBytes = 1 << 20
	// DefaultShutdownTimeout bounds graceful shutdown.
	DefaultShutdownTimeout = 10 * time.Second
	// DefaultOpenTimeout bounds the initial database connection check.
	DefaultOpenTimeout = 5 * time.Second
	// DefaultDatabasePingTimeout bounds the database health ping.
	DefaultDatabasePingTimeout = 2 * time.Second
	// DefaultDatabaseBusyTimeout is the SQLite busy timeout applied to every
	// connection.
	DefaultDatabaseBusyTimeout = 5 * time.Second

	// RequestIDHeader carries the per-request correlation ID.
	RequestIDHeader = "X-Request-ID"
	// RequestIDContextKey stores the correlation ID in the request context.
	RequestIDContextKey = "request_id"
	// MaxRequestIDLength rejects absurdly long incoming correlation IDs.
	MaxRequestIDLength = 64

	// PINLength is the number of digits in a pairing PIN.
	PINLength = 6
	// DefaultPINTTL bounds a pairing session (configurable).
	DefaultPINTTL = 5 * time.Minute
	// DefaultPINAttempts is the number of wrong PINs a session tolerates
	// before it is burned (0 for unlimited).
	DefaultPINAttempts = 0
	// DefaultMaxPairingSessions caps concurrently open pairing sessions
	// (0 for unlimited, or auto-evicts oldest when full).
	DefaultMaxPairingSessions = 10
	// TokenBytes is the entropy of a device token (256 bits).
	TokenBytes = 32
	// TokenPrefixLength is how many leading characters of a token are kept
	// in clear text for identification (non-secret).
	TokenPrefixLength = 12
	// DefaultTokenGracePeriod keeps a rotated token valid briefly so
	// in-flight requests do not fail (configurable).
	DefaultTokenGracePeriod = 30 * time.Second
	// DefaultConfirmRateLimit caps pairing confirmations per client IP per
	// minute (0 disables rate limiting).
	DefaultConfirmRateLimit = 0
	// TokenLastUsedStaleness throttles last-seen writes to at most one per
	// window per token.
	TokenLastUsedStaleness = time.Minute

	// MaxDeviceNameLength bounds the device display name.
	MaxDeviceNameLength = 64
	// MaxDeviceMetaLength bounds model and OS version strings.
	MaxDeviceMetaLength = 128
	// MaxSessionIDLength bounds the pairing session identifier.
	MaxSessionIDLength = 64

	// MaxWebSocketFrameBytes caps an inbound WebSocket frame (64 KiB).
	MaxWebSocketFrameBytes = int64(64 * 1024)
	// WebSocketPingInterval is the duration between server-sent ping heartbeats.
	WebSocketPingInterval = 30 * time.Second
	// WebSocketPongTimeout is the maximum wait time for a client pong reply.
	WebSocketPongTimeout = 10 * time.Second
	// WebSocketWriteTimeout bounds writing a frame to the WebSocket.
	WebSocketWriteTimeout = 5 * time.Second
	// MaxWebSocketConnectionsPerDevice bounds concurrent connections per device.
	MaxWebSocketConnectionsPerDevice = 2
	// MaxTotalWebSocketConnections bounds concurrent connections overall.
	MaxTotalWebSocketConnections = 20
)

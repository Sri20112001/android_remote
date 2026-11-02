// Package constants centralises application-wide constants: identity,
// defaults, route paths, limits and error codes. Values that must stay
// configurable at runtime are referenced here only as *defaults* and live in
// the configuration afterwards.
package constants

const (
	// AppName is the human-readable name of the application.
	AppName = "TUF Remote"
	// AppVersion is the semantic version of the agent.
	AppVersion = "0.1.0"
	// DefaultPort is the TCP port the HTTP server listens on when no
	// configuration is supplied.
	DefaultPort = 8765
	// APIPrefix is the base path shared by every versioned REST endpoint.
	APIPrefix = "/api/v1"
	// DefaultConfigPath is probed when neither the -config flag nor the
	// configuration environment variable points at a file.
	DefaultConfigPath = "configs/config.yaml"
)

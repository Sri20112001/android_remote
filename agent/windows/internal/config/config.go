// Package config loads and validates the agent configuration. Sources are
// layered: built-in defaults, then an optional YAML file, then
// TUF_REMOTE_* environment variables, then validation.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/tuf-remote/agent/internal/constants"
)

// EnvConfigPath names the environment variable that points at a
// configuration file (same role as the -config command line flag).
const EnvConfigPath = "TUF_REMOTE_CONFIG"

// envPrefix is prepended to every supported environment override.
const envPrefix = "TUF_REMOTE_"

// Config is the root configuration of the agent.
type Config struct {
	Agent    AgentConfig    `yaml:"agent"`
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Logging  LoggingConfig  `yaml:"logging"`
	Security SecurityConfig `yaml:"security"`
}

// AgentConfig describes the identity of this agent on the network.
type AgentConfig struct {
	// Name is the friendly name shown to paired devices.
	Name string `yaml:"name"`
}

// ServerConfig controls the HTTP listener.
type ServerConfig struct {
	// Host is the bind address. The default (127.0.0.1) keeps the agent
	// local-only; use 0.0.0.0 to expose it on the LAN (TLS required for
	// production LAN use).
	Host string `yaml:"host"`
	// Port is the TCP port; 0 asks the OS for an ephemeral port (tests).
	Port int `yaml:"port"`
	// ReadHeaderTimeout mirrors http.Server.ReadHeaderTimeout.
	ReadHeaderTimeout Duration `yaml:"read_header_timeout"`
	// ReadTimeout mirrors http.Server.ReadTimeout.
	ReadTimeout Duration `yaml:"read_timeout"`
	// WriteTimeout mirrors http.Server.WriteTimeout.
	WriteTimeout Duration `yaml:"write_timeout"`
	// IdleTimeout mirrors http.Server.IdleTimeout.
	IdleTimeout Duration `yaml:"idle_timeout"`
	// MaxRequestBytes caps request bodies for ordinary endpoints.
	MaxRequestBytes int64 `yaml:"max_request_bytes"`
	// TLS configures transport encryption.
	TLS TLSConfig `yaml:"tls"`
}

// TLSConfig controls transport security.
type TLSConfig struct {
	// Enabled turns on TLS for the HTTP listener.
	Enabled bool `yaml:"enabled"`
	// CertFile is the PEM certificate (leaf or full chain) path.
	CertFile string `yaml:"cert_file"`
	// KeyFile is the PEM private key path.
	KeyFile string `yaml:"key_file"`
}

// DatabaseConfig locates the SQLite database.
type DatabaseConfig struct {
	// Path is the database file; parent directories are created on demand.
	Path string `yaml:"path"`
	// BusyTimeout is how long SQLite waits for a locked database.
	BusyTimeout Duration `yaml:"busy_timeout"`
}

// LoggingConfig controls structured logging.
type LoggingConfig struct {
	// Level is one of debug, info, warn, error.
	Level string `yaml:"level"`
	// Format is one of text, json.
	Format string `yaml:"format"`
}

// SecurityConfig groups the pairing and authentication controls.
type SecurityConfig struct {
	// Pairing configures the PIN-based pairing flow.
	Pairing PairingConfig `yaml:"pairing"`
	// RateLimit configures request budgets for unauthenticated endpoints.
	RateLimit RateLimitConfig `yaml:"rate_limit"`
	// AllowedHosts lists extra hostnames the agent answers for (DNS
	// rebinding defence). IP literals, localhost and this machine's own
	// hostname are always accepted.
	AllowedHosts []string `yaml:"allowed_hosts"`
}

// PairingConfig controls the pairing session lifecycle.
type PairingConfig struct {
	// PINTTL is how long an opened pairing session stays valid.
	PINTTL Duration `yaml:"pin_ttl"`
	// MaxAttempts is how many wrong PINs a session tolerates before it is
	// burned.
	MaxAttempts int `yaml:"max_attempts"`
	// MaxActiveSessions caps concurrently open sessions.
	MaxActiveSessions int `yaml:"max_active_sessions"`
	// TokenGracePeriod keeps a rotated token valid briefly so in-flight
	// requests do not fail.
	TokenGracePeriod Duration `yaml:"token_grace_period"`
}

// RateLimitConfig sets per-client budgets for unauthenticated endpoints.
type RateLimitConfig struct {
	// ConfirmPerMinute caps POST /pairing/confirm attempts per client IP.
	ConfirmPerMinute int `yaml:"confirm_per_minute"`
}

// Defaults returns the built-in configuration used when no file or
// environment override is present. It always passes Validate.
func Defaults() *Config {
	return &Config{
		Agent: AgentConfig{Name: constants.AppName},
		Server: ServerConfig{
			Host:              "127.0.0.1",
			Port:              constants.DefaultPort,
			ReadHeaderTimeout: Duration(constants.DefaultReadHeaderTimeout),
			ReadTimeout:       Duration(constants.DefaultReadTimeout),
			WriteTimeout:      Duration(constants.DefaultWriteTimeout),
			IdleTimeout:       Duration(constants.DefaultIdleTimeout),
			MaxRequestBytes:   constants.DefaultMaxRequestBytes,
		},
		Database: DatabaseConfig{
			Path:        constants.DefaultDatabasePath,
			BusyTimeout: Duration(constants.DefaultDatabaseBusyTimeout),
		},
		Logging: LoggingConfig{Level: "info", Format: "text"},
		Security: SecurityConfig{
			Pairing: PairingConfig{
				PINTTL:            Duration(constants.DefaultPINTTL),
				MaxAttempts:       constants.DefaultPINAttempts,
				MaxActiveSessions: constants.DefaultMaxPairingSessions,
				TokenGracePeriod:  Duration(constants.DefaultTokenGracePeriod),
			},
			RateLimit: RateLimitConfig{
				ConfirmPerMinute: constants.DefaultConfirmRateLimit,
			},
		},
	}
}

// Load builds the effective configuration. path may be empty, which selects
// defaults plus environment overrides only.
func Load(path string) (*Config, error) {
	cfg := Defaults()
	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read configuration file: %w", err)
		}
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("parse configuration file %s: %w", path, err)
		}
	}
	if err := applyEnv(cfg); err != nil {
		return nil, err
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// applyEnv overlays TUF_REMOTE_* variables on top of the current values.
// Empty variable values are ignored so tests (and users) can clear an
// override with an empty string.
func applyEnv(cfg *Config) error {
	if v := os.Getenv(envPrefix + "AGENT_NAME"); v != "" {
		cfg.Agent.Name = v
	}
	if v := os.Getenv(envPrefix + "SERVER_HOST"); v != "" {
		cfg.Server.Host = v
	}
	if v := os.Getenv(envPrefix + "SERVER_PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("%sSERVER_PORT: %q is not an integer", envPrefix, v)
		}
		cfg.Server.Port = port
	}
	if v := os.Getenv(envPrefix + "SERVER_TLS_ENABLED"); v != "" {
		enabled, err := strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("%sSERVER_TLS_ENABLED: %q is not a boolean", envPrefix, v)
		}
		cfg.Server.TLS.Enabled = enabled
	}
	if v := os.Getenv(envPrefix + "SERVER_TLS_CERT_FILE"); v != "" {
		cfg.Server.TLS.CertFile = v
	}
	if v := os.Getenv(envPrefix + "SERVER_TLS_KEY_FILE"); v != "" {
		cfg.Server.TLS.KeyFile = v
	}
	if v := os.Getenv(envPrefix + "DATABASE_PATH"); v != "" {
		cfg.Database.Path = v
	}
	if v := os.Getenv(envPrefix + "LOGGING_LEVEL"); v != "" {
		cfg.Logging.Level = v
	}
	if v := os.Getenv(envPrefix + "LOGGING_FORMAT"); v != "" {
		cfg.Logging.Format = v
	}
	if v := os.Getenv(envPrefix + "SECURITY_PAIRING_PIN_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return fmt.Errorf("%sSECURITY_PAIRING_PIN_TTL: %q is not a duration: %w", envPrefix, v, err)
		}
		cfg.Security.Pairing.PINTTL = Duration(d)
	}
	if v := os.Getenv(envPrefix + "SECURITY_PAIRING_MAX_ATTEMPTS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("%sSECURITY_PAIRING_MAX_ATTEMPTS: %q is not an integer", envPrefix, v)
		}
		cfg.Security.Pairing.MaxAttempts = n
	}
	if v := os.Getenv(envPrefix + "SECURITY_PAIRING_MAX_ACTIVE_SESSIONS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("%sSECURITY_PAIRING_MAX_ACTIVE_SESSIONS: %q is not an integer", envPrefix, v)
		}
		cfg.Security.Pairing.MaxActiveSessions = n
	}
	if v := os.Getenv(envPrefix + "SECURITY_PAIRING_TOKEN_GRACE_PERIOD"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return fmt.Errorf("%sSECURITY_PAIRING_TOKEN_GRACE_PERIOD: %q is not a duration: %w", envPrefix, v, err)
		}
		cfg.Security.Pairing.TokenGracePeriod = Duration(d)
	}
	if v := os.Getenv(envPrefix + "SECURITY_RATE_LIMIT_CONFIRM_PER_MINUTE"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("%sSECURITY_RATE_LIMIT_CONFIRM_PER_MINUTE: %q is not an integer", envPrefix, v)
		}
		cfg.Security.RateLimit.ConfirmPerMinute = n
	}
	if v := os.Getenv(envPrefix + "SECURITY_ALLOWED_HOSTS"); v != "" {
		// Comma-separated list of extra hostnames.
		cfg.Security.AllowedHosts = splitList(v)
	}
	return nil
}

// splitList parses a comma-separated host list, trimming spaces.
func splitList(v string) []string {
	var out []string
	for _, item := range strings.Split(v, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

// Duration is a time.Duration that (de)serialises as a YAML string such as
// "5s" or "1m30s".
type Duration time.Duration

// UnmarshalYAML implements yaml.Unmarshaler.
func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	var raw string
	if err := node.Decode(&raw); err != nil {
		return fmt.Errorf("duration must be a quoted string such as \"5s\": %w", err)
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return fmt.Errorf("invalid duration %q: %w", raw, err)
	}
	*d = Duration(parsed)
	return nil
}

// MarshalYAML implements yaml.Marshaler.
func (d Duration) MarshalYAML() (any, error) {
	return time.Duration(d).String(), nil
}

// Duration returns the underlying time.Duration value.
func (d Duration) Duration() time.Duration { return time.Duration(d) }

// String implements fmt.Stringer.
func (d Duration) String() string { return time.Duration(d).String() }

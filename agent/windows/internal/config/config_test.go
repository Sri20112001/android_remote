package config_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
)

// clearEnv blanks every supported override so tests are hermetic regardless
// of the developer machine's environment.
func clearEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"AGENT_NAME",
		"SERVER_HOST",
		"SERVER_PORT",
		"SERVER_TLS_ENABLED",
		"SERVER_TLS_CERT_FILE",
		"SERVER_TLS_KEY_FILE",
		"DATABASE_PATH",
		"LOGGING_LEVEL",
		"LOGGING_FORMAT",
		"SECURITY_PAIRING_PIN_TTL",
		"SECURITY_PAIRING_MAX_ATTEMPTS",
		"SECURITY_PAIRING_MAX_ACTIVE_SESSIONS",
		"SECURITY_PAIRING_TOKEN_GRACE_PERIOD",
		"SECURITY_RATE_LIMIT_CONFIRM_PER_MINUTE",
		"SECURITY_ALLOWED_HOSTS",
	} {
		t.Setenv("TUF_REMOTE_"+key, "")
	}
}

func TestDefaultsAreValid(t *testing.T) {
	clearEnv(t)

	cfg := config.Defaults()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("defaults must validate, got: %v", err)
	}
	if cfg.Server.Host != "127.0.0.1" {
		t.Errorf("default host = %q, want loopback binding", cfg.Server.Host)
	}
	if cfg.Server.Port != constants.DefaultPort {
		t.Errorf("default port = %d, want %d", cfg.Server.Port, constants.DefaultPort)
	}
	if cfg.Server.TLS.Enabled {
		t.Error("TLS must be disabled by default so local development works out of the box")
	}
}

func TestLoadWithoutFileUsesDefaults(t *testing.T) {
	clearEnv(t)

	cfg, err := config.Load("")
	if err != nil {
		t.Fatalf("Load(\"\") failed: %v", err)
	}
	if cfg.Database.Path != constants.DefaultDatabasePath {
		t.Errorf("database path = %q, want %q", cfg.Database.Path, constants.DefaultDatabasePath)
	}
}

func TestLoadFileThenEnvPrecedence(t *testing.T) {
	clearEnv(t)

	path := filepath.Join(t.TempDir(), "config.yaml")
	yaml := `
agent:
  name: Office PC
server:
  host: 0.0.0.0
  port: 9000
  read_timeout: 7s
database:
  path: custom.db
logging:
  level: debug
  format: json
`
	if err := os.WriteFile(path, []byte(yaml), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	// Environment must win over the file.
	t.Setenv("TUF_REMOTE_SERVER_PORT", "9100")

	cfg, err := config.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if cfg.Agent.Name != "Office PC" {
		t.Errorf("agent.name = %q", cfg.Agent.Name)
	}
	if cfg.Server.Host != "0.0.0.0" {
		t.Errorf("server.host = %q", cfg.Server.Host)
	}
	if cfg.Server.Port != 9100 {
		t.Errorf("server.port = %d, want env value 9100", cfg.Server.Port)
	}
	if got := cfg.Server.ReadTimeout.Duration(); got != 7*time.Second {
		t.Errorf("read_timeout = %s, want 7s", got)
	}
	if cfg.Database.Path != "custom.db" {
		t.Errorf("database.path = %q", cfg.Database.Path)
	}
	if cfg.Logging.Level != "debug" || cfg.Logging.Format != "json" {
		t.Errorf("logging = %+v", cfg.Logging)
	}
}

func TestLoadMissingFileFails(t *testing.T) {
	clearEnv(t)

	_, err := config.Load(filepath.Join(t.TempDir(), "absent.yaml"))
	if err == nil {
		t.Fatal("expected an error for a missing config file")
	}
	if !strings.Contains(err.Error(), "read configuration file") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadRejectsBadDuration(t *testing.T) {
	clearEnv(t)

	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("server:\n  read_timeout: banana\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	_, err := config.Load(path)
	if err == nil || !strings.Contains(err.Error(), "invalid duration") {
		t.Fatalf("expected invalid duration error, got: %v", err)
	}
}

func TestLoadRejectsBadEnvPort(t *testing.T) {
	clearEnv(t)
	t.Setenv("TUF_REMOTE_SERVER_PORT", "eight-thousand")

	_, err := config.Load("")
	if err == nil || !strings.Contains(err.Error(), "SERVER_PORT") {
		t.Fatalf("expected SERVER_PORT error, got: %v", err)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	clearEnv(t)

	path := filepath.Join(t.TempDir(), "config.yaml")
	yaml := `
server:
  port: 70000
logging:
  level: chatty
`
	if err := os.WriteFile(path, []byte(yaml), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	_, err := config.Load(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	for _, want := range []string{"server.port", "logging.level"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}

// TestExampleConfigIsValid keeps configs/config.example.yaml honest: the
// shipped example must always load and validate, so documentation drift
// fails the build instead of surprising an operator.
func TestExampleConfigIsValid(t *testing.T) {
	clearEnv(t)

	cfg, err := config.Load(filepath.Join("..", "..", "configs", "config.example.yaml"))
	if err != nil {
		t.Fatalf("example config must load and validate: %v", err)
	}
	if cfg.Server.Host != "127.0.0.1" || cfg.Server.Port != 8765 {
		t.Errorf("server = %s:%d", cfg.Server.Host, cfg.Server.Port)
	}
	if got := cfg.Security.Pairing.PINTTL.Duration(); got != constants.DefaultPINTTL {
		t.Errorf("pin_ttl = %v, want %v", got, constants.DefaultPINTTL)
	}
	if cfg.Security.Pairing.MaxAttempts != constants.DefaultPINAttempts {
		t.Errorf("max_attempts = %d", cfg.Security.Pairing.MaxAttempts)
	}
	if cfg.Security.Pairing.MaxActiveSessions != constants.DefaultMaxPairingSessions {
		t.Errorf("max_active_sessions = %d", cfg.Security.Pairing.MaxActiveSessions)
	}
	if got := cfg.Security.Pairing.TokenGracePeriod.Duration(); got != constants.DefaultTokenGracePeriod {
		t.Errorf("token_grace_period = %v", got)
	}
	if cfg.Security.RateLimit.ConfirmPerMinute != constants.DefaultConfirmRateLimit {
		t.Errorf("confirm_per_minute = %d", cfg.Security.RateLimit.ConfirmPerMinute)
	}
	if len(cfg.Security.AllowedHosts) != 0 {
		t.Errorf("allowed_hosts = %v, want empty by default", cfg.Security.AllowedHosts)
	}
}

func TestSecurityEnvOverrides(t *testing.T) {
	clearEnv(t)
	t.Setenv("TUF_REMOTE_SECURITY_PAIRING_PIN_TTL", "2m")
	t.Setenv("TUF_REMOTE_SECURITY_PAIRING_MAX_ATTEMPTS", "7")
	t.Setenv("TUF_REMOTE_SECURITY_PAIRING_MAX_ACTIVE_SESSIONS", "4")
	t.Setenv("TUF_REMOTE_SECURITY_PAIRING_TOKEN_GRACE_PERIOD", "45s")
	t.Setenv("TUF_REMOTE_SECURITY_RATE_LIMIT_CONFIRM_PER_MINUTE", "5")
	t.Setenv("TUF_REMOTE_SECURITY_ALLOWED_HOSTS", "my-pc.local, LivingRoom")

	cfg, err := config.Load("")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got := cfg.Security.Pairing.PINTTL.Duration(); got != 2*time.Minute {
		t.Errorf("pin_ttl = %v, want 2m", got)
	}
	if cfg.Security.Pairing.MaxAttempts != 7 {
		t.Errorf("max_attempts = %d, want 7", cfg.Security.Pairing.MaxAttempts)
	}
	if cfg.Security.Pairing.MaxActiveSessions != 4 {
		t.Errorf("max_active_sessions = %d, want 4", cfg.Security.Pairing.MaxActiveSessions)
	}
	if got := cfg.Security.Pairing.TokenGracePeriod.Duration(); got != 45*time.Second {
		t.Errorf("grace = %v, want 45s", got)
	}
	if cfg.Security.RateLimit.ConfirmPerMinute != 5 {
		t.Errorf("confirm_per_minute = %d, want 5", cfg.Security.RateLimit.ConfirmPerMinute)
	}
	if len(cfg.Security.AllowedHosts) != 2 ||
		cfg.Security.AllowedHosts[0] != "my-pc.local" ||
		cfg.Security.AllowedHosts[1] != "LivingRoom" {
		t.Errorf("allowed_hosts = %v", cfg.Security.AllowedHosts)
	}
}

func TestSecurityEnvRejectsBadValues(t *testing.T) {
	clearEnv(t)
	t.Setenv("TUF_REMOTE_SECURITY_PAIRING_PIN_TTL", "soon")

	_, err := config.Load("")
	if err == nil {
		t.Fatal("a non-duration pin_ttl must fail the load")
	}
	if !strings.Contains(err.Error(), "SECURITY_PAIRING_PIN_TTL") {
		t.Errorf("error %q must name the offending variable", err)
	}
}

func TestValidationRejectsBadAllowedHosts(t *testing.T) {
	clearEnv(t)

	cases := []struct {
		name  string
		hosts []string
		want  string
	}{
		{"scheme", []string{"https://evil.example"}, "security.allowed_hosts"},
		{"port", []string{"pc.example:8765"}, "security.allowed_hosts"},
		{"empty entry", []string{"ok", ""}, "security.allowed_hosts"},
		{"duplicate", []string{"pc.local", "PC.local."}, "duplicate"},
		{"too many", make([]string, 33), "at most 32"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := config.Defaults()
			cfg.Security.AllowedHosts = tc.hosts

			err := cfg.Validate()
			if err == nil {
				t.Fatal("expected validation error")
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("error %q does not mention %q", err, tc.want)
			}
		})
	}
}

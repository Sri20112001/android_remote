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

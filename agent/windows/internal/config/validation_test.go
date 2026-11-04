package config_test

import (
	"strings"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/config"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*config.Config)
		wantErr string
	}{
		{"valid defaults", func(*config.Config) {}, ""},
		{"empty agent name", func(c *config.Config) { c.Agent.Name = "  " }, "agent.name"},
		{"long agent name", func(c *config.Config) { c.Agent.Name = strings.Repeat("x", 65) }, "agent.name"},
		{"empty host", func(c *config.Config) { c.Server.Host = "" }, "server.host"},
		{"whitespace host", func(c *config.Config) { c.Server.Host = "127.0.0.1 extra" }, "server.host"},
		{"negative port", func(c *config.Config) { c.Server.Port = -1 }, "server.port"},
		{"port too large", func(c *config.Config) { c.Server.Port = 65536 }, "server.port"},
		{"zero read timeout", func(c *config.Config) { c.Server.ReadTimeout = 0 }, "server.read_timeout"},
		{"small max body", func(c *config.Config) { c.Server.MaxRequestBytes = 10 }, "max_request_bytes"},
		{"tls without cert", func(c *config.Config) { c.Server.TLS.Enabled = true }, "server.tls.cert_file"},
		{"empty database path", func(c *config.Config) { c.Database.Path = " " }, "database.path"},
		{"zero busy timeout", func(c *config.Config) { c.Database.BusyTimeout = 0 }, "database.busy_timeout"},
		{"bad log level", func(c *config.Config) { c.Logging.Level = "loud" }, "logging.level"},
		{"bad log format", func(c *config.Config) { c.Logging.Format = "xml" }, "logging.format"},
		{"zero pin ttl", func(c *config.Config) { c.Security.Pairing.PINTTL = 0 }, "security.pairing.pin_ttl"},
		{"absurd pin ttl", func(c *config.Config) { c.Security.Pairing.PINTTL = config.Duration(time.Hour) }, "security.pairing.pin_ttl"},
		{"negative pin attempts", func(c *config.Config) { c.Security.Pairing.MaxAttempts = -1 }, "security.pairing.max_attempts"},
		{"negative sessions", func(c *config.Config) { c.Security.Pairing.MaxActiveSessions = -1 }, "security.pairing.max_active_sessions"},
		{"negative grace", func(c *config.Config) { c.Security.Pairing.TokenGracePeriod = -1 }, "security.pairing.token_grace_period"},
		{"negative confirm limit", func(c *config.Config) { c.Security.RateLimit.ConfirmPerMinute = -1 }, "security.rate_limit.confirm_per_minute"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := config.Defaults()
			tc.mutate(cfg)

			err := cfg.Validate()
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("expected valid config, got: %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error mentioning %q", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Errorf("error %q does not mention %q", err, tc.wantErr)
			}
		})
	}
}

func TestValidateAggregatesProblems(t *testing.T) {
	cfg := config.Defaults()
	cfg.Agent.Name = ""
	cfg.Server.Port = -1
	cfg.Logging.Level = "chatty"

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected error")
	}
	for _, want := range []string{"agent.name", "server.port", "logging.level"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("aggregated error %q misses %q", err, want)
		}
	}
}

func TestTLSRequiresBothFiles(t *testing.T) {
	cfg := config.Defaults()
	cfg.Server.TLS.Enabled = true
	cfg.Server.TLS.CertFile = "cert.pem"

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "server.tls.key_file") {
		t.Fatalf("expected key_file error, got: %v", err)
	}
}

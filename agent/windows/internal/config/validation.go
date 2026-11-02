package config

import (
	"fmt"
	"strings"
	"time"
)

// Validate checks the whole configuration and reports every problem it finds
// in a single error so users can fix them in one pass.
func (c *Config) Validate() error {
	var problems []string

	name := strings.TrimSpace(c.Agent.Name)
	switch {
	case name == "":
		problems = append(problems, "agent.name must not be empty")
	case len(name) > 64:
		problems = append(problems, "agent.name must be at most 64 characters")
	}

	host := strings.TrimSpace(c.Server.Host)
	switch {
	case host == "":
		problems = append(problems, "server.host must not be empty")
	case strings.ContainsAny(host, " \t\r\n"):
		problems = append(problems, "server.host must not contain whitespace")
	}

	if c.Server.Port < 0 || c.Server.Port > 65535 {
		problems = append(problems, "server.port must be between 0 and 65535 (0 selects an ephemeral port)")
	}

	problems = append(problems, positiveDuration("server.read_header_timeout", c.Server.ReadHeaderTimeout)...)
	problems = append(problems, positiveDuration("server.read_timeout", c.Server.ReadTimeout)...)
	problems = append(problems, positiveDuration("server.write_timeout", c.Server.WriteTimeout)...)
	problems = append(problems, positiveDuration("server.idle_timeout", c.Server.IdleTimeout)...)

	if c.Server.MaxRequestBytes < 1024 {
		problems = append(problems, "server.max_request_bytes must be at least 1024")
	}

	if c.Server.TLS.Enabled {
		if strings.TrimSpace(c.Server.TLS.CertFile) == "" {
			problems = append(problems, "server.tls.cert_file is required when TLS is enabled")
		}
		if strings.TrimSpace(c.Server.TLS.KeyFile) == "" {
			problems = append(problems, "server.tls.key_file is required when TLS is enabled")
		}
	}

	if strings.TrimSpace(c.Database.Path) == "" {
		problems = append(problems, "database.path must not be empty")
	}
	problems = append(problems, positiveDuration("database.busy_timeout", c.Database.BusyTimeout)...)

	switch c.Logging.Level {
	case "debug", "info", "warn", "error":
	default:
		problems = append(problems, fmt.Sprintf("logging.level must be one of debug, info, warn, error (got %q)", c.Logging.Level))
	}

	switch c.Logging.Format {
	case "text", "json":
	default:
		problems = append(problems, fmt.Sprintf("logging.format must be one of text, json (got %q)", c.Logging.Format))
	}

	problems = append(problems, securityProblems(c.Security)...)

	if len(problems) > 0 {
		return fmt.Errorf("invalid configuration: %s", strings.Join(problems, "; "))
	}
	return nil
}

// securityProblems validates the pairing and rate-limit settings.
func securityProblems(sec SecurityConfig) []string {
	var problems []string

	ttl := sec.Pairing.PINTTL.Duration()
	switch {
	case ttl <= 0:
		problems = append(problems, "security.pairing.pin_ttl must be a positive duration")
	case ttl > 30*time.Minute:
		problems = append(problems, "security.pairing.pin_ttl must not exceed 30m")
	}

	if sec.Pairing.MaxAttempts < 1 || sec.Pairing.MaxAttempts > 20 {
		problems = append(problems, "security.pairing.max_attempts must be between 1 and 20")
	}
	if sec.Pairing.MaxActiveSessions < 1 || sec.Pairing.MaxActiveSessions > 20 {
		problems = append(problems, "security.pairing.max_active_sessions must be between 1 and 20")
	}

	grace := sec.Pairing.TokenGracePeriod.Duration()
	if grace < 0 || grace > 10*time.Minute {
		problems = append(problems, "security.pairing.token_grace_period must be between 0 and 10m")
	}

	if sec.RateLimit.ConfirmPerMinute < 1 || sec.RateLimit.ConfirmPerMinute > 1000 {
		problems = append(problems, "security.rate_limit.confirm_per_minute must be between 1 and 1000")
	}

	if len(sec.AllowedHosts) > 32 {
		problems = append(problems, "security.allowed_hosts must list at most 32 hostnames")
	}
	seen := make(map[string]bool, len(sec.AllowedHosts))
	for i, h := range sec.AllowedHosts {
		switch {
		case h == "":
			problems = append(problems, "security.allowed_hosts entries must not be empty")
		case len(h) > 253:
			problems = append(problems, fmt.Sprintf("security.allowed_hosts[%d] is longer than 253 characters", i))
		case strings.ContainsAny(h, " /\\:?#@"):
			problems = append(problems, fmt.Sprintf(
				"security.allowed_hosts[%d] must be a bare hostname without scheme, port or path", i))
		default:
			key := strings.ToLower(strings.TrimSuffix(h, "."))
			if seen[key] {
				problems = append(problems, fmt.Sprintf("security.allowed_hosts[%d] is a duplicate", i))
			}
			seen[key] = true
		}
	}

	return problems
}

// positiveDuration appends a problem when d is not strictly positive.
func positiveDuration(name string, d Duration) []string {
	if d.Duration() <= 0 {
		return []string{name + " must be a positive duration"}
	}
	return nil
}

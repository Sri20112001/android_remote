package middleware

import (
	"log/slog"
	"net"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// Guard blocks browser-driven cross-site requests to the agent. Native
// clients (the Android app, curl, the tray UI) send neither Sec-Fetch-Site
// nor Origin, so they pass untouched; web pages do — and are rejected.
//
// This defends a local agent against three classic attacks:
//   - CSRF: a malicious page issues fetch()/form POSTs to
//     http://127.0.0.1:8765/... from the victim's browser;
//   - DNS rebinding: the attacker's domain resolves to the agent and the
//     browser addresses it under the foreign Host. Because the page and
//     the target then share an origin, Origin and Sec-Fetch-Site checks
//     alone cannot see it — only the Host allowlist does;
//   - probe-and-spray: requests aimed at the agent but addressed to a
//     name it never serves.
//
// allowed carries the hostnames the agent answers for: configured
// extras, plus this machine's own hostname (os.Hostname). IP literals and
// localhost are always accepted, since a LAN client addresses the PC by
// IP and local tooling by loopback.
func Guard(logger *slog.Logger, allowed ...string) gin.HandlerFunc {
	hosts := normalizeHosts(allowed)

	return func(c *gin.Context) {
		if !hostAllowed(c.Request.Host, hosts) {
			rejectBrowserRequest(c, logger, "host not allowed",
				"requests must address this agent by a host it serves")
			return
		}
		if site := c.GetHeader("Sec-Fetch-Site"); site == "cross-site" {
			rejectBrowserRequest(c, logger, "cross-site fetch", crossOriginMessage)
			return
		}
		if origin := c.GetHeader("Origin"); origin != "" {
			if origin == "null" {
				rejectBrowserRequest(c, logger, "opaque origin", crossOriginMessage)
				return
			}
			u, err := url.Parse(origin)
			if err != nil || !strings.EqualFold(u.Host, c.Request.Host) {
				rejectBrowserRequest(c, logger, "origin mismatch", crossOriginMessage)
				return
			}
		}
		c.Next()
	}
}

// crossOriginMessage is what every cross-origin rejection shows the
// client: one generic answer, so probing learns nothing about which rule
// fired (the log line carries the precise reason).
const crossOriginMessage = "cross-origin requests are not allowed"

// hostAllowed reports whether the Host header addresses this agent.
func hostAllowed(hostHeader string, allowed map[string]bool) bool {
	host := hostHeader
	// Strip the port; keep IPv6 literals intact ([::1]:8765).
	if h, _, err := net.SplitHostPort(hostHeader); err == nil {
		host = h
	}
	host = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
	if host == "" {
		return false
	}
	// IP literals are not reachable through DNS, so they cannot be
	// rebound: any address the client dialled directly is fine.
	if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
		return true
	}
	if host == "localhost" {
		return true
	}
	return allowed[host]
}

// normalizeHosts lowercases and de-duplicates the configured hostnames.
func normalizeHosts(hosts []string) map[string]bool {
	out := make(map[string]bool, len(hosts))
	for _, h := range hosts {
		h = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(h)), ".")
		if h == "" {
			continue
		}
		// A configured entry may carry an accidental port; strip it.
		if base, _, err := net.SplitHostPort(h); err == nil {
			h = base
		}
		out[h] = true
	}
	return out
}

// Hostname returns this machine's own hostname for the guard allowlist.
// It is a helper so the router does not import os directly.
func Hostname() string {
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	return name
}

// rejectBrowserRequest refuses the request and logs why (no secrets).
// clientHint is a short reason code; humanMessage is what the client sees.
func rejectBrowserRequest(c *gin.Context, logger *slog.Logger, clientHint, humanMessage string) {
	logger.LogAttrs(c.Request.Context(), slog.LevelWarn, "cross-origin request blocked",
		slog.String("reason", clientHint),
		slog.String("method", c.Request.Method),
		slog.String("path", c.Request.URL.Path),
		slog.String("host", c.Request.Host),
		slog.String("origin", c.GetHeader("Origin")),
		slog.String("request_id", RequestIDFromContext(c)),
	)
	utils.RespondError(c, 403, constants.CodeForbidden, humanMessage)
	c.Abort()
}

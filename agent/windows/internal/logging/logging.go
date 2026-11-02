// Package logging builds the structured logger used by the whole agent.
package logging

import (
	"fmt"
	"io"
	"log/slog"
	"os"

	"github.com/tuf-remote/agent/internal/config"
)

// New builds the application logger writing to stdout.
func New(cfg config.LoggingConfig) (*slog.Logger, error) {
	return NewWithWriter(cfg, os.Stdout)
}

// NewWithWriter builds the application logger writing to w. Tests use it to
// capture log output.
func NewWithWriter(cfg config.LoggingConfig, w io.Writer) (*slog.Logger, error) {
	level, err := parseLevel(cfg.Level)
	if err != nil {
		return nil, err
	}
	opts := &slog.HandlerOptions{Level: level}

	var handler slog.Handler
	switch cfg.Format {
	case "json":
		handler = slog.NewJSONHandler(w, opts)
	case "text":
		handler = slog.NewTextHandler(w, opts)
	default:
		return nil, fmt.Errorf("unsupported log format %q (want text or json)", cfg.Format)
	}
	return slog.New(handler), nil
}

// parseLevel maps a configuration string to a slog level.
func parseLevel(raw string) (slog.Level, error) {
	switch raw {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("unsupported log level %q (want debug, info, warn or error)", raw)
	}
}

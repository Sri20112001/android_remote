package logging_test

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/logging"
)

func TestTextFormatWritesToWriter(t *testing.T) {
	var buf bytes.Buffer
	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "info", Format: "text"}, &buf)
	if err != nil {
		t.Fatalf("NewWithWriter: %v", err)
	}

	logger.Info("agent starting", "port", 8765)

	out := buf.String()
	if !strings.Contains(out, "agent starting") {
		t.Errorf("log output missing message: %q", out)
	}
	if !strings.Contains(out, "port=8765") {
		t.Errorf("log output missing attribute: %q", out)
	}
}

func TestJSONFormat(t *testing.T) {
	var buf bytes.Buffer
	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "info", Format: "json"}, &buf)
	if err != nil {
		t.Fatalf("NewWithWriter: %v", err)
	}

	logger.Info("hello")

	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("output is not JSON: %v (%q)", err, buf.String())
	}
	if payload["msg"] != "hello" {
		t.Errorf("msg = %v", payload["msg"])
	}
}

func TestLevelFiltering(t *testing.T) {
	var buf bytes.Buffer
	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "warn", Format: "text"}, &buf)
	if err != nil {
		t.Fatalf("NewWithWriter: %v", err)
	}

	logger.Debug("hidden")
	logger.Warn("visible")

	if strings.Contains(buf.String(), "hidden") {
		t.Error("debug message must be filtered at level warn")
	}
	if !strings.Contains(buf.String(), "visible") {
		t.Error("warn message must be logged")
	}
}

func TestInvalidLevelFails(t *testing.T) {
	if _, err := logging.NewWithWriter(config.LoggingConfig{Level: "loud", Format: "text"}, &bytes.Buffer{}); err == nil {
		t.Fatal("expected error for unknown level")
	}
}

func TestInvalidFormatFails(t *testing.T) {
	if _, err := logging.NewWithWriter(config.LoggingConfig{Level: "info", Format: "xml"}, &bytes.Buffer{}); err == nil {
		t.Fatal("expected error for unknown format")
	}
}

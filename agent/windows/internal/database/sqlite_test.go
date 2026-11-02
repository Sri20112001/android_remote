package database_test

import (
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/database"
)

// testConfig returns a configuration pointing at a fresh temporary database.
func testConfig(t *testing.T) config.DatabaseConfig {
	t.Helper()
	return config.DatabaseConfig{
		Path:        filepath.Join(t.TempDir(), "test.db"),
		BusyTimeout: config.Duration(5 * time.Second),
	}
}

func TestOpenAppliesPragmas(t *testing.T) {
	cfg := testConfig(t)
	logger := slog.New(slog.NewTextHandler(&nopWriter{}, nil))

	db, err := database.Open(cfg, logger)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer func() { _ = db.Close() }()

	cases := []struct {
		pragga string
		want   string
	}{
		{"foreign_keys", "1"},
		{"busy_timeout", "5000"},
		{"journal_mode", "wal"},
	}
	for _, tc := range cases {
		var got string
		if err := db.QueryRow("PRAGMA " + tc.pragga).Scan(&got); err != nil {
			t.Fatalf("PRAGMA %s: %v", tc.pragga, err)
		}
		if got != tc.want {
			t.Errorf("PRAGMA %s = %q, want %q", tc.pragga, got, tc.want)
		}
	}
}

func TestOpenCreatesParentDirectory(t *testing.T) {
	cfg := config.DatabaseConfig{Path: filepath.Join(t.TempDir(), "nested", "deeper", "agent.db")}

	db, err := database.Open(cfg, nil)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer func() { _ = db.Close() }()

	if err := db.Ping(); err != nil {
		t.Fatalf("Ping: %v", err)
	}
}

func TestOpenFailsOnImpossiblePath(t *testing.T) {
	// A file where the parent directory should be: MkdirAll must fail.
	blocked := filepath.Join(t.TempDir(), "blocked")
	cfg := config.DatabaseConfig{Path: filepath.Join(blocked, "agent.db")}
	if err := writeFile(blocked); err != nil {
		t.Fatalf("prepare blocker: %v", err)
	}

	if _, err := database.Open(cfg, nil); err == nil {
		t.Fatal("expected Open to fail when the parent path is a file")
	}
}

// nopWriter discards log output.
type nopWriter struct{}

func (nopWriter) Write(p []byte) (int, error) { return len(p), nil }

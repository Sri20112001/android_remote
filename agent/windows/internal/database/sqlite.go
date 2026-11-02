// Package database owns the SQLite connection, its pragmas and the schema
// migration runner.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite" // pure-Go SQLite driver, no cgo required

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
)

// driverName is registered by modernc.org/sqlite.
const driverName = "sqlite"

// Open connects to the SQLite database described by cfg, applies the
// standard pragmas and verifies connectivity before returning.
func Open(cfg config.DatabaseConfig, logger *slog.Logger) (*sql.DB, error) {
	if err := ensureParentDir(cfg.Path); err != nil {
		return nil, err
	}

	db, err := sql.Open(driverName, buildDSN(cfg))
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	// SQLite permits a single writer; serialising access through one
	// connection avoids SQLITE_BUSY deadlocks without harming this agent's
	// small workload.
	db.SetMaxOpenConns(1)

	ctx, cancel := context.WithTimeout(context.Background(), constants.DefaultOpenTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close() // best-effort cleanup; the ping error is the real cause
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	if logger != nil {
		logger.Debug("database opened", "path", cfg.Path)
	}
	return db, nil
}

// ensureParentDir creates the directory holding the database file.
func ensureParentDir(path string) error {
	dir := filepath.Dir(path)
	if dir == "" || dir == "." {
		return nil
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return fmt.Errorf("create database directory %s: %w", dir, err)
	}
	return nil
}

// buildDSN renders the SQLite data source name with the configured pragmas.
// The journal is write-ahead logging so readers never block the writer.
func buildDSN(cfg config.DatabaseConfig) string {
	busy := cfg.BusyTimeout.Duration()
	if busy <= 0 {
		busy = constants.DefaultDatabaseBusyTimeout
	}
	return fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(%d)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)",
		filepath.ToSlash(cfg.Path),
		busy.Milliseconds(),
	)
}

// nowUTC is the timestamp format used across the schema.
func nowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}

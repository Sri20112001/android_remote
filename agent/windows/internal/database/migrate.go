package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"github.com/tuf-remote/agent/internal/constants"
)

// migrationSuffix marks executable migration files (e.g. 0001_init.sql).
const migrationSuffix = ".sql"

// Migrate applies every pending migration found in fsys. Each applied file
// is recorded together with a SHA-256 checksum; editing a migration that was
// already applied is reported as an error instead of being silently
// re-executed.
func Migrate(ctx context.Context, db *sql.DB, logger *slog.Logger, fsys fs.FS) error {
	if err := ensureMigrationTable(ctx, db); err != nil {
		return err
	}

	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return fmt.Errorf("read migrations directory: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), migrationSuffix) {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		content, err := fs.ReadFile(fsys, name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		sum := checksum(content)

		applied, existingSum, err := migrationStatus(ctx, db, name)
		if err != nil {
			return err
		}
		if applied {
			if existingSum != sum {
				return fmt.Errorf(
					"migration %s was already applied with a different checksum; create a new migration instead of editing it",
					name,
				)
			}
			continue
		}

		if err := applyMigration(ctx, db, name, string(content), sum); err != nil {
			return err
		}
		if logger != nil {
			logger.Info("migration applied", "migration", name)
		}
	}
	return nil
}

// ensureMigrationTable creates the bookkeeping table if needed.
func ensureMigrationTable(ctx context.Context, db *sql.DB) error {
	query := fmt.Sprintf(
		`CREATE TABLE IF NOT EXISTS %s (
	version   TEXT PRIMARY KEY,
	checksum  TEXT NOT NULL,
	applied_at TEXT NOT NULL
)`, constants.MigrationTable,
	)
	if _, err := db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("create migration table: %w", err)
	}
	return nil
}

// migrationStatus reports whether a migration was applied and its checksum.
func migrationStatus(ctx context.Context, db *sql.DB, name string) (applied bool, sum string, err error) {
	query := fmt.Sprintf("SELECT checksum FROM %s WHERE version = ?", constants.MigrationTable)
	err = db.QueryRowContext(ctx, query, name).Scan(&sum)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return false, "", nil
	case err != nil:
		return false, "", fmt.Errorf("read status of migration %s: %w", name, err)
	}
	return true, sum, nil
}

// applyMigration runs the migration file and its bookkeeping row in one
// transaction, so a failing migration leaves the schema untouched.
func applyMigration(ctx context.Context, db *sql.DB, name, content, sum string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration %s: %w", name, err)
	}
	// Rollback after Commit is a documented no-op (sql.ErrTxDone) and is the
	// idiomatic way to cover the failure path.
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, content); err != nil {
		return fmt.Errorf("apply migration %s: %w", name, err)
	}

	insert := fmt.Sprintf(
		"INSERT INTO %s (version, checksum, applied_at) VALUES (?, ?, ?)",
		constants.MigrationTable,
	)
	if _, err := tx.ExecContext(ctx, insert, name, sum, nowUTC()); err != nil {
		return fmt.Errorf("record migration %s: %w", name, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration %s: %w", name, err)
	}
	return nil
}

// checksum returns the hex-encoded SHA-256 of a migration file.
func checksum(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

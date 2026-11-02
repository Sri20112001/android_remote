package database_test

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/database"
	"github.com/tuf-remote/agent/internal/database/migrations"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Open(testConfig(t), nil)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func tableExists(t *testing.T, db *sql.DB, name string) bool {
	t.Helper()
	var found string
	err := db.QueryRow(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
		name,
	).Scan(&found)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("query sqlite_master: %v", err)
	}
	return found == name
}

func TestMigrateAppliesEmbeddedSchema(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	if err := database.Migrate(ctx, db, nil, migrations.FS); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	for _, want := range []string{
		"paired_devices",
		"device_tokens",
		"application_settings",
		"audit_logs",
		constants.MigrationTable,
	} {
		if !tableExists(t, db, want) {
			t.Errorf("table %q was not created", want)
		}
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if err := database.Migrate(ctx, db, nil, migrations.FS); err != nil {
			t.Fatalf("run %d: %v", i+1, err)
		}
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM " + constants.MigrationTable).Scan(&count); err != nil {
		t.Fatalf("count migrations: %v", err)
	}
	if count != 1 {
		t.Errorf("expected exactly 1 recorded migration, got %d", count)
	}
}

func TestMigrateEnforcesForeignKeys(t *testing.T) {
	db := openTestDB(t)
	if err := database.Migrate(context.Background(), db, nil, migrations.FS); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	// A token for a device that does not exist must be rejected.
	_, err := db.Exec(`
		INSERT INTO device_tokens (id, device_id, token_hash, token_prefix, created_at)
		VALUES ('t1', 'ghost-device', 'hash', 'abcd', '2026-01-01T00:00:00Z')`)
	if err == nil {
		t.Fatal("foreign key violation was not enforced")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "foreign key") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestMigrateRejectsEditedMigration(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	original := fstest.MapFS{
		"0001_demo.sql": &fstest.MapFile{Data: []byte("CREATE TABLE demo (id INTEGER PRIMARY KEY);")},
	}
	if err := database.Migrate(ctx, db, nil, original); err != nil {
		t.Fatalf("first Migrate: %v", err)
	}

	edited := fstest.MapFS{
		"0001_demo.sql": &fstest.MapFile{Data: []byte("CREATE TABLE demo (id INTEGER PRIMARY KEY, extra TEXT);")},
	}
	err := database.Migrate(ctx, db, nil, edited)
	if err == nil || !strings.Contains(err.Error(), "different checksum") {
		t.Fatalf("expected checksum error, got: %v", err)
	}
}

func TestMigrateRollsBackFailedMigration(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	broken := fstest.MapFS{
		"0001_broken.sql": &fstest.MapFile{Data: []byte("CREATE TABLE half (id INTEGER;")},
	}
	err := database.Migrate(ctx, db, nil, broken)
	if err == nil {
		t.Fatal("expected the broken migration to fail")
	}

	if tableExists(t, db, "half") {
		t.Error("failed migration must not leave objects behind")
	}
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM " + constants.MigrationTable).Scan(&count); err != nil {
		t.Fatalf("count migrations: %v", err)
	}
	if count != 0 {
		t.Errorf("failed migration must not be recorded, got %d rows", count)
	}
}

func TestMigrateSkipsNonSQLFiles(t *testing.T) {
	db := openTestDB(t)
	fsys := fstest.MapFS{
		"README.md":         &fstest.MapFile{Data: []byte("not sql")},
		"0001_ok.sql":       &fstest.MapFile{Data: []byte("CREATE TABLE ok (id INTEGER PRIMARY KEY);")},
		"notes/ignored.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
	}

	if err := database.Migrate(context.Background(), db, nil, fsys); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	if !tableExists(t, db, "ok") {
		t.Error("0001_ok.sql was not applied")
	}
}

// writeFile creates a plain file at path (used to block a directory).
func writeFile(path string) error {
	return os.WriteFile(path, []byte("blocker"), 0o600)
}

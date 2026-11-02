package audit_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tuf-remote/agent/internal/audit"
	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/database"
	"github.com/tuf-remote/agent/internal/database/migrations"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Open(config.DatabaseConfig{Path: filepath.Join(t.TempDir(), "audit.db")}, nil)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := database.Migrate(context.Background(), db, nil, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestRecordPersistsEntry(t *testing.T) {
	db := newTestDB(t)
	logger := audit.New(db)

	err := logger.Record(context.Background(), audit.Entry{
		ActorType: audit.ActorLocal,
		Action:    "pairing.start",
		Outcome:   audit.OutcomeSuccess,
		Detail:    "session=abc",
	})
	if err != nil {
		t.Fatalf("Record: %v", err)
	}

	var (
		createdAt string
		actorType string
		action    string
		outcome   string
		detail    sql.NullString
		actorID   sql.NullString
	)
	err = db.QueryRow(`SELECT created_at, actor_type, actor_id, action, outcome, detail
		FROM audit_logs WHERE action = 'pairing.start'`).
		Scan(&createdAt, &actorType, &actorID, &action, &outcome, &detail)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if actorType != audit.ActorLocal || outcome != audit.OutcomeSuccess {
		t.Errorf("unexpected row: type=%q outcome=%q", actorType, outcome)
	}
	if createdAt == "" {
		t.Error("created_at must be set")
	}
	if actorID.Valid {
		t.Errorf("absent actor_id must stay NULL, got %q", actorID.String)
	}
	if !detail.Valid || detail.String != "session=abc" {
		t.Errorf("detail = %v", detail)
	}
}

func TestRecordRejectsInvalidEntries(t *testing.T) {
	db := newTestDB(t)
	logger := audit.New(db)

	cases := []struct {
		name  string
		entry audit.Entry
	}{
		{"bad actor", audit.Entry{ActorType: "ghost", Action: "x", Outcome: audit.OutcomeSuccess}},
		{"bad outcome", audit.Entry{ActorType: audit.ActorDevice, Action: "x", Outcome: "maybe"}},
		{"empty action", audit.Entry{ActorType: audit.ActorSystem, Action: "", Outcome: audit.OutcomeFailure}},
		{"newline detail", audit.Entry{ActorType: audit.ActorDevice, Action: "x", Outcome: audit.OutcomeSuccess, Detail: "a\nb"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := logger.Record(context.Background(), tc.entry); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM audit_logs").Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 0 {
		t.Errorf("invalid entries must not be written, found %d rows", count)
	}
}

func TestRecordOnMissingTableFails(t *testing.T) {
	db := newTestDB(t)
	if _, err := db.Exec("DROP TABLE audit_logs"); err != nil {
		t.Fatalf("drop: %v", err)
	}

	err := audit.New(db).Record(context.Background(), audit.Entry{
		ActorType: audit.ActorLocal,
		Action:    "test",
		Outcome:   audit.OutcomeSuccess,
	})
	if err == nil {
		t.Fatal("expected an error when the table is missing")
	}
	if !strings.Contains(err.Error(), "write audit entry") {
		t.Errorf("error lacks context: %v", err)
	}
}

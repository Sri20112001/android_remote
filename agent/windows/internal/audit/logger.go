// Package audit records security-relevant actions in the audit_logs table.
// Audit entries must never contain secrets: no tokens, no PINs, no
// clipboard or notification content.
package audit

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/tuf-remote/agent/internal/security"
)

// Actor types (mirrored by a CHECK constraint on audit_logs).
const (
	ActorDevice = "device" // an authenticated paired device
	ActorLocal  = "local"  // a process on this PC (loopback request)
	ActorSystem = "system" // the agent itself
)

// Outcomes (mirrored by a CHECK constraint on audit_logs).
const (
	OutcomeSuccess = "success"
	OutcomeFailure = "failure"
)

// Entry is one audit record. Detail must be a safe, non-secret summary.
type Entry struct {
	ActorType string
	ActorID   string
	Action    string
	Resource  string
	Outcome   string
	Detail    string
}

// validate rejects entries the schema would reject anyway, with clearer
// messages, and enforces the no-newlines rule for log safety.
func (e Entry) validate() error {
	switch e.ActorType {
	case ActorDevice, ActorLocal, ActorSystem:
	default:
		return fmt.Errorf("audit: invalid actor type %q", e.ActorType)
	}
	switch e.Outcome {
	case OutcomeSuccess, OutcomeFailure:
	default:
		return fmt.Errorf("audit: invalid outcome %q", e.Outcome)
	}
	if e.Action == "" {
		return fmt.Errorf("audit: action must not be empty")
	}
	if !security.IsPrintableDetail(e.Detail) {
		return fmt.Errorf("audit: detail must not contain newlines or NUL")
	}
	return nil
}

// Logger writes audit entries. It is safe for concurrent use (the
// underlying pool is serialised by the database package).
type Logger struct {
	db *sql.DB
}

// New creates an audit logger on top of an open database.
func New(db *sql.DB) *Logger {
	return &Logger{db: db}
}

// Record persists one entry. Callers decide whether a failure is fatal for
// their operation; errors are always surfaced, never swallowed silently.
func (l *Logger) Record(ctx context.Context, e Entry) error {
	if err := e.validate(); err != nil {
		return err
	}
	const query = `INSERT INTO audit_logs
		(created_at, actor_type, actor_id, action, resource, outcome, detail)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	if _, err := l.db.ExecContext(ctx, query,
		nowUTC(), e.ActorType, nullIfEmpty(e.ActorID), e.Action,
		nullIfEmpty(e.Resource), e.Outcome, nullIfEmpty(e.Detail),
	); err != nil {
		return fmt.Errorf("write audit entry: %w", err)
	}
	return nil
}

// nullIfEmpty keeps optional columns NULL instead of storing "".
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// nowUTC stamps entries in the schema's RFC 3339 UTC format.
func nowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}

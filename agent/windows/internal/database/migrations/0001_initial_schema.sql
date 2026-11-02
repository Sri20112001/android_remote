-- 0001_initial_schema.sql
-- Core schema: paired devices, their tokens, agent settings and the audit
-- log. Module-specific tables (macros, approved directories, ...) arrive
-- with their modules in later migrations.
--
-- Conventions:
--   * identifiers are application-generated TEXT (UUID-style) primary keys;
--   * timestamps are TEXT in RFC 3339 UTC;
--   * every mutation of paired state is mirrored in audit_logs.

CREATE TABLE IF NOT EXISTS paired_devices (
	id           TEXT PRIMARY KEY,
	name         TEXT NOT NULL,
	platform     TEXT NOT NULL DEFAULT 'android',
	model        TEXT,
	os_version   TEXT,
	paired_at    TEXT NOT NULL,
	last_seen_at TEXT,
	revoked_at   TEXT,
	created_at   TEXT NOT NULL,
	updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_tokens (
	id           TEXT PRIMARY KEY,
	device_id    TEXT NOT NULL
	           REFERENCES paired_devices(id) ON DELETE CASCADE,
	token_hash   TEXT NOT NULL UNIQUE,
	token_prefix TEXT NOT NULL,
	expires_at   TEXT,
	last_used_at TEXT,
	revoked_at   TEXT,
	created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_device ON device_tokens(device_id);

CREATE TABLE IF NOT EXISTS application_settings (
	key        TEXT PRIMARY KEY,
	value      TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	created_at TEXT NOT NULL,
	actor_type TEXT NOT NULL
	           CHECK (actor_type IN ('device', 'local', 'system')),
	actor_id   TEXT,
	action     TEXT NOT NULL,
	resource   TEXT,
	outcome    TEXT NOT NULL
	           CHECK (outcome IN ('success', 'failure')),
	detail     TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

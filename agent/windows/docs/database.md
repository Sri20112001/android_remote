# Database

Engine: **SQLite** through `modernc.org/sqlite` (pure Go, no cgo). The
database file lives at `database.path` (default `data/tuf_remote.db`,
created on demand); the directory is created with user-only permissions
(`0750`).

## Connection policy

The DSN always applies these pragmas:

| Pragma | Value | Why |
|---|---|---|
| `busy_timeout` | `database.busy_timeout` (default 5 s) | wait instead of failing on locks |
| `foreign_keys` | `1` | referential integrity is not optional in SQLite |
| `journal_mode` | `WAL` | readers never block the writer (and vice versa) |

Additionally the pool is capped with `SetMaxOpenConns(1)`: SQLite permits a
single writer, and serialising access removes `SQLITE_BUSY` deadlocks by
construction. The agent's workload (pairing, settings, audit rows) does not
need concurrency; revisit only if a module proves otherwise.

Connectivity is verified with a timed ping at startup — a broken database
fails the boot instead of surfacing on the first request.

## Conventions

- **Primary keys**: application-generated `TEXT` (UUID-style, from a
  CSPRNG), not autoincrement integers — values must be unguessable and
  portable across devices.
- **Timestamps**: `TEXT` in RFC 3339 UTC (`2026-11-01T07:16:54Z`), so they
  sort lexicographically and are readable in any client.
- **Secrets**: only hashes are stored (`token_hash`), never raw tokens.
- **SQL**: always parameterised (`?` placeholders); no string interpolation
  of values (identifiers come from `constants`).

## Migrations

Location: `internal/database/migrations/`, embedded into the binary via
`embed.FS` (the agent is self-contained; no files shipped next to it).

Rules:

1. Files are named `NNNN_description.sql` and applied in lexicographic
   order.
2. Each file runs inside **one transaction** together with its bookkeeping
   row — a failing migration leaves the schema untouched.
3. Bookkeeping table `schema_migrations(version, checksum, applied_at)`.
4. The SHA-256 of every applied file is recorded; **editing an already
   applied migration is an error**. Schema changes always arrive as a new
   migration.
5. Migrations are append-only in normal operation. For development, delete
   the database file to start over.

Adding a migration:

```text
internal/database/migrations/0002_pairing_policies.sql   ← next number
```

It is picked up automatically (embedded) and logged as
`migration applied`.

## Schema (status: `0001_initial_schema.sql`)

```text
paired_devices
  id            TEXT PK
  name          TEXT NOT NULL                display name of the device
  platform      TEXT NOT NULL DEFAULT 'android'
  model, os_version  TEXT                    optional metadata
  paired_at     TEXT NOT NULL                RFC3339
  last_seen_at, revoked_at  TEXT             lifecycle (NULL = active)
  created_at, updated_at  TEXT NOT NULL

device_tokens
  id            TEXT PK
  device_id     TEXT FK → paired_devices(id) ON DELETE CASCADE
  token_hash    TEXT NOT NULL UNIQUE          sha256 of the token
  token_prefix  TEXT NOT NULL                 non-secret prefix for display
  expires_at, last_used_at, revoked_at  TEXT
  created_at    TEXT NOT NULL
  idx_device_tokens_device (device_id)

application_settings
  key           TEXT PK
  value         TEXT NOT NULL
  updated_at    TEXT NOT NULL

audit_logs
  id            INTEGER PK AUTOINCREMENT
  created_at    TEXT NOT NULL
  actor_type    TEXT NOT NULL CHECK IN ('device','local','system')
  actor_id      TEXT                          device id or NULL
  action        TEXT NOT NULL                 e.g. 'power.shutdown'
  resource      TEXT
  outcome       TEXT NOT NULL CHECK IN ('success','failure')
  detail        TEXT                          safe, non-secret summary
  idx_audit_logs_created_at (created_at)
  idx_audit_logs_action (action)
```

Notes:

- `paired_devices` / `device_tokens` / `audit_logs` are created now so the
  pairing milestone (2) starts against a real schema; their repositories
  arrive with that milestone.
- Module-specific tables (macros, approved directories, scheduled tasks,
  automation profiles) are added by migrations **with their modules**, so
  the schema never runs far ahead of the code.
- Foreign-key enforcement is covered by tests (inserting a token for an
  unknown device must fail).

## Testing

- Every test uses a fresh database in `t.TempDir()` (never the developer's
  file); temp directories are removed automatically.
- The migration runner is tested against both the embedded migrations and
  synthetic `fstest.MapFS` fixtures (idempotency, checksum enforcement,
  rollback of broken files, skipping non-SQL files).

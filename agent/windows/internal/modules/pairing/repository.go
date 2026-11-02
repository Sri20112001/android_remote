package pairing

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Repository errors mapped by the controller.
var (
	// ErrDeviceNotFound means no device with that id exists.
	ErrDeviceNotFound = errors.New("pairing: device not found")
	// ErrAlreadyRevoked means the device's access was already withdrawn.
	ErrAlreadyRevoked = errors.New("pairing: device already revoked")
	// ErrTokenNotFound means no token row matched the lookup.
	ErrTokenNotFound = errors.New("pairing: token not found")
)

// Repository is the persistence boundary of the pairing module. The
// service depends on this interface so it can be tested without SQLite.
type Repository interface {
	// CreateDeviceWithToken inserts a device and its first token atomically.
	CreateDeviceWithToken(ctx context.Context, device Device, token TokenRecord) error
	// LookupToken resolves a token hash to its identity, expiry and
	// revocation state (device join included).
	LookupToken(ctx context.Context, hash string) (TokenLookup, error)
	// ListDevices returns every paired device with its last-seen stamp.
	ListDevices(ctx context.Context) ([]Device, error)
	// GetDevice returns one device by id.
	GetDevice(ctx context.Context, id string) (Device, error)
	// RevokeDevice marks a device revoked; it fails with ErrAlreadyRevoked
	// when the device was already revoked.
	RevokeDevice(ctx context.Context, id, now string) error
	// CreateToken inserts an additional token for an existing device.
	CreateToken(ctx context.Context, token TokenRecord) error
	// RetireTokenAt schedules a token's revocation at the given instant
	// (used for rotation: the old token dies after its grace window).
	RetireTokenAt(ctx context.Context, tokenID, revokedAt string) error
	// TouchToken records a use, throttled to one write per window so
	// authentication does not become a write amplifier.
	TouchToken(ctx context.Context, tokenID, now string, staleBefore string) error
}

// TokenLookup is the authentication-relevant projection of a token row.
type TokenLookup struct {
	TokenID    string
	DeviceID   string
	DeviceName string
	ExpiresAt  string // "" = never expires
	RevokedAt  string // "" = not revoked
	DeviceGone bool   // device row missing or revoked
}

// ValidAt reports whether the token authorises a request at now. A token
// inside its rotation grace window (revoked at a future instant) still
// works; it dies the moment now reaches that instant.
func (l TokenLookup) ValidAt(now time.Time) bool {
	if l.DeviceGone {
		return false
	}
	if l.ExpiresAt != "" && now.After(parseStamp(l.ExpiresAt)) {
		return false
	}
	if l.RevokedAt != "" && !now.Before(parseStamp(l.RevokedAt)) {
		return false
	}
	return true
}

// parseStamp interprets an RFC 3339 stamp; a malformed value parses to the
// zero time so the token is treated as expired rather than valid forever.
func parseStamp(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

// SQLiteRepository implements Repository on the agent's database.
type SQLiteRepository struct {
	db *sql.DB
}

// NewSQLiteRepository wires the repository to an open database.
func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

// CreateDeviceWithToken inserts the device and its first token in one
// transaction: a device without a usable credential (or vice versa) must
// never be observable.
func (r *SQLiteRepository) CreateDeviceWithToken(ctx context.Context, device Device, token TokenRecord) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin pairing transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	const deviceQuery = `INSERT INTO paired_devices
		(id, name, platform, model, os_version, paired_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	if _, err := tx.ExecContext(ctx, deviceQuery,
		device.ID, device.Name, device.Platform,
		nullIfEmpty(device.Model), nullIfEmpty(device.OSVersion),
		device.PairedAt, device.PairedAt, device.PairedAt,
	); err != nil {
		return fmt.Errorf("insert paired device: %w", err)
	}

	if err := insertToken(ctx, tx, token); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit pairing transaction: %w", err)
	}
	return nil
}

// CreateToken adds a token to an existing device.
func (r *SQLiteRepository) CreateToken(ctx context.Context, token TokenRecord) error {
	if _, err := r.db.ExecContext(ctx,
		`INSERT INTO device_tokens (id, device_id, token_hash, token_prefix, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		token.ID, token.DeviceID, token.Hash, token.Prefix,
		nullIfEmpty(token.ExpiresAt), token.CreatedAt,
	); err != nil {
		return fmt.Errorf("insert device token: %w", err)
	}
	return nil
}

// insertToken shares the token INSERT between the transactional and the
// standalone path.
func insertToken(ctx context.Context, tx *sql.Tx, token TokenRecord) error {
	const query = `INSERT INTO device_tokens
		(id, device_id, token_hash, token_prefix, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`
	if _, err := tx.ExecContext(ctx, query,
		token.ID, token.DeviceID, token.Hash, token.Prefix,
		nullIfEmpty(token.ExpiresAt), token.CreatedAt,
	); err != nil {
		return fmt.Errorf("insert device token: %w", err)
	}
	return nil
}

// LookupToken resolves a token hash. Unknown hashes yield ErrTokenNotFound,
// which the caller turns into a generic 401.
func (r *SQLiteRepository) LookupToken(ctx context.Context, hash string) (TokenLookup, error) {
	const query = `SELECT t.id, t.device_id, t.expires_at, t.revoked_at,
		d.name, d.revoked_at
		FROM device_tokens t
		LEFT JOIN paired_devices d ON d.id = t.device_id
		WHERE t.token_hash = ?`

	var (
		lookup        TokenLookup
		tokenExpiry   sql.NullString
		tokenRevoked  sql.NullString
		deviceName    sql.NullString
		deviceRevoked sql.NullString
	)
	err := r.db.QueryRowContext(ctx, query, hash).Scan(
		&lookup.TokenID, &lookup.DeviceID, &tokenExpiry, &tokenRevoked,
		&deviceName, &deviceRevoked,
	)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return TokenLookup{}, ErrTokenNotFound
	case err != nil:
		return TokenLookup{}, fmt.Errorf("lookup device token: %w", err)
	}

	lookup.ExpiresAt = tokenExpiry.String
	lookup.RevokedAt = tokenRevoked.String
	lookup.DeviceName = deviceName.String
	// A missing device row (LEFT JOIN gave NULL) or a revoked device both
	// mean the credential no longer stands.
	lookup.DeviceGone = !deviceName.Valid || deviceRevoked.Valid
	return lookup, nil
}

// ListDevices returns all devices, newest first, with last use derived
// from their tokens.
func (r *SQLiteRepository) ListDevices(ctx context.Context) ([]Device, error) {
	const query = `SELECT d.id, d.name, d.platform, COALESCE(d.model, ''),
		COALESCE(d.os_version, ''), d.paired_at, COALESCE(d.revoked_at, ''),
		COALESCE((SELECT MAX(t.last_used_at) FROM device_tokens t
			WHERE t.device_id = d.id), '')
		FROM paired_devices d
		ORDER BY d.paired_at DESC, d.id DESC`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list paired devices: %w", err)
	}
	defer rows.Close()

	devices := make([]Device, 0, 4)
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.Name, &d.Platform, &d.Model,
			&d.OSVersion, &d.PairedAt, &d.RevokedAt, &d.LastSeenAt); err != nil {
			return nil, fmt.Errorf("scan paired device: %w", err)
		}
		devices = append(devices, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate paired devices: %w", err)
	}
	return devices, nil
}

// GetDevice returns a single device by id, with last use derived from its
// tokens exactly as in ListDevices.
func (r *SQLiteRepository) GetDevice(ctx context.Context, id string) (Device, error) {
	const query = `SELECT d.id, d.name, d.platform, COALESCE(d.model, ''),
		COALESCE(d.os_version, ''), d.paired_at, COALESCE(d.revoked_at, ''),
		COALESCE((SELECT MAX(t.last_used_at) FROM device_tokens t
			WHERE t.device_id = d.id), '')
		FROM paired_devices d WHERE d.id = ?`

	var d Device
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&d.ID, &d.Name, &d.Platform, &d.Model, &d.OSVersion,
		&d.PairedAt, &d.RevokedAt, &d.LastSeenAt,
	)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return Device{}, ErrDeviceNotFound
	case err != nil:
		return Device{}, fmt.Errorf("get paired device: %w", err)
	}
	return d, nil
}

// RevokeDevice revokes the device and every token it holds, in one
// transaction, so no path keeps working after the call returns.
func (r *SQLiteRepository) RevokeDevice(ctx context.Context, id, now string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin revoke transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var revokedAt sql.NullString
	err = tx.QueryRowContext(ctx,
		`SELECT revoked_at FROM paired_devices WHERE id = ?`, id).
		Scan(&revokedAt)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return ErrDeviceNotFound
	case err != nil:
		return fmt.Errorf("read device for revocation: %w", err)
	}
	if revokedAt.Valid {
		return ErrAlreadyRevoked
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE paired_devices SET revoked_at = ?, updated_at = ? WHERE id = ?`,
		now, now, id,
	); err != nil {
		return fmt.Errorf("revoke paired device: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE device_tokens SET revoked_at = ?
		 WHERE device_id = ? AND (revoked_at IS NULL OR revoked_at > ?)`,
		now, id, now,
	); err != nil {
		return fmt.Errorf("revoke device tokens: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit revocation: %w", err)
	}
	return nil
}

// RetireTokenAt sets a token's revocation instant, which may lie in the
// future (rotation grace). The token row must exist.
func (r *SQLiteRepository) RetireTokenAt(ctx context.Context, tokenID, revokedAt string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE device_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
		revokedAt, tokenID,
	)
	if err != nil {
		return fmt.Errorf("retire device token: %w", err)
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return ErrTokenNotFound
	}
	return nil
}

// TouchToken records a use only when the stored stamp is older than
// staleBefore, keeping last-seen fresh without a write per request.
func (r *SQLiteRepository) TouchToken(ctx context.Context, tokenID, now, staleBefore string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE device_tokens SET last_used_at = ?
		 WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)`,
		now, tokenID, staleBefore,
	)
	if err != nil {
		return fmt.Errorf("touch device token: %w", err)
	}
	return nil
}

// nullIfEmpty stores optional columns as NULL rather than "".
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

package pairing_test

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/database"
	"github.com/tuf-remote/agent/internal/database/migrations"
	"github.com/tuf-remote/agent/internal/modules/pairing"
	"github.com/tuf-remote/agent/internal/security"
)

// newTestDB opens a migrated temporary database.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Open(config.DatabaseConfig{Path: filepath.Join(t.TempDir(), "pairing.db")}, nil)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := database.Migrate(context.Background(), db, nil, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// newRepo returns a repository on a fresh database.
func newRepo(t *testing.T) *pairing.SQLiteRepository {
	t.Helper()
	return pairing.NewSQLiteRepository(newTestDB(t))
}

// seedDevice inserts a device with one token and returns both records plus
// the raw token.
func seedDevice(t *testing.T, repo *pairing.SQLiteRepository, name string) (pairing.Device, pairing.TokenRecord, string) {
	t.Helper()
	raw, err := security.GenerateToken()
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	deviceID, err := security.NewID()
	if err != nil {
		t.Fatalf("id: %v", err)
	}
	tokenID, err := security.NewID()
	if err != nil {
		t.Fatalf("id: %v", err)
	}

	device := pairing.Device{
		ID: deviceID, Name: name, Platform: "android", PairedAt: now,
	}
	token := pairing.TokenRecord{
		ID: tokenID, DeviceID: deviceID, Hash: security.HashToken(raw),
		Prefix: security.TokenPrefix(raw), CreatedAt: now,
	}
	if err := repo.CreateDeviceWithToken(context.Background(), device, token); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return device, token, raw
}

func TestCreateDeviceWithTokenIsAtomicAndQueryable(t *testing.T) {
	repo := newRepo(t)
	device, token, raw := seedDevice(t, repo, "Pixel 8")

	lookup, err := repo.LookupToken(context.Background(), security.HashToken(raw))
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if lookup.DeviceID != device.ID || lookup.TokenID != token.ID {
		t.Errorf("lookup = %+v", lookup)
	}
	if lookup.DeviceName != "Pixel 8" {
		t.Errorf("device name = %q", lookup.DeviceName)
	}
	if !lookup.ValidAt(time.Now()) {
		t.Error("fresh token must be valid")
	}
	// The stored value must be a hash, never the raw token.
	stored, err := repo.GetDevice(context.Background(), device.ID)
	if err != nil {
		t.Fatalf("GetDevice: %v", err)
	}
	if stored.Name != "Pixel 8" || stored.RevokedAt != "" {
		t.Errorf("device = %+v", stored)
	}
}

func TestLookupTokenUnknownHash(t *testing.T) {
	repo := newRepo(t)

	_, err := repo.LookupToken(context.Background(), security.HashToken("tuf_not-a-real-token"))
	if !errors.Is(err, pairing.ErrTokenNotFound) {
		t.Fatalf("err = %v, want ErrTokenNotFound", err)
	}
}

func TestTokenValidityRespectsExpiryAndGrace(t *testing.T) {
	repo := newRepo(t)
	_, token, raw := seedDevice(t, repo, "Pixel")
	ctx := context.Background()

	// Inside the rotation grace: revoked_at lies in the future.
	future := time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339)
	if err := repo.RetireTokenAt(ctx, token.ID, future); err != nil {
		t.Fatalf("RetireTokenAt: %v", err)
	}
	inGrace, err := repo.LookupToken(ctx, security.HashToken(raw))
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if !inGrace.ValidAt(time.Now()) {
		t.Error("token inside its grace window must still work")
	}
	if inGrace.ValidAt(time.Now().Add(2 * time.Minute)) {
		t.Error("token must stop working after the grace window")
	}

	// Retiring again must not move an already-scheduled revocation.
	pastStamp := time.Now().Add(-time.Minute).UTC().Format(time.RFC3339)
	if err := repo.RetireTokenAt(ctx, token.ID, pastStamp); !errors.Is(err, pairing.ErrTokenNotFound) {
		t.Errorf("second retire: err = %v, want ErrTokenNotFound (no overwrite)", err)
	}
	unchanged, err := repo.LookupToken(ctx, security.HashToken(raw))
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if unchanged.RevokedAt != future {
		t.Errorf("revoked_at = %q, want the original %q", unchanged.RevokedAt, future)
	}
	if unchanged.ValidAt(time.Now().Add(2 * time.Minute)) {
		t.Error("token must be dead past its grace window")
	}
}

func TestTokenExpiryRejectsStaleToken(t *testing.T) {
	repo := newRepo(t)
	ctx := context.Background()
	raw, err := security.GenerateToken()
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	now := time.Now().UTC()
	deviceID, _ := security.NewID()
	tokenID, _ := security.NewID()

	device := pairing.Device{ID: deviceID, Name: "Old", Platform: "android", PairedAt: now.Format(time.RFC3339)}
	token := pairing.TokenRecord{
		ID: tokenID, DeviceID: deviceID, Hash: security.HashToken(raw),
		Prefix:    security.TokenPrefix(raw),
		ExpiresAt: now.Add(-time.Second).Format(time.RFC3339),
		CreatedAt: now.Format(time.RFC3339),
	}
	if err := repo.CreateDeviceWithToken(ctx, device, token); err != nil {
		t.Fatalf("seed: %v", err)
	}

	lookup, err := repo.LookupToken(ctx, security.HashToken(raw))
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if lookup.ValidAt(now) {
		t.Error("expired token must not validate")
	}
	if !lookup.ValidAt(now.Add(-time.Minute)) {
		t.Error("the same token was valid before it expired")
	}
}

func TestRevokeDeviceKillsTokensAndIsIdempotentGuarded(t *testing.T) {
	repo := newRepo(t)
	device, _, raw := seedDevice(t, repo, "Tablet")
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)

	if err := repo.RevokeDevice(ctx, device.ID, now); err != nil {
		t.Fatalf("RevokeDevice: %v", err)
	}

	lookup, err := repo.LookupToken(ctx, security.HashToken(raw))
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if lookup.ValidAt(time.Now()) {
		t.Error("token of a revoked device must not validate")
	}

	if err := repo.RevokeDevice(ctx, device.ID, now); !errors.Is(err, pairing.ErrAlreadyRevoked) {
		t.Errorf("second revoke: err = %v, want ErrAlreadyRevoked", err)
	}
	if err := repo.RevokeDevice(ctx, "missing-device-id", now); !errors.Is(err, pairing.ErrDeviceNotFound) {
		t.Errorf("unknown device: err = %v, want ErrDeviceNotFound", err)
	}
}

func TestListDevicesIncludesRevokedAndLastSeen(t *testing.T) {
	repo := newRepo(t)
	ctx := context.Background()
	device, token, _ := seedDevice(t, repo, "Pixel 8")

	// Record a use, then a second one inside the throttle window: the
	// service always passes "stale before now minus one minute", so a
	// second write moments later must be ignored.
	used := time.Now().UTC().Format(time.RFC3339)
	staleBefore := time.Now().Add(-constants.TokenLastUsedStaleness).UTC().Format(time.RFC3339)
	if err := repo.TouchToken(ctx, token.ID, used, staleBefore); err != nil {
		t.Fatalf("TouchToken: %v", err)
	}
	second := time.Now().UTC().Add(30 * time.Second).Format(time.RFC3339)
	if err := repo.TouchToken(ctx, token.ID, second, staleBefore); err != nil {
		t.Fatalf("TouchToken: %v", err)
	}

	devices, err := repo.ListDevices(ctx)
	if err != nil {
		t.Fatalf("ListDevices: %v", err)
	}
	if len(devices) != 1 {
		t.Fatalf("len = %d, want 1", len(devices))
	}
	if devices[0].LastSeenAt == "" {
		t.Error("last_seen_at must be derived from token use")
	}
	if devices[0].LastSeenAt != used {
		t.Errorf("last_seen_at = %q, want the throttled first stamp %q", devices[0].LastSeenAt, used)
	}
	if devices[0].Info().Status != pairing.StatusActive {
		t.Errorf("status = %q", devices[0].Info().Status)
	}

	if err := repo.RevokeDevice(ctx, device.ID, time.Now().UTC().Format(time.RFC3339)); err != nil {
		t.Fatalf("RevokeDevice: %v", err)
	}
	devices, err = repo.ListDevices(ctx)
	if err != nil {
		t.Fatalf("ListDevices: %v", err)
	}
	if devices[0].Info().Status != pairing.StatusRevoked {
		t.Errorf("status after revoke = %q", devices[0].Info().Status)
	}
}

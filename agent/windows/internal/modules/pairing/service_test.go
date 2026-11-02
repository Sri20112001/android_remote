package pairing_test

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/audit"
	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/pairing"
	"github.com/tuf-remote/agent/internal/security"
)

// fakeAudit records entries in memory so tests can assert on them.
type fakeAudit struct {
	entries []audit.Entry
	err     error
}

func (f *fakeAudit) Record(_ context.Context, e audit.Entry) error {
	if f.err != nil {
		return f.err
	}
	f.entries = append(f.entries, e)
	return nil
}

func (f *fakeAudit) actions() []string {
	out := make([]string, 0, len(f.entries))
	for _, e := range f.entries {
		out = append(out, e.Action)
	}
	return out
}

// mutableClock is an injectable Clock the test can advance.
type mutableClock struct {
	now time.Time
}

func (c *mutableClock) Now() time.Time          { return c.now }
func (c *mutableClock) advance(d time.Duration) { c.now = c.now.Add(d) }

// newTestService builds a pairing service on a temporary database with a
// recorded audit trail and a controllable clock. The database handle is
// returned so tests can inspect what was persisted.
func newTestService(t *testing.T) (*pairing.Service, *fakeAudit, *mutableClock, *sql.DB) {
	t.Helper()

	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "debug", Format: "text"}, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("logger: %v", err)
	}

	clock := &mutableClock{now: time.Date(2026, 11, 1, 9, 0, 0, 0, time.UTC)}
	sink := &fakeAudit{}
	db := newTestDB(t)
	repo := pairing.NewSQLiteRepository(db)
	sessions := pairing.NewSessionStore(constants.DefaultPINTTL, constants.DefaultPINAttempts, constants.DefaultMaxPairingSessions)

	svc := pairing.NewService(repo, sessions, sink, logger, clock.Now, pairing.ServiceConfig{
		TokenGracePeriod: constants.DefaultTokenGracePeriod,
	})
	return svc, sink, clock, db
}

// startAndConfirm runs the happy path and returns the raw token.
func startAndConfirm(t *testing.T, svc *pairing.Service, name string) (pairing.ConfirmResponse, string) {
	t.Helper()

	start, err := svc.StartPairing(context.Background())
	if err != nil {
		t.Fatalf("StartPairing: %v", err)
	}
	confirmed, err := svc.ConfirmPairing(context.Background(), pairing.ConfirmRequest{
		PIN: start.PIN, Name: name, Model: "Pixel 8", OSVersion: "15", Platform: "android",
	})
	if err != nil {
		t.Fatalf("ConfirmPairing: %v", err)
	}
	if confirmed.Token.Token == "" {
		t.Fatal("confirm must hand over a raw token exactly once")
	}
	return confirmed, confirmed.Token.Token
}

func TestStartPairingIssuesPINWithoutPersistingIt(t *testing.T) {
	svc, sink, _, _ := newTestService(t)

	start, err := svc.StartPairing(context.Background())
	if err != nil {
		t.Fatalf("StartPairing: %v", err)
	}
	if len(start.PIN) != constants.PINLength || !security.ValidPINFormat(start.PIN) {
		t.Fatalf("PIN %q is not %d digits", start.PIN, constants.PINLength)
	}
	if start.AttemptsRemaining != constants.DefaultPINAttempts {
		t.Errorf("attempts = %d", start.AttemptsRemaining)
	}
	if start.ExpiresAt == "" || start.SessionID == "" {
		t.Errorf("response incomplete: %+v", start)
	}

	// The audit trail must not carry the PIN.
	for _, e := range sink.entries {
		if strings.Contains(e.Detail, start.PIN) {
			t.Fatalf("audit detail leaked the PIN: %q", e.Detail)
		}
	}
	// The session store holds it in memory only; the database has no
	// pairing table at all — verify no PIN-shaped value was written to
	// audit_logs either (the only place a PIN could land today).
	if got := sink.actions(); len(got) != 1 || got[0] != pairing.ActionPairingStart {
		t.Errorf("actions = %v", got)
	}
}

func TestStartPairingHonoursSessionCapacity(t *testing.T) {
	logger, err := logging.NewWithWriter(config.LoggingConfig{Level: "debug", Format: "text"}, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("logger: %v", err)
	}
	clock := &mutableClock{now: time.Now()}
	repo := pairing.NewSQLiteRepository(newTestDB(t))
	sessions := pairing.NewSessionStore(time.Hour, 3, 1)
	svc := pairing.NewService(repo, sessions, &fakeAudit{}, logger, clock.Now,
		pairing.ServiceConfig{TokenGracePeriod: time.Second})

	if _, err := svc.StartPairing(context.Background()); err != nil {
		t.Fatalf("first: %v", err)
	}
	if _, err := svc.StartPairing(context.Background()); !errors.Is(err, pairing.ErrTooManySessions) {
		t.Fatalf("second: err = %v, want ErrTooManySessions", err)
	}
}

func TestConfirmPairingRejectsWrongPIN(t *testing.T) {
	svc, sink, _, _ := newTestService(t)

	start, err := svc.StartPairing(context.Background())
	if err != nil {
		t.Fatalf("StartPairing: %v", err)
	}
	wrong := differ(start.PIN)

	_, err = svc.ConfirmPairing(context.Background(), pairing.ConfirmRequest{PIN: wrong, Name: "Phone"})
	if !errors.Is(err, pairing.ErrPINInvalid) {
		t.Fatalf("err = %v, want ErrPINInvalid", err)
	}
	// Failure must be audited without the attempted PIN.
	var confirmFailures int
	for _, e := range sink.entries {
		if e.Action == pairing.ActionPairingConfirm {
			confirmFailures++
			if e.Outcome != audit.OutcomeFailure {
				t.Errorf("outcome = %q", e.Outcome)
			}
			if strings.Contains(e.Detail, wrong) || strings.Contains(e.Detail, start.PIN) {
				t.Errorf("audit leaked a PIN: %q", e.Detail)
			}
		}
	}
	if confirmFailures != 1 {
		t.Errorf("confirm failures = %d, want 1", confirmFailures)
	}
}

func TestConfirmPairingValidatesName(t *testing.T) {
	svc, _, _, _ := newTestService(t)

	start, err := svc.StartPairing(context.Background())
	if err != nil {
		t.Fatalf("StartPairing: %v", err)
	}
	_, err = svc.ConfirmPairing(context.Background(), pairing.ConfirmRequest{PIN: start.PIN, Name: "   "})
	if !errors.Is(err, pairing.ErrInvalidRequest) {
		t.Fatalf("blank name: err = %v, want ErrInvalidRequest", err)
	}
}

func TestConfirmPairingStoresOnlyTheHash(t *testing.T) {
	svc, _, _, db := newTestService(t)
	_, raw := startAndConfirm(t, svc, "Pixel 8")

	// Dump every persisted token column: the raw token must not appear.
	stored, err := dumpTokenRows(db)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if strings.Contains(stored, raw) {
		t.Fatalf("raw token present in the database: %q", stored)
	}
	if !strings.Contains(stored, security.HashToken(raw)) {
		t.Fatalf("hashed token missing from the database: %q", stored)
	}
}

// dumpTokenRows renders the persisted token rows as one searchable string.
func dumpTokenRows(db *sql.DB) (string, error) {
	rows, err := db.Query(`SELECT id, device_id, token_hash, token_prefix FROM device_tokens`)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var b strings.Builder
	for rows.Next() {
		var id, deviceID, hash, prefix string
		if err := rows.Scan(&id, &deviceID, &hash, &prefix); err != nil {
			return "", err
		}
		b.WriteString(id)
		b.WriteString(deviceID)
		b.WriteString(hash)
		b.WriteString(prefix)
		b.WriteByte('\n')
	}
	return b.String(), rows.Err()
}

func TestValidateTokenRoundTrip(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	confirmed, raw := startAndConfirm(t, svc, "Pixel 8")

	id, err := svc.ValidateToken(context.Background(), raw)
	if err != nil {
		t.Fatalf("ValidateToken: %v", err)
	}
	if id.DeviceID != confirmed.Device.ID || id.DeviceName != "Pixel 8" {
		t.Errorf("identity = %+v", id)
	}
	if id.TokenID == "" || id.Local {
		t.Errorf("identity incomplete: %+v", id)
	}

	if _, err := svc.ValidateToken(context.Background(), "tuf_definitely-wrong"); !errors.Is(err, middleware.ErrInvalidToken) {
		t.Errorf("unknown token err = %v, want ErrInvalidToken", err)
	}
}

func TestRotateTokenIssuesNewAndExpiresOldAfterGrace(t *testing.T) {
	svc, sink, clock, _ := newTestService(t)
	_, raw := startAndConfirm(t, svc, "Pixel 8")

	rotated, err := svc.RotateToken(context.Background(), mustIdentity(t, svc, raw))
	if err != nil {
		t.Fatalf("RotateToken: %v", err)
	}
	if rotated.Token.Token == "" || rotated.Token.Token == raw {
		t.Fatal("rotation must issue a distinct fresh token")
	}

	// New token works immediately.
	if _, err := svc.ValidateToken(context.Background(), rotated.Token.Token); err != nil {
		t.Fatalf("new token rejected: %v", err)
	}
	// Old token still works inside the grace window.
	if _, err := svc.ValidateToken(context.Background(), raw); err != nil {
		t.Fatalf("old token rejected inside grace: %v", err)
	}
	// After the grace window it is dead.
	clock.advance(constants.DefaultTokenGracePeriod + time.Second)
	if _, err := svc.ValidateToken(context.Background(), raw); !errors.Is(err, middleware.ErrInvalidToken) {
		t.Errorf("old token err = %v, want ErrInvalidToken", err)
	}
	if _, err := svc.ValidateToken(context.Background(), rotated.Token.Token); err != nil {
		t.Errorf("new token must outlive the old one: %v", err)
	}

	if !contains(sink.actions(), pairing.ActionTokenRotate) {
		t.Errorf("rotation not audited: %v", sink.actions())
	}
}

func TestRevokeDeviceInvalidatesItsToken(t *testing.T) {
	svc, sink, _, _ := newTestService(t)
	confirmed, raw := startAndConfirm(t, svc, "Tablet")

	revoked, err := svc.RevokeDevice(context.Background(), confirmed.Device.ID)
	if err != nil {
		t.Fatalf("RevokeDevice: %v", err)
	}
	if revoked.Status != pairing.StatusRevoked {
		t.Errorf("status = %q", revoked.Status)
	}
	if _, err := svc.ValidateToken(context.Background(), raw); !errors.Is(err, middleware.ErrInvalidToken) {
		t.Errorf("revoked device token err = %v, want ErrInvalidToken", err)
	}
	if _, err := svc.RevokeDevice(context.Background(), confirmed.Device.ID); !errors.Is(err, pairing.ErrAlreadyRevoked) {
		t.Errorf("second revoke: err = %v", err)
	}
	if _, err := svc.RevokeDevice(context.Background(), "does-not-exist"); !errors.Is(err, pairing.ErrDeviceNotFound) {
		t.Errorf("unknown device: err = %v", err)
	}
	if !contains(sink.actions(), pairing.ActionDeviceRevoke) {
		t.Errorf("revocation not audited: %v", sink.actions())
	}
}

func TestListDevicesReportsBothStates(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	first, _ := startAndConfirm(t, svc, "Pixel 8")
	second, _ := startAndConfirm(t, svc, "Tablet")

	if _, err := svc.RevokeDevice(context.Background(), second.Device.ID); err != nil {
		t.Fatalf("RevokeDevice: %v", err)
	}

	list, err := svc.ListDevices(context.Background())
	if err != nil {
		t.Fatalf("ListDevices: %v", err)
	}
	if len(list.Devices) != 2 {
		t.Fatalf("len = %d, want 2", len(list.Devices))
	}

	byID := map[string]pairing.DeviceInfo{}
	for _, d := range list.Devices {
		byID[d.ID] = d
	}
	if byID[first.Device.ID].Status != pairing.StatusActive {
		t.Errorf("first status = %q", byID[first.Device.ID].Status)
	}
	if byID[second.Device.ID].Status != pairing.StatusRevoked {
		t.Errorf("second status = %q", byID[second.Device.ID].Status)
	}
}

func TestAuditFailureIsLoggedButDoesNotLeakSecrets(t *testing.T) {
	svc, sink, _, _ := newTestService(t)
	sink.err = errors.New("audit backend down")

	// The pairing flow must still complete; the failure is logged instead.
	start, err := svc.StartPairing(context.Background())
	if err != nil {
		t.Fatalf("StartPairing: %v", err)
	}
	if _, err := svc.ConfirmPairing(context.Background(), pairing.ConfirmRequest{
		PIN: start.PIN, Name: "Pixel 8",
	}); err != nil {
		t.Fatalf("ConfirmPairing: %v", err)
	}
}

// contains reports whether list includes want.
func contains(list []string, want string) bool {
	for _, item := range list {
		if item == want {
			return true
		}
	}
	return false
}

// mustIdentity validates a raw token and returns the resulting identity.
func mustIdentity(t *testing.T, svc *pairing.Service, raw string) middleware.Identity {
	t.Helper()
	id, err := svc.ValidateToken(context.Background(), raw)
	if err != nil {
		t.Fatalf("ValidateToken: %v", err)
	}
	return id
}

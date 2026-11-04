package pairing_test

import (
	"errors"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/modules/pairing"
)

func testStore() *pairing.SessionStore {
	return pairing.NewSessionStore(constants.DefaultPINTTL, constants.DefaultPINAttempts, constants.DefaultMaxPairingSessions)
}

func TestCreateIssuesSixDigitPINWithDeadline(t *testing.T) {
	store := testStore()
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

	sess, err := store.Create(now)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if len(sess.PIN) != constants.PINLength {
		t.Errorf("PIN %q has %d digits, want %d", sess.PIN, len(sess.PIN), constants.PINLength)
	}
	if sess.ID == "" {
		t.Error("session id must be set")
	}
	if want := now.Add(constants.DefaultPINTTL); !sess.ExpiresAt.Equal(want) {
		t.Errorf("expiresAt = %v, want %v", sess.ExpiresAt, want)
	}
	if sess.AttemptsLeft != constants.DefaultPINAttempts {
		t.Errorf("attempts = %d, want %d", sess.AttemptsLeft, constants.DefaultPINAttempts)
	}
}

func TestCreateEnforcesCapacityAndPurgesExpired(t *testing.T) {
	store := pairing.NewSessionStore(time.Minute, 3, 2)
	now := time.Now()

	first, err := store.Create(now)
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	if _, err := store.Create(now.Add(time.Second)); err != nil {
		t.Fatalf("second: %v", err)
	}
	// Third session creation evicts the oldest session ('first') so capacity is bounded
	// and pairing creation never fails with an exceed limit error.
	third, err := store.Create(now.Add(2 * time.Second))
	if err != nil {
		t.Fatalf("third should succeed by evicting oldest: %v", err)
	}
	if count := store.ActiveCount(now.Add(2 * time.Second)); count != 2 {
		t.Fatalf("active count must be capped at 2, got %d", count)
	}
	// 'first' should be gone because it was evicted.
	if _, err := store.Consume(first.PIN, now.Add(2*time.Second)); !errors.Is(err, pairing.ErrPINInvalid) {
		t.Errorf("evicted session PIN should be invalid, got %v", err)
	}
	// 'third' should still be valid.
	if _, err := store.Consume(third.PIN, now.Add(2*time.Second)); err != nil {
		t.Errorf("third session PIN should be valid, got %v", err)
	}

	// After the remaining sessions expire, capacity drops to 0.
	later := now.Add(5 * time.Minute)
	if store.ActiveCount(later) != 0 {
		t.Fatalf("expired sessions must be purged, count = %d", store.ActiveCount(later))
	}
	if _, err := store.Create(later); err != nil {
		t.Fatalf("create after purge: %v", err)
	}
}

func TestConsumeWithUnlimitedAttemptsDoesNotBurnSession(t *testing.T) {
	// maxAttempts = 0 means unlimited attempts
	store := pairing.NewSessionStore(time.Minute, 0, 3)
	now := time.Now()

	sess, err := store.Create(now)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	wrong := differ(sess.PIN)
	for attempt := 1; attempt <= 20; attempt++ {
		_, err := store.Consume(wrong, now)
		if !errors.Is(err, pairing.ErrPINInvalid) {
			t.Fatalf("attempt %d: err = %v, want ErrPINInvalid", attempt, err)
		}
	}
	// Session must NOT be burned despite 20 wrong PIN attempts.
	if got := store.ActiveCount(now); got != 1 {
		t.Errorf("session must still be active when maxAttempts=0, got active = %d", got)
	}
	// Correct PIN still succeeds.
	if _, err := store.Consume(sess.PIN, now); err != nil {
		t.Errorf("correct PIN should succeed after wrong attempts: %v", err)
	}
}

func TestConsumeMatchesCorrectPINOnce(t *testing.T) {
	store := testStore()
	now := time.Now()

	opened, err := store.Create(now)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	consumed, err := store.Consume(opened.PIN, now)
	if err != nil {
		t.Fatalf("Consume: %v", err)
	}
	if consumed.ID != opened.ID {
		t.Errorf("consumed session %q, want %q", consumed.ID, opened.ID)
	}

	// Single use: the same PIN no longer works.
	if _, err := store.Consume(opened.PIN, now); !errors.Is(err, pairing.ErrPINInvalid) {
		t.Errorf("second use: err = %v, want ErrPINInvalid", err)
	}
}

func TestConsumeRejectsWrongPINAndBurnsSession(t *testing.T) {
	store := pairing.NewSessionStore(time.Minute, 3, 3)
	now := time.Now()

	sess, err := store.Create(now)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// A PIN guaranteed to differ from the issued one (never a coin flip).
	wrong := differ(sess.PIN)
	for attempt := 1; attempt <= 3; attempt++ {
		_, err := store.Consume(wrong, now)
		if !errors.Is(err, pairing.ErrPINInvalid) {
			t.Fatalf("attempt %d: err = %v, want ErrPINInvalid", attempt, err)
		}
	}
	// Budget exhausted: the session is gone even for a valid-looking count.
	if got := store.ActiveCount(now); got != 0 {
		t.Errorf("session must be burned after 3 wrong PINs, active = %d", got)
	}
}

// differ returns a 6-digit PIN that provably differs from in.
func differ(in string) string {
	// Flip the last digit between 0 and 1: different for every input.
	if in[len(in)-1] == '0' {
		return in[:len(in)-1] + "1"
	}
	return in[:len(in)-1] + "0"
}

func TestConsumeRejectsExpiredPIN(t *testing.T) {
	store := pairing.NewSessionStore(50*time.Millisecond, 5, 3)
	now := time.Now()

	sess, err := store.Create(now)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	later := now.Add(time.Second)
	if _, err := store.Consume(sess.PIN, later); !errors.Is(err, pairing.ErrPINInvalid) {
		t.Errorf("err = %v, want ErrPINInvalid after expiry", err)
	}
}

func TestCreateGeneratesDistinctPINs(t *testing.T) {
	store := pairing.NewSessionStore(time.Hour, 5, 20)
	now := time.Now()

	seen := make(map[string]bool, 20)
	for i := 0; i < 20; i++ {
		sess, err := store.Create(now)
		if err != nil {
			t.Fatalf("Create %d: %v", i, err)
		}
		if seen[sess.PIN] {
			t.Fatalf("PIN %q issued twice within one run", sess.PIN)
		}
		seen[sess.PIN] = true
	}
}

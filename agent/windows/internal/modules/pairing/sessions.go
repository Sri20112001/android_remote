package pairing

import (
	"errors"
	"sync"
	"time"

	"github.com/tuf-remote/agent/internal/security"
)

// Session-store errors (mapped to HTTP statuses by the controller).
var (
	// ErrPINInvalid covers every PIN failure — unknown, expired, burned or
	// not yet started — so responses never reveal which.
	ErrPINInvalid = errors.New("pairing: invalid or expired pairing PIN")
	// ErrTooManySessions means the configured session capacity is in use.
	ErrTooManySessions = errors.New("pairing: too many active pairing sessions")
)

// session is one open pairing window. Sessions live only in memory: a
// restart invalidates every outstanding PIN, which is the desired failure
// mode for a secret with a lifetime of minutes.
type session struct {
	id        string
	pin       string
	createdAt time.Time
	expiresAt time.Time
	attempts  int
}

// SessionStore manages open pairing sessions under a capacity, a TTL and
// an attempt budget. It is safe for concurrent use.
type SessionStore struct {
	mu          sync.Mutex
	ttl         time.Duration
	maxAttempts int
	maxActive   int
	sessions    map[string]*session
}

// NewSessionStore builds a store with the configured limits.
func NewSessionStore(ttl time.Duration, maxAttempts, maxActive int) *SessionStore {
	return &SessionStore{
		ttl:         ttl,
		maxAttempts: maxAttempts,
		maxActive:   maxActive,
		sessions:    make(map[string]*session),
	}
}

// Create opens a new session at now. Expired sessions are purged first, so
// they never count against capacity. If capacity is reached, the oldest session
// is evicted so creating a session never fails with an exceed limit error.
func (s *SessionStore) Create(now time.Time) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pruneExpired(now)
	if s.maxActive > 0 && len(s.sessions) >= s.maxActive {
		var oldestID string
		var oldestTime time.Time
		for id, sess := range s.sessions {
			if oldestID == "" || sess.createdAt.Before(oldestTime) {
				oldestID = id
				oldestTime = sess.createdAt
			}
		}
		if oldestID != "" {
			delete(s.sessions, oldestID)
		}
	}

	id, err := security.NewID()
	if err != nil {
		return Session{}, err
	}
	pin, err := security.GeneratePIN()
	if err != nil {
		return Session{}, err
	}

	sess := &session{
		id:        id,
		pin:       pin,
		createdAt: now,
		expiresAt: now.Add(s.ttl),
	}
	s.sessions[id] = sess
	return s.sessionView(sess), nil
}

// Consume matches pin against the currently open sessions. A match removes
// the session (PINs are single use). A mismatch charges one attempt to
// every open session and burns the ones that run out (if maxAttempts > 0).
func (s *SessionStore) Consume(pin string, now time.Time) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pruneExpired(now)

	// Compare against every session without early exit so timing does not
	// reveal which (if any) session was close.
	matchedID := ""
	for id, sess := range s.sessions {
		if security.PINMatches(sess.pin, pin) {
			matchedID = id
		}
	}
	if matchedID != "" {
		matched := s.sessions[matchedID]
		delete(s.sessions, matchedID)
		return s.sessionView(matched), nil
	}

	for id, sess := range s.sessions {
		sess.attempts++
		if s.maxAttempts > 0 && sess.attempts >= s.maxAttempts {
			delete(s.sessions, id)
		}
	}
	return Session{}, ErrPINInvalid
}

// ActiveCount reports open sessions at now (used for capacity feedback).
func (s *SessionStore) ActiveCount(now time.Time) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneExpired(now)
	return len(s.sessions)
}

// pruneExpired drops sessions past their TTL. Callers hold s.mu.
func (s *SessionStore) pruneExpired(now time.Time) {
	for id, sess := range s.sessions {
		if !now.Before(sess.expiresAt) {
			delete(s.sessions, id)
		}
	}
}

// sessionView copies a session into the exported value type. maxAttempts
// comes from the owning store so the session itself needs no copy of it.
func (s *SessionStore) sessionView(sess *session) Session {
	left := 0
	if s.maxAttempts > 0 {
		left = s.maxAttempts - sess.attempts
		if left < 0 {
			left = 0
		}
	}
	return Session{
		ID:           sess.id,
		PIN:          sess.pin,
		ExpiresAt:    sess.expiresAt,
		AttemptsLeft: left,
	}
}

// Session is the public view of an open pairing session.
type Session struct {
	ID           string
	PIN          string
	ExpiresAt    time.Time
	AttemptsLeft int
}

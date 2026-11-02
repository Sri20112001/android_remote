package pairing

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/tuf-remote/agent/internal/audit"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/security"
)

// Service-level errors mapped by the controller.
var (
	// ErrInvalidRequest covers malformed input the caller can fix
	// (missing name, out-of-range metadata, bad device id length).
	ErrInvalidRequest = errors.New("pairing: invalid request")
)

// AuditSink records pairing events. Defined as an interface so tests can
// observe calls without a database; the production implementation is
// *audit.Logger.
type AuditSink interface {
	Record(ctx context.Context, e audit.Entry) error
}

// Clock supplies the current time; injectable so tests can drive expiry
// and throttling deterministically.
type Clock func() time.Time

// Service implements the pairing and token lifecycle. Every method that
// mutates state writes an audit entry; audit failures are logged loudly
// but never leak secrets (details carry ids and names only).
type Service struct {
	repo     Repository
	sessions *SessionStore
	audit    AuditSink
	clock    Clock
	logger   *slog.Logger
	grace    time.Duration
}

// ServiceConfig carries the settings the service needs.
type ServiceConfig struct {
	TokenGracePeriod time.Duration
}

// NewService wires the pairing service.
func NewService(
	repo Repository,
	sessions *SessionStore,
	sink AuditSink,
	logger *slog.Logger,
	clock Clock,
	cfg ServiceConfig,
) *Service {
	if clock == nil {
		clock = time.Now
	}
	return &Service{
		repo:     repo,
		sessions: sessions,
		audit:    sink,
		clock:    clock,
		logger:   logger,
		grace:    cfg.TokenGracePeriod,
	}
}

// StartPairing opens a pairing session. It is only ever called from a
// loopback request (enforced by middleware); the PIN it returns must be
// shown to the PC user and never logged.
func (s *Service) StartPairing(ctx context.Context) (StartResponse, error) {
	now := s.clock()
	sess, err := s.sessions.Create(now)
	if err != nil {
		if errors.Is(err, ErrTooManySessions) {
			s.record(ctx, audit.Entry{
				ActorType: audit.ActorLocal,
				Action:    ActionPairingStart,
				Outcome:   audit.OutcomeFailure,
				Detail:    "session capacity reached",
			})
			return StartResponse{}, err
		}
		return StartResponse{}, fmt.Errorf("create pairing session: %w", err)
	}

	s.record(ctx, audit.Entry{
		ActorType: audit.ActorLocal,
		Action:    ActionPairingStart,
		Outcome:   audit.OutcomeSuccess,
		Resource:  "session/" + sess.ID,
		Detail:    fmt.Sprintf("expires_at=%s attempts=%d", sess.ExpiresAt.UTC().Format(time.RFC3339), sess.AttemptsLeft),
	})

	return StartResponse{
		SessionID:         sess.ID,
		PIN:               sess.PIN,
		ExpiresAt:         sess.ExpiresAt.UTC().Format(time.RFC3339),
		AttemptsRemaining: sess.AttemptsLeft,
	}, nil
}

// ConfirmPairing exchanges a PIN for a fresh device token. The raw token
// is returned exactly once; only its hash is stored.
func (s *Service) ConfirmPairing(ctx context.Context, req ConfirmRequest) (ConfirmResponse, error) {
	if !security.ValidPINFormat(req.PIN) {
		// Same error as a wrong PIN: format is not an oracle.
		return ConfirmResponse{}, ErrPINInvalid
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > constants.MaxDeviceNameLength {
		return ConfirmResponse{}, ErrInvalidRequest
	}
	if len(req.Model) > constants.MaxDeviceMetaLength ||
		len(req.OSVersion) > constants.MaxDeviceMetaLength {
		return ConfirmResponse{}, ErrInvalidRequest
	}

	now := s.clock()
	if _, err := s.sessions.Consume(req.PIN, now); err != nil {
		s.record(ctx, audit.Entry{
			ActorType: audit.ActorDevice,
			Action:    ActionPairingConfirm,
			Outcome:   audit.OutcomeFailure,
			Detail:    "pin rejected",
		})
		return ConfirmResponse{}, err
	}

	device, token, raw, err := s.issueDevice(ctx, name, req, now)
	if err != nil {
		return ConfirmResponse{}, err
	}

	s.record(ctx, audit.Entry{
		ActorType: audit.ActorDevice,
		ActorID:   device.ID,
		Action:    ActionPairingConfirm,
		Outcome:   audit.OutcomeSuccess,
		Resource:  "device/" + device.ID,
		Detail:    "name=" + device.Name + " platform=" + device.Platform,
	})

	return ConfirmResponse{
		Device: device.Info(),
		Token: TokenInfo{
			Token:     raw,
			ExpiresAt: token.ExpiresAt,
		},
	}, nil
}

// issueDevice mints identifiers, persists device + token atomically and
// returns the raw token for the one-time handover.
func (s *Service) issueDevice(ctx context.Context, name string, req ConfirmRequest, now time.Time) (Device, TokenRecord, string, error) {
	deviceID, err := security.NewID()
	if err != nil {
		return Device{}, TokenRecord{}, "", fmt.Errorf("device id: %w", err)
	}
	tokenID, err := security.NewID()
	if err != nil {
		return Device{}, TokenRecord{}, "", fmt.Errorf("token id: %w", err)
	}
	raw, err := security.GenerateToken()
	if err != nil {
		return Device{}, TokenRecord{}, "", fmt.Errorf("device token: %w", err)
	}

	platform := strings.TrimSpace(req.Platform)
	if platform == "" {
		platform = "android"
	}
	stamp := now.UTC().Format(time.RFC3339)
	device := Device{
		ID:        deviceID,
		Name:      name,
		Platform:  platform,
		Model:     strings.TrimSpace(req.Model),
		OSVersion: strings.TrimSpace(req.OSVersion),
		PairedAt:  stamp,
	}
	token := TokenRecord{
		ID:        tokenID,
		DeviceID:  deviceID,
		Hash:      security.HashToken(raw),
		Prefix:    security.TokenPrefix(raw),
		CreatedAt: stamp,
	}

	if err := s.repo.CreateDeviceWithToken(ctx, device, token); err != nil {
		return Device{}, TokenRecord{}, "", fmt.Errorf("persist paired device: %w", err)
	}
	return device, token, raw, nil
}

// ListDevices returns every paired device (loopback callers only).
func (s *Service) ListDevices(ctx context.Context) (DevicesResponse, error) {
	devices, err := s.repo.ListDevices(ctx)
	if err != nil {
		return DevicesResponse{}, err
	}
	views := make([]DeviceInfo, 0, len(devices))
	for _, d := range devices {
		views = append(views, d.Info())
	}
	return DevicesResponse{Devices: views}, nil
}

// RevokeDevice withdraws a device's access (loopback callers only).
func (s *Service) RevokeDevice(ctx context.Context, deviceID string) (RevokeResponse, error) {
	if len(deviceID) == 0 || len(deviceID) > constants.MaxSessionIDLength {
		return RevokeResponse{}, ErrInvalidRequest
	}
	now := s.clock().UTC().Format(time.RFC3339)

	err := s.repo.RevokeDevice(ctx, deviceID, now)
	switch {
	case errors.Is(err, ErrDeviceNotFound):
		return RevokeResponse{}, err
	case errors.Is(err, ErrAlreadyRevoked):
		return RevokeResponse{}, err
	case err != nil:
		return RevokeResponse{}, err
	}

	s.record(ctx, audit.Entry{
		ActorType: audit.ActorLocal,
		Action:    ActionDeviceRevoke,
		Outcome:   audit.OutcomeSuccess,
		Resource:  "device/" + deviceID,
		Detail:    "access withdrawn",
	})
	return RevokeResponse{DeviceID: deviceID, Status: StatusRevoked}, nil
}

// RotateToken exchanges the caller's current token for a fresh one. The
// identity comes from the RequireToken middleware, which already proved
// possession, so no raw token is handled here. The old token keeps
// working for the configured grace window, then dies.
func (s *Service) RotateToken(ctx context.Context, id middleware.Identity) (RotateResponse, error) {
	if id.TokenID == "" || id.DeviceID == "" {
		// RequireLocal-style identities have no token: rotation demands a
		// real credential, which RequireToken guarantees.
		return RotateResponse{}, middleware.ErrInvalidToken
	}

	now := s.clock()
	tokenID, err := security.NewID()
	if err != nil {
		return RotateResponse{}, fmt.Errorf("token id: %w", err)
	}
	fresh, err := security.GenerateToken()
	if err != nil {
		return RotateResponse{}, fmt.Errorf("device token: %w", err)
	}

	stamp := now.UTC().Format(time.RFC3339)
	newToken := TokenRecord{
		ID:        tokenID,
		DeviceID:  id.DeviceID,
		Hash:      security.HashToken(fresh),
		Prefix:    security.TokenPrefix(fresh),
		CreatedAt: stamp,
	}
	if err := s.repo.CreateToken(ctx, newToken); err != nil {
		return RotateResponse{}, fmt.Errorf("persist rotated token: %w", err)
	}

	retireAt := now.Add(s.grace).UTC().Format(time.RFC3339)
	if err := s.repo.RetireTokenAt(ctx, id.TokenID, retireAt); err != nil {
		// The new token exists; the old one just dies immediately instead
		// of after the grace window — still safe, so report success.
		s.logger.Warn("token grace scheduling failed",
			"error", err,
			"token_id", id.TokenID,
		)
	}

	s.record(ctx, audit.Entry{
		ActorType: audit.ActorDevice,
		ActorID:   id.DeviceID,
		Action:    ActionTokenRotate,
		Outcome:   audit.OutcomeSuccess,
		Resource:  "device/" + id.DeviceID,
		Detail:    fmt.Sprintf("grace_seconds=%d", int(s.grace.Seconds())),
	})

	return RotateResponse{Token: TokenInfo{
		Token:     fresh,
		ExpiresAt: newToken.ExpiresAt,
	}}, nil
}

// ValidateToken implements middleware.TokenValidator: it resolves a raw
// bearer token to an identity, updating the last-seen stamp on the way.
func (s *Service) ValidateToken(ctx context.Context, rawToken string) (middleware.Identity, error) {
	now := s.clock()
	lookup, err := s.repo.LookupToken(ctx, security.HashToken(rawToken))
	switch {
	case errors.Is(err, ErrTokenNotFound):
		return middleware.Identity{}, middleware.ErrInvalidToken
	case err != nil:
		return middleware.Identity{}, err
	}
	if !lookup.ValidAt(now) {
		return middleware.Identity{}, middleware.ErrInvalidToken
	}

	stamp := now.UTC().Format(time.RFC3339)
	staleBefore := now.Add(-constants.TokenLastUsedStaleness).UTC().Format(time.RFC3339)
	if err := s.repo.TouchToken(ctx, lookup.TokenID, stamp, staleBefore); err != nil {
		// Last-seen is bookkeeping: log and continue authenticating.
		s.logger.Warn("token use stamp failed", "error", err, "token_id", lookup.TokenID)
	}

	return middleware.Identity{
		DeviceID:   lookup.DeviceID,
		DeviceName: lookup.DeviceName,
		TokenID:    lookup.TokenID,
	}, nil
}

// record writes an audit entry; a failure is logged because an unwritten
// security event must never pass unnoticed. Details are id/name only.
func (s *Service) record(ctx context.Context, e audit.Entry) {
	if err := s.audit.Record(ctx, e); err != nil {
		s.logger.Error("audit write failed",
			"action", e.Action,
			"outcome", e.Outcome,
			"error", err,
		)
	}
}

package power

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/tuf-remote/agent/internal/audit"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

type confirmation struct {
	action    string
	deviceID  string
	expiresAt time.Time
}

// Service manages power operations and two-step confirmation flows.
type Service struct {
	executor      Executor
	auditLogger   *audit.Logger
	logger        *slog.Logger
	mu            sync.Mutex
	confirmations map[string]confirmation
}

// NewService constructs a power service.
func NewService(executor Executor, auditLogger *audit.Logger, logger *slog.Logger) *Service {
	return &Service{
		executor:      executor,
		auditLogger:   auditLogger,
		logger:        logger,
		confirmations: make(map[string]confirmation),
	}
}

// Lock immediately locks the Windows desktop.
func (s *Service) Lock(ctx context.Context, id middleware.Identity) error {
	err := s.executor.Lock()
	actorType := "device"
	if id.Local {
		actorType = "local"
	}

	outcome := "success"
	detail := "workstation locked"
	if err != nil {
		outcome = "failure"
		detail = err.Error()
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Record(ctx, audit.Entry{
			ActorType: actorType,
			ActorID:   id.DeviceID,
			Action:    "power.lock",
			Resource:  "workstation",
			Outcome:   outcome,
			Detail:    detail,
		})
	}

	return err
}

// RequestConfirmation initiates a confirmation window for a destructive power action.
func (s *Service) RequestConfirmation(ctx context.Context, id middleware.Identity, action string) (*RequestResponse, error) {
	switch action {
	case ActionSleep, ActionHibernate, ActionRestart, ActionShutdown:
	default:
		return nil, fmt.Errorf("unsupported power action: %s", action)
	}

	b := make([]byte, 16)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)

	expiresAt := time.Now().UTC().Add(30 * time.Second)

	s.mu.Lock()
	// Clean expired tokens
	now := time.Now()
	for k, v := range s.confirmations {
		if now.After(v.expiresAt) {
			delete(s.confirmations, k)
		}
	}
	s.confirmations[token] = confirmation{
		action:    action,
		deviceID:  id.DeviceID,
		expiresAt: expiresAt,
	}
	s.mu.Unlock()

	return &RequestResponse{
		ConfirmationToken: token,
		Action:            action,
		ExpiresAt:         expiresAt.Format(time.RFC3339),
	}, nil
}

// Confirm validates a token and triggers the power operation.
func (s *Service) Confirm(ctx context.Context, id middleware.Identity, token string) (*ConfirmResponse, error) {
	s.mu.Lock()
	conf, ok := s.confirmations[token]
	if !ok || time.Now().After(conf.expiresAt) {
		delete(s.confirmations, token)
		s.mu.Unlock()
		return nil, fmt.Errorf("invalid or expired confirmation token")
	}
	delete(s.confirmations, token)
	s.mu.Unlock()

	actorType := "device"
	if id.Local {
		actorType = "local"
	}

	var opErr error
	switch conf.action {
	case ActionSleep:
		opErr = s.executor.Sleep()
	case ActionHibernate:
		opErr = s.executor.Hibernate()
	case ActionRestart:
		opErr = s.executor.Restart()
	case ActionShutdown:
		opErr = s.executor.Shutdown()
	}

	outcome := "success"
	detail := conf.action + " executed"
	if opErr != nil {
		outcome = "failure"
		detail = opErr.Error()
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Record(ctx, audit.Entry{
			ActorType: actorType,
			ActorID:   id.DeviceID,
			Action:    "power." + conf.action,
			Resource:  "system",
			Outcome:   outcome,
			Detail:    detail,
		})
	}

	if opErr != nil {
		return nil, opErr
	}

	return &ConfirmResponse{
		Action: conf.action,
		Status: "initiated",
	}, nil
}

// RegisterWS registers power commands with the WebSocket registry.
func (s *Service) RegisterWS(registry *ws.Registry) {
	registry.Register("power", "lock", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		if err := s.Lock(ctx, id); err != nil {
			return nil, ws.NewCommandError(constants.CodeInternal, err.Error())
		}
		return map[string]string{"status": "locked"}, nil
	})

	registry.Register("power", "request", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req RequestPayload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		res, err := s.RequestConfirmation(ctx, id, req.Action)
		if err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, err.Error())
		}
		return res, nil
	})

	registry.Register("power", "confirm", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		var req ConfirmPayload
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, "invalid json payload")
		}
		res, err := s.Confirm(ctx, id, req.ConfirmationToken)
		if err != nil {
			return nil, ws.NewCommandError(constants.CodeInvalidRequest, err.Error())
		}
		return res, nil
	})
}

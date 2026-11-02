package monitoring

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/ws"
)

// Service coordinates system monitoring and WebSocket telemetry broadcast.
type Service struct {
	provider MetricsProvider
	hub      *ws.Hub
	logger   *slog.Logger
}

// NewService constructs a monitoring service.
func NewService(provider MetricsProvider, hub *ws.Hub, logger *slog.Logger) *Service {
	return &Service{
		provider: provider,
		hub:      hub,
		logger:   logger,
	}
}

// GetMetrics returns a current snapshot of system metrics.
func (s *Service) GetMetrics(ctx context.Context) (SystemMetrics, error) {
	return s.provider.CollectMetrics(ctx)
}

// RegisterWS registers the monitoring command with the WebSocket registry.
func (s *Service) RegisterWS(registry *ws.Registry) {
	registry.Register("monitoring", "metrics", func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error) {
		return s.GetMetrics(ctx)
	})
}

// StartBroadcaster broadcasts telemetry to active WebSocket clients periodically.
func (s *Service) StartBroadcaster(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if s.hub != nil && s.hub.ConnectionCount() > 0 {
					metrics, err := s.provider.CollectMetrics(ctx)
					if err == nil {
						s.hub.Broadcast("monitoring.metrics", metrics)
					}
				}
			}
		}
	}()
}

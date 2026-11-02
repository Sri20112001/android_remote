package monitoring

import "context"

// MetricsProvider abstracts hardware metrics measurement for testability.
type MetricsProvider interface {
	CollectMetrics(ctx context.Context) (SystemMetrics, error)
}

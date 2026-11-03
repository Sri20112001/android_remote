package monitoring

import "context"

// MetricsProvider abstracts hardware metrics measurement for testability.
type MetricsProvider interface {
	CollectMetrics(ctx context.Context) (SystemMetrics, error)
	GetProcesses(ctx context.Context) ([]ProcessInfo, error)
	KillProcess(pid int) error
}

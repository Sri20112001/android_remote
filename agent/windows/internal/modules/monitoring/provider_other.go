//go:build !windows

package monitoring

import "context"

type OtherMetricsProvider struct{}

func NewMetricsProvider() *OtherMetricsProvider {
	return &OtherMetricsProvider{}
}

func (p *OtherMetricsProvider) CollectMetrics(ctx context.Context) (SystemMetrics, error) {
	return SystemMetrics{}, nil
}

func (p *OtherMetricsProvider) GetProcesses(ctx context.Context) ([]ProcessInfo, error) {
	return []ProcessInfo{}, nil
}

func (p *OtherMetricsProvider) KillProcess(pid int) error {
	return nil
}


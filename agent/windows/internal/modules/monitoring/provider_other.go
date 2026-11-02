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

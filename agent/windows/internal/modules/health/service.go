package health

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/platform"
)

// SystemInfoProvider abstracts the platform-specific host information so the
// service can be unit tested with a fake.
type SystemInfoProvider interface {
	Collect(ctx context.Context) (platform.Info, error)
}

// Store is the subset of the database the health checks need.
// PingContext matches *sql.DB directly.
type Store interface {
	PingContext(ctx context.Context) error
}

// Service provides health and system information to the transport layer.
type Service struct {
	startedAt time.Time
	sysInfo   SystemInfoProvider
	store     Store
}

// NewService wires the health service. startedAt is the agent's boot time
// (process start), used for the reported uptime.
func NewService(startedAt time.Time, sysInfo SystemInfoProvider, store Store) *Service {
	return &Service{startedAt: startedAt, sysInfo: sysInfo, store: store}
}

// Health reports the liveness of the agent process.
func (s *Service) Health() HealthResponse {
	return HealthResponse{
		Status:             StatusOK,
		AppName:            constants.AppName,
		Version:            constants.AppVersion,
		AgentUptimeSeconds: s.agentUptimeSeconds(),
		Timestamp:          time.Now().UTC().Format(time.RFC3339),
	}
}

// SystemInfo collects static host information from the platform provider.
// A provider failure is returned as an error; nothing is faked.
func (s *Service) SystemInfo(ctx context.Context) (SystemInfoResponse, error) {
	info, err := s.sysInfo.Collect(ctx)
	if err != nil {
		return SystemInfoResponse{}, fmt.Errorf("collect system info: %w", err)
	}
	return SystemInfoResponse{
		AppName:       constants.AppName,
		Version:       constants.AppVersion,
		Hostname:      info.Hostname,
		OS:            info.OS,
		OSVersion:     info.OSVersion,
		IPAddresses:   info.IPAddresses,
		UptimeSeconds: info.UptimeSeconds,
	}, nil
}

// SystemStatus pings the database and samples the process. It returns both
// the response and the underlying error (if any) so the controller can log
// the cause while still answering with a degraded payload.
func (s *Service) SystemStatus(ctx context.Context) (SystemStatusResponse, error) {
	resp := SystemStatusResponse{
		Status:             StatusOK,
		AppName:            constants.AppName,
		Version:            constants.AppVersion,
		AgentUptimeSeconds: s.agentUptimeSeconds(),
		Timestamp:          time.Now().UTC().Format(time.RFC3339),
		Database:           ComponentStatus{Status: StatusOK},
		Process:            sampleProcess(),
	}

	pingCtx, cancel := context.WithTimeout(ctx, constants.DefaultDatabasePingTimeout)
	defer cancel()
	if err := s.store.PingContext(pingCtx); err != nil {
		resp.Status = StatusDegraded
		resp.Database = ComponentStatus{Status: StatusDegraded}
		return resp, fmt.Errorf("database ping: %w", err)
	}
	return resp, nil
}

// agentUptimeSeconds reports how long the agent process has been running.
func (s *Service) agentUptimeSeconds() int64 {
	return int64(time.Since(s.startedAt).Seconds())
}

// sampleProcess captures the agent's runtime statistics.
func sampleProcess() ProcessStatus {
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	return ProcessStatus{
		Goroutines: runtime.NumGoroutine(),
		Memory: MemoryStatus{
			HeapAllocBytes: stats.HeapAlloc,
			HeapSysBytes:   stats.HeapSys,
			SysBytes:       stats.Sys,
			NumGC:          stats.NumGC,
		},
	}
}

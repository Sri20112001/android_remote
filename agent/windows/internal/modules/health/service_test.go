package health_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/modules/health"
	"github.com/tuf-remote/agent/internal/platform"
)

// fakeSysInfo returns a canned platform.Info or error.
type fakeSysInfo struct {
	info platform.Info
	err  error
}

func (f fakeSysInfo) Collect(context.Context) (platform.Info, error) {
	return f.info, f.err
}

// fakeStore answers PingContext with a canned error.
type fakeStore struct {
	err error
}

func (f fakeStore) PingContext(context.Context) error { return f.err }

func TestHealthReportsVersionAndUptime(t *testing.T) {
	started := time.Now().Add(-90 * time.Second)
	svc := health.NewService(started, fakeSysInfo{}, fakeStore{})

	resp := svc.Health()

	if resp.Status != health.StatusOK {
		t.Errorf("status = %q", resp.Status)
	}
	if resp.Version != constants.AppVersion {
		t.Errorf("version = %q, want %q", resp.Version, constants.AppVersion)
	}
	if resp.AppName != constants.AppName {
		t.Errorf("app_name = %q", resp.AppName)
	}
	if resp.AgentUptimeSeconds < 89 || resp.AgentUptimeSeconds > 91 {
		t.Errorf("agent_uptime_seconds = %d, want ~90", resp.AgentUptimeSeconds)
	}
	if resp.Timestamp == "" {
		t.Error("timestamp must be set")
	}
}

func TestSystemInfoMapsPlatformInfo(t *testing.T) {
	osVersion := "Windows 11 (24H2, build 26100)"
	var uptime int64 = 12345
	provider := fakeSysInfo{info: platform.Info{
		Hostname:      "tuf-laptop",
		OS:            "windows",
		OSVersion:     &osVersion,
		IPAddresses:   []string{"192.168.1.42"},
		UptimeSeconds: &uptime,
	}}
	svc := health.NewService(time.Now(), provider, fakeStore{})

	resp, err := svc.SystemInfo(context.Background())
	if err != nil {
		t.Fatalf("SystemInfo: %v", err)
	}
	if resp.Hostname != "tuf-laptop" || resp.OS != "windows" {
		t.Errorf("unexpected identity: %+v", resp)
	}
	if resp.OSVersion == nil || *resp.OSVersion != osVersion {
		t.Errorf("os_version = %v", resp.OSVersion)
	}
	if resp.UptimeSeconds == nil || *resp.UptimeSeconds != uptime {
		t.Errorf("uptime_seconds = %v", resp.UptimeSeconds)
	}
}

func TestSystemInfoPropagatesProviderFailure(t *testing.T) {
	svc := health.NewService(time.Now(), fakeSysInfo{err: errors.New("registry denied")}, fakeStore{})

	if _, err := svc.SystemInfo(context.Background()); err == nil {
		t.Fatal("a provider failure must surface as an error, not as empty data")
	}
}

func TestSystemStatusHealthy(t *testing.T) {
	svc := health.NewService(time.Now(), fakeSysInfo{}, fakeStore{})

	resp, err := svc.SystemStatus(context.Background())
	if err != nil {
		t.Fatalf("SystemStatus: %v", err)
	}
	if resp.Status != health.StatusOK {
		t.Errorf("status = %q", resp.Status)
	}
	if resp.Database.Status != health.StatusOK {
		t.Errorf("database = %+v", resp.Database)
	}
	if resp.Process.Goroutines < 1 {
		t.Errorf("goroutines = %d", resp.Process.Goroutines)
	}
}

func TestSystemStatusDegradedWhenDatabaseDown(t *testing.T) {
	svc := health.NewService(time.Now(), fakeSysInfo{}, fakeStore{err: errors.New("connection refused")})

	resp, err := svc.SystemStatus(context.Background())
	if err == nil {
		t.Fatal("the underlying cause must be returned for logging")
	}
	if resp.Status != health.StatusDegraded {
		t.Errorf("status = %q, want degraded", resp.Status)
	}
	if resp.Database.Status != health.StatusDegraded {
		t.Errorf("database = %+v", resp.Database)
	}
}

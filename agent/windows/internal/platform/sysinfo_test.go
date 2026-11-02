package platform_test

import (
	"context"
	"encoding/json"
	"runtime"
	"strings"
	"testing"

	"github.com/tuf-remote/agent/internal/platform"
)

// NewSystemInfo is exported through a constructor in the platform package.
// The test exercises whichever implementation the build selects.

func TestCollectReportsHostname(t *testing.T) {
	provider := platform.NewSystemInfo()

	info, err := provider.Collect(context.Background())
	if err != nil {
		t.Fatalf("Collect: %v", err)
	}
	if strings.TrimSpace(info.Hostname) == "" {
		t.Error("hostname must not be empty")
	}
	if info.OS != runtime.GOOS {
		t.Errorf("os = %q, want %q", info.OS, runtime.GOOS)
	}
	if info.IPAddresses == nil {
		t.Error("ip_addresses must serialise as [] and never null")
	}
}

func TestCollectHonoursCancelledContext(t *testing.T) {
	provider := platform.NewSystemInfo()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := provider.Collect(ctx); err == nil {
		t.Fatal("expected an error for a cancelled context")
	}
}

func TestInfoJSONOmitsUnavailableFields(t *testing.T) {
	info := platform.Info{
		Hostname:    "pc",
		OS:          "windows",
		IPAddresses: []string{"192.168.1.10"},
	}

	data, err := json.Marshal(info)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	body := string(data)

	if strings.Contains(body, "os_version") || strings.Contains(body, "uptime_seconds") {
		t.Errorf("unavailable optional fields must be omitted, got: %s", body)
	}
	if !strings.Contains(body, `"ip_addresses":["192.168.1.10"]`) {
		t.Errorf("unexpected body: %s", body)
	}
}

func TestInfoJSONIncludesMeasuredZero(t *testing.T) {
	var uptime int64 = 0
	info := platform.Info{
		Hostname:      "pc",
		OS:            "windows",
		UptimeSeconds: &uptime,
	}

	data, err := json.Marshal(info)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	// A measured zero must be reported as0, not treated as "unavailable".
	if !strings.Contains(string(data), `"uptime_seconds":0`) {
		t.Errorf("measured zero missing from: %s", data)
	}
}

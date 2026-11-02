// Package platform isolates operating-system specific functionality behind
// small interfaces so the rest of the agent stays portable and testable.
package platform

import (
	"context"
	"fmt"
	"net"
	"os"
	"runtime"
	"sort"
)

// Info describes the host the agent runs on. Optional fields are pointers so
// that "not measured" stays distinguishable from a real zero value.
type Info struct {
	// Hostname is the machine's network name.
	Hostname string `json:"hostname"`
	// OS is the operating system family (e.g. "windows").
	OS string `json:"os"`
	// OSVersion is the detailed OS version when the platform exposes it.
	OSVersion *string `json:"os_version,omitempty"`
	// IPAddresses lists the suitable unicast IPv4 addresses of the host
	// (loopback and link-local addresses are excluded).
	IPAddresses []string `json:"ip_addresses"`
	// UptimeSeconds is the time since the last boot.
	UptimeSeconds *int64 `json:"uptime_seconds,omitempty"`
}

// SystemInfoProvider collects host information in a platform-specific way.
type SystemInfoProvider interface {
	// Collect gathers the available host information. Implementations must
	// never invent values: fields they cannot measure are left unset, and a
	// failure to read the essential fields is returned as an error.
	Collect(ctx context.Context) (Info, error)
}

// collectPortable gathers the platform-neutral subset of Info.
func collectPortable(ctx context.Context) (Info, error) {
	if err := ctx.Err(); err != nil {
		return Info{}, err
	}

	hostname, err := os.Hostname()
	if err != nil {
		return Info{}, fmt.Errorf("read hostname: %w", err)
	}

	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return Info{}, fmt.Errorf("list network interfaces: %w", err)
	}
	ips := make([]string, 0, 4)
	for _, addr := range addrs {
		ipnet, ok := addr.(*net.IPNet)
		if !ok || ipnet.IP.To4() == nil || !ipnet.IP.IsGlobalUnicast() {
			continue // keep IPv4 global unicast only: no loopback, no link-local
		}
		ips = append(ips, ipnet.IP.String())
	}
	sort.Strings(ips)

	return Info{
		Hostname:    hostname,
		OS:          runtime.GOOS,
		IPAddresses: ips,
	}, nil
}

//go:build windows

package platform

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"syscall"

	"golang.org/x/sys/windows/registry"
)

// currentVersionKey holds the Windows version information.
const currentVersionKey = `SOFTWARE\Microsoft\Windows NT\CurrentVersion`

// NewSystemInfo returns the Windows implementation of SystemInfoProvider.
func NewSystemInfo() SystemInfoProvider { return windowsSystemInfo{} }

type windowsSystemInfo struct{}

func (windowsSystemInfo) Collect(ctx context.Context) (Info, error) {
	info, err := collectPortable(ctx)
	if err != nil {
		return Info{}, err
	}
	info.OSVersion = osVersion()
	if seconds, ok := uptimeSeconds(); ok {
		info.UptimeSeconds = &seconds
	}
	return info, nil
}

var (
	kernel32           = syscall.NewLazyDLL("kernel32.dll")
	procGetTickCount64 = kernel32.NewProc("GetTickCount64")
)

// uptimeSeconds reports the system uptime from GetTickCount64 (milliseconds
// since boot, monotonic and never wrapping on supported Windows versions).
// The API has no failure mode: a non-zero last-error after the call is a
// artefact of the syscall convention, not a fault.
func uptimeSeconds() (int64, bool) {
	ret, _, callErr := procGetTickCount64.Call()
	if errno, ok := callErr.(syscall.Errno); ok && errno != 0 {
		return 0, false
	}
	return int64(ret / 1000), true
}

// osVersion reads the marketing version from the registry. Missing optional
// values simply shorten the description; only a registry the agent cannot
// open at all yields nil (version unavailable).
func osVersion() *string {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, currentVersionKey, registry.QUERY_VALUE)
	if err != nil {
		return nil
	}
	defer func() { _ = key.Close() }()

	// Both values are optional: DisplayVersion ("24H2") and
	// CurrentBuildNumber ("26100") ship with every supported Windows build.
	display, _, displayErr := key.GetStringValue("DisplayVersion")
	build, _, buildErr := key.GetStringValue("CurrentBuildNumber")
	if displayErr != nil && buildErr != nil {
		return nil
	}

	// ProductName is unreliable ("Windows 10 Pro" is reported on Windows 11
	// machines), so the edition label is derived from the build number.
	label := "Windows"
	if n, err := strconv.Atoi(strings.TrimSpace(build)); err == nil {
		switch {
		case n >= 22000:
			label = "Windows 11"
		case n >= 10240:
			label = "Windows 10"
		}
	}

	details := make([]string, 0, 2)
	if display = strings.TrimSpace(display); display != "" {
		details = append(details, display)
	}
	if build = strings.TrimSpace(build); build != "" {
		details = append(details, "build "+build)
	}
	if len(details) == 0 {
		return &label
	}
	version := fmt.Sprintf("%s (%s)", label, strings.Join(details, ", "))
	return &version
}

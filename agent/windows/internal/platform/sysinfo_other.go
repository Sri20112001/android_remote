//go:build !windows

package platform

import "context"

// NewSystemInfo returns a provider limited to the platform-neutral fields;
// OS-specific measurements (OS version, uptime) are unavailable outside
// Windows and stay unset rather than being guessed.
func NewSystemInfo() SystemInfoProvider { return portableSystemInfo{} }

type portableSystemInfo struct{}

func (portableSystemInfo) Collect(ctx context.Context) (Info, error) {
	return collectPortable(ctx)
}

//go:build windows

package monitoring

import (
	"context"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	kernel32DLL = windows.NewLazySystemDLL("kernel32.dll")

	procGlobalMemoryStatusEx = kernel32DLL.NewProc("GlobalMemoryStatusEx")
	procGetSystemPowerStatus = kernel32DLL.NewProc("GetSystemPowerStatus")
	procGetSystemTimes       = kernel32DLL.NewProc("GetSystemTimes")
	procGetDiskFreeSpaceExW  = kernel32DLL.NewProc("GetDiskFreeSpaceExW")
)

type memoryStatusEx struct {
	dwLength                uint32
	dwMemoryLoad            uint32
	ullTotalPhys            uint64
	ullAvailPhys            uint64
	ullTotalPageFile        uint64
	ullAvailPageFile        uint64
	ullTotalVirtual         uint64
	ullAvailVirtual         uint64
	ullAvailExtendedVirtual uint64
}

type systemPowerStatus struct {
	acLineStatus        byte
	batteryFlag         byte
	batteryLifePercent  byte
	systemStatusFlag    byte
	batteryLifeTime     uint32
	batteryFullLifeTime uint32
}

// WindowsMetricsProvider queries Win32 APIs for hardware metrics.
type WindowsMetricsProvider struct {
	mu         sync.Mutex
	lastSample time.Time
	lastIdle   uint64
	lastKernel uint64
	lastUser   uint64
}

// NewMetricsProvider returns the Windows implementation.
func NewMetricsProvider() *WindowsMetricsProvider {
	return &WindowsMetricsProvider{}
}

func fileTimeToUint64(ft *windows.Filetime) uint64 {
	return (uint64(ft.HighDateTime) << 32) | uint64(ft.LowDateTime)
}

func (p *WindowsMetricsProvider) CollectMetrics(ctx context.Context) (SystemMetrics, error) {
	metrics := SystemMetrics{}

	// 1. Memory
	var mem memoryStatusEx
	mem.dwLength = uint32(unsafe.Sizeof(mem))
	r, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&mem)))
	if r != 0 {
		used := mem.ullTotalPhys - mem.ullAvailPhys
		usagePct := 0.0
		if mem.ullTotalPhys > 0 {
			usagePct = (float64(used) / float64(mem.ullTotalPhys)) * 100.0
		}
		metrics.Memory = MemoryMetrics{
			TotalBytes:     mem.ullTotalPhys,
			AvailableBytes: mem.ullAvailPhys,
			UsedBytes:      used,
			UsagePercent:   usagePct,
		}
	}

	// 2. CPU
	var idleTime, kernelTime, userTime windows.Filetime
	r, _, _ = procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idleTime)),
		uintptr(unsafe.Pointer(&kernelTime)),
		uintptr(unsafe.Pointer(&userTime)),
	)
	if r != 0 {
		idle := fileTimeToUint64(&idleTime)
		kernel := fileTimeToUint64(&kernelTime)
		user := fileTimeToUint64(&userTime)

		p.mu.Lock()
		if !p.lastSample.IsZero() {
			dIdle := idle - p.lastIdle
			dKernel := kernel - p.lastKernel
			dUser := user - p.lastUser
			dTotal := dKernel + dUser
			if dTotal > 0 && dTotal >= dIdle {
				cpuPct := (float64(dTotal-dIdle) / float64(dTotal)) * 100.0
				if cpuPct < 0 {
					cpuPct = 0
				} else if cpuPct > 100 {
					cpuPct = 100
				}
				metrics.CPU = CPUMetrics{UsagePercent: cpuPct}
			}
		}
		p.lastSample = time.Now()
		p.lastIdle = idle
		p.lastKernel = kernel
		p.lastUser = user
		p.mu.Unlock()
	}

	// 3. Battery
	var sps systemPowerStatus
	r, _, _ = procGetSystemPowerStatus.Call(uintptr(unsafe.Pointer(&sps)))
	if r != 0 {
		present := sps.batteryFlag != 128 && sps.batteryFlag != 255
		charging := (sps.batteryFlag & 8) != 0
		pct := int(sps.batteryLifePercent)
		if pct > 100 {
			pct = -1 // unknown
		}
		var lifeTime int64
		if sps.batteryLifeTime != 0xFFFFFFFF {
			lifeTime = int64(sps.batteryLifeTime)
		}
		metrics.Battery = BatteryMetrics{
			Present:         present,
			Charging:        charging,
			Percentage:      pct,
			LifeTimeSeconds: lifeTime,
		}
	}

	// 4. Primary Disk (C:\)
	diskPath, _ := syscall.UTF16PtrFromString("C:\\")
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	r, _, _ = procGetDiskFreeSpaceExW.Call(
		uintptr(unsafe.Pointer(diskPath)),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalBytes)),
		uintptr(unsafe.Pointer(&totalFreeBytes)),
	)
	if r != 0 && totalBytes > 0 {
		used := totalBytes - totalFreeBytes
		metrics.Disks = []DiskMetrics{
			{
				Mount:        "C:",
				TotalBytes:   totalBytes,
				FreeBytes:    totalFreeBytes,
				UsedBytes:    used,
				UsagePercent: (float64(used) / float64(totalBytes)) * 100.0,
			},
		}
	}

	return metrics, nil
}

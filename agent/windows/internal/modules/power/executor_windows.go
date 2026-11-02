//go:build windows

package power

import (
	"fmt"
	"os/exec"

	"golang.org/x/sys/windows"
)

var (
	user32DLL   = windows.NewLazySystemDLL("user32.dll")
	powrprofDLL = windows.NewLazySystemDLL("powrprof.dll")

	procLockWorkStation = user32DLL.NewProc("LockWorkStation")
	procSetSuspendState = powrprofDLL.NewProc("SetSuspendState")
)

// WindowsExecutor implements Executor via Win32 calls.
type WindowsExecutor struct{}

// NewExecutor returns the Windows power executor.
func NewExecutor() *WindowsExecutor {
	return &WindowsExecutor{}
}

func (e *WindowsExecutor) Lock() error {
	r, _, err := procLockWorkStation.Call()
	if r == 0 {
		return fmt.Errorf("LockWorkStation failed: %w", err)
	}
	return nil
}

func (e *WindowsExecutor) Sleep() error {
	// SetSuspendState(bHibernate=0, bForce=1, bWakeupEventsDisabled=0)
	r, _, err := procSetSuspendState.Call(0, 1, 0)
	if r == 0 {
		return fmt.Errorf("SetSuspendState(sleep) failed: %w", err)
	}
	return nil
}

func (e *WindowsExecutor) Hibernate() error {
	// SetSuspendState(bHibernate=1, bForce=1, bWakeupEventsDisabled=0)
	r, _, err := procSetSuspendState.Call(1, 1, 0)
	if r == 0 {
		return fmt.Errorf("SetSuspendState(hibernate) failed: %w", err)
	}
	return nil
}

func (e *WindowsExecutor) Restart() error {
	cmd := exec.Command("shutdown.exe", "/r", "/t", "0")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("shutdown /r failed: %w", err)
	}
	return nil
}

func (e *WindowsExecutor) Shutdown() error {
	cmd := exec.Command("shutdown.exe", "/s", "/t", "0")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("shutdown /s failed: %w", err)
	}
	return nil
}

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
	procSendMessage     = user32DLL.NewProc("SendMessageW")
)

// WindowsExecutor implements Executor via Win32 calls.
type WindowsExecutor struct{}

// NewExecutor returns the Windows power executor.
func NewExecutor() *WindowsExecutor {
	return &WindowsExecutor{}
}

func (e *WindowsExecutor) DisplayOff() error {
	// HWND_BROADCAST = 0xffff, WM_SYSCOMMAND = 0x0112, SC_MONITORPOWER = 0xF170, 2 = turn off
	r, _, err := procSendMessage.Call(0xffff, 0x0112, 0xF170, 2)
	if r == 0 && err != windows.ERROR_SUCCESS {
		// Fallback via PowerShell
		cmd := exec.Command("powershell", "-NoProfile", "-Command", "(Add-Type '[DllImport(\"user32.dll\")]public static extern int SendMessage(int hWnd,int hMsg,int wParam,int lParam);' -Name a -PassThru)::SendMessage(0xffff,0x0112,0xF170,2)")
		_ = cmd.Run()
	}
	return nil
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

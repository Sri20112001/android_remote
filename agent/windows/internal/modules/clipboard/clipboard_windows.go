//go:build windows

package clipboard

import (
	"os/exec"
	"strings"
	"sync"
)

// WindowsClipboard accesses the Windows clipboard via PowerShell.
type WindowsClipboard struct {
	mu sync.Mutex
}

// NewClipboard returns the Windows clipboard provider.
func NewClipboard() *WindowsClipboard {
	return &WindowsClipboard{}
}

func (c *WindowsClipboard) GetText() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimRight(string(out), "\r\n"), nil
}

func (c *WindowsClipboard) SetText(text string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard -Value $input")
	cmd.Stdin = strings.NewReader(text)
	return cmd.Run()
}

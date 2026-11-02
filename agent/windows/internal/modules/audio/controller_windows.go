//go:build windows

package audio

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/sys/windows"
)

var (
	user32         = windows.NewLazySystemDLL("user32.dll")
	procKeybdEvent = user32.NewProc("keybd_event")
)

const (
	vkVolumeMute   = 0xAD
	vkVolumeDown   = 0xAE
	vkVolumeUp     = 0xAF
	keyeventfKeyUp = 0x0002
)

// WindowsDeviceController controls audio volume and mute on Windows.
type WindowsDeviceController struct {
	mu          sync.Mutex
	cachedLevel int
	cachedMuted bool
	initialized bool
}

// NewDeviceController returns a new Windows device controller.
func NewDeviceController() *WindowsDeviceController {
	return &WindowsDeviceController{
		cachedLevel: 50,
		cachedMuted: false,
	}
}

func (c *WindowsDeviceController) sendKey(vk int) {
	procKeybdEvent.Call(uintptr(vk), 0, 0, 0)
	procKeybdEvent.Call(uintptr(vk), 0, keyeventfKeyUp, 0)
}

func (c *WindowsDeviceController) querySystemAudio() (int, bool, error) {
	// Query current volume and mute state via powershell one-liner using Windows CoreAudio COM
	psScript := `$dev = (New-Object -ComObject MMDeviceEnumerator).GetDefaultAudioEndpoint(0, 1); [math]::Round($dev.AudioEndpointVolume.MasterVolumeLevelScalar * 100); $dev.AudioEndpointVolume.Mute`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript)
	out, err := cmd.Output()
	if err != nil {
		return c.cachedLevel, c.cachedMuted, nil
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) >= 2 {
		vol, err := strconv.Atoi(strings.TrimSpace(lines[0]))
		if err == nil && vol >= 0 && vol <= 100 {
			c.cachedLevel = vol
		}
		c.cachedMuted = strings.EqualFold(strings.TrimSpace(lines[1]), "True")
		c.initialized = true
	}
	return c.cachedLevel, c.cachedMuted, nil
}

func (c *WindowsDeviceController) GetVolume() (int, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.querySystemAudio()
}

func (c *WindowsDeviceController) SetVolume(level int) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if level < 0 {
		level = 0
	} else if level > 100 {
		level = 100
	}

	scalar := float64(level) / 100.0
	psScript := fmt.Sprintf(`$dev = (New-Object -ComObject MMDeviceEnumerator).GetDefaultAudioEndpoint(0, 1); $dev.AudioEndpointVolume.MasterVolumeLevelScalar = %f`, scalar)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript)
	if err := cmd.Run(); err != nil {
		// Fallback to keybd_event delta
		diff := level - c.cachedLevel
		steps := diff / 2
		if steps > 0 {
			for i := 0; i < steps; i++ {
				c.sendKey(vkVolumeUp)
			}
		} else if steps < 0 {
			for i := 0; i < -steps; i++ {
				c.sendKey(vkVolumeDown)
			}
		}
	}
	c.cachedLevel = level
	return nil
}

func (c *WindowsDeviceController) SetMute(muted bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	muteStr := "$false"
	if muted {
		muteStr = "$true"
	}
	psScript := fmt.Sprintf(`$dev = (New-Object -ComObject MMDeviceEnumerator).GetDefaultAudioEndpoint(0, 1); $dev.AudioEndpointVolume.Mute = %s`, muteStr)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript)
	if err := cmd.Run(); err != nil {
		if c.cachedMuted != muted {
			c.sendKey(vkVolumeMute)
		}
	}
	c.cachedMuted = muted
	return nil
}

func (c *WindowsDeviceController) ToggleMute() (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.sendKey(vkVolumeMute)
	c.cachedMuted = !c.cachedMuted
	return c.cachedMuted, nil
}

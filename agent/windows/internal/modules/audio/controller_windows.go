//go:build windows

package audio

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"unsafe"

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
	volChan     chan int
}

// NewDeviceController returns a new Windows device controller.
func NewDeviceController() *WindowsDeviceController {
	c := &WindowsDeviceController{
		cachedLevel: 50,
		cachedMuted: false,
		volChan:     make(chan int, 32),
	}
	go c.volumeWorker()
	return c
}

func (c *WindowsDeviceController) sendKey(vk int) {
	procKeybdEvent.Call(uintptr(vk), 0, 0, 0)
	procKeybdEvent.Call(uintptr(vk), 0, keyeventfKeyUp, 0)
}

func (c *WindowsDeviceController) volumeWorker() {
	for lvl := range c.volChan {
		// Conflate: drain any newer pending volume updates so we only apply the latest
	drain:
		for {
			select {
			case next := <-c.volChan:
				lvl = next
			default:
				break drain
			}
		}

		c.applySystemVolume(lvl)
	}
}

func (c *WindowsDeviceController) applySystemVolume(level int) {
	scalar := float64(level) / 100.0
	psScript := fmt.Sprintf(`$dev = (New-Object -ComObject MMDeviceEnumerator).GetDefaultAudioEndpoint(0, 1); $dev.AudioEndpointVolume.MasterVolumeLevelScalar = %f`, scalar)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript)
	if err := cmd.Run(); err != nil {
		c.mu.Lock()
		diff := level - c.cachedLevel
		c.mu.Unlock()
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
	if level < 0 {
		level = 0
	} else if level > 100 {
		level = 100
	}

	c.mu.Lock()
	c.cachedLevel = level
	c.mu.Unlock()

	select {
	case c.volChan <- level:
	default:
		// Channel full, drop oldest and enqueue latest
		select {
		case <-c.volChan:
		default:
		}
		c.volChan <- level
	}
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

var (
	procEnumWindows              = user32.NewProc("EnumWindows")
	procGetWindowTextW           = user32.NewProc("GetWindowTextW")
	procGetWindowTextLengthW     = user32.NewProc("GetWindowTextLengthW")
	procIsWindowVisible          = user32.NewProc("IsWindowVisible")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
)

type mediaWindow struct {
	title       string
	processName string
}

func getProcessName(pid uint32) string {
	const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
	h, err := windows.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return ""
	}
	defer windows.CloseHandle(h)

	var buf [windows.MAX_PATH]uint16
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &size); err == nil {
		fullPath := windows.UTF16ToString(buf[:size])
		parts := strings.Split(fullPath, "\\")
		if len(parts) > 0 {
			name := strings.ToLower(parts[len(parts)-1])
			return strings.TrimSuffix(name, ".exe")
		}
	}
	return ""
}

// GetNowPlaying inspects active desktop windows to identify current music or video playing.
func (c *WindowsDeviceController) GetNowPlaying() (*NowPlayingInfo, error) {
	var candidates []mediaWindow

	cb := windows.NewCallback(func(hwnd windows.Handle, lparam uintptr) uintptr {
		vis, _, _ := procIsWindowVisible.Call(uintptr(hwnd))
		if vis == 0 {
			return 1
		}

		length, _, _ := procGetWindowTextLengthW.Call(uintptr(hwnd))
		if length == 0 {
			return 1
		}

		buf := make([]uint16, length+1)
		procGetWindowTextW.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&buf[0])), uintptr(length+1))
		title := strings.TrimSpace(windows.UTF16ToString(buf))
		if title == "" {
			return 1
		}

		var pid uint32
		procGetWindowThreadProcessId.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&pid)))
		if pid == 0 {
			return 1
		}

		procName := getProcessName(pid)
		candidates = append(candidates, mediaWindow{
			title:       title,
			processName: procName,
		})
		return 1
	})

	procEnumWindows.Call(cb, 0)

	// Check Spotify
	for _, w := range candidates {
		if strings.Contains(w.processName, "spotify") {
			if w.title != "" && !strings.EqualFold(w.title, "Spotify") && !strings.EqualFold(w.title, "Spotify Free") && !strings.EqualFold(w.title, "Spotify Premium") {
				parts := strings.SplitN(w.title, " - ", 2)
				if len(parts) == 2 {
					return &NowPlayingInfo{
						Artist:  strings.TrimSpace(parts[0]),
						Title:   strings.TrimSpace(parts[1]),
						Player:  "Spotify",
						Playing: true,
					}, nil
				}
				return &NowPlayingInfo{
					Title:   w.title,
					Artist:  "Spotify",
					Player:  "Spotify",
					Playing: true,
				}, nil
			}
		}
	}

	// Check VLC Media Player
	for _, w := range candidates {
		if strings.Contains(w.processName, "vlc") {
			title := strings.TrimSuffix(w.title, " - VLC media player")
			if title != "" && !strings.EqualFold(title, "VLC media player") {
				return &NowPlayingInfo{
					Title:   title,
					Artist:  "VLC Media Player",
					Player:  "VLC",
					Playing: true,
				}, nil
			}
		}
	}

	// Check Foobar2000, AIMP, Apple Music / iTunes
	for _, w := range candidates {
		if strings.Contains(w.processName, "foobar2000") || strings.Contains(w.processName, "aimp") || strings.Contains(w.processName, "itunes") || strings.Contains(w.processName, "applemusic") {
			return &NowPlayingInfo{
				Title:   w.title,
				Artist:  w.processName,
				Player:  w.processName,
				Playing: true,
			}, nil
		}
	}

	// Check Browsers playing YouTube / SoundCloud
	for _, w := range candidates {
		lower := strings.ToLower(w.title)
		if strings.Contains(lower, " - youtube") {
			cleanTitle := strings.TrimSuffix(w.title, " - YouTube")
			for _, suffix := range []string{" - Google Chrome", " - Microsoft Edge", " - Brave", " - Mozilla Firefox"} {
				cleanTitle = strings.TrimSuffix(cleanTitle, suffix)
			}
			return &NowPlayingInfo{
				Title:   strings.TrimSpace(cleanTitle),
				Artist:  "YouTube",
				Player:  w.processName,
				Playing: true,
			}, nil
		}
	}

	return &NowPlayingInfo{
		Title:   "Ready for Playback",
		Artist:  "No active media detected",
		Player:  "Windows Media",
		Playing: false,
	}, nil
}

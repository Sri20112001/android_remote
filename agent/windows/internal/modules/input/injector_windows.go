//go:build windows

package input

import (
	"strings"
	"time"

	"golang.org/x/sys/windows"
)

var (
	user32DLL = windows.NewLazySystemDLL("user32.dll")

	procMouseEvent       = user32DLL.NewProc("mouse_event")
	procKeybdEvent       = user32DLL.NewProc("keybd_event")
	procOpenInputDesktop = user32DLL.NewProc("OpenInputDesktop")
	procSetThreadDesktop = user32DLL.NewProc("SetThreadDesktop")
	procCloseDesktop     = user32DLL.NewProc("CloseDesktop")
)

// ensureInputDesktop attaches the calling thread to the currently active input desktop.
// This prevents ERROR_ACCESS_DENIED on Windows during UAC elevation, lock screen transitions,
// and background goroutine execution.
func ensureInputDesktop() {
	if procOpenInputDesktop.Find() != nil || procSetThreadDesktop.Find() != nil {
		return
	}
	// 0x1FF corresponds to MAXIMUM_ALLOWED / GENERIC_ALL
	hDesk, _, _ := procOpenInputDesktop.Call(0, 0, 0x1FF)
	if hDesk != 0 {
		procSetThreadDesktop.Call(hDesk)
		procCloseDesktop.Call(hDesk)
	}
}

const (
	mouseEventfMove       = 0x0001
	mouseEventfLeftDown   = 0x0002
	mouseEventfLeftUp     = 0x0004
	mouseEventfRightDown  = 0x0008
	mouseEventfRightUp    = 0x0010
	mouseEventfMiddleDown = 0x0020
	mouseEventfMiddleUp   = 0x0040
	mouseEventfWheel      = 0x0800
	mouseEventfAbsolute   = 0x8000

	keyEventfKeyUp   = 0x0002
	keyEventfUnicode = 0x0004
)

var keyMap = map[string]byte{
	"enter":            0x0D,
	"return":           0x0D,
	"escape":           0x1B,
	"esc":              0x1B,
	"backspace":        0x08,
	"tab":              0x09,
	"space":            0x20,
	"delete":           0x2E,
	"del":              0x2E,
	"insert":           0x2D,
	"home":             0x24,
	"end":              0x23,
	"pageup":           0x21,
	"pagedown":         0x22,
	"left":             0x25,
	"up":               0x26,
	"right":            0x27,
	"down":             0x28,
	"control":          0x11,
	"ctrl":             0x11,
	"alt":              0x12,
	"shift":            0x10,
	"win":              0x5B,
	"windows":          0x5B,
	"volume_up":        0xAF,
	"volume_down":      0xAE,
	"volume_mute":      0xAD,
	"media_next":       0xB0,
	"media_prev":       0xB1,
	"media_stop":       0xB2,
	"media_play_pause": 0xB3,
	"f1":               0x70,
	"f2":               0x71,
	"f3":               0x72,
	"f4":               0x73,
	"f5":               0x74,
	"f6":               0x75,
	"f7":               0x76,
	"f8":               0x77,
	"f9":               0x78,
	"f10":              0x79,
	"f11":              0x7A,
	"f12":              0x7B,
	"capslock":         0x14,
	"`":                0xC0,
	"-":                0xBD,
	"=":                0xBB,
	"[":                0xDB,
	"]":                0xDD,
	"\\":               0xDC,
	";":                0xBA,
	"'":                0xDE,
	",":                0xBC,
	".":                0xBE,
	"/":                0xBF,
}

// WindowsInjector implements Injector on Windows using Win32 API.
type WindowsInjector struct{}

// NewInjector returns the Windows input injector.
func NewInjector() *WindowsInjector {
	return &WindowsInjector{}
}

func (inj *WindowsInjector) MouseMove(dx, dy int) error {
	ensureInputDesktop()
	procMouseEvent.Call(uintptr(mouseEventfMove), uintptr(dx), uintptr(dy), 0, 0)
	return nil
}

func (inj *WindowsInjector) MouseMoveAbsolute(x, y int) error {
	ensureInputDesktop()
	// Normalized absolute coordinates (0 to 65535)
	procMouseEvent.Call(uintptr(mouseEventfMove|mouseEventfAbsolute), uintptr(x), uintptr(y), 0, 0)
	return nil
}

func (inj *WindowsInjector) MouseDown(button string) error {
	ensureInputDesktop()
	var flag uintptr
	switch strings.ToLower(button) {
	case "right":
		flag = mouseEventfRightDown
	case "middle":
		flag = mouseEventfMiddleDown
	default:
		flag = mouseEventfLeftDown
	}
	procMouseEvent.Call(flag, 0, 0, 0, 0)
	return nil
}

func (inj *WindowsInjector) MouseUp(button string) error {
	ensureInputDesktop()
	var flag uintptr
	switch strings.ToLower(button) {
	case "right":
		flag = mouseEventfRightUp
	case "middle":
		flag = mouseEventfMiddleUp
	default:
		flag = mouseEventfLeftUp
	}
	procMouseEvent.Call(flag, 0, 0, 0, 0)
	return nil
}

func (inj *WindowsInjector) MouseClick(button string, double bool) error {
	_ = inj.MouseDown(button)
	time.Sleep(10 * time.Millisecond)
	_ = inj.MouseUp(button)

	if double {
		time.Sleep(50 * time.Millisecond)
		_ = inj.MouseDown(button)
		time.Sleep(10 * time.Millisecond)
		_ = inj.MouseUp(button)
	}
	return nil
}

func (inj *WindowsInjector) MouseScroll(dy int) error {
	ensureInputDesktop()
	procMouseEvent.Call(uintptr(mouseEventfWheel), 0, 0, uintptr(dy), 0)
	return nil
}

func resolveVK(key string) byte {
	k := strings.ToLower(strings.TrimSpace(key))
	if vk, ok := keyMap[k]; ok {
		return vk
	}
	if len(k) == 1 {
		char := k[0]
		if char >= 'a' && char <= 'z' {
			return char - 'a' + 0x41
		}
		if char >= '0' && char <= '9' {
			return char
		}
	}
	return 0
}

func (inj *WindowsInjector) KeyDown(key string) error {
	ensureInputDesktop()
	vk := resolveVK(key)
	if vk != 0 {
		procKeybdEvent.Call(uintptr(vk), 0, 0, 0)
	}
	return nil
}

func (inj *WindowsInjector) KeyUp(key string) error {
	ensureInputDesktop()
	vk := resolveVK(key)
	if vk != 0 {
		procKeybdEvent.Call(uintptr(vk), 0, uintptr(keyEventfKeyUp), 0)
	}
	return nil
}

func (inj *WindowsInjector) KeyTap(key string, modifiers []string) error {
	ensureInputDesktop()
	// Press modifiers
	for _, m := range modifiers {
		_ = inj.KeyDown(m)
	}
	time.Sleep(5 * time.Millisecond)

	// Tap key
	_ = inj.KeyDown(key)
	time.Sleep(10 * time.Millisecond)
	_ = inj.KeyUp(key)

	time.Sleep(5 * time.Millisecond)
	// Release modifiers in reverse
	for i := len(modifiers) - 1; i >= 0; i-- {
		_ = inj.KeyUp(modifiers[i])
	}
	return nil
}

func (inj *WindowsInjector) TypeText(text string) error {
	ensureInputDesktop()
	for _, r := range text {
		procKeybdEvent.Call(0, uintptr(r), uintptr(keyEventfUnicode), 0)
		procKeybdEvent.Call(0, uintptr(r), uintptr(keyEventfUnicode|keyEventfKeyUp), 0)
		time.Sleep(2 * time.Millisecond)
	}
	return nil
}

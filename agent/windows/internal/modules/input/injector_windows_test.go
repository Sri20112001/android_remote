//go:build windows

package input

import "testing"

// The on-screen keyboard sends every keycap through key_tap, so any key that
// the VK table cannot resolve is silently swallowed by the agent. These cases
// cover the keys added for the full QWERTY layout.
func TestResolveVKPunctuationAndFunctionKeys(t *testing.T) {
	cases := map[string]byte{
		"`":        0xC0,
		"-":        0xBD,
		"=":        0xBB,
		"[":        0xDB,
		"]":        0xDD,
		"\\":       0xDC,
		";":        0xBA,
		"'":        0xDE,
		",":        0xBC,
		".":        0xBE,
		"/":        0xBF,
		"capslock": 0x14,
		"f1":       0x70,
		"f12":      0x7B,
	}

	for key, want := range cases {
		if got := resolveVK(key); got != want {
			t.Errorf("resolveVK(%q) = 0x%02X, want 0x%02X", key, got, want)
		}
	}
}

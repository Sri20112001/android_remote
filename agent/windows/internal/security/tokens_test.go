package security_test

import (
	"regexp"
	"strings"
	"testing"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/security"
)

func TestGenerateTokenEntropyAndShape(t *testing.T) {
	seen := make(map[string]bool, 100)
	for i := 0; i < 100; i++ {
		raw, err := security.GenerateToken()
		if err != nil {
			t.Fatalf("GenerateToken: %v", err)
		}
		if !strings.HasPrefix(raw, "tuf_") {
			t.Fatalf("token %q lacks prefix", raw)
		}
		// prefix + 32 bytes base64url without padding = 4 + 43 chars.
		if len(raw) != 47 {
			t.Errorf("token length = %d, want 47", len(raw))
		}
		if seen[raw] {
			t.Fatal("token repeated within 100 generations")
		}
		seen[raw] = true
	}
}

func TestHashTokenIsOneWayAndDeterministic(t *testing.T) {
	raw, err := security.GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	hash := security.HashToken(raw)
	if hash != security.HashToken(raw) {
		t.Error("hash must be deterministic")
	}
	if hash == raw {
		t.Error("hash must differ from the raw token")
	}
	if len(hash) != 64 {
		t.Errorf("hash length = %d, want 64 hex chars", len(hash))
	}
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(hash) {
		t.Errorf("hash %q is not lowercase hex", hash)
	}
	// A different token must never produce the same stored value.
	other, _ := security.GenerateToken()
	if security.HashToken(other) == hash {
		t.Error("distinct tokens hashed identically")
	}
}

func TestTokenPrefixDoesNotRevealSecret(t *testing.T) {
	raw, err := security.GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	prefix := security.TokenPrefix(raw)
	if prefix != raw[:constants.TokenPrefixLength] {
		t.Errorf("prefix = %q", prefix)
	}
	if strings.Contains(raw[len(prefix):], prefix) {
		t.Error("prefix check inconsequential")
	}
}

func TestGeneratePINFormatAndSpread(t *testing.T) {
	seenDigits := make(map[string]bool)
	for i := 0; i < 500; i++ {
		pin, err := security.GeneratePIN()
		if err != nil {
			t.Fatalf("GeneratePIN: %v", err)
		}
		if len(pin) != constants.PINLength {
			t.Fatalf("PIN %q has wrong length", pin)
		}
		if !security.ValidPINFormat(pin) {
			t.Fatalf("PIN %q is not %d digits", pin, constants.PINLength)
		}
		seenDigits[pin] = true
	}
	// 500 draws over 10^6 possibilities expect ~0.1 collisions; requiring
	// 480 distinct values leaves a wide safety margin while still catching
	// a generator that collapses onto a small set.
	if len(seenDigits) < 480 {
		t.Errorf("PINs collapse: only %d distinct in 500 draws", len(seenDigits))
	}
	if !security.ValidPINFormat("000000") {
		t.Error("all-zero PIN must be format-valid (leading zeros are legitimate)")
	}
}

func TestValidPINFormatRejectsBadInput(t *testing.T) {
	cases := []string{"", "12345", "1234567", "12345a", "12 456", "abcdef", "１２３４５６"}
	for _, c := range cases {
		if security.ValidPINFormat(c) {
			t.Errorf("%q must be rejected", c)
		}
	}
}

func TestPINMatches(t *testing.T) {
	if !security.PINMatches("123456", "123456") {
		t.Error("equal PINs must match")
	}
	if security.PINMatches("123456", "123457") {
		t.Error("different PINs must not match")
	}
	if security.PINMatches("123456", "1234567") {
		t.Error("different lengths must not match")
	}
}

func TestNewIDUniquenessAndShape(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 200; i++ {
		id, err := security.NewID()
		if err != nil {
			t.Fatalf("NewID: %v", err)
		}
		if len(id) != 32 || !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(id) {
			t.Fatalf("id %q is not 32 hex chars", id)
		}
		if seen[id] {
			t.Fatal("id repeated")
		}
		seen[id] = true
	}
}

func TestIsPrintableDetail(t *testing.T) {
	if !security.IsPrintableDetail("device=Pixel_8") {
		t.Error("plain text must pass")
	}
	if security.IsPrintableDetail("line\nbreak") {
		t.Error("newlines must be rejected")
	}
	if security.IsPrintableDetail("null\x00byte") {
		t.Error("NUL must be rejected")
	}
}

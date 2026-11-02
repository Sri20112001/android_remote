// Package security provides the cryptographic primitives the agent relies
// on: device tokens, pairing PINs and their hashing. It performs no I/O
// and holds no state, so every function is trivially testable.
package security

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/tuf-remote/agent/internal/constants"
)

// tokenPrefix marks issued tokens so they are recognisable in support
// tooling (never secret).
const tokenPrefix = "tuf_"

// pinBase is 10^PINLength, the space PINs are drawn from uniformly.
var pinBase = new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(constants.PINLength)), nil)

// GenerateToken returns a fresh device token: a URL-safe string carrying
// 256 bits of CSPRNG entropy. The raw value is shown to the client exactly
// once; only HashToken(raw) is stored.
func GenerateToken() (raw string, err error) {
	buf := make([]byte, constants.TokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return tokenPrefix + base64.RawURLEncoding.EncodeToString(buf), nil
}

// HashToken renders the value stored for a token: hex-encoded SHA-256.
// The token is 256 bits of uniform randomness, so a fast unkeyed hash is
// sufficient and allows lookup directly by hash.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// TokenPrefix returns the non-secret identifying prefix stored alongside
// the hash (lets the UI show "which token" without revealing it).
func TokenPrefix(raw string) string {
	if len(raw) <= constants.TokenPrefixLength {
		return raw
	}
	return raw[:constants.TokenPrefixLength]
}

// GeneratePIN returns a uniformly random PIN of constants.PINLength digits
// (leading zeros preserved).
func GeneratePIN() (string, error) {
	n, err := rand.Int(rand.Reader, pinBase)
	if err != nil {
		return "", fmt.Errorf("generate pairing PIN: %w", err)
	}
	return fmt.Sprintf("%0*d", constants.PINLength, n.Int64()), nil
}

// PINMatches compares two PINs in constant time. Callers must only pass
// PINs that already passed format validation so length is not an oracle.
func PINMatches(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// ValidPINFormat reports whether s is exactly PINLength digits.
func ValidPINFormat(s string) bool {
	if len(s) != constants.PINLength {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// NewID returns a random 128-bit identifier as lowercase hex — used for
// primary keys that must not be guessable.
func NewID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// IsPrintableDetail guards audit details so accidental whitespace or
// control characters (which could hide injected content in logs) are
// rejected before they are written.
func IsPrintableDetail(s string) bool {
	return !strings.ContainsAny(s, "\r\n\x00")
}

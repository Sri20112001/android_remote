// Package pairing implements device pairing and device-token
// administration: PIN-based pairing with explicit authorisation on the PC,
// hashed bearer tokens, revocation and rotation.
package pairing

// Status values shared by pairing responses.
const (
	// StatusActive marks a device that currently holds a valid credential.
	StatusActive = "active"
	// StatusRevoked marks a device whose access was withdrawn.
	StatusRevoked = "revoked"
)

// Audit actions recorded by the pairing module (stored in audit_logs).
const (
	// ActionPairingStart records that a pairing window was opened.
	ActionPairingStart = "pairing.start"
	// ActionPairingConfirm records a PIN confirmation attempt.
	ActionPairingConfirm = "pairing.confirm"
	// ActionDeviceRevoke records a local revocation.
	ActionDeviceRevoke = "device.revoke"
	// ActionTokenRotate records a token rotation.
	ActionTokenRotate = "auth.rotate"
)

// StartResponse is the payload of POST /pairing/start. The PIN is shown to
// the PC user only; it is never logged or persisted.
type StartResponse struct {
	SessionID string `json:"session_id"`
	PIN       string `json:"pin"`
	ExpiresAt string `json:"expires_at"`
	// AttemptsRemaining is how many wrong PINs this session still tolerates.
	AttemptsRemaining int `json:"attempts_remaining"`
}

// ConfirmRequest is the payload of POST /pairing/confirm: the device
// presents the PIN the PC user shared plus its self-described metadata.
type ConfirmRequest struct {
	PIN       string `json:"pin"`
	Name      string `json:"name"`
	Model     string `json:"model,omitempty"`
	OSVersion string `json:"os_version,omitempty"`
	Platform  string `json:"platform,omitempty"`
}

// ConfirmResponse carries the freshly created device and its token. The
// raw token appears here exactly once and is never retrievable again.
type ConfirmResponse struct {
	Device DeviceInfo `json:"device"`
	Token  TokenInfo  `json:"token"`
}

// DeviceInfo is the client-facing view of a paired device.
type DeviceInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Platform   string `json:"platform"`
	Model      string `json:"model,omitempty"`
	OSVersion  string `json:"os_version,omitempty"`
	PairedAt   string `json:"paired_at"`
	LastSeenAt string `json:"last_seen_at,omitempty"`
	Status     string `json:"status"`
}

// TokenInfo describes an issued token. Token is present only when the
// token is being handed over (creation or rotation).
type TokenInfo struct {
	Token     string `json:"token,omitempty"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

// DevicesResponse lists paired devices.
type DevicesResponse struct {
	Devices []DeviceInfo `json:"devices"`
}

// RevokeRequest withdraws access from a device (loopback callers only).
type RevokeRequest struct {
	DeviceID string `json:"device_id"`
}

// RevokeResponse confirms the revocation.
type RevokeResponse struct {
	DeviceID string `json:"device_id"`
	Status   string `json:"status"`
}

// RotateResponse carries the replacement token (shown once).
type RotateResponse struct {
	Token TokenInfo `json:"token"`
}

// Device is the persisted paired device.
type Device struct {
	ID        string
	Name      string
	Platform  string
	Model     string
	OSVersion string
	PairedAt  string
	// LastSeenAt is derived from the newest token use ("" when never seen).
	LastSeenAt string
	RevokedAt  string
}

// Info renders the client-facing view.
func (d Device) Info() DeviceInfo {
	status := StatusActive
	if d.RevokedAt != "" {
		status = StatusRevoked
	}
	return DeviceInfo{
		ID:         d.ID,
		Name:       d.Name,
		Platform:   d.Platform,
		Model:      d.Model,
		OSVersion:  d.OSVersion,
		PairedAt:   d.PairedAt,
		LastSeenAt: d.LastSeenAt,
		Status:     status,
	}
}

// TokenRecord is a token as persisted (hash only, never the raw value).
type TokenRecord struct {
	ID        string
	DeviceID  string
	Hash      string
	Prefix    string
	ExpiresAt string // "" = never expires
	CreatedAt string
}

// TokenIdentity is the authentication-relevant slice of a token row.
type TokenIdentity struct {
	TokenID    string
	DeviceID   string
	DeviceName string
}

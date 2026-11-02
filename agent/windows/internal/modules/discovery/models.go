package discovery

// QRPayload represents the discovery and pairing details encoded in a QR code.
type QRPayload struct {
	AgentName   string   `json:"agent_name"`
	Version     string   `json:"version"`
	Hostname    string   `json:"hostname"`
	IPAddresses []string `json:"ip_addresses"`
	Port        int      `json:"port"`
	TLSEnabled  bool     `json:"tls_enabled"`
	SessionID   string   `json:"session_id,omitempty"`
	PIN         string   `json:"pin,omitempty"`
}

// InfoResponse provides public discovery info for network clients.
type InfoResponse struct {
	AgentName  string   `json:"agent_name"`
	Version    string   `json:"version"`
	Hostname   string   `json:"hostname"`
	Addresses  []string `json:"addresses"`
	Port       int      `json:"port"`
	TLSEnabled bool     `json:"tls_enabled"`
}

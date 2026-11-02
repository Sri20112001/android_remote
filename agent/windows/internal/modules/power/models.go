package power

// Supported power actions.
const (
	ActionLock      = "lock"
	ActionSleep     = "sleep"
	ActionHibernate = "hibernate"
	ActionRestart   = "restart"
	ActionShutdown  = "shutdown"
)

// RequestPayload specifies the power action to request confirmation for.
type RequestPayload struct {
	Action string `json:"action"`
}

// RequestResponse returns the confirmation token required to execute the action.
type RequestResponse struct {
	ConfirmationToken string `json:"confirmation_token"`
	Action            string `json:"action"`
	ExpiresAt         string `json:"expires_at"`
}

// ConfirmPayload contains the confirmation token to proceed.
type ConfirmPayload struct {
	ConfirmationToken string `json:"confirmation_token"`
}

// ConfirmResponse reports the outcome of the power action.
type ConfirmResponse struct {
	Action string `json:"action"`
	Status string `json:"status"`
}

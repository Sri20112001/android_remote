package constants

// Route paths are registered relative to APIPrefix on the API router group,
// so a full endpoint path is APIPrefix + Route*. Modules keep their route
// constants together as they are added.
const (
	// RouteHealth is the liveness endpoint.
	RouteHealth = "/health"
	// RouteSystemInfo exposes static host information.
	RouteSystemInfo = "/system/info"
	// RouteSystemStatus exposes the dynamic status of the agent.
	RouteSystemStatus = "/system/status"

	// RoutePairingStart opens a pairing session (loopback only: the PC
	// user's explicit authorisation).
	RoutePairingStart = "/pairing/start"
	// RoutePairingConfirm completes pairing with the PIN (device facing).
	RoutePairingConfirm = "/pairing/confirm"
	// RoutePairingDevices lists paired devices (loopback only).
	RoutePairingDevices = "/pairing/devices"
	// RoutePairingRevoke revokes a paired device (loopback only).
	RoutePairingRevoke = "/pairing/revoke"

	// RouteAuthRotate exchanges a valid token for a fresh one.
	RouteAuthRotate = "/auth/rotate"

	// RouteWebSocket is the real-time bidirectional WebSocket endpoint.
	RouteWebSocket = "/ws"

	// RouteDiscoveryInfo provides public server discovery info.
	RouteDiscoveryInfo = "/discovery/info"
	// RouteDiscoveryQR provides connection & pairing payload for QR generation (loopback only).
	RouteDiscoveryQR = "/discovery/qr"

	// RouteMonitoringSystem returns system hardware metrics snapshot.
	RouteMonitoringSystem = "/monitoring/system"

	// RoutePowerLock locks the workstation immediately.
	RoutePowerLock = "/power/lock"
	// RoutePowerRequest requests a confirmation token for power actions.
	RoutePowerRequest = "/power/request"
	// RoutePowerConfirm executes confirmed power actions with a valid confirmation token.
	RoutePowerConfirm = "/power/confirm"

	// RouteAudioVolume gets or sets master audio volume.
	RouteAudioVolume = "/audio/volume"
	// RouteAudioMute gets or sets master audio mute state.
	RouteAudioMute = "/audio/mute"

	// RouteInputMouse injects mouse motion, clicks or scrolling.
	RouteInputMouse = "/input/mouse"
	// RouteInputKeyboard injects keystrokes or unicode text.
	RouteInputKeyboard = "/input/keyboard"

	// RouteClipboard gets or sets the system clipboard text.
	RouteClipboard = "/clipboard"
)

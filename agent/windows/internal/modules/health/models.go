// Package health exposes the agent's liveness, host information and runtime
// status endpoints. Hardware telemetry (CPU, RAM, battery, GPU) arrives with
// the monitoring module; this package never invents measurements.
package health

// Health status values shared by the health endpoints.
const (
	// StatusOK means everything checked is healthy.
	StatusOK = "ok"
	// StatusDegraded means the endpoint responded but a dependency is failing.
	StatusDegraded = "degraded"
)

// HealthResponse is the payload of GET /api/v1/health. It answers "is the
// agent process alive", nothing more.
type HealthResponse struct {
	Status             string `json:"status"`
	AppName            string `json:"app_name"`
	Version            string `json:"version"`
	AgentUptimeSeconds int64  `json:"agent_uptime_seconds"`
	Timestamp          string `json:"timestamp"`
}

// SystemInfoResponse is the payload of GET /api/v1/system/info: static
// identity of the host. Optional fields are omitted when the platform does
// not expose them.
type SystemInfoResponse struct {
	AppName       string   `json:"app_name"`
	Version       string   `json:"version"`
	Hostname      string   `json:"hostname"`
	OS            string   `json:"os"`
	OSVersion     *string  `json:"os_version,omitempty"`
	IPAddresses   []string `json:"ip_addresses"`
	UptimeSeconds *int64   `json:"uptime_seconds,omitempty"`
}

// SystemStatusResponse is the payload of GET /api/v1/system/status: the
// dynamic health of the agent and its dependencies.
type SystemStatusResponse struct {
	Status             string          `json:"status"`
	AppName            string          `json:"app_name"`
	Version            string          `json:"version"`
	AgentUptimeSeconds int64           `json:"agent_uptime_seconds"`
	Timestamp          string          `json:"timestamp"`
	Database           ComponentStatus `json:"database"`
	Process            ProcessStatus   `json:"process"`
}

// ComponentStatus reports a dependency's state. Deliberately carries no
// error detail: causes go to the server log, never to the client.
type ComponentStatus struct {
	Status string `json:"status"`
}

// ProcessStatus describes the agent process itself (not the host system).
type ProcessStatus struct {
	Goroutines int          `json:"goroutines"`
	Memory     MemoryStatus `json:"memory"`
}

// MemoryStatus mirrors the interesting fields of runtime.MemStats.
type MemoryStatus struct {
	HeapAllocBytes uint64 `json:"heap_alloc_bytes"`
	HeapSysBytes   uint64 `json:"heap_sys_bytes"`
	SysBytes       uint64 `json:"sys_bytes"`
	NumGC          uint32 `json:"num_gc"`
}

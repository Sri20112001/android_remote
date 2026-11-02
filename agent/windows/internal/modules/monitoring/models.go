package monitoring

// SystemMetrics describes real-time host hardware metrics.
type SystemMetrics struct {
	CPU     CPUMetrics     `json:"cpu"`
	Memory  MemoryMetrics  `json:"memory"`
	Battery BatteryMetrics `json:"battery"`
	Disks   []DiskMetrics  `json:"disks,omitempty"`
}

// CPUMetrics contains processor load statistics.
type CPUMetrics struct {
	UsagePercent float64 `json:"usage_percent"`
}

// MemoryMetrics contains system RAM usage statistics.
type MemoryMetrics struct {
	TotalBytes     uint64  `json:"total_bytes"`
	AvailableBytes uint64  `json:"available_bytes"`
	UsedBytes      uint64  `json:"used_bytes"`
	UsagePercent   float64 `json:"usage_percent"`
}

// BatteryMetrics contains battery and power line status.
type BatteryMetrics struct {
	Present         bool  `json:"present"`
	Charging        bool  `json:"charging"`
	Percentage      int   `json:"percentage"`
	LifeTimeSeconds int64 `json:"life_time_seconds,omitempty"`
}

// DiskMetrics contains storage utilization for a logical drive.
type DiskMetrics struct {
	Mount        string  `json:"mount"`
	TotalBytes   uint64  `json:"total_bytes"`
	FreeBytes    uint64  `json:"free_bytes"`
	UsedBytes    uint64  `json:"used_bytes"`
	UsagePercent float64 `json:"usage_percent"`
}

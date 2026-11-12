package audio

// VolumeStatus represents current master volume level and mute state.
type VolumeStatus struct {
	Level int  `json:"level"` // 0 to 100
	Muted bool `json:"muted"`
}

// SetVolumePayload defines requested master volume.
type SetVolumePayload struct {
	Level int `json:"level"` // 0 to 100
}

// SetMutePayload defines requested mute state.
type SetMutePayload struct {
	Muted bool `json:"muted"`
}

// NowPlayingInfo represents active media title, artist and source application.
type NowPlayingInfo struct {
	Title   string `json:"title"`
	Artist  string `json:"artist"`
	Player  string `json:"player"`
	Playing bool   `json:"playing"`
}

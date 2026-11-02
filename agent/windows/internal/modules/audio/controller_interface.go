package audio

// DeviceController provides abstract audio control operations.
type DeviceController interface {
	GetVolume() (int, bool, error)
	SetVolume(level int) error
	SetMute(muted bool) error
	ToggleMute() (bool, error)
}

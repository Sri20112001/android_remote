//go:build !windows

package audio

type OtherDeviceController struct {
	level int
	muted bool
}

func NewDeviceController() *OtherDeviceController {
	return &OtherDeviceController{level: 50, muted: false}
}

func (c *OtherDeviceController) GetVolume() (int, bool, error) {
	return c.level, c.muted, nil
}

func (c *OtherDeviceController) SetVolume(level int) error {
	c.level = level
	return nil
}

func (c *OtherDeviceController) SetMute(muted bool) error {
	c.muted = muted
	return nil
}

func (c *OtherDeviceController) ToggleMute() (bool, error) {
	c.muted = !c.muted
	return c.muted, nil
}

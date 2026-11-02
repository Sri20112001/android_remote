//go:build !windows

package clipboard

type OtherClipboard struct {
	text string
}

func NewClipboard() *OtherClipboard {
	return &OtherClipboard{}
}

func (c *OtherClipboard) GetText() (string, error) {
	return c.text, nil
}

func (c *OtherClipboard) SetText(text string) error {
	c.text = text
	return nil
}

package input

// MouseAction defines mouse events.
const (
	MouseActionMove   = "move"
	MouseActionClick  = "click"
	MouseDown         = "down"
	MouseUp           = "up"
	MouseActionScroll = "scroll"
)

// MousePayload carries parameters for mouse injection.
type MousePayload struct {
	Action   string `json:"action,omitempty"` // move, click, down, up, scroll
	Button   string `json:"button,omitempty"` // left, right, middle
	DX       int    `json:"dx,omitempty"`
	DY       int    `json:"dy,omitempty"`
	X        int    `json:"x,omitempty"`
	Y        int    `json:"y,omitempty"`
	Absolute bool   `json:"absolute,omitempty"`
	Double   bool   `json:"double,omitempty"`
}

// KeyboardAction defines keyboard events.
const (
	KeyActionTap  = "tap"
	KeyActionDown = "down"
	KeyActionUp   = "up"
	KeyActionText = "text"
)

// KeyboardPayload carries parameters for keyboard injection.
type KeyboardPayload struct {
	Action    string   `json:"action,omitempty"`    // tap, down, up, text
	Key       string   `json:"key,omitempty"`       // e.g. "enter", "backspace", "tab", "esc", "space"
	Modifiers []string `json:"modifiers,omitempty"` // ctrl, alt, shift, win
	Text      string   `json:"text,omitempty"`
}

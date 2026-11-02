package input

// Injector defines low-level input injection operations.
type Injector interface {
	MouseMove(dx, dy int) error
	MouseMoveAbsolute(x, y int) error
	MouseDown(button string) error
	MouseUp(button string) error
	MouseClick(button string, double bool) error
	MouseScroll(dy int) error
	KeyDown(key string) error
	KeyUp(key string) error
	KeyTap(key string, modifiers []string) error
	TypeText(text string) error
}

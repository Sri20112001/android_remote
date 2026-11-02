//go:build !windows

package input

type OtherInjector struct{}

func NewInjector() *OtherInjector {
	return &OtherInjector{}
}

func (inj *OtherInjector) MouseMove(dx, dy int) error                  { return nil }
func (inj *OtherInjector) MouseMoveAbsolute(x, y int) error            { return nil }
func (inj *OtherInjector) MouseDown(button string) error               { return nil }
func (inj *OtherInjector) MouseUp(button string) error                 { return nil }
func (inj *OtherInjector) MouseClick(button string, double bool) error { return nil }
func (inj *OtherInjector) MouseScroll(dy int) error                    { return nil }
func (inj *OtherInjector) KeyDown(key string) error                    { return nil }
func (inj *OtherInjector) KeyUp(key string) error                      { return nil }
func (inj *OtherInjector) KeyTap(key string, modifiers []string) error { return nil }
func (inj *OtherInjector) TypeText(text string) error                  { return nil }

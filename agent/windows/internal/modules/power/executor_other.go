//go:build !windows

package power

type OtherExecutor struct{}

func NewExecutor() *OtherExecutor {
	return &OtherExecutor{}
}

func (e *OtherExecutor) Lock() error      { return nil }
func (e *OtherExecutor) Sleep() error     { return nil }
func (e *OtherExecutor) Hibernate() error { return nil }
func (e *OtherExecutor) Restart() error   { return nil }
func (e *OtherExecutor) Shutdown() error  { return nil }

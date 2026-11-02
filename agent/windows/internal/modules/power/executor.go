package power

// Executor defines OS-level power operations.
type Executor interface {
	Lock() error
	Sleep() error
	Hibernate() error
	Restart() error
	Shutdown() error
}

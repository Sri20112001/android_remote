package clipboard

// Clipboard abstracts OS clipboard access.
type Clipboard interface {
	GetText() (string, error)
	SetText(text string) error
}

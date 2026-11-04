package constants

const (
	// DefaultDatabasePath is the SQLite database location relative to the
	// working directory.
	DefaultDatabasePath = "data/remotedeck.db"
	// MigrationTable records the schema migrations that have been applied.
	MigrationTable = "schema_migrations"
)

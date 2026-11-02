package constants

const (
	// DefaultDatabasePath is the SQLite database location relative to the
	// working directory.
	DefaultDatabasePath = "data/tuf_remote.db"
	// MigrationTable records the schema migrations that have been applied.
	MigrationTable = "schema_migrations"
)

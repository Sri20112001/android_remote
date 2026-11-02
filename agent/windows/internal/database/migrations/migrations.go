// Package migrations embeds the agent's SQL schema migrations so the binary
// is self-contained.
package migrations

import "embed"

// FS contains every migration file. Files must be named NNNN_description.sql
// and are applied in lexicographic order.
//
//go:embed *.sql
var FS embed.FS

package bootstrap

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/database"
	"github.com/tuf-remote/agent/internal/database/migrations"
	"github.com/tuf-remote/agent/internal/server"
)

// App owns the long-lived resources of the agent and their shutdown order.
type App struct {
	cfg       *config.Config
	logger    *slog.Logger
	db        *sql.DB
	server    *server.Server
	deps      *Dependencies
	startedAt time.Time
}

// New opens the database, applies migrations and builds the HTTP server.
// Nothing listens yet; call Start (or Run) afterwards.
func New(cfg *config.Config, logger *slog.Logger) (*App, error) {
	startedAt := time.Now().UTC()

	db, err := database.Open(cfg.Database, logger)
	if err != nil {
		return nil, err
	}
	if err := database.Migrate(context.Background(), db, logger, migrations.FS); err != nil {
		if closeErr := db.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("close database: %w", closeErr))
		}
		return nil, err
	}

	deps := buildDependencies(cfg, logger, db, startedAt)
	handler := server.NewRouter(deps.routerDependencies())
	srv := server.New(cfg.Server, handler, logger)

	return &App{
		cfg:       cfg,
		logger:    logger,
		db:        db,
		server:    srv,
		deps:      deps,
		startedAt: startedAt,
	}, nil
}

// Start binds the listener and serves in the background. It returns once
// the socket accepts connections; asynchronous failures appear on Errors.
func (a *App) Start() error {
	if err := a.server.Start(); err != nil {
		return err
	}
	if a.deps != nil && a.deps.DiscoveryService != nil {
		_ = a.deps.DiscoveryService.StartAdvertiser(a.server.Port())
	}
	return nil
}

// Addr returns the bound address ("" until Start succeeds).
func (a *App) Addr() string { return a.server.Addr() }

// Errors reports asynchronous server failures.
func (a *App) Errors() <-chan error { return a.server.Errors() }

// Run starts the server and blocks until ctx is cancelled (typically a
// termination signal) or the server fails, then shuts everything down in
// dependency order within the shutdown timeout.
func (a *App) Run(ctx context.Context) error {
	if err := a.Start(); err != nil {
		return err
	}

	var runErr error
	select {
	case <-ctx.Done():
		a.logger.Info("shutdown requested", "reason", context.Cause(ctx))
	case err := <-a.Errors():
		a.logger.Error("server failed", "error", err)
		runErr = err
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), constants.DefaultShutdownTimeout)
	defer cancel()
	if err := a.Shutdown(shutdownCtx); err != nil {
		runErr = errors.Join(runErr, err)
	} else {
		a.logger.Info("shutdown complete")
	}
	return runErr
}

// Shutdown stops the HTTP server first (no new work), then closes the
// database. Each resource is attempted even if an earlier step fails.
func (a *App) Shutdown(ctx context.Context) error {
	var errs []error
	if a.deps != nil && a.deps.DiscoveryService != nil {
		a.deps.DiscoveryService.Stop()
	}
	if a.deps != nil && a.deps.WSHub != nil {
		a.deps.WSHub.CloseAll("agent shutting down")
	}
	if err := a.server.Shutdown(ctx); err != nil {
		errs = append(errs, err)
	}
	if err := a.db.Close(); err != nil {
		errs = append(errs, fmt.Errorf("close database: %w", err))
	}
	return errors.Join(errs...)
}

// Package bootstrap assembles the agent: database, module graph, HTTP
// router and server, and defines their shutdown order.
package bootstrap

import (
	"database/sql"
	"log/slog"
	"time"

	"github.com/tuf-remote/agent/internal/audit"
	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/audio"
	"github.com/tuf-remote/agent/internal/modules/clipboard"
	"github.com/tuf-remote/agent/internal/modules/discovery"
	"github.com/tuf-remote/agent/internal/modules/health"
	"github.com/tuf-remote/agent/internal/modules/input"
	"github.com/tuf-remote/agent/internal/modules/monitoring"
	"github.com/tuf-remote/agent/internal/modules/pairing"
	"github.com/tuf-remote/agent/internal/modules/power"
	"github.com/tuf-remote/agent/internal/modules/ws"
	"github.com/tuf-remote/agent/internal/platform"
	"github.com/tuf-remote/agent/internal/server"
)

// Dependencies holds the components built during bootstrap and shared by
// every module. All wiring is constructor-based; nothing is global.
type Dependencies struct {
	Config *config.Config
	Logger *slog.Logger
	DB     *sql.DB
	Health *health.Controller
	// PairingController exposes the pairing endpoints.
	PairingController *pairing.Controller
	// PairingService doubles as the bearer-token validator.
	PairingService *pairing.Service
	// ConfirmLimiter is the per-IP budget for POST /pairing/confirm.
	ConfirmLimiter *middleware.RateLimiter
	// WSHub manages active WebSocket connections.
	WSHub *ws.Hub
	// WSRegistry maps module:action commands to their handlers.
	WSRegistry *ws.Registry
	// WSController handles the WebSocket upgrade and connection lifecycle.
	WSController *ws.Controller
	// DiscoveryService manages mDNS broadcasting.
	DiscoveryService *discovery.Service
	// DiscoveryController exposes discovery and QR endpoints.
	DiscoveryController *discovery.Controller
	// MonitoringService provides system metrics and broadcasts.
	MonitoringService *monitoring.Service
	// MonitoringController exposes monitoring endpoints.
	MonitoringController *monitoring.Controller
	// PowerService manages power operations.
	PowerService *power.Service
	// PowerController exposes power endpoints.
	PowerController *power.Controller
	// AudioService manages audio volume and mute.
	AudioService *audio.Service
	// AudioController exposes audio endpoints.
	AudioController *audio.Controller
	// InputService manages mouse and keyboard injection.
	InputService *input.Service
	// InputController exposes input endpoints.
	InputController *input.Controller
	// ClipboardService manages system clipboard.
	ClipboardService *clipboard.Service
	// ClipboardController exposes clipboard endpoints.
	ClipboardController *clipboard.Controller
}

// buildDependencies creates the module graph. Each module contributes its
// service and controller here as it lands in a later milestone.
func buildDependencies(cfg *config.Config, logger *slog.Logger, db *sql.DB, startedAt time.Time) *Dependencies {
	sysInfo := platform.NewSystemInfo()

	healthService := health.NewService(startedAt, sysInfo, db)
	healthController := health.NewController(healthService, logger)

	auditLogger := audit.New(db)
	pairingRepo := pairing.NewSQLiteRepository(db)
	pairingSessions := pairing.NewSessionStore(
		cfg.Security.Pairing.PINTTL.Duration(),
		cfg.Security.Pairing.MaxAttempts,
		cfg.Security.Pairing.MaxActiveSessions,
	)
	pairingService := pairing.NewService(
		pairingRepo,
		pairingSessions,
		auditLogger,
		logger,
		nil, // wall clock; tests inject their own
		pairing.ServiceConfig{
			TokenGracePeriod: cfg.Security.Pairing.TokenGracePeriod.Duration(),
		},
	)
	pairingController := pairing.NewController(pairingService, logger)

	confirmLimiter := middleware.NewRateLimiter(
		cfg.Security.RateLimit.ConfirmPerMinute,
		time.Minute,
	)

	wsHub := ws.NewHub(logger)
	wsRegistry := ws.NewRegistry()
	wsController := ws.NewController(wsHub, wsRegistry, pairingService, logger)

	discoveryService := discovery.NewService(cfg, sysInfo, logger)
	discoveryController := discovery.NewController(discoveryService, cfg.Server.Port, logger)

	monitoringProvider := monitoring.NewMetricsProvider()
	monitoringService := monitoring.NewService(monitoringProvider, wsHub, logger)
	monitoringService.RegisterWS(wsRegistry)
	monitoringController := monitoring.NewController(monitoringService, logger)

	powerExecutor := power.NewExecutor()
	powerService := power.NewService(powerExecutor, auditLogger, logger)
	powerService.RegisterWS(wsRegistry)
	powerController := power.NewController(powerService, logger)

	audioDeviceCtrl := audio.NewDeviceController()
	audioService := audio.NewService(audioDeviceCtrl, logger)
	audioService.RegisterWS(wsRegistry)
	audioController := audio.NewController(audioService, logger)

	inputInjector := input.NewInjector()
	inputService := input.NewService(inputInjector, logger)
	inputService.RegisterWS(wsRegistry)
	inputController := input.NewController(inputService, logger)

	clipboardProvider := clipboard.NewClipboard()
	clipboardService := clipboard.NewService(clipboardProvider, logger)
	clipboardService.RegisterWS(wsRegistry)
	clipboardController := clipboard.NewController(clipboardService, logger)

	return &Dependencies{
		Config:               cfg,
		Logger:               logger,
		DB:                   db,
		Health:               healthController,
		PairingController:    pairingController,
		PairingService:       pairingService,
		ConfirmLimiter:       confirmLimiter,
		WSHub:                wsHub,
		WSRegistry:           wsRegistry,
		WSController:         wsController,
		DiscoveryService:     discoveryService,
		DiscoveryController:  discoveryController,
		MonitoringService:    monitoringService,
		MonitoringController: monitoringController,
		PowerService:         powerService,
		PowerController:      powerController,
		AudioService:         audioService,
		AudioController:      audioController,
		InputService:         inputService,
		InputController:      inputController,
		ClipboardService:     clipboardService,
		ClipboardController:  clipboardController,
	}
}

// routerDependencies projects the dependencies the HTTP router consumes.
// Keeping this separate from Dependencies makes the router's needs explicit
// and keeps the server package free of database concerns.
func (d *Dependencies) routerDependencies() server.RouterDependencies {
	return server.RouterDependencies{
		Config:               d.Config,
		Logger:               d.Logger,
		Health:               d.Health,
		PairingController:    d.PairingController,
		PairingValidator:     d.PairingService,
		ConfirmLimiter:       d.ConfirmLimiter,
		WSController:         d.WSController.Connect,
		DiscoveryController:  d.DiscoveryController,
		MonitoringController: d.MonitoringController,
		PowerController:      d.PowerController,
		AudioController:      d.AudioController,
		InputController:      d.InputController,
		ClipboardController:  d.ClipboardController,
	}
}

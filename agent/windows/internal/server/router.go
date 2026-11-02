// Package server owns HTTP concerns: the Gin engine (routing, middleware
// order, JSON error mapping) and the net/http listener lifecycle.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
	"github.com/tuf-remote/agent/internal/modules/health"
	"github.com/tuf-remote/agent/internal/modules/pairing"
	"github.com/tuf-remote/agent/internal/utils"
)

// RouterDependencies carries everything the router needs to expose routes.
// New modules add their controllers here as they are implemented.
type RouterDependencies struct {
	Config            *config.Config
	Logger            *slog.Logger
	Health            *health.Controller
	PairingController *pairing.Controller
	// PairingValidator resolves bearer tokens for protected endpoints.
	PairingValidator middleware.TokenValidator
	// ConfirmLimiter caps POST /pairing/confirm per client IP.
	ConfirmLimiter *middleware.RateLimiter
	// WSController handles the WebSocket upgrade and connection lifecycle.
	WSController gin.HandlerFunc
	// DiscoveryController exposes discovery and QR endpoints.
	DiscoveryController interface {
		Info(*gin.Context)
		QR(*gin.Context)
	}
	MonitoringController interface {
		System(*gin.Context)
	}
	PowerController interface {
		Lock(*gin.Context)
		Request(*gin.Context)
		Confirm(*gin.Context)
	}
	AudioController interface {
		GetVolume(*gin.Context)
		SetVolume(*gin.Context)
		SetMute(*gin.Context)
	}
	InputController interface {
		Mouse(*gin.Context)
		Keyboard(*gin.Context)
	}
	ClipboardController interface {
		Get(*gin.Context)
		Set(*gin.Context)
	}
}

// NewRouter builds the Gin engine: middleware first (Gin snapshots the
// middleware chain when routes and error handlers are registered, so Use
// must run before any registration), then module routes, then the JSON
// handlers for unmatched requests.
func NewRouter(deps RouterDependencies) *gin.Engine {
	setGinMode(deps.Config.Logging.Level)
	// Route Gin's own diagnostics through the structured logger so no
	// unstructured output escapes the agent.
	gin.DefaultWriter = slogWriter{logger: deps.Logger, level: slog.LevelDebug}
	gin.DefaultErrorWriter = slogWriter{logger: deps.Logger, level: slog.LevelError}

	engine := gin.New()
	// Never trust X-Forwarded-For: ClientIP must reflect the real peer so
	// log lines and rate limits cannot be spoofed.
	if err := engine.SetTrustedProxies(nil); err != nil {
		// Only reachable on a programming error (nil never fails to parse).
		deps.Logger.Error("failed to disable trusted proxies", "error", err)
	}

	engine.Use(
		middleware.RequestID(),
		middleware.Logging(deps.Logger),
		middleware.Recovery(deps.Logger),
		// Guard last so it sees requests that survived logging/recovery
		// setup, and blocks browser-driven cross-site traffic (and DNS
		// rebinding via the Host allowlist) before any handler runs.
		middleware.Guard(deps.Logger, allowedHosts(deps)...),
	)

	api := engine.Group(constants.APIPrefix)
	health.RegisterRoutes(api, deps.Health)
	// Pairing is optional here: unit tests build partial routers with only
	// the health module wired.
	if deps.PairingController != nil {
		pairing.RegisterRoutes(api, pairing.RouteDeps{
			Controller:     deps.PairingController,
			Validator:      deps.PairingValidator,
			Logger:         deps.Logger,
			ConfirmLimiter: confirmLimiter(deps),
		})
	}
	if deps.WSController != nil {
		api.GET(constants.RouteWebSocket, deps.WSController)
		engine.GET(constants.RouteWebSocket, deps.WSController)
	}
	if deps.DiscoveryController != nil {
		api.GET(constants.RouteDiscoveryInfo, deps.DiscoveryController.Info)
		api.GET(constants.RouteDiscoveryQR, middleware.RequireLocal(), deps.DiscoveryController.QR)
	}
	if deps.PairingValidator != nil {
		auth := middleware.RequireAuth(deps.PairingValidator, deps.Logger)
		if deps.MonitoringController != nil {
			api.GET(constants.RouteMonitoringSystem, auth, deps.MonitoringController.System)
		}
		if deps.PowerController != nil {
			api.POST(constants.RoutePowerLock, auth, deps.PowerController.Lock)
			api.POST(constants.RoutePowerRequest, auth, deps.PowerController.Request)
			api.POST(constants.RoutePowerConfirm, auth, deps.PowerController.Confirm)
		}
		if deps.AudioController != nil {
			api.GET(constants.RouteAudioVolume, auth, deps.AudioController.GetVolume)
			api.PUT(constants.RouteAudioVolume, auth, deps.AudioController.SetVolume)
			api.POST(constants.RouteAudioMute, auth, deps.AudioController.SetMute)
		}
		if deps.InputController != nil {
			api.POST(constants.RouteInputMouse, auth, deps.InputController.Mouse)
			api.POST(constants.RouteInputKeyboard, auth, deps.InputController.Keyboard)
		}
		if deps.ClipboardController != nil {
			api.GET(constants.RouteClipboard, auth, deps.ClipboardController.Get)
			api.POST(constants.RouteClipboard, auth, deps.ClipboardController.Set)
		}
	}

	engine.HandleMethodNotAllowed = true
	engine.NoRoute(func(c *gin.Context) {
		utils.RespondError(c, http.StatusNotFound, constants.CodeNotFound, "endpoint not found")
	})
	engine.NoMethod(func(c *gin.Context) {
		utils.RespondError(c, http.StatusMethodNotAllowed, constants.CodeMethodNotAllowed, "method not allowed")
	})

	return engine
}

// confirmLimiter builds the per-IP budget middleware for pairing
// confirmation, or a pass-through when pairing is not wired (unit tests
// that build a partial router).
func confirmLimiter(deps RouterDependencies) gin.HandlerFunc {
	if deps.ConfirmLimiter == nil {
		return func(c *gin.Context) { c.Next() }
	}
	return deps.ConfirmLimiter.Middleware(middleware.ClientIPKey)
}

// allowedHosts is the host allowlist Guard enforces: the configured
// extras plus this machine's own hostname (so reaching the PC by its own
// name keeps working).
func allowedHosts(deps RouterDependencies) []string {
	hosts := append([]string(nil), deps.Config.Security.AllowedHosts...)
	if name := middleware.Hostname(); name != "" {
		hosts = append(hosts, name)
	}
	return hosts
}

// setGinMode follows the configured log level: debug output only when the
// operator asked for debug logging.
func setGinMode(level string) {
	if level == "debug" {
		gin.SetMode(gin.DebugMode)
		return
	}
	gin.SetMode(gin.ReleaseMode)
}

// slogWriter adapts io.Writer to the structured logger (used for Gin's and
// net/http's internal diagnostics).
type slogWriter struct {
	logger *slog.Logger
	level  slog.Level
}

// Write implements io.Writer.
func (w slogWriter) Write(p []byte) (int, error) {
	message := strings.TrimSpace(string(p))
	if message != "" {
		w.logger.Log(context.Background(), w.level, "internal", "message", message)
	}
	return len(p), nil
}

// Package server owns HTTP concerns: the Gin engine (routing, middleware
// order, JSON error mapping) and the net/http listener lifecycle.
package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

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

		api.POST("/files/upload", auth, handleFileUpload(deps.Logger))
		api.GET("/files/download/:filename", handleFileDownload(deps.Logger))
		api.GET("/files/list", auth, handleFileList(deps.Logger))
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
	if deps.ConfirmLimiter == nil || (deps.Config != nil && deps.Config.Security.RateLimit.ConfirmPerMinute <= 0) {
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

// handleFileUpload accepts multipart/form-data uploads and writes them safely into the user's Downloads directory.
func handleFileUpload(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			utils.RespondError(c, http.StatusBadRequest, constants.CodeInvalidRequest, "missing file in form-data")
			return
		}

		userProfile := os.Getenv("USERPROFILE")
		if userProfile == "" {
			userProfile = "."
		}
		downloadsDir := filepath.Join(userProfile, "Downloads")
		_ = os.MkdirAll(downloadsDir, 0755)

		cleanName := filepath.Base(file.Filename)
		cleanName = strings.ReplaceAll(cleanName, "..", "")
		cleanName = strings.ReplaceAll(cleanName, "/", "_")
		cleanName = strings.ReplaceAll(cleanName, "\\", "_")
		if cleanName == "" || cleanName == "." {
			cleanName = fmt.Sprintf("drop_%d.bin", time.Now().Unix())
		}

		destPath := filepath.Join(downloadsDir, cleanName)
		if err := c.SaveUploadedFile(file, destPath); err != nil {
			logger.Error("failed to save uploaded file", "error", err, "dest", destPath)
			utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to save file")
			return
		}

		logger.Info("file received from mobile client", "filename", cleanName, "size", file.Size, "dest", destPath)
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"filename": cleanName,
			"path":     destPath,
			"size":     file.Size,
		})
	}
}

// handleFileDownload serves files from Downloads directory to authorized mobile devices.
func handleFileDownload(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		filename := c.Param("filename")
		filename = filepath.Base(filename)
		filename = strings.ReplaceAll(filename, "..", "")

		userProfile := os.Getenv("USERPROFILE")
		if userProfile == "" {
			userProfile = "."
		}
		filePath := filepath.Join(userProfile, "Downloads", filename)

		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			logger.Warn("file download not found", "filename", filename)
			utils.RespondError(c, http.StatusNotFound, constants.CodeNotFound, "file not found")
			return
		}

		logger.Info("streaming file download to client", "filename", filename)
		c.FileAttachment(filePath, filename)
	}
}

// handleFileList lists recently saved beamed files in Downloads directory.
func handleFileList(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		userProfile := os.Getenv("USERPROFILE")
		if userProfile == "" {
			userProfile = "."
		}
		downloadsDir := filepath.Join(userProfile, "Downloads")
		entries, err := os.ReadDir(downloadsDir)
		if err != nil {
			logger.Error("failed to read downloads directory", "error", err)
			utils.RespondError(c, http.StatusInternalServerError, constants.CodeInternal, "failed to read files")
			return
		}

		var files []gin.H
		for _, entry := range entries {
			if !entry.IsDir() {
				info, err := entry.Info()
				if err == nil {
					files = append(files, gin.H{
						"name":     entry.Name(),
						"size":     info.Size(),
						"modified": info.ModTime().Unix(),
					})
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"files": files})
	}
}



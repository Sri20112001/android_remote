// Command agent runs the Remote Deck Windows background agent: a local HTTP
// and WebSocket server that an Android device uses to control this PC.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/tuf-remote/agent/internal/bootstrap"
	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/logging"
)

func main() {
	configPath := flag.String("config", "", "path to the configuration file (defaults to "+constants.DefaultConfigPath+" when present)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("%s %s\n", constants.AppName, constants.AppVersion)
		return
	}

	path, err := resolveConfigPath(*configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "configuration error:", err)
		os.Exit(1)
	}

	cfg, err := config.Load(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "configuration error:", err)
		os.Exit(1)
	}

	logger, err := logging.New(cfg.Logging)
	if err != nil {
		fmt.Fprintln(os.Stderr, "logging configuration error:", err)
		os.Exit(1)
	}

	configSource := "built-in defaults"
	if path != "" {
		configSource = path
	}
	logger.Info("starting agent",
		"name", constants.AppName,
		"version", constants.AppVersion,
		"config_source", configSource,
	)

	app, err := bootstrap.New(cfg, logger)
	if err != nil {
		logger.Error("bootstrap failed", "error", err)
		os.Exit(1)
	}

	// SIGTERM is not delivered by the Windows console, but keeps the agent
	// well-behaved under service wrappers that send it.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx); err != nil {
		logger.Error("agent stopped with error", "error", err)
		os.Exit(1)
	}
	logger.Info("agent stopped")
}

// resolveConfigPath selects the configuration file: the -config flag wins,
// then TUF_REMOTE_CONFIG, then the default path if it exists. An empty
// result means "use built-in defaults plus environment overrides".
func resolveConfigPath(flagPath string) (string, error) {
	if flagPath != "" {
		return flagPath, nil // an explicitly named file must exist
	}
	if envPath := os.Getenv(config.EnvConfigPath); envPath != "" {
		return envPath, nil
	}
	if _, err := os.Stat(constants.DefaultConfigPath); err == nil {
		return constants.DefaultConfigPath, nil
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("probe default configuration %s: %w", constants.DefaultConfigPath, err)
	}
	return "", nil
}

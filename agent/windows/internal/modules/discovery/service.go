package discovery

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/grandcat/zeroconf"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/platform"
)

// Service provides mDNS advertisement and discovery/QR metadata.
type Service struct {
	cfg     *config.Config
	sysInfo platform.SystemInfoProvider
	logger  *slog.Logger
	server  *zeroconf.Server
}

// NewService constructs a discovery service.
func NewService(cfg *config.Config, sysInfo platform.SystemInfoProvider, logger *slog.Logger) *Service {
	return &Service{
		cfg:     cfg,
		sysInfo: sysInfo,
		logger:  logger,
	}
}

// StartAdvertiser begins broadcasting mDNS on local interfaces.
func (s *Service) StartAdvertiser(port int) error {
	if port <= 0 {
		return fmt.Errorf("invalid port for mDNS: %d", port)
	}

	hostname, _ := os.Hostname()
	instanceName := s.cfg.Agent.Name
	if instanceName == "" {
		instanceName = "Remote Deck"
	}

	txtRecords := []string{
		"version=" + constants.AppVersion,
		"name=" + instanceName,
		"tls=" + fmt.Sprintf("%t", s.cfg.Server.TLS.Enabled),
	}

	server, err := zeroconf.Register(
		instanceName,
		"_remotedeck._tcp",
		"local.",
		port,
		txtRecords,
		nil,
	)
	if err != nil {
		s.logger.Warn("mDNS advertisement failed to register", "error", err)
		return err
	}

	s.server = server
	s.logger.Info("mDNS advertiser started", "service", "_remotedeck._tcp", "instance", instanceName, "port", port, "host", hostname)
	return nil
}

// Stop stops the mDNS broadcaster.
func (s *Service) Stop() {
	if s.server != nil {
		s.server.Shutdown()
		s.server = nil
		s.logger.Info("mDNS advertiser stopped")
	}
}

// GetInfo collects current discovery parameters.
func (s *Service) GetInfo(ctx context.Context, port int) (*InfoResponse, error) {
	info, err := s.sysInfo.Collect(ctx)
	if err != nil {
		return nil, err
	}

	return &InfoResponse{
		AgentName:  s.cfg.Agent.Name,
		Version:    constants.AppVersion,
		Hostname:   info.Hostname,
		Addresses:  info.IPAddresses,
		Port:       port,
		TLSEnabled: s.cfg.Server.TLS.Enabled,
	}, nil
}

// GetQRPayload builds the QR code payload.
func (s *Service) GetQRPayload(ctx context.Context, port int, sessionID, pin string) (*QRPayload, error) {
	info, err := s.sysInfo.Collect(ctx)
	if err != nil {
		return nil, err
	}

	return &QRPayload{
		AgentName:   s.cfg.Agent.Name,
		Version:     constants.AppVersion,
		Hostname:    info.Hostname,
		IPAddresses: info.IPAddresses,
		Port:        port,
		TLSEnabled:  s.cfg.Server.TLS.Enabled,
		SessionID:   sessionID,
		PIN:         pin,
	}, nil
}

package server

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"sync"

	"github.com/tuf-remote/agent/internal/config"
	"github.com/tuf-remote/agent/internal/constants"
)

// Server wraps net/http with the configured timeouts, optional TLS,
// asynchronous error reporting and graceful shutdown.
type Server struct {
	cfg        config.ServerConfig
	logger     *slog.Logger
	httpServer *http.Server
	errCh      chan error

	mu sync.Mutex
	ln net.Listener
}

// New creates a server that serves handler according to cfg.
func New(cfg config.ServerConfig, handler http.Handler, logger *slog.Logger) *Server {
	return &Server{
		cfg:    cfg,
		logger: logger,
		errCh:  make(chan error, 1),
		httpServer: &http.Server{
			Handler:           handler,
			ReadHeaderTimeout: cfg.ReadHeaderTimeout.Duration(),
			ReadTimeout:       cfg.ReadTimeout.Duration(),
			WriteTimeout:      cfg.WriteTimeout.Duration(),
			IdleTimeout:       cfg.IdleTimeout.Duration(),
			MaxHeaderBytes:    constants.DefaultMaxHeaderBytes,
			// Keep net/http's internal diagnostics in the structured log.
			ErrorLog: log.New(slogWriter{logger: logger, level: slog.LevelError}, "", 0),
		},
	}
}

// Start binds the listener (loading the TLS key pair first when TLS is
// enabled) and begins serving in the background. It returns once the socket
// accepts connections; later failures are reported on Errors.
func (s *Server) Start() error {
	addr := net.JoinHostPort(s.cfg.Host, strconv.Itoa(s.cfg.Port))

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", addr, err)
	}

	if s.cfg.TLS.Enabled {
		cert, err := tls.LoadX509KeyPair(s.cfg.TLS.CertFile, s.cfg.TLS.KeyFile)
		if err != nil {
			_ = listener.Close() // best-effort cleanup before reporting the real cause
			return fmt.Errorf("load TLS key pair (cert %q, key %q): %w",
				s.cfg.TLS.CertFile, s.cfg.TLS.KeyFile, err)
		}
		listener = tls.NewListener(listener, &tls.Config{
			Certificates: []tls.Certificate{cert},
			// TLS 1.2 is the modern floor; older versions are refused.
			MinVersion: tls.VersionTLS12,
		})
	}

	s.mu.Lock()
	s.ln = listener
	s.mu.Unlock()

	s.logger.Info("http server listening",
		"addr", addr,
		"resolved_addr", listener.Addr().String(),
		"tls", s.cfg.TLS.Enabled,
	)
	go s.serve(listener)
	return nil
}

// serve runs the accept loop; an unexpected exit is logged and published on
// Errors (never http.ErrServerClosed, which is the graceful path).
func (s *Server) serve(listener net.Listener) {
	err := s.httpServer.Serve(listener)
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		s.logger.Error("http server stopped unexpectedly", "error", err)
		select {
		case s.errCh <- err:
		default: // an error is already waiting; never block the goroutine
		}
		return
	}
	s.logger.Debug("http server closed")
}

// Errors reports asynchronous server failures.
func (s *Server) Errors() <-chan error { return s.errCh }

// Addr returns the bound address ("host:port"), or "" before Start. With
// port 0 it reveals the ephemeral port the OS assigned.
func (s *Server) Addr() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ln == nil {
		return ""
	}
	return s.ln.Addr().String()
}

// Port returns the bound TCP port, or 0 if not bound.
func (s *Server) Port() int {
	addr := s.Addr()
	if addr == "" {
		return 0
	}
	_, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return 0
	}
	p, _ := strconv.Atoi(portStr)
	return p
}

// Shutdown stops accepting new connections and drains in-flight requests
// until the context expires.
func (s *Server) Shutdown(ctx context.Context) error {
	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	return nil
}

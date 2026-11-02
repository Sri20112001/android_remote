package middleware_test

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/middleware"
)

// stubValidator answers with a fixed identity or error.
type stubValidator struct {
	identity middleware.Identity
	err      error
	calls    int
}

func (v *stubValidator) ValidateToken(_ context.Context, _ string) (middleware.Identity, error) {
	v.calls++
	return v.identity, v.err
}

// testLog returns a logger writing into a discarded buffer.
func testLog() *slog.Logger {
	return slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))
}

// protectedEngine builds an engine with one endpoint per auth mode.
func protectedEngine(validator middleware.TokenValidator) *gin.Engine {
	gin.SetMode(gin.TestMode)
	logger := testLog()
	engine := gin.New()
	engine.GET("/local", middleware.RequireLocal(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"local": middleware.IdentityFromContext(c).Local})
	})
	engine.GET("/auth", middleware.RequireAuth(validator, logger), func(c *gin.Context) {
		id := middleware.IdentityFromContext(c)
		c.JSON(http.StatusOK, gin.H{"device": id.DeviceID, "local": id.Local})
	})
	engine.GET("/token", middleware.RequireToken(validator, logger), func(c *gin.Context) {
		id := middleware.IdentityFromContext(c)
		c.JSON(http.StatusOK, gin.H{"device": id.DeviceID})
	})
	return engine
}

func do(engine *gin.Engine, path, remoteAddr, auth string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = remoteAddr
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

const (
	loopback = "127.0.0.1:6000"
	lan      = "10.0.0.9:6000"
)

func TestRequireLocalRejectsLAN(t *testing.T) {
	engine := protectedEngine(&stubValidator{})

	if rec := do(engine, "/local", lan, ""); rec.Code != http.StatusForbidden {
		t.Errorf("LAN status = %d, want 403", rec.Code)
	}
	rec := do(engine, "/local", loopback, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("loopback status = %d", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"local":true`)) {
		t.Errorf("body = %s", rec.Body.String())
	}
}

func TestRequireLocalIgnoresForwardedHeaders(t *testing.T) {
	engine := protectedEngine(&stubValidator{})

	req := httptest.NewRequest(http.MethodGet, "/local", nil)
	req.RemoteAddr = lan
	// A spoofed loopback claim in a header must not open the endpoint.
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Real-IP", "127.0.0.1")
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403 despite spoofed headers", rec.Code)
	}
}

func TestRequireAuthAcceptsLoopbackWithoutToken(t *testing.T) {
	validator := &stubValidator{}
	engine := protectedEngine(validator)

	rec := do(engine, "/auth", loopback, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if validator.calls != 0 {
		t.Errorf("loopback must not consult the validator, calls = %d", validator.calls)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"local":true`)) {
		t.Errorf("body = %s", rec.Body.String())
	}
}

func TestRequireAuthFromLANNeedsBearerToken(t *testing.T) {
	valid := &stubValidator{identity: middleware.Identity{DeviceID: "dev-1", TokenID: "tok-1"}}
	engine := protectedEngine(valid)

	t.Run("missing header", func(t *testing.T) {
		if rec := do(engine, "/auth", lan, ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
	})
	t.Run("malformed scheme", func(t *testing.T) {
		if rec := do(engine, "/auth", lan, "Basic dXNlcjpwYXNz"); rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
	})
	t.Run("valid token", func(t *testing.T) {
		rec := do(engine, "/auth", lan, "Bearer abc123")
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		if valid.calls != 1 {
			t.Errorf("validator calls = %d", valid.calls)
		}
		if !bytes.Contains(rec.Body.Bytes(), []byte(`"device":"dev-1"`)) {
			t.Errorf("body = %s", rec.Body.String())
		}
	})
	t.Run("invalid token", func(t *testing.T) {
		bad := &stubValidator{err: middleware.ErrInvalidToken}
		engine := protectedEngine(bad)
		if rec := do(engine, "/auth", lan, "Bearer nope"); rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
	})
	t.Run("infrastructure failure fails closed", func(t *testing.T) {
		broken := &stubValidator{err: errors.New("database gone")}
		engine := protectedEngine(broken)
		if rec := do(engine, "/auth", lan, "Bearer abc"); rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500 and fail-closed", rec.Code)
		}
	})
}

func TestRequireTokenDemandsCredentialFromLoopbackToo(t *testing.T) {
	valid := &stubValidator{identity: middleware.Identity{DeviceID: "dev-1", TokenID: "tok-1"}}
	engine := protectedEngine(valid)

	// Loopback without a token: refused (unlike RequireAuth).
	if rec := do(engine, "/token", loopback, ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("loopback without token: status = %d, want 401", rec.Code)
	}
	// Loopback with a token: accepted, and the identity is stored.
	rec := do(engine, "/token", loopback, "Bearer abc")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestBearerTokenExtractionRules(t *testing.T) {
	engine := protectedEngine(&stubValidator{identity: middleware.Identity{DeviceID: "d"}})

	cases := []struct {
		header string
		want   int
	}{
		{"Bearer token", http.StatusOK},
		{"bearer token", http.StatusOK}, // scheme is case-insensitive
		{"Bearer  ", http.StatusUnauthorized},
		{"Bearer", http.StatusUnauthorized},
		{"token", http.StatusUnauthorized},
		{"", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "/token", nil)
		req.RemoteAddr = lan
		if tc.header != "" {
			req.Header.Set("Authorization", tc.header)
		}
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		if rec.Code != tc.want {
			t.Errorf("header %q: status = %d, want %d", tc.header, rec.Code, tc.want)
		}
	}
}

func TestIsLoopbackHandlesOddAddresses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		addr string
		want bool
	}{
		{"127.0.0.1:1", true},
		{"[::1]:1", true},
		{"192.168.1.5:1", false},
		{"192.0.2.1:1234", false},
		{"not-an-address", false},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = tc.addr
		rec := httptest.NewRecorder()
		engine := gin.New()
		var got bool
		engine.GET("/", func(c *gin.Context) {
			got = middleware.IsLoopback(c)
			c.Status(http.StatusNoContent)
		})
		engine.ServeHTTP(rec, req)
		if got != tc.want {
			t.Errorf("IsLoopback(%q) = %v, want %v", tc.addr, got, tc.want)
		}
	}
}

package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// guardedEngine returns an engine with Guard in front of a counting
// handler, plus the count of requests that reached it. "tuf-pc.local" is
// configured as an allowed hostname, as an operator would.
func guardedEngine(t *testing.T) (*gin.Engine, *int) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	engine.Use(middleware.Guard(testLog(), "tuf-pc.local"))
	reached := 0
	engine.Any("/api/v1/anything", func(c *gin.Context) {
		reached++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return engine, &reached
}

func guardRequest(engine *gin.Engine, headers map[string]string) *httptest.ResponseRecorder {
	return guardRequestWithHost(engine, "tuf-pc.local:8765", headers)
}

// guardRequestWithHost issues the request under an explicit Host header,
// which is what a rebinding attacker controls.
func guardRequestWithHost(engine *gin.Engine, host string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/anything", nil)
	req.RemoteAddr = "10.0.0.5:5555"
	req.Host = host
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

func TestGuardBlocksCrossSiteFetch(t *testing.T) {
	engine, reached := guardedEngine(t)

	rec := guardRequest(engine, map[string]string{"Sec-Fetch-Site": "cross-site"})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
	if *reached != 0 {
		t.Error("handler must not run for a blocked request")
	}
	if got := errorCodes(t, rec); got != string(constants.CodeForbidden) {
		t.Errorf("code = %v", got)
	}
}

func TestGuardBlocksForeignOrigin(t *testing.T) {
	engine, reached := guardedEngine(t)

	rec := guardRequest(engine, map[string]string{"Origin": "https://evil.example"})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
	if *reached != 0 {
		t.Error("handler must not run")
	}
}

func TestGuardBlocksOpaqueOrigin(t *testing.T) {
	engine, _ := guardedEngine(t)

	rec := guardRequest(engine, map[string]string{"Origin": "null"})
	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403 for an opaque origin", rec.Code)
	}
}

func TestGuardAllowsSameOriginBrowserRequest(t *testing.T) {
	engine, reached := guardedEngine(t)

	rec := guardRequest(engine, map[string]string{
		"Origin":          "http://tuf-pc.local:8765",
		"Sec-Fetch-Site":  "same-origin",
		"Sec-Fetch-Mode":  "cors",
		"Sec-Fetch-Dest":  "empty",
		"Accept-Language": "en-US",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if *reached != 1 {
		t.Errorf("handler runs = %d, want 1", *reached)
	}
}

func TestGuardIgnoresNativeClients(t *testing.T) {
	engine, reached := guardedEngine(t)

	// The Android app and curl send no Origin and no Sec-Fetch-* headers.
	rec := guardRequest(engine, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if *reached != 1 {
		t.Errorf("handler runs = %d, want 1", *reached)
	}
}

func TestGuardIsCaseInsensitiveOnSchemeHost(t *testing.T) {
	engine, reached := guardedEngine(t)

	rec := guardRequest(engine, map[string]string{"Origin": "HTTP://TUF-PC.LOCAL:8765"})
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, body = %s (host comparison must ignore case)", rec.Code, rec.Body.String())
	}
	if *reached != 1 {
		t.Errorf("handler runs = %d, want 1", *reached)
	}
}

func TestGuardBlocksRebindingHost(t *testing.T) {
	engine, reached := guardedEngine(t)

	// After rebinding, the page at attacker.example and the target share
	// an origin — so Origin and Sec-Fetch-Site both *match*. Only the Host
	// allowlist sees it.
	rec := guardRequestWithHost(engine, "attacker.example:8765", map[string]string{
		"Origin":         "http://attacker.example:8765",
		"Sec-Fetch-Site": "same-origin",
		"Sec-Fetch-Mode": "cors",
	})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 for a rebinding host", rec.Code)
	}
	if *reached != 0 {
		t.Error("handler must not run for a rebinding host")
	}
	if got := errorCodes(t, rec); got != string(constants.CodeForbidden) {
		t.Errorf("code = %v", got)
	}
}

func TestGuardAcceptsAddressFormsClientsUse(t *testing.T) {
	engine, reached := guardedEngine(t)

	cases := []struct {
		name string
		host string
	}{
		{"lan ip", "192.168.1.9:8765"},
		{"loopback ip", "127.0.0.1:8765"},
		{"ipv6 loopback", "[::1]:8765"},
		{"localhost", "localhost:8765"},
		{"configured name", "tuf-pc.local:8765"},
		{"configured name, upper case", "TUF-PC.LOCAL:8765"},
		{"configured name, no port", "tuf-pc.local"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := guardRequestWithHost(engine, tc.host, nil)
			if rec.Code != http.StatusOK {
				t.Errorf("host %q: status = %d, body = %s", tc.host, rec.Code, rec.Body.String())
			}
		})
	}
	if *reached != len(cases) {
		t.Errorf("handler runs = %d, want %d", *reached, len(cases))
	}
}

func TestGuardRejectsEmptyHost(t *testing.T) {
	engine, reached := guardedEngine(t)

	rec := guardRequestWithHost(engine, "", nil)
	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403 for a missing Host", rec.Code)
	}
	if *reached != 0 {
		t.Error("handler must not run")
	}
}

// errorCodes extracts the machine-readable code from an error envelope.
func errorCodes(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("body is not the error envelope: %v (%q)", err, rec.Body.String())
	}
	return payload.Error.Code
}

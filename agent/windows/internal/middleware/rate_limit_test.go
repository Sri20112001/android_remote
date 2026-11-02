package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/middleware"
)

func TestRateLimiterAllowsUpToTheBudgetThenDenies(t *testing.T) {
	limiter := middleware.NewRateLimiter(3, time.Minute)

	for i := 1; i <= 3; i++ {
		allowed, _ := limiter.Allow("client-a")
		if !allowed {
			t.Fatalf("request %d must be allowed", i)
		}
	}
	allowed, retryAfter := limiter.Allow("client-a")
	if allowed {
		t.Fatal("4th request must be denied")
	}
	if retryAfter <= 0 || retryAfter > time.Minute {
		t.Errorf("retryAfter = %v, want within the window", retryAfter)
	}
}

func TestRateLimiterBucketsAreIndependent(t *testing.T) {
	limiter := middleware.NewRateLimiter(1, time.Minute)

	if allowed, _ := limiter.Allow("a"); !allowed {
		t.Fatal("first use of a must pass")
	}
	if allowed, _ := limiter.Allow("a"); allowed {
		t.Fatal("second use of a must be denied")
	}
	if allowed, _ := limiter.Allow("b"); !allowed {
		t.Fatal("b must have its own budget")
	}
}

func TestRateLimiterWindowReset(t *testing.T) {
	limiter := middleware.NewRateLimiter(1, 20*time.Millisecond)

	if allowed, _ := limiter.Allow("c"); !allowed {
		t.Fatal("first must pass")
	}
	if allowed, _ := limiter.Allow("c"); allowed {
		t.Fatal("second must be denied")
	}
	time.Sleep(40 * time.Millisecond)
	if allowed, _ := limiter.Allow("c"); !allowed {
		t.Fatal("budget must reset after the window")
	}
}

func TestRateLimiterMiddlewareRespondsWith429AndRetryAfter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := middleware.NewRateLimiter(2, time.Minute)

	engine := gin.New()
	engine.GET("/limited",
		limiter.Middleware(middleware.ClientIPKey),
		func(c *gin.Context) { c.Status(http.StatusOK) },
	)

	send := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/limited", nil)
		req.RemoteAddr = "10.0.0.4:9000"
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		return rec
	}

	if rec := send(); rec.Code != http.StatusOK {
		t.Fatalf("1st = %d", rec.Code)
	}
	if rec := send(); rec.Code != http.StatusOK {
		t.Fatalf("2nd = %d", rec.Code)
	}

	rec := send()
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("3rd = %d, want 429", rec.Code)
	}
	raw := rec.Header().Get("Retry-After")
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		t.Fatalf("Retry-After %q is not an integer: %v", raw, err)
	}
	if seconds < 1 {
		t.Errorf("Retry-After = %d, want >= 1", seconds)
	}
}

func TestClientIPKeyUsesSocketPeer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	observed := ""
	engine := gin.New()
	engine.GET("/", func(c *gin.Context) {
		observed = middleware.ClientIPKey(c)
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "172.16.0.8:1234"
	// Trusted proxies are disabled in the real router; even so, ClientIPKey
	// must read the socket, never a header.
	req.Header.Set("X-Forwarded-For", "8.8.8.8")
	engine.ServeHTTP(httptest.NewRecorder(), req)

	if observed != "172.16.0.8" {
		t.Errorf("key = %q, want the socket peer", observed)
	}
}

func TestRateLimitKeyDiffersPerClient(t *testing.T) {
	limiter := middleware.NewRateLimiter(1, time.Minute)

	if allowed, _ := limiter.Allow("10.0.0.1"); !allowed {
		t.Fatal("first client must pass")
	}
	if allowed, _ := limiter.Allow("10.0.0.2"); !allowed {
		t.Fatal("second client must have its own budget")
	}
	if allowed, _ := limiter.Allow("10.0.0.1"); allowed {
		t.Fatal("first client must now be limited")
	}
}

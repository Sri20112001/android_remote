package middleware

import (
	"math"
	"net"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/utils"
)

// RateLimiter is a small fixed-window in-memory counter keyed by an
// arbitrary string (typically a client IP). Windows are reset lazily, so
// memory stays bounded by the number of distinct keys seen inside one
// window; expired keys are purged on every call.
type RateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	counts map[string]*limiterEntry
}

type limiterEntry struct {
	count   int
	resetAt time.Time
}

// NewRateLimiter creates a limiter allowing limit events per key per
// window. limit must be positive (configuration validates this).
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:  limit,
		window: window,
		counts: make(map[string]*limiterEntry),
	}
}

// Allow consumes one unit of the budget for key. When denied it also
// returns how long the caller should wait before retrying.
func (l *RateLimiter) Allow(key string) (allowed bool, retryAfter time.Duration) {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	for k, entry := range l.counts {
		if !now.Before(entry.resetAt) {
			delete(l.counts, k)
		}
	}

	entry, ok := l.counts[key]
	if !ok {
		l.counts[key] = &limiterEntry{count: 1, resetAt: now.Add(l.window)}
		return true, 0
	}
	if entry.count >= l.limit {
		return false, entry.resetAt.Sub(now)
	}
	entry.count++
	return true, 0
}

// Middleware rejects requests over the budget with 429 + Retry-After.
// keyFn extracts the bucketing key (usually the client IP).
func (l *RateLimiter) Middleware(keyFn func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		allowed, retryAfter := l.Allow(keyFn(c))
		if allowed {
			c.Next()
			return
		}
		seconds := int(math.Ceil(retryAfter.Seconds()))
		if seconds < 1 {
			seconds = 1
		}
		c.Header("Retry-After", strconv.Itoa(seconds))
		utils.RespondError(c, 429, constants.CodeRateLimited, "too many requests, try again shortly")
		c.Abort()
	}
}

// ClientIPKey buckets a request by its socket peer address. With trusted
// proxies disabled this cannot be spoofed through headers.
func ClientIPKey(c *gin.Context) string {
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}

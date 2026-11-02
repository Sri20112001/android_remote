# Architecture

## Overview

The TUF Remote agent is a single Go binary that runs locally on Windows 11.
It exposes a versioned REST API (Gin on net/http) and, in a later milestone,
a WebSocket channel for latency-sensitive commands and live events.

Design goals, in priority order:

1. **Modularity** — every feature lives in its own module with a
   routes → controller → service split; modules are added without touching
   the core.
2. **Security** — no global mutable state, no arbitrary command execution,
   no unauthenticated destructive endpoint, least-privilege defaults
   (loopback binding, TLS for LAN).
3. **Testability** — business logic depends on small interfaces, not on
   hardware; Windows specifics are isolated behind `platform` and
   `*_windows.go` files.
4. **Honesty** — an operation the platform cannot perform returns
   `unsupported`/`unavailable`; measurements are never invented.

## Layering

```text
                ┌─────────────────────────────────────────────┐
                │ cmd/agent            flags · signals · exit │
                └───────────────────────┬─────────────────────┘
                                        │
                ┌───────────────────────▼─────────────────────┐
                │ bootstrap            DI graph · lifecycle    │
                │                      Run/Shutdown ordering   │
                └───────┬──────────────────────────┬──────────┘
                        │                          │
        ┌───────────────▼──────────────┐   ┌───────▼──────────────┐
        │ server                       │   │ database             │
        │  Gin engine · middleware     │   │  SQLite · migrations │
        │  net/http listener · TLS     │   └──────────────────────┘
        └───────┬──────────────────────┘
                │  RouterDependencies
        ┌───────▼──────────────────────────────────────────────┐
        │ modules/<feature>                                    │
        │   routes.go      registration only (no logic)        │
        │   controller.go  parse · validate · respond · map    │
        │   service.go     business logic (interfaces in)      │
        └───────┬──────────────────────────────────────────────┘
                │  SystemInfoProvider, Store, … (interfaces)
        ┌───────▼───────────────┐       ┌──────────────────────┐
        │ platform (windows)    │       │ utils · constants    │
        │ registry · win32 API  │       │ config · logging     │
        └───────────────────────┘       └──────────────────────┘
```

**Rule of thumb:** dependencies point downward only. `modules/*` never
imports `bootstrap`; `server` never imports `database`; controllers never
touch SQL.

## Package responsibilities

| Package | Responsibility | Must not contain |
|---|---|---|
| `cmd/agent` | flag parsing, signal handling, process exit codes | business logic, route definitions |
| `internal/bootstrap` | build the dependency graph, app lifecycle, shutdown order | HTTP details, SQL |
| `internal/config` | load/validate YAML + environment configuration | secrets, runtime state |
| `internal/constants` | identity, route paths, limits, defaults, error codes | runtime-configurable values |
| `internal/database` | SQLite connection, pragmas, migration runner | feature queries |
| `internal/logging` | construct the `slog` logger | ad-hoc `fmt.Print*` |
| `internal/middleware` | request ID, access logging, panic recovery | authentication (later, own file) |
| `internal/modules/*` | feature modules: routes → controller → service | cross-module imports |
| `internal/platform` | OS-specific measurements behind interfaces | business rules |
| `internal/server` | Gin engine assembly, listener lifecycle, TLS | business logic, database access |
| `internal/utils` | response envelope helpers | anything stateful |

## Request flow

```text
socket
  → net/http (timeouts, TLS)
  → Gin engine
      1. middleware.RequestID    assigns/echoes X-Request-ID
      2. middleware.Logging      access log (status-aware level)
      3. middleware.Recovery     panic → JSON 500 + stack in log
      4. module routes           registered on /api/v1 group
  → controller   parse → validate → call service → respond
  → service      business logic, interfaces for external effects
  → repository   (from milestone 2 on) parameterised SQL
  → SQLite / platform API
```

Unmatched paths hit `NoRoute` and wrong methods hit `NoMethod`; both return
the standard JSON error envelope. Gin's `SetTrustedProxies(nil)` disables
`X-Forwarded-For` parsing so client IPs (logs, future rate limits) cannot be
spoofed.

## Dependency injection

All wiring happens once in `bootstrap.buildDependencies` using
constructor injection:

```go
healthService := health.NewService(startedAt, sysInfo, db)
healthController := health.NewController(healthService, logger)
```

There is no service locator and no mutable package-level state (Gin's
global mode/writer settings are assigned once during router construction).
Tests substitute fakes through the same constructors — no mocking
framework is used.

## Concurrency model

- One goroutine per HTTP request (net/http default).
- SQLite access is serialised through a single connection
  (`SetMaxOpenConns(1)`): SQLite allows one writer, and the agent's workload
  is small; this removes `SQLITE_BUSY` deadlocks by construction.
- Graceful shutdown: signal → stop accepting connections → drain in-flight
  requests (bounded by the shutdown timeout) → close the database.
- The WebSocket hub (milestone 3) will own its own goroutines and per-client
  write deadlines; screen streaming (milestone 7) will be kept out of the
  request path entirely.

## Platform isolation

Windows-specific behaviour lives behind interfaces and file suffixes:

```text
internal/platform/sysinfo.go          # interface + portable collection
internal/platform/sysinfo_windows.go  # registry, GetTickCount64  (//go:build windows)
internal/platform/sysinfo_other.go    # portable subset only      (//go:build !windows)
```

Feature modules follow the same pattern (`media_windows.go`,
`audio_windows.go`, …): the service depends on an interface, the Windows
implementation is selected at build time, and non-Windows builds compile
with an explicitly unsupported implementation. **Unsupported operations
return `unsupported`; they never fake success.**

## Key decisions

| Decision | Rationale |
|---|---|
| **Gin v1.10.1** (not latest) | Project requirement to use Gin. v1.11+ pull `quic-go` and `mongo-driver` into the module graph; v1.10.1 has an identical API for our use cases with a much smaller tree. |
| **modernc.org/sqlite** | Pure-Go SQLite: no cgo, cross-compiles to any Windows arch (verified on 386 and amd64 here). |
| **gopkg.in/yaml.v3** | Config file format; maintained, pure Go, already in Gin's tree. |
| **golang.org/x/sys** | The supported way to reach Windows APIs (registry now; Core Audio, power, input later). Already an indirect dependency. |
| **Route constants in `constants/`** | One authoritative place for the API surface; controllers register paths only. |
| **Relative route constants** | Modules register on the `/api/v1` group so per-module middleware (auth) can be attached later without touching path strings. |
| **Checksummed migrations** | Editing an applied migration is an error; schema history stays reproducible. |
| **Error envelope `{"error":{"code","message"}}`** | Stable machine-readable codes; messages are safe for clients and never contain internals. |
| **Loopback default binding** | The agent must not become a LAN-exposed service by accident. |

## Milestone plan

| # | Milestone | Contents |
|---|---|---|
| **1** | **Core agent foundation** | bootstrap, config, constants, logging, SQLite + migrations, Gin router, middleware, health module, graceful shutdown, tests, docs |
| 2 | Authentication & pairing | pairing PIN lifecycle, device registration, hashed tokens, auth middleware, rate limiting, revocation, audit log writer |
| 3 | WebSocket communication | hub, client lifecycle, auth, heartbeat, request/response correlation, event broadcast, command registry |
| 4 | Network discovery | interface selection, mDNS advertisement, QR pairing payload |
| 5 | Windows feature modules | media, audio, display, input, monitoring, power, applications, files, clipboard, notifications, automation, screen — one sub-milestone each |
| 6 | Final integration | full command registry, end-to-end verification, hardening pass |

Each milestone ends with: implementation notes, file list, architectural
decisions, dependency review, test results, known limitations, and a docs
update in [implementation-status.md](implementation-status.md).

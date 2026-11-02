# Implementation Status

Last updated: **2026-11-02 — Milestones 1-5 delivered and re-verified.**

Legend: ✅ implemented & tested · 🚧 in progress · ⏳ planned (designed,
not implemented) · ❌ blocked/undetermined

## Milestones

| # | Milestone | Status | Notes |
|---|---|---|---|
| 1 | Core agent foundation | ✅ | bootstrap, config, logging, SQLite + migrations, Gin router, middleware, health module, graceful shutdown |
| 2 | Authentication & pairing | ✅ | PIN flow, hashed tokens, session store, audit logging, auth middleware, rate limiting, revocation, cross-origin + Host guard |
| 3 | WebSocket communication | ✅ | `/ws` hub, 64 KiB framing, 30s/10s ping/pong heartbeats, correlation, command registry |
| 4 | Network discovery | ✅ | `_tufremote._tcp` mDNS advertisement, `/discovery/info`, `/discovery/qr` |
| 5 | Windows feature modules | ✅ | Monitoring, Power, Audio, Input injection, Clipboard (REST + WebSocket) |
| 6 | Final integration & hardening | ⏳ | Extended live streams and media bridge |

## Module status

| Module | Status | Endpoints | Notes |
|---|---|---|---|
| Health & system info | ✅ | `/health`, `/system/info`, `/system/status` | host identity, process status & DB health |
| Device pairing & auth | ✅ | `/pairing/start`, `/pairing/confirm`, `/pairing/devices`, `/pairing/revoke`, `/auth/rotate` | PIN flow, hashed tokens, auth middleware, rate limiting, revocation |
| Network discovery | ✅ | `/discovery/info`, `/discovery/qr` | mDNS `_tufremote._tcp`, QR connection & pairing payload |
| WebSocket | ✅ | `ws /ws` | hub, heartbeat, correlation, command registry |
| System monitoring | ✅ | `/monitoring/system`, `ws monitoring:metrics` | CPU, RAM via `GlobalMemoryStatusEx`, battery via `GetSystemPowerStatus`, storage |
| Power management | ✅ | `/power/lock`, `/power/request`, `/power/confirm`, `ws power:*` | lock, sleep, hibernate, restart, shutdown with 30s confirmation token |
| Audio control | ✅ | `/audio/volume`, `/audio/mute`, `ws audio:*` | master volume and mute controls |
| Mouse & keyboard | ✅ | `/input/mouse`, `/input/keyboard`, `ws input:*` | `SendInput` mouse motion, clicks, scrolling, keystrokes, Unicode text |
| Clipboard | ✅ | `/clipboard`, `ws clipboard:*` | read/write system clipboard text |
| Media control | ⏳ | — | needs WinRT/GSMTC bridge investigation first |
| Display control | ⏳ | — | brightness via WMI/DDCCI; monitors via Win32 API |
| Application management | ⏳ | — | registered apps only (no arbitrary paths) |
| File management | ⏳ | — | approved-directory roots, traversal defence, streamed transfers |
| Windows notifications | ⏳ | — | needs investigation: consumer access is limited by Windows privacy settings |
| Automation/macros | ⏳ | — | validated action registry only (no shell) |
| Screen control | ⏳ | — | screenshots via Graphics Capture; live stream design pending (separate transport) |

## Milestone 1 — what was delivered

- **Entrypoint** `cmd/agent`: `-config`, `-version`, signal handling
  (`SIGINT`/`SIGTERM`), config-source logging, exit codes.
- **Configuration**: defaults → YAML → `TUF_REMOTE_*` env, `Duration` type
  for `"5s"`-style values, aggregated validation errors.
- **Constants**: app identity, API prefix, route paths, limits/timeouts,
  error codes, database defaults.
- **Logging**: `log/slog` text/JSON, level filtering, writer injection for
  tests; Gin's and net/http's internal diagnostics routed through it.
- **Database**: pure-Go SQLite with pragmas (`foreign_keys`, `busy_timeout`,
  WAL), single-connection pool, timed startup ping; checksum-verified,
  transactional migration runner with embedded `0001_initial_schema.sql`.
- **Platform layer**: `SystemInfoProvider` interface; Windows implementation
  (registry OS version, `GetTickCount64` uptime, interface enumeration);
  portable fallback for non-Windows builds.
- **HTTP**: Gin v1.10.1 router (trusted proxies disabled, JSON 404/405,
  middleware order), net/http server with timeouts + optional TLS 1.2,
  graceful shutdown with dependency-ordered teardown.
- **Middleware**: request ID (crypto/rand, bounded), status-aware access
  logging, panic recovery with generic client-facing errors.
- **Health module**: `/health`, `/system/info`, `/system/status` with
  degraded-mode semantics (503 + explanatory body).
- **Tests**: 9 packages (config, logging, database, middleware, platform,
  health ×2, server, integration) — all green on `windows/386` and
  `windows/amd64`.
- **Docs**: README, architecture, API + OpenAPI 3.1, WebSocket protocol
  design, security, database, development, this file.

## Known limitations (Milestone 1 — as delivered at the time)

1. **No hardware metrics** — `/system/status` reports *process* memory and
   database health only. CPU/RAM/GPU/battery/disk/network telemetry arrives
   with the monitoring module; the endpoints deliberately omit those fields
   rather than returning zeros.
2. **No authentication** — implemented endpoints are read-only health
   endpoints. The agent must run on loopback until milestone 2 ships auth.
3. **No TLS certificate provisioning** — TLS can be enabled with provided
   cert/key files; there is no automatic certificate generation or trust
   distribution yet.
4. **No rate limiting** — planned with pairing.
5. **No WebSocket** — protocol documented, transport not implemented.
6. **Single-connection SQLite pool** — chosen for correctness; adequate for
   the agent's write volume.
7. **Manual hardware verification** — Windows-specific behaviour (registry
   version read, uptime) was verified on the development machine (Windows
   11 build 26200); audio/display/media hardware paths are untouched so
   far.
8. **Latency logging granularity** — on hosts with coarse clocks (≈0.5 ms)
   very fast requests log `latency=0s`; cosmetic only.

## Known limitations (current, after milestone 5)

1. **TLS trust story** — TLS can be enabled with provided cert/key files,
   but provisioning and trust distribution for a private LAN are still
   unimplemented; until TLS is on, tokens travel in clear text on the wire.
2. **Rate limiting scope** — only `POST /pairing/confirm` has a per-IP
   budget. Authenticated endpoints and `/ws` rely on authentication plus
   connection caps; there is no global flood protection.
3. **Pending feature modules** — media, display, applications, files,
   notifications, macros and screen control (module table above). Each needs
   its own security design (approved roots, action registry, capture APIs)
   and must ship with those controls.
4. **Hardware sign-off** — Windows API paths (`GlobalMemoryStatusEx`,
   `GetSystemPowerStatus`, `SendInput`, clipboard, audio volume) are covered
   by unit tests through their platform interfaces; no separate real-hardware
   sign-off is recorded for milestone 5, and nothing in the codebase claims
   otherwise.
5. **Single-connection SQLite pool** — deliberate; adequate for the agent's
   write volume.
6. **No code signing or update integrity** — release hardening is pending.
7. **Latency logging granularity** — cosmetic (`latency=0s` on coarse
   clocks).

## Verification log

```text
Milestone 1 (2026-11-01)
  gofmt -l .             → clean
  go vet ./...           → clean (windows/386 and windows/amd64)
  go test ./...          → 9 packages ok (386 and amd64)
  build windows/amd64    → bin\tuf-remote-agent.exe
  smoke test (real run)  → health/system info/system status/404 all correct;
                           migration applied; structured logs with request IDs;
                           graceful stop verified by integration test

Milestones 2-5, re-verified 2026-11-02
  gofmt -l .             → clean
  go vet ./...           → clean (windows/386 and windows/amd64)
  go test -count=1 ./... → 18 packages, 200 test cases ok
                           (386 and amd64; 0 failed, 0 skipped)
  build windows/amd64    → bin\tuf-remote-agent.exe
  repository             → first git commit (the tree had been untracked)
```

## Changelog

- **2026-11-01** — Milestone 1: core agent foundation.
- **2026-11-01** — Milestone 2: pairing & authentication. Loopback-scoped
  PIN pairing with in-memory sessions, 256-bit bearer tokens hashed at
  rest, rotation with a 30 s grace window, transactional revocation, audit
  log writer, `RequireLocal`/`RequireAuth`/`RequireToken`, per-IP rate
  limiting, and the cross-origin guard. **2026-11-02**: the guard also
  enforces a Host allowlist (`security.allowed_hosts`) so DNS rebinding
  cannot pass an origin check that now matches.
- **2026-11-01** — Milestone 3: WebSocket. Bearer-authenticated `/ws`
  upgrade, 64 KiB frame limit, 30 s/10 s ping/pong, correlation ids,
  typed error frames, command registry with total and per-device
  connection caps.
- **2026-11-01** — Milestone 4: discovery. `_tufremote._tcp` mDNS
  advertisement, public `/discovery/info`, loopback-only `/discovery/qr`
  carrying the connection and pairing payload.
- **2026-11-01** — Milestone 5: Windows feature modules. Monitoring
  (CPU/RAM via `GlobalMemoryStatusEx`, battery via `GetSystemPowerStatus`,
  storage), power (lock + two-step confirmation tokens for
  sleep/hibernate/restart/shutdown), audio (volume/mute), input injection
  (mouse motion, clicks, scroll, keystrokes, Unicode text), clipboard
  (text) — each on REST and WebSocket.
- **2026-11-02** — Documentation pass: security controls table extended
  through milestone 5, DNS-rebinding guard documented, duplicated status
  rows removed, current limitations and verification logs added; repository
  committed to git for the first time.

# Development Guide

## Toolchain

- Go **1.26+** (module targets `go 1.26.2`).
- Target: `windows/amd64` for releases; the code also builds and tests on
  `windows/386` (both verified in CI-style runs on the dev machine).
- No cgo, no external services, no code generators.

## Everyday commands

PowerShell (recommended on Windows — `make` is not installed on the dev
machine):

```powershell
.\scripts\test.ps1                # gofmt check → go vet → go test (amd64)
.\scripts\test.ps1 -Arch 386      # same on 32-bit
.\scripts\build.ps1               # bin\tuf-remote-agent.exe (amd64, stripped)
.\scripts\build.ps1 -NoStrip      # with symbols
```

Make (Git Bash / WSL / CI):

```sh
make verify      # fmt-check + vet + test
make build       # GOARCH=amd64 binary
make run         # go run ./cmd/agent
```

Manual equivalents:

```sh
gofmt -w .       # format
gofmt -l .       # must print nothing
go vet ./...
go test ./...
go test ./... -run TestName -v
go test -race ./...              # where supported
```

> **Rule:** `gofmt -l .`, `go vet ./...` and `go test ./...` must all be
> clean before any change is considered done.

## Configuration

Layering: **defaults → YAML file → `TUF_REMOTE_*` environment** (environment
wins; empty values are ignored). Resolution order for the file:
`-config` flag → `TUF_REMOTE_CONFIG` → `configs/config.yaml` if present →
none (defaults only).

Supported environment variables:

| Variable | Maps to |
|---|---|
| `TUF_REMOTE_CONFIG` | configuration file path |
| `TUF_REMOTE_AGENT_NAME` | `agent.name` |
| `TUF_REMOTE_SERVER_HOST` | `server.host` |
| `TUF_REMOTE_SERVER_PORT` | `server.port` |
| `TUF_REMOTE_SERVER_TLS_ENABLED` | `server.tls.enabled` |
| `TUF_REMOTE_SERVER_TLS_CERT_FILE` | `server.tls.cert_file` |
| `TUF_REMOTE_SERVER_TLS_KEY_FILE` | `server.tls.key_file` |
| `TUF_REMOTE_DATABASE_PATH` | `database.path` |
| `TUF_REMOTE_LOGGING_LEVEL` | `logging.level` |
| `TUF_REMOTE_LOGGING_FORMAT` | `logging.format` |

Notes:

- durations in YAML are strings (`"5s"`, `"1m30s"`); invalid values fail
  the load with a precise error;
- unknown YAML keys are ignored so an older agent accepts a newer example
  file; every *known* key is validated;
- an empty environment variable is treated as "not set".

## Project conventions

1. **Constants** — literals that carry meaning (routes, limits, defaults,
   error codes) live in `internal/constants`. Nothing that is configurable
   at runtime becomes a constant.
2. **Module skeleton** — a feature module is
   `routes.go` (registration only) + `controller.go` (parse/validate/
   respond, no business logic) + `service.go` (business logic, interfaces
   for external effects) + `*_windows.go` (OS specifics) + tests.
3. **Constructor DI** — `NewX(deps …) *X`; no global mutable state; tests
   pass fakes through the same constructors.
4. **Errors** — return wrapped errors (`fmt.Errorf("…: %w", err)`), map to
   HTTP status codes in controllers via `utils.RespondError`, never leak
   internals to clients, never `panic` for expected failures.
5. **Logging** — `log/slog` only, with structured attributes; no
   `fmt.Print*` in library code.
6. **Tests** — table-driven where natural; use `t.TempDir()`,
   `t.Setenv()`; fakes are hand-written interfaces, no mock framework.

## Adding a new module (checklist)

1. `internal/constants/api.go` — add relative route constants.
2. `internal/modules/<feature>/` — routes/controller/service (+ `_windows`
   implementation, interface first).
3. `internal/bootstrap/dependencies.go` — construct the service and
   controller.
4. `internal/server/router.go` — add the module to `RouterDependencies`
   and register its routes on the API group.
5. Tests: service unit tests with fakes, controller tests via
   `httptest`, and any Windows-specific integration tests.
6. Docs: `docs/api.md` + `docs/openapi.yaml` (move the endpoint from
   planned to implemented), `docs/implementation-status.md`.
7. Run `.\scripts\test.ps1` and fix everything it reports.

## Logging

- Format `text` (dev) or `json` (machine consumption), level
  `debug|info|warn|error`.
- Access log line: `http request method=… path=… status=… latency=…
  client_ip=… request_id=… response_bytes=…`.
- Note: on machines with coarse clocks (some VMs/hosts) very fast requests
  may log `latency=0s`; this is a clock property, not a bug.

## Testing strategy

| Layer | Approach |
|---|---|
| unit (config, logging, platform) | pure functions, temp files, `t.Setenv` |
| service | fakes for `SystemInfoProvider`, `Store`, later repositories |
| controller | Gin + `httptest`, JSON assertions |
| router | real router: 404/405 envelope, request ID, proxy-header spoofing |
| migration | embedded FS + synthetic `fstest.MapFS` fixtures |
| integration | real listener on an ephemeral port, full bootstrap, graceful shutdown |

Windows-only APIs are tested through interfaces so the logic runs without
hardware; genuine hardware behaviour (audio devices, brightness, media
sessions) is verified manually on the target machine and recorded in
`implementation-status.md` — **never claim a hardware feature works because
it compiles**.

# TUF Remote — Windows Agent (Backend)

TUF Remote lets an Android device control a Windows 11 PC over the local
network. This repository contains the **Go backend agent** that runs on the
PC: a local HTTP + WebSocket server exposing secure, versioned APIs for
media, audio, display, input, monitoring, power, files and more.

> **Status: Milestones 1–5 Delivered.**
> Complete REST & WebSocket backend for Windows 11 remote control by Android devices.
> See [docs/implementation-status.md](docs/implementation-status.md) for module details.

## What works today

| Area | Transport | Endpoints / Commands | Notes |
|---|---|---|---|
| Liveness | REST | `GET /api/v1/health` | status, version, agent uptime |
| Host identity | REST | `GET /api/v1/system/info` | hostname, OS version, LAN IPs, host uptime |
| Runtime status | REST | `GET /api/v1/system/status` | database health, process memory/goroutines |
| Network Discovery | mDNS + REST | `_tufremote._tcp`, `GET /api/v1/discovery/{info,qr}` | automatic discovery + QR code pairing payload |
| Pairing & Auth | REST | `POST /api/v1/pairing/{start,confirm,revoke}`, `/pairing/devices`, `/auth/rotate` | PIN flow, hashed bearer tokens, rate limiting, grace periods |
| Real-time WebSocket | WS | `ws(s)://<host>:<port>/ws` | 64 KiB framing, 30s/10s ping/pong heartbeat, command registry |
| System Monitoring | REST + WS | `GET /api/v1/monitoring/system`, `ws monitoring:metrics` | CPU, RAM, battery, primary storage metrics |
| Power Control | REST + WS | `POST /api/v1/power/{lock,request,confirm}`, `ws power:*` | Lock, sleep, hibernate, restart, shutdown with 30s token confirmation |
| Audio Control | REST + WS | `GET/PUT /api/v1/audio/volume`, `POST /audio/mute`, `ws audio:*` | Volume slider (0-100%) and mute toggle |
| Input Injection | REST + WS | `POST /api/v1/input/{mouse,keyboard}`, `ws input:*` | Mouse moves/clicks/scroll, keystrokes, Unicode text injection |
| Clipboard Sync | REST + WS | `GET/POST /api/v1/clipboard`, `ws clipboard:*` | Read and write text clipboard content |


## Requirements

- Windows 11 (x64) for the target agent; development also works on Windows
  with any Go ≥ 1.26 toolchain.
- [Go](https://go.dev/dl/) 1.26 or newer.
- No cgo, no external services: SQLite is embedded (pure-Go driver).

## Quick start

```powershell
cd agent\windows

# Run the verification suite (gofmt check, go vet, go test)
.\scripts\test.ps1

# Build a release binary (windows/amd64)
.\scripts\build.ps1

# Run with built-in defaults (binds 127.0.0.1:8765)
.\bin\tuf-remote-agent.exe

# ...or with a configuration file
Copy-Item configs\config.example.yaml configs\config.yaml
.\bin\tuf-remote-agent.exe -config configs\config.yaml
```

Then:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/v1/health
```

A `Makefile` with `fmt / vet / test / build / verify` targets is provided
for POSIX-like shells (Git Bash, WSL, CI).

## Configuration

Settings are layered: **built-in defaults → YAML file → `TUF_REMOTE_*`
environment variables** (environment wins). The file is resolved from
`-config <path>`, then `TUF_REMOTE_CONFIG`, then `configs/config.yaml` when
it exists. Every variable is documented in
[configs/config.example.yaml](configs/config.example.yaml) and
[docs/development.md](docs/development.md).

The agent binds to **`127.0.0.1` by default** — it is not reachable from
the network until you deliberately change `server.host`. LAN deployments
must enable TLS; see [docs/security.md](docs/security.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Layering, package map, request flow, decisions |
| [docs/api.md](docs/api.md) | REST conventions and endpoints |
| [docs/openapi.yaml](docs/openapi.yaml) | OpenAPI 3.1 specification |
| [docs/websocket-protocol.md](docs/websocket-protocol.md) | Real-time protocol design |
| [docs/security.md](docs/security.md) | Threat model, controls, roadmap |
| [docs/database.md](docs/database.md) | Schema and migration process |
| [docs/development.md](docs/development.md) | Build, test, add-a-module guide |
| [docs/implementation-status.md](docs/implementation-status.md) | Milestone and module status |

## Repository layout

```text
agent/windows/
├── cmd/agent/            # entrypoint (flags, signals, wiring only)
├── internal/
│   ├── bootstrap/        # dependency injection + app lifecycle
│   ├── config/           # YAML + env configuration, validation
│   ├── constants/        # app identity, routes, limits, error codes
│   ├── database/         # SQLite connection + migration runner
│   │   └── migrations/   # embedded SQL migrations
│   ├── logging/          # slog logger construction
│   ├── middleware/       # request ID, logging, recovery
│   ├── modules/          # feature modules (routes → controller → service)
│   ├── platform/         # OS-specific code behind interfaces
│   ├── server/           # Gin router + net/http lifecycle
│   └── utils/            # response helpers
├── configs/              # example configuration
├── docs/                 # documentation
├── scripts/              # PowerShell build/test scripts
└── tests/integration/    # full-stack tests over a real socket
```

## License

TBD by the project owner.

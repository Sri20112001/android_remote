# REST API

Base URL: `http(s)://<host>:<port>/api/v1`

This document describes the **implemented** API. Planned endpoints are listed
with their intended transport so the Android client can be designed against
the contract; they return `404` until their milestone lands.

## Conventions

- **Transport**: REST over HTTP(S) for request/response operations that are
  not latency-critical. Real-time commands and live events use WebSocket
  (`/ws`, see [websocket-protocol.md](websocket-protocol.md)). Features are
  exposed on exactly one transport unless duplication is justified; the
  planned table says which.
- **Encoding**: `application/json; charset=utf-8`, UTF-8 only.
- **Success**: the payload is the resource itself (no envelope).
- **Failure**: always the same envelope:

  ```json
  { "error": { "code": "invalid_request", "message": "human-readable, safe to display" } }
  ```

  `code` is a stable identifier from `internal/constants` — clients switch
  on codes, never on messages.

| Code | HTTP status | Meaning |
|---|---|---|
| `invalid_request` | 400 | malformed or semantically invalid input |
| `unauthorized` | 401 | missing/invalid credential (milestone 2) |
| `forbidden` | 403 | credential lacks permission (milestone 2) |
| `not_found` | 404 | unknown endpoint or resource |
| `method_not_allowed` | 405 | wrong HTTP method for the path |
| `conflict` | 409 | request conflicts with current state |
| `rate_limited` | 429 | request budget exceeded (milestone 2) |
| `unsupported` | 501 | valid request the platform cannot serve |
| `unavailable` | 503 | dependency temporarily unavailable |
| `internal_error` | 500 | unexpected failure (details only in the server log) |

- **Correlation**: every response carries `X-Request-ID`; the same value
  appears in the server log line for the request.
- **Authentication**: none of the implemented endpoints require it (they are
  read-only health endpoints). From milestone 2, all non-health endpoints
  require `Authorization: Bearer <device-token>`.

## Implemented endpoints

### `GET /health`

Liveness of the agent process.

```json
{
  "status": "ok",
  "app_name": "TUF Remote",
  "version": "0.1.0",
  "agent_uptime_seconds": 126,
  "timestamp": "2026-11-01T07:16:54Z"
}
```

`200` — always, as long as the process answers.

### `GET /system/info`

Static identity of the host. Optional fields are **omitted** when the
platform does not expose them (absent ≠ zero).

```json
{
  "app_name": "TUF Remote",
  "version": "0.1.0",
  "hostname": "LAPTOP-DPEFC07F",
  "os": "windows",
  "os_version": "Windows 11 (25H2, build 26200)",
  "ip_addresses": ["192.168.0.104"],
  "uptime_seconds": 8529
}
```

| Field | Source | Notes |
|---|---|---|
| `hostname` | OS | |
| `os` | build target | `windows` |
| `os_version` | registry `Windows NT\CurrentVersion` | omitted if unreadable |
| `ip_addresses` | network interfaces | global unicast IPv4 only (no loopback/link-local) |
| `uptime_seconds` | `GetTickCount64` | omitted if unavailable |

`503` with the standard error envelope if the platform provider fails.

### `GET /system/status`

Dynamic health of the agent. **`200` when healthy, `503` when degraded** —
the body is present in both cases and explains which component fails.

```json
{
  "status": "ok",
  "app_name": "TUF Remote",
  "version": "0.1.0",
  "agent_uptime_seconds": 126,
  "timestamp": "2026-11-01T07:16:54Z",
  "database": { "status": "ok" },
  "process": {
    "goroutines": 7,
    "memory": {
      "heap_alloc_bytes": 621488,
      "heap_sys_bytes": 8192000,
      "sys_bytes": 11030528,
      "num_gc": 0
    }
  }
}
```

`database.status` reflects a timed `PingContext`; failure yields
`"status":"degraded"` for the endpoint. Error causes go to the server log,
never to the client. `process.memory` describes the **agent process**, not
system RAM (system telemetry arrives with the monitoring module).

### `POST /pairing/start`

Opens a pairing window and generates a 6-digit PIN. Accessible only from loopback (`127.0.0.1`), representing the PC user's local consent.

```json
{
  "session_id": "0194...",
  "pin": "492815",
  "expires_at": "2026-11-01T07:21:54Z",
  "attempts_remaining": 5
}
```

### `POST /pairing/confirm`

Device-facing endpoint. The Android client presents the PIN and its metadata to complete pairing and receive a bearer token. Rate-limited per IP.

```json
{
  "device": {
    "id": "dev-0194...",
    "name": "Pixel 8",
    "platform": "android",
    "model": "Pixel 8 Pro",
    "os_version": "Android 14",
    "paired_at": "2026-11-01T07:18:12Z",
    "status": "active"
  },
  "token": {
    "token": "tuf_sec_...",
    "expires_at": ""
  }
}
```

### `GET /pairing/devices`

Lists all paired devices. Loopback only.

```json
{
  "devices": [
    {
      "id": "dev-0194...",
      "name": "Pixel 8",
      "platform": "android",
      "paired_at": "2026-11-01T07:18:12Z",
      "status": "active"
    }
  ]
}
```

### `POST /pairing/revoke`

Revokes a device and all its issued tokens. Loopback only.

```json
{
  "device_id": "dev-0194...",
  "status": "revoked"
}
```

### `POST /auth/rotate`

Rotates an active bearer token. Requires `Authorization: Bearer <token>`. The previous token remains valid during a 30-second grace period.

```json
{
  "token": {
    "token": "tuf_sec_...",
    "expires_at": ""
  }
}
```

## Planned endpoints

Status markers: `planned` (designed, not implemented). No endpoint below
responds with anything but `404` today.

| Endpoint | Transport | Milestone | Purpose |
|---|---|---|---|
| `POST /media/control` | WS + REST | 5 | play/pause/next/previous/seek |
| `GET /media/sessions` | REST | 5 | active media sessions |
| `GET/PUT /audio/volume`, `/audio/mute`, `/audio/devices` | WS + REST | 5 | Core Audio control |
| `GET/PUT /display/brightness`, `GET /display/monitors` | WS + REST | 5 | brightness, resolution, refresh rate |
| `POST /input/mouse`, `/input/keyboard` | WS (primary) | 5 | mouse/keyboard injection |
| `GET /monitoring/{cpu,memory,gpu,battery,network}` | WS (primary) | 5 | telemetry stream + REST snapshot |
| `POST /power/{lock,sleep,hibernate,restart,shutdown}` | REST (confirm flow) | 5 | power management |
| `GET/POST /applications`, `POST /applications/{id}/close` | REST | 5 | application management |
| `GET/POST /files`, upload/download | REST (streamed) | 5 | file browsing inside approved directories |
| `GET/PUT /clipboard` | WS (events) + REST | 5 | clipboard sync (opt-in) |
| `GET /notifications` | WS (events) | 5 | Windows notification stream |
| `POST /automation/macro/...` | REST + WS | 5 | macros from a validated action registry |
| `POST /screen/screenshot`, `GET /screen/stream` | REST + separate stream | 5 | screenshots, live screen |

Exact request/response schemas are documented per module as they are
implemented, and `openapi.yaml` is updated in the same change.

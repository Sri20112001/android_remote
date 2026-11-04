# REST API

Base URL: `http(s)://<host>:<port>/api/v1`

This document describes the **implemented** API. Planned endpoints are listed
at the end with their intended transport and milestone so the Android client
can be designed against the contract; they return `404` until they land.

Transport split: REST for request/response operations and snapshots, WebSocket
(`/ws`, see [websocket-protocol.md](websocket-protocol.md)) for latency-critical
commands, typed commands with correlation, and server push. A feature is
exposed on exactly one *primary* transport unless duplication is justified; the
module sections say which.

## Conventions

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
| `unauthorized` | 401 | missing/invalid credential: absent or unknown bearer token, or a wrong/expired/burned pairing PIN |
| `forbidden` | 403 | refused before the handler: a non-loopback caller on a PC-only endpoint, or a cross-origin / unknown-`Host` request |
| `not_found` | 404 | unknown endpoint or resource |
| `method_not_allowed` | 405 | wrong HTTP method for the path |
| `conflict` | 409 | request conflicts with current state (device already revoked, pairing session capacity reached) |
| `rate_limited` | 429 | request budget exceeded; carries `Retry-After` |
| `unsupported` | 501 | valid request the platform cannot serve |
| `unavailable` | 503 | dependency temporarily unavailable |
| `internal_error` | 500 | unexpected failure (details only in the server log) |

- **Correlation**: every response carries `X-Request-ID`; the same value
  appears in the server log line for the request.
- **Request bodies**: capped at 1 MiB (`server.max_request_bytes`).
- **Authentication** — three levels, decided per endpoint:

  | Level | Endpoints | Rule |
  |---|---|---|
  | open | `/health`, `/system/info`, `/system/status`, `/discovery/info` | no credential |
  | bearer or loopback | every feature endpoint (`/monitoring/*`, `/power/*`, `/audio/*`, `/input/*`, `/clipboard`) | `Authorization: Bearer <device-token>`, **or** a request originating on the PC itself |
  | bearer only | `/ws`, `/auth/rotate` | a valid token is required even from loopback |
  | loopback only | `/pairing/start`, `/pairing/devices`, `/pairing/revoke`, `/discovery/qr` | a LAN peer receives `403` |

  Tokens come from `POST /pairing/confirm` (shown once) and are replaced via
  `POST /auth/rotate`. A failed token *validation* is `401`; an
  infrastructure failure during validation is `500` and fails closed.
- **Browser requests**: the guard rejects cross-site fetches, mismatched or
  opaque `Origin` headers, and any `Host` outside the allowlist (IP literals,
  `localhost`, the machine's hostname, `security.allowed_hosts`) with `403`.
  Native clients send none of those headers and are unaffected.
- **Rate limiting**: `POST /pairing/confirm` allows 20 attempts per client IP
  per minute by default (`security.rate_limit.confirm_per_minute`); over-budget
  requests answer `429` with `Retry-After`. The PIN itself has its own attempt
  budget inside each pairing session. Authenticated feature endpoints are not
  rate limited.

## System

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
system RAM — host telemetry is `GET /monitoring/system`.

## Pairing and authentication

### `POST /pairing/start`

Opens a pairing window and generates a 6-digit CSPRNG PIN. Accessible only from loopback (`127.0.0.1`), representing the PC user's local consent. The PIN lives in memory only (never written to disk or logs) and expires with `expires_at`.

```json
{
  "session_id": "7f4a1c9e2b5d8a3f6c0e4b7d1a9f2c5e",
  "pin": "492815",
  "expires_at": "2026-11-01T07:21:54Z",
  "attempts_remaining": 5
}
```

`201` — session opened · `403` — called from another machine, from a browser page, or under an unknown `Host` · `409` — configured session capacity (default 3) is in use.

### `POST /pairing/confirm`

Device-facing endpoint. The Android client presents the PIN and its metadata to complete pairing and receive a bearer token. Rate-limited per IP (20/min by default). The PIN is single use and tolerates 5 wrong attempts.

Request body:

```json
{
  "pin": "492815",
  "name": "Pixel 8",
  "model": "Pixel 8 Pro",
  "os_version": "Android 14",
  "platform": "android"
}
```

Response:

```json
{
  "device": {
    "id": "b3e7d1a95f4c2e8b7d6a0c3f5e1b9a47",
    "name": "Pixel 8",
    "platform": "android",
    "model": "Pixel 8 Pro",
    "os_version": "Android 14",
    "paired_at": "2026-11-01T07:18:12Z",
    "status": "active"
  },
  "token": {
    "token": "tuf_7Wq2Kx9pLmN4vR8sT1yU6zA3bC5dE0fGhJ4iO8kPnQx"
  }
}
```

`201` — paired; the token appears **once** and only its SHA-256 hash is stored (`expires_at` is omitted because device tokens do not expire by default) · `400` — malformed/unknown JSON field or an invalid `name` · `401` — wrong, expired or burned PIN (one generic answer for all three) · `403` — cross-origin request or unknown `Host` · `429` — per-IP budget exceeded (`Retry-After` is set).

### `GET /pairing/devices`

Lists all paired devices, newest first, with `last_seen_at` derived from the newest token use (omitted when the device never authenticated). Loopback only.

```json
{
  "devices": [
    {
      "id": "b3e7d1a95f4c2e8b7d6a0c3f5e1b9a47",
      "name": "Pixel 8",
      "platform": "android",
      "paired_at": "2026-11-01T07:18:12Z",
      "last_seen_at": "2026-11-01T07:40:03Z",
      "status": "active"
    }
  ]
}
```

`200` — list (may be empty) · `403` — non-loopback, cross-origin or unknown `Host`.

### `POST /pairing/revoke`

Revokes a device and every token it holds, atomically. Loopback only.

```json
{
  "device_id": "b3e7d1a95f4c2e8b7d6a0c3f5e1b9a47",
  "status": "revoked"
}
```

`200` — revoked · `400` — missing `device_id` · `403` — non-loopback, cross-origin or unknown `Host` · `404` — unknown device · `409` — already revoked.

### `POST /auth/rotate`

Rotates an active bearer token. Requires `Authorization: Bearer <token>` **even from loopback** (the caller must prove possession). The previous token remains valid for the grace period (`security.pairing.token_grace_period`, 30 s by default) so in-flight requests do not fail, then dies.

```json
{
  "token": {
    "token": "tuf_9Hn4Bp2vQ7wE5rT3yU8iO1aS6dF0gJ5kL9zX2cV4bN"
  }
}
```

`200` — new token issued (shown once) · `401` — missing, unknown, expired or revoked token · `403` — cross-origin request or unknown `Host`.

## Discovery

### `GET /discovery/info`

Public snapshot used for LAN discovery and for verifying a connection before
pairing. Open — no credential.

```json
{
  "agent_name": "TUF Remote",
  "version": "0.1.0",
  "hostname": "LAPTOP-DPEFC07F",
  "addresses": ["192.168.0.104"],
  "port": 8765,
  "tls_enabled": false
}
```

`200` — snapshot · `503` — platform information unavailable.

### `GET /discovery/qr`

Loopback only. Returns the payload the agent window renders as a QR code,
including the live pairing PIN when `session_id` and `pin` query parameters are
supplied (normally by the agent's own UI right after `POST /pairing/start`).

| Query | Required | Meaning |
|---|---|---|
| `session_id` | no | pairing session to embed |
| `pin` | no | PIN to embed; omitted from the response when absent |

```json
{
  "agent_name": "TUF Remote",
  "version": "0.1.0",
  "hostname": "LAPTOP-DPEFC07F",
  "ip_addresses": ["192.168.0.104"],
  "port": 8765,
  "tls_enabled": false,
  "session_id": "7f4a1c9e2b5d8a3f6c0e4b7d1a9f2c5e",
  "pin": "492815"
}
```

`200` — payload · `403` — non-loopback, cross-origin or unknown `Host` ·
`503` — platform information unavailable.

## Monitoring

Primary transport: **REST snapshot**. The WebSocket adds a request/response
command (`monitoring.metrics`) and process control. No server-push telemetry is
scheduled today — see *Known gaps*.

### `GET /monitoring/system`

Bearer or loopback.

```json
{
  "cpu": { "usage_percent": 12.5 },
  "memory": {
    "total_bytes": 17179869184,
    "available_bytes": 8589934592,
    "used_bytes": 8589934592,
    "usage_percent": 50
  },
  "battery": {
    "present": true,
    "charging": true,
    "percentage": 87,
    "life_time_seconds": 18420
  },
  "disks": [
    {
      "mount": "C:",
      "total_bytes": 511101108224,
      "free_bytes": 123456789012,
      "used_bytes": 387644319212,
      "usage_percent": 75.8
    }
  ]
}
```

| Field | Notes |
|---|---|
| `cpu.usage_percent` | 0–100, sampled by the provider |
| `memory` | physical RAM (`GlobalMemoryStatusEx`) |
| `battery.present` | `false` on desktops without a battery; `percentage` is then `0` |
| `battery.life_time_seconds` | omitted when unknown |
| `disks` | omitted when no logical drive is readable |

`200` — snapshot · `401` — missing/invalid token · `500` — collection failed.

### WebSocket commands

| Command | Payload | Result |
|---|---|---|
| `monitoring.metrics` | — | same body as `GET /monitoring/system` |
| `monitoring.processes` | — | `[{ "pid": 1234, "name": "chrome.exe", "memory_mb": 512.4 }]` |
| `monitoring.kill_process` | `{ "pid": 1234 }` | `{ "success": true }` |

`kill_process` terminates the process with the given `pid`; a missing or
unreadable process answers `internal_error`.

## Power

Primary transport: **REST**, mirrored on WebSocket. Destructive actions use a
two-step handshake: `request` mints a single-use confirmation token valid for
**30 seconds**, `confirm` spends it. Locking is non-destructive and immediate.

### `POST /power/lock`

Bearer or loopback.

```json
{ "status": "locked" }
```

`200` — desktop locked · `401` — missing/invalid token · `500` — lock failed.

### `POST /power/request`

```json
{ "action": "restart" }
```

`action` ∈ `sleep` \| `hibernate` \| `restart` \| `shutdown`. `lock` is **not**
accepted here — use `POST /power/lock`.

```json
{
  "confirmation_token": "5c1f0a9b7e3d42a8b6c4d2e0f1a3b5c7",
  "action": "restart",
  "expires_at": "2026-11-02T09:15:30Z"
}
```

`200` — token issued · `400` — unknown action or malformed body ·
`401` — missing/invalid token.

### `POST /power/confirm`

```json
{ "confirmation_token": "5c1f0a9b7e3d42a8b6c4d2e0f1a3b5c7" }
```

```json
{ "action": "restart", "status": "initiated" }
```

`200` — action dispatched · `400` — unknown, already spent or expired token,
**or the OS refused the action** (the controller maps every service failure to
`400`, so clients must read the message) · `401` — missing/invalid token.

Tokens are single-use: they are deleted when spent or when they expire, so a
replay answers `400`. Every lock and confirmed action is written to the audit
log with the acting identity.

### WebSocket commands

| Command | Payload | Result |
|---|---|---|
| `power.lock` | — | `{ "status": "locked" }` |
| `power.request` | `{ "action": "shutdown" }` | same body as `POST /power/request` |
| `power.confirm` | `{ "confirmation_token": "…" }` | `{ "action": "shutdown", "status": "initiated" }` |

## Audio

Primary transport: **REST**, mirrored on WebSocket.

### `GET /audio/volume`

Bearer or loopback.

```json
{ "level": 42, "muted": false }
```

`level` is the master volume, 0–100.

`200` — current state · `401` — missing/invalid token · `500` — endpoint
unavailable.

### `PUT /audio/volume`

```json
{ "level": 75 }
```

Responds with the **new** state (`{ "level": 75, "muted": false }`).
`200` — applied · `400` — malformed body · `500` — device refused the change.

### `POST /audio/mute`

```json
{ "muted": true }
```

Responds with the new state. `200` — applied · `400` — malformed body ·
`500` — device refused the change.

### WebSocket commands

| Command | Payload | Result |
|---|---|---|
| `audio.get_volume` | — | `{ "level": 42, "muted": false }` |
| `audio.set_volume` | `{ "level": 75 }` | new state |
| `audio.set_mute` | `{ "muted": true }` | new state |
| `audio.toggle_mute` | — | new state |

## Input injection

Primary transport: **WebSocket** (latency-critical). REST equivalents exist
for tooling and for clients without a socket; both run the same service.

### `POST /input/mouse`

Bearer or loopback. `action` selects the operation:

| `action` | Required fields | Effect |
|---|---|---|
| `move` | `dx`, `dy` — or `x`, `y` with `absolute: true` | moves the cursor |
| `click` | `button` (`left`/`right`/`middle`), optional `double` | click at the current position |
| `down` / `up` | `button` | press / release a button and hold it |
| `scroll` | `dy` | wheel notches; negative scrolls up |

Omitting `action` falls back compatibly: `dx`/`dy` mean move, otherwise a
`button` means click.

```json
{ "action": "click", "button": "left", "double": false }
```

```json
{ "success": true }
```

`200` — injected · `400` — malformed body · `401` — missing/invalid token ·
`500` — `SendInput` failed.

### `POST /input/keyboard`

| `action` | Required fields | Effect |
|---|---|---|
| `tap` | `key`, optional `modifiers` | press+release, with modifiers held around it |
| `down` / `up` | `key` | hold / release a key |
| `text` | `text` | types Unicode text |

`key` is a lower-case name (`enter`, `backspace`, `tab`, `esc`, `space`,
`a`–`z`, `0`–`9`, `f1`–`f12`, punctuation names, arrows, `home`, `end`,
`pageup`, `pagedown`, `insert`, `delete`, `capslock`). `modifiers` is any
subset of `ctrl`, `alt`, `shift`, `win`.

```json
{ "action": "tap", "key": "a", "modifiers": ["ctrl"] }
```

`200` — injected · `400` — malformed body · `500` — `SendInput` failed.

### WebSocket commands

| Command | Payload | Result |
|---|---|---|
| `input.mouse` | a `MousePayload` | `{ "success": true }` |
| `input.mouse_move` | `{ "dx": 8, "dy": -4 }` | *(no response payload)* |
| `input.mouse_click` | `{ "button": "left", "double": false }` | `{ "success": true }` |
| `input.mouse_scroll` | `{ "dy": 120 }` | *(no response payload)* |
| `input.keyboard` | a `KeyboardPayload` | `{ "success": true }` |
| `input.key_tap` | `{ "key": "enter", "modifiers": ["ctrl"] }` | `{ "success": true }` |
| `input.type_text` | `{ "text": "hello" }` | `{ "success": true }` |
| `input.launch_app` | `{ "app": "chrome" }` | `{ "success": true }` |

`mouse_move` and `mouse_scroll` are the high-frequency path: the handler returns
no data, so **no response frame is sent at all** — clients must fire and forget
those two and must not wait for a timeout. They also discard injection errors;
use `input.mouse` with an explicit `action` when the result matters. See
[websocket-protocol.md](websocket-protocol.md#input).

`launch_app` accepts **only** an allowlisted key — `chrome`, `spotify`, `code`,
`calc`, `taskmgr`, `terminal`, `cmd`, `notepad`, `explorer`, `settings`.
Anything else answers `invalid_request`; there is no path or command-string
passthrough.

## Clipboard

Primary transport: **REST**, mirrored on WebSocket. Text only.

### `GET /clipboard`

```json
{ "text": "copied text" }
```

`200` — current text (may be empty) · `500` — clipboard unavailable.

### `POST /clipboard`

```json
{ "text": "text to place on the PC clipboard" }
```

```json
{ "success": true }
```

`200` — written · `400` — malformed body · `500` — clipboard unavailable.

### WebSocket commands

| Command | Payload | Result |
|---|---|---|
| `clipboard.get` | — | `{ "text": "…" }` |
| `clipboard.set` | `{ "text": "…" }` | `{ "success": true }` |

## Planned endpoints

Status markers: `planned` (designed, not implemented). No endpoint below
responds with anything but `404` today, and the Android client must not call
them yet.

| Endpoint | Transport | Milestone | Purpose |
|---|---|---|---|
| `POST /media/control` | WS + REST | 6 | play/pause/next/previous/seek |
| `GET /media/sessions` | REST | 6 | active media sessions |
| `GET /display/monitors` | REST | 6 | monitors, resolution, refresh rate |
| `GET/PUT /display/brightness` | WS + REST | 6 | brightness |
| `POST /applications`, `POST /applications/{id}/close` | REST | 6 | application management |
| `GET/POST /files`, upload/download | REST (streamed) | 6 | file browsing inside approved directories |
| `GET /notifications` | WS (events) | 6 | Windows notification stream |
| `POST /automation/macro/...` | REST + WS | 6 | macros from a validated action registry |
| `POST /screen/screenshot`, `GET /screen/stream` | REST + separate stream | 6 | screenshots, live screen |

A file module is required before `useAgentWS().uploadFile` can do real work;
the client currently rejects with an explicit "not available" error rather
than probing a route that does not exist.

## Known gaps

1. **No push telemetry.** `monitoring.StartBroadcaster` exists but is never
   scheduled by bootstrap, so no `monitoring.metrics` events are emitted.
   Clients poll `GET /monitoring/system` (the Android app does so every 3 s).
2. **No rate limiting on feature endpoints.** Only `POST /pairing/confirm` has
   a per-IP budget; authenticated endpoints rely on authentication plus the
   WebSocket connection caps.
3. **No TLS provisioning.** TLS works with provided cert/key files; trust
   distribution for a private LAN is not implemented.
4. **Hardware sign-off.** Windows API paths are covered by unit tests through
   their platform interfaces, but no real-hardware sign-off is recorded for
   milestone 5.

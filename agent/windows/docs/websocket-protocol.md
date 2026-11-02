# WebSocket Protocol

> **Status: designed, not yet implemented** (milestone 3). This document is
> the contract the implementation must follow; nothing here answers on the
> wire today.

Endpoint: `ws(s)://<host>:<port>/ws` (constant `WebSocketPath`, added with
the module).

## Why a second transport

REST is right for request/response operations. WebSocket carries:

- **latency-sensitive commands** (input injection, media transport),
- **server-push events** (notification arrival, clipboard change,
  telemetry samples),
- **streaming control** (screen capture frames use a separate transport so
  bulk video never competes with command traffic).

Each feature is exposed on exactly one primary transport; see the planned
table in [api.md](api.md).

## Connection handshake

1. Client opens `ws://…/ws?token=<device-token>` — or sends an `auth`
   frame as the first message (the chosen variant will be finalised with
   the pairing milestone; query token is preferred because headers are
   awkward on some Android clients).
2. Server validates the token against hashed device tokens, applies the
   connection limit, then either accepts or closes with a protocol error
   code.
3. Unauthenticated connections are closed within one round trip; the server
   never processes commands from them.

## Message envelope

Every frame is a single JSON object. All five fields except `payload` are
mandatory on commands; responses mirror the request `id`.

```jsonc
// → client to agent
{
  "type": "command",
  "id": "req-123",          // unique per request, used for correlation
  "module": "media",        // target module (registry key)
  "action": "play_pause",   // action within the module
  "payload": {}             // action-specific arguments (object)
}

// ← agent to client
{
  "type": "response",
  "id": "req-123",          // correlation ID, echoed verbatim
  "success": true,
  "data": { "status": "playing" },
  "error": null             // { "code": "...", "message": "..." } on failure
}
```

Other frame types:

| `type` | Direction | Purpose |
|---|---|---|
| `command` | client → agent | invoke an action |
| `response` | agent → client | result of a command (correlated by `id`) |
| `event` | agent → client | unsolicited push (`id` absent, `event` names the kind) |
| `ping` / `pong` | both | application-level heartbeat with `ts` |
| `error` | agent → client | protocol violation (bad JSON, unknown fields, oversized frame) — not tied to a command |

```jsonc
// event example
{
  "type": "event",
  "event": "notification.received",
  "data": { "app": "Teams", "title": "New message", "body": "…" }
}
```

## Validation and limits

- Frame size cap: **64 KiB** for commands (file/screen traffic does not
  travel on this socket); oversized frames close the connection with
  `message_too_big`.
- Unknown `type`, missing fields, or unknown `module`/`action` produce an
  `error` frame with code `invalid_request` — the connection stays open.
- Unknown actions return a **response** with `success:false` and code
  `unsupported` (never a silent success).
- `id` is echoed exactly; clients generate unique IDs (UUIDv4-style) and
  match responses to in-flight requests with a timeout.

## Heartbeat and liveness

- Server sends a `ping` frame every **30 s** with a server timestamp.
- Client must reply `pong` within **10 s**; otherwise the server closes the
  connection as dead (and the client should reconnect with backoff).
- WebSocket-level ping/pong frames are used in addition as a fallback, with
  a read deadline set from the last pong.

## Reconnection and ordering

- Clients reconnect with exponential backoff (initial 500 ms, cap 30 s,
  ±20 % jitter).
- The server tolerates multiple connections per device until the
  per-device connection cap (2) is reached; older connections are closed
  with `replaced`.
- Messages on one connection are processed **in order**; there is no
  cross-connection ordering guarantee. Clients must not assume a command
  has been applied until its `response` arrives.

## Command registry

Actions are resolved through a registry (`module` → `action` → handler),
not through arbitrary dispatch:

- handlers live in their owning module and are registered during
  bootstrap;
- every payload is structurally validated before the service runs;
- **no shell strings, no executable paths, no dynamic code** — only
  whitelisted operations with typed arguments.

## Error codes

Same vocabulary as REST (`invalid_request`, `unauthorized`, `unsupported`,
`rate_limited`, `internal_error`, …) plus transport-specific codes:
`message_too_big`, `auth_failed`, `replaced`, `shutdown`.

## Draft events (growing per milestone)

| Event | Milestone | Payload sketch |
|---|---|---|
| `media.state` | 5 | `{ playing, title, artist, position_ms }` |
| `telemetry.sample` | 5 | cpu/memory/gpu/network snapshot |
| `notification.received` | 5 | app, title, body, timestamp |
| `clipboard.changed` | 5 | text length + preview (opt-in) |
| `power.state` | 5 | lock/sleep/shutdown transitions |

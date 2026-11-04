# WebSocket Protocol

> **Status: implemented** (milestone 3), with the command registry extended
> through milestone 5. Everything in this document is what the agent answers
> on the wire today. Planned events are labelled as such.

Endpoint:

| Path | Notes |
|---|---|
| `ws(s)://<host>:<port>/ws` | canonical |
| `ws(s)://<host>:<port>/api/v1/ws` | same handler, registered for clients that build every URL from the API prefix |

The route is registered with `ws.Controller.Connect` directly — it does not go
through `RequireAuth`, because the HTTP upgrade has to happen in the handler.
The controller performs the token check itself before upgrading.

## Why a second transport

REST is right for request/response operations and snapshots. WebSocket carries:

- **latency-sensitive commands** (trackpad motion, clicks, keystrokes),
- **correlated request/response** on a connection that is already open, so a
  pointer move does not pay for a new HTTP request,
- the structural home for **server-push events** (not yet emitted — see
  [Events](#events)).

Each feature has one *primary* transport. Input injection is primary on
WebSocket; monitoring, power, audio and clipboard are primary on REST and
mirrored here. See [api.md](api.md) for the REST surface.

## Connection handshake

```
GET /ws?token=<device-token> HTTP/1.1
Upgrade: websocket
Connection: Upgrade
```

The token may also be sent as `Authorization: Bearer <device-token>`; the query
parameter is checked first, then the header. Unlike every feature endpoint,
**loopback is not a substitute for a token here** — a local caller must present
one too, exactly like `/auth/rotate`.

Failures happen *before* the upgrade, so they are ordinary HTTP responses using
the standard error envelope:

| Situation | Response |
|---|---|
| no token in query or `Authorization` | `401 unauthorized` — `"device token required"` |
| token unknown, expired or revoked | `401 unauthorized` — `"invalid or expired token"` |
| token validation infrastructure failure | `500 internal_error` — `"authentication check failed"` (fails closed) |
| cross-origin browser request or unknown `Host` | `403 forbidden` (global guard, before the handler) |
| upgrader rejected the request | connection refused; the reason is in the agent log only |

A revoked token therefore fails at connect time and will keep failing: retrying
is pointless until the device pairs again or rotates its token.

The token in the query string does not reach the access log — `middleware.Logging`
records `c.Request.URL.Path` only, never the raw query. Use the header if your
client's request tracing captures full URLs.

## Message envelope

Every message is a single JSON object. Only `type` is always present; every
other field is omitted when empty.

| Field | Type | Direction | Meaning |
|---|---|---|---|
| `type` | string | both | `command`, `response`, `event`, `ping`, `pong` or `error` |
| `id` | string | command, response | correlation ID |
| `module` | string | command | registry section (`input`, `power`, …) |
| `action` | string | command | action within the module |
| `payload` | raw JSON | command | action-specific arguments (an object) |
| `success` | bool | response | `true` = data, `false` = error |
| `data` | any | response, event | result or event body |
| `error` | object | response, error | `{ "code": "…", "message": "…" }` |
| `event` | string | event | event name, e.g. `monitoring.metrics` |
| `ts` | integer | ping, pong | Unix milliseconds |

`payload` is `json.RawMessage` on the wire: the frame layer hands the bytes to
the handler, which unmarshals into its own request struct. Unknown fields inside
a payload are ignored by `encoding/json`; a payload that is not valid JSON for
its handler answers `invalid_request`.

### Command

```json
{
  "type": "command",
  "id": "cmd_17_1730541234567",
  "module": "power",
  "action": "lock",
  "payload": {}
}
```

`id`, `module` and `action` are required. `id` is client-generated and must be
unique among in-flight requests on that connection.

### Success response

```json
{
  "type": "response",
  "id": "cmd_17_1730541234567",
  "success": true,
  "data": { "status": "locked" }
}
```

### Failure response

```json
{
  "type": "response",
  "id": "cmd_18_1730541234999",
  "success": false,
  "error": { "code": "unsupported", "message": "action 'media.play' is not supported" }
}
```

`data` is absent on failure and `error` is absent on success — clients should
branch on `success`, not on field presence alone.

### Protocol error (not correlated)

```json
{
  "type": "error",
  "error": { "code": "invalid_request", "message": "unknown message type" }
}
```

There is no `id` on this frame: it reports a problem with the frame itself
(bad JSON, unknown `type`, command without an `id`), not with a request the
server agreed to run.

## Frame types

| `type` | Direction | Purpose |
|---|---|---|
| `command` | client → agent | invoke a registered action |
| `response` | agent → client | result, correlated by `id` |
| `event` | agent → client | unsolicited push (`id` absent, `event` names the kind) |
| `ping` | both | application-level heartbeat carrying `ts` |
| `pong` | both | heartbeat acknowledgement, echoing the ping's `ts` |
| `error` | agent → client | protocol violation, not tied to a command |

Any other `type` answers `error/invalid_request` (`"unknown message type"`)
and the connection stays open.

## Dispatch and correlation

Commands from one connection are queued on a single FIFO channel and executed by
a dedicated `CommandPump` goroutine, **in the order they arrived**. Dispatching
happens off the read loop on purpose: clipboard and audio actions shell out to
PowerShell for hundreds of milliseconds, and running them inline would delay
every pointer move queued behind them.

Ordering guarantees:

- **within one connection**: commands run in send order; a response is queued
  when its handler returns,
- **across connections**: no ordering at all,
- **across modules**: no ordering beyond the FIFO above.

Dispatch decisions:

| Input | Answer |
|---|---|
| command with an `id`, known module/action | `response` with `success:true` + `data`, or `success:false` + `error` |
| command with an `id`, unknown module/action | `response` with `success:false`, code `unsupported` |
| command missing `module` or `action` | `response` with `success:false`, code `invalid_request` |
| command missing `id` | **uncorrelated** `error` frame, code `invalid_request` (`"command frame must include an id"`) |
| handler returns `(nil, nil)` | **no frame at all** |
| handler returns an error | `response` with `success:false`; the code is the handler's, or `internal_error` |

The `(nil, nil)` case is deliberate, not a bug: `input.mouse_move` and
`input.mouse_scroll` are the high-frequency pointer path and answer nothing, so
a drag does not allocate a response object per frame. **Clients must send those
two fire-and-forget** and must not await a response or a timeout. Every other
registered command answers, including `input.mouse_click`.

Handler panics are not recovered (the pump goroutine has no `recover`); a
panicking handler would terminate the process. No current handler can panic on
attacker-controlled input — payload unmarshalling errors are returned, not
ignored — but any new handler is expected to be panic-free by construction.

## Heartbeat and liveness

- The **server** sends an application-level `ping` with `ts` every **30 s**
  (`WebSocketPingInterval`) from `WritePump`.
- The read deadline is `ping interval + pong timeout` = **40 s** and is reset on
  **any** inbound frame — an app-level `pong`, an app-level `ping`, or a command.
  The client therefore only has to send *something* within 40 s; replying `pong`
  to each server ping is the simplest strategy.
- If the client sends `ping`, the server answers `pong` with the same `ts`
  (or the current time when `ts` is `0`/absent).
- Every write is bounded by **5 s** (`WebSocketWriteTimeout`). A failed write
  closes the connection; the cause is logged server-side and not sent to the
  client.
- The server does not send WebSocket-level ping control frames; liveness is the
  application `ping`/`pong` above. Gorilla's own control frames are accepted and
  reset the same read deadline.

## Limits

| Limit | Value | On breach |
|---|---|---|
| inbound frame size | **64 KiB** (`MaxWebSocketFrameBytes`) | the WebSocket library closes with status **1009**; no `error` frame is sent |
| connections per device | **2** | the oldest is closed with an `error` frame code `replaced`, then a normal close |
| total connections | **20** | the new connection is upgraded, then closed with an `error` frame code `unavailable` |
| outbound queue per connection | **256 frames** | the frame is **dropped** (the writer is never blocked) and the drop is logged |

The outbound-drop rule matters for clients: under a flood of broadcasts a slow
reader silently loses frames. Today nothing broadcasts, so it only affects
pathological command volumes, but it is why no code should assume every event
arrives exactly once.

`message_too_big` exists in the error vocabulary but is **not emitted today**:
the size cap is enforced by the WebSocket library, which closes the socket
before the agent sees the frame.

## Close behaviour

`Connection.Close(code, reason)`:

1. writes an `error` frame carrying `{code, reason}` when `code` is non-empty,
2. sends a WebSocket close frame with status **1000** and the reason string,
3. closes the socket and unregisters the connection from the hub.

The machine-readable reason is in the **`error` frame**, not in the close code —
the close frame is always 1000. Clients should read the last `error` frame
before reconnecting to distinguish the cases below.

| Code | When |
|---|---|
| `replaced` | a newer connection for the same device evicted this one |
| `unavailable` | the 20-connection cap was already reached |
| `shutdown` | agent shutdown (`Hub.CloseAll`), or a pump exited after a read/write failure |

`auth_failed` is defined in `constants` but unused: authentication failures are
rejected with `401` before the upgrade, so they never reach a socket.

## Reconnection

The agent does not dictate a backoff policy; it only guarantees that a
reconnect with a valid token is accepted. Recommended client behaviour:

- exponential backoff from **500 ms**, cap **30 s**, ±20 % jitter;
- **one socket per device**: opening a second is fine (that is what the
  per-device cap of 2 is for), but the third evicts the oldest, so a client that
  reconnects without closing its previous socket will keep killing its own
  sessions;
- on `401` at connect time, stop retrying and re-pair or rotate the token;
- on close code `replaced`, do not reconnect — a newer connection already owns
  the device;
- in-flight commands are lost on close; the client's own command timeout is the
  only signal.

## Command registry (implemented)

The registry is a `(module, action)` → handler map, populated during bootstrap by
each module's `RegisterWS`. There is no dynamic dispatch, no shell-string
passthrough, and no executable path anywhere in the protocol.

### Monitoring

| Command | Payload | Data |
|---|---|---|
| `monitoring.metrics` | — | same body as `GET /monitoring/system` |
| `monitoring.processes` | — | `[{ "pid": 1234, "name": "chrome.exe", "memory_mb": 512.4 }]` |
| `monitoring.kill_process` | `{ "pid": 1234 }` | `{ "success": true }` |

`kill_process` returns `internal_error` when the PID is missing, unreadable or
the termination is refused.

### Power

| Command | Payload | Data |
|---|---|---|
| `power.lock` | — | `{ "status": "locked" }` |
| `power.request` | `{ "action": "restart" }` | `{ "confirmation_token": "…", "action": "restart", "expires_at": "…" }` |
| `power.confirm` | `{ "confirmation_token": "…" }` | `{ "action": "restart", "status": "initiated" }` |

`action` ∈ `sleep` \| `hibernate` \| `restart` \| `shutdown`. `lock` is not
accepted by `power.request`.

Confirmation tokens are **single-use**, live **30 s**, and are deleted when spent
or when an expired one is presented. The requesting device ID is recorded with
the token but is **not checked** at confirm time: any authenticated caller that
holds the token can spend it. Treat the token as the capability, keep it on the
connection that asked for it, and do not log it.

Every lock and confirmed action is written to the audit log with the acting
identity (`device` or `local`).

### Audio

| Command | Payload | Data |
|---|---|---|
| `audio.get_volume` | — | `{ "level": 42, "muted": false }` |
| `audio.set_volume` | `{ "level": 75 }` | new state |
| `audio.set_mute` | `{ "muted": true }` | new state |
| `audio.toggle_mute` | — | new state |

### Input

| Command | Payload | Data |
|---|---|---|
| `input.mouse` | a `MousePayload` | `{ "success": true }` |
| `input.mouse_move` | `{ "dx": 8, "dy": -4, "absolute": false, "x": 0, "y": 0 }` | **none — no response frame** |
| `input.mouse_click` | `{ "button": "left", "double": false }` | `{ "success": true }` |
| `input.mouse_scroll` | `{ "dy": 120 }` | **none — no response frame** |
| `input.keyboard` | a `KeyboardPayload` | `{ "success": true }` |
| `input.key_tap` | `{ "key": "enter", "modifiers": ["ctrl"] }` | `{ "success": true }` |
| `input.type_text` | `{ "text": "hello" }` | `{ "success": true }` |
| `input.launch_app` | `{ "app": "chrome" }` | `{ "success": true }` |

`mouse_move` / `mouse_scroll` **discard injection errors**: they answer nothing
on success and nothing on failure. A client that needs to know whether the
cursor actually moved has to use `input.mouse` with an explicit
`"action": "move"` / `"action": "scroll"`, which does report errors.

Mouse keys: `dx`, `dy` (relative, and wheel notches for scroll), `x`/`y` with
`absolute: true`, `button` ∈ `left` | `right` | `middle`, `double`.

Keyboard keys: lower-case names — `enter`, `backspace`, `tab`, `esc`, `space`,
`a`–`z`, `0`–`9`, `f1`–`f12`, punctuation names, arrows, `home`, `end`,
`pageup`, `pagedown`, `insert`, `delete`, `capslock`. `modifiers` is any subset
of `ctrl`, `alt`, `shift`, `win`, held around a tap.

`launch_app` accepts **only** an allowlisted key: `chrome`, `spotify`, `code`,
`calc`, `taskmgr`, `terminal`, `cmd`, `notepad`, `explorer`, `settings`.
Anything else answers `invalid_request` (`"app not permitted"`). There is no
path or command-string passthrough; the agent runs `cmd /c start <fixed target>`.

### Clipboard

| Command | Payload | Data |
|---|---|---|
| `clipboard.get` | — | `{ "text": "…" }` |
| `clipboard.set` | `{ "text": "…" }` | `{ "success": true }` |

Text only. Binary clipboard formats are not on the wire.

## Events

**No events are emitted today.** The frame type, `Hub.Broadcast`,
`Hub.SendToDevice` and `monitoring.StartBroadcaster` all exist, but bootstrap
never starts the broadcaster, so a connected client receives only `response`,
`pong` and `error` frames.

`StartBroadcaster` would emit `monitoring.metrics` with the same body as
`monitoring.metrics` command data, on a caller-supplied interval. Until it is
wired, poll `GET /monitoring/system` (the Android app does so every 3 s) or send
`monitoring.metrics`.

Planned events, for milestone 6 — these names are **not** on the wire:

| Event | Milestone | Payload sketch |
|---|---|---|
| `monitoring.metrics` | 6 | cpu/memory/battery/disks snapshot |
| `media.state` | 6 | `{ playing, title, artist, position_ms }` |
| `notification.received` | 6 | app, title, body, timestamp |
| `clipboard.changed` | 6 | length + opt-in preview |
| `power.state` | 6 | lock/sleep/shutdown transitions |

## Error codes

Same vocabulary as REST (`invalid_request`, `unauthorized`, `unsupported`,
`rate_limited`, `internal_error`, …) plus transport-specific codes:

| Code | Emitted today | Meaning |
|---|---|---|
| `invalid_request` | yes | malformed JSON, unknown `type`, command without `id`, bad payload, refused app key |
| `unsupported` | yes | unknown `(module, action)` pair |
| `internal_error` | yes | handler failure; the detail is in the agent log |
| `unavailable` | yes | connection cap reached |
| `replaced` | yes | evicted by a newer connection for the same device |
| `shutdown` | yes | agent shutting down or a pump terminated |
| `message_too_big` | no | reserved; the socket is closed with 1009 instead |
| `auth_failed` | no | reserved; authentication is refused with HTTP 401 |
| `forbidden` | no | HTTP-level guard rejection before the upgrade |
| `rate_limited` | no | no WebSocket rate limiting exists |

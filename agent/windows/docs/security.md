# Security

## Threat model (local-network agent)

The agent is a privileged service on a Windows PC, reachable by anything on
the same LAN. The relevant adversaries:

1. **Honest-but-curious devices** on the Wi-Fi that probe the API.
2. **A compromised/malicious device** that already paired (or stole a
   token) and tries to escalate to destructive actions.
3. **Network attackers** who can observe or modify traffic (ARP spoofing,
   rogue AP) — relevant once the agent leaves loopback.
4. **Malicious inputs** arriving over the network: oversized bodies, path
   traversal strings, malformed JSON, flooding.

Out of scope for now: local users with administrator rights on the PC
(they already own the machine), and physical attacks.

## Controls implemented

### Milestone 1 — transport and baseline

| Control | Implementation |
|---|---|
| Loopback by default | `server.host` defaults to `127.0.0.1`; exposing the agent is an explicit configuration decision |
| TLS support (server side) | `server.tls` with `MinVersion: TLS 1.2`; key pair is validated **before** the socket is published |
| Request size ceiling | `server.max_request_bytes` default 1 MiB + `MaxHeaderBytes` 1 MiB |
| Server timeouts | read-header/read/write/idle timeouts configured from constants with config overrides |
| Panic containment | recovery middleware converts panics to a generic JSON 500; stack traces stay in the log; panic values never reach clients |
| Structured access log | method, path, status, latency, client IP, request ID — enough for audit reconstruction later |
| Unspoofable client IP | `SetTrustedProxies(nil)`: `X-Forwarded-For`/`X-Real-IP` are ignored (verified by test) |
| Safe error responses | fixed envelope; error causes (file paths, SQL text) go to the log only |
| Correlation IDs | `X-Request-ID` (crypto/rand, bounded length) ties client reports to log lines |
| No globals in app code | dependency injection only; no mutable package state to race or abuse |
| Migration integrity | SHA-256 checksums; editing an applied migration fails loudly |

### Milestone 2 — pairing, authentication, browser defences

| Control | Implementation |
|---|---|
| Loopback-scoped administration | `POST /pairing/start`, `GET /pairing/devices`, `POST /pairing/revoke` and `GET /discovery/qr` answer only to loopback peers (`RequireLocal`); a LAN client receives 403 |
| CSPRNG PINs and tokens | `crypto/rand`: 6-digit PIN, 256-bit `tuf_…` bearer token, 128-bit random hex identifiers — no defaults, no sequences |
| Hashed tokens at rest | only `SHA-256(token)` is stored; the raw token is handed over exactly once (pairing or rotation) and is never retrievable again |
| Constant-time PIN check | `subtle.ConstantTimeCompare`, every open session compared without early exit; all failures answer one generic 401 |
| Pairing session budgets | in-memory only: TTL (default 5 m), attempt budget (5), capacity (3), single use; a restart invalidates every outstanding PIN |
| Auth middleware | `RequireToken` (bearer always), `RequireAuth` (bearer **or** loopback), `RequireLocal` (loopback only) |
| Rate limiting | fixed-window per-IP budget on `POST /pairing/confirm` (default 20/min) → `429` + `Retry-After` |
| Token rotation with grace | `POST /auth/rotate` issues a fresh token; the old one keeps working for `security.pairing.token_grace_period` (30 s), then dies |
| Revocation | revoking a device kills the device and every token it holds in one transaction; a second attempt answers 409 |
| Audit log writer | pairing, revocation and rotation land in `audit_logs` with actor/outcome/resource/detail; details are validated so a PIN or token can never be written, and newlines/NUL are rejected; failed audit writes are logged loudly, never swallowed |
| CSRF and DNS-rebinding guard | `middleware.Guard` runs on every request: rejects `Sec-Fetch-Site: cross-site`, opaque (`null`) or mismatched `Origin`, and any `Host` outside the allowlist (IP literals, `localhost`, this machine's hostname, `security.allowed_hosts`). Native clients send none of these headers and are unaffected |

### Milestones 3–5 — feature controls

| Control | Implementation |
|---|---|
| WebSocket authentication | `/ws` upgrades only after a valid bearer token (401 otherwise); `CheckOrigin` delegates to the guard |
| WebSocket connection caps | total and per-device connection limits; a newer connection replaces the oldest connection of the same device |
| WebSocket framing and heartbeat | 64 KiB read limit per frame, 30 s ping / 10 s pong deadlines, write deadline on every send |
| Destructive power actions | two-step: `/power/request` returns a confirmation token with `expires_at`, `/power/confirm` executes it under the caller's identity; workstation lock stays immediate because it is non-destructive |
| Input/clipboard scope | text and motion only — no shell, no arbitrary paths; the clipboard exposes text, never file contents |

## Explicitly NOT yet implemented

These are the gaps that still matter:

- **TLS trust story for clients** — TLS can be enabled with provided cert/key
  files, but certificate provisioning and trust distribution for a private LAN
  (self-signed CA or user-installed cert) are still to be designed. Until TLS
  is on, LAN traffic (including bearer tokens) is readable on the wire.
- **Global flood protection** — only `/pairing/confirm` is rate limited.
  Authenticated endpoints and `/ws` rely on connection caps and authentication;
  per-device budgets and a global request budget are not implemented yet.
- **Remaining feature modules** — media, display, applications, files,
  notifications, macros and screen control are not implemented. Each carries
  its own design work (approved directory roots, validated action registry,
  capture APIs) and must land with those controls, not after them.
- **Release hardening** — no code signing or update-integrity mechanism yet.

## Security rules for all future code

- Never store plaintext credentials or tokens; store hashes only
  (SHA-256 of a high-entropy token is acceptable; any lower-entropy secret
  that must be persisted goes through a KDF). Pairing PINs are never
  persisted at all — they live in memory for the session TTL only.
- No hardcoded secrets; no default PINs; no "dev bypass" flags in release
  builds.
- No arbitrary shell/exec endpoints — input injection uses dedicated APIs,
  automation uses a validated action registry, applications are launched
  only from registered entries.
- File access restricted to explicitly approved directories; traversal
  (`..`), symlinks out of scope, and absolute paths outside the roots are
  rejected before any syscall.
- Destructive endpoints (power, delete, revoke) require authentication
  **and** explicit confirmation.
- Logs must not contain tokens, PINs, clipboard contents or notification
  bodies.
- When a platform cannot provide a feature securely, answer `unsupported`
  — never approximate.

## Reporting

Report security issues privately to the project owner; do not file public
issues for exploitable vulnerabilities.

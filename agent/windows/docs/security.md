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

## Controls implemented (Milestone 1)

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

## Explicitly NOT yet implemented (milestone 2+)

These are the gaps that matter; until they land the agent must stay on
loopback:

- **Device pairing and authentication** — PIN-based pairing with explicit
  user authorisation on the PC, hashed device tokens at rest, bearer auth
  middleware, token rotation, device revocation. (Tables `paired_devices`,
  `device_tokens` already exist in the schema.)
- **Rate limiting** — per-IP and per-device budgets, especially on pairing
  endpoints.
- **Audit log writer** — table exists; the writer lands with pairing so
  every privileged action is recorded.
- **WebSocket authentication** and connection caps.
- **TLS trust story for clients** — certificate provisioning/distribution
  for a private LAN (self-signed CA or user-installed cert) is still to be
  designed.
- **Destructive-operation confirmation** — power actions will require an
  explicit confirmation token/flow.

## Security rules for all future code

- Never store plaintext credentials or tokens; store hashes only
  (SHA-256 of a high-entropy token is acceptable; PINs go through a KDF).
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

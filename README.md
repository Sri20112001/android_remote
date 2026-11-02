# TUF Remote

Remote control for a Windows PC from an Android phone: the PC runs a small
agent, the phone pairs with it over the LAN and drives it.

## Repository layout

| Path       | Contents |
|------------|----------|
| `agent/`   | Go agent for Windows (`agent/windows`) — HTTP/WebSocket API, PIN pairing, token auth, discovery, monitoring and control modules. |
| `app/`     | Android client built with Expo (React Native, SDK 58). See `app/README.md`. |
| `design/`  | Product mockups (`code.html` + `screen.png` per concept) — the visual source of truth for the app. |

## Getting started

**Agent** (Windows):

```powershell
cd agent/windows
.\scripts\build.ps1          # builds bin\tuf-remote-agent.exe
.\bin\tuf-remote-agent.exe   # default: 127.0.0.1:8765
.\scripts\test.ps1           # gofmt check, go vet, go test
```

Configuration defaults come from `agent/windows/configs/config.example.yaml`
and can be overridden with `TUF_REMOTE_*` environment variables.

**App** (phone + dev machine):

```bash
cd app
npm install
npx expo start               # scan with Expo Go (SDK 58)
```

See `app/README.md` for verification commands and the implemented milestones.

## Status

- **Agent (Windows):** milestones 1–5 implemented and tested (18 packages,
  200 tests; windows/386 + amd64). Docs in `agent/windows/docs/`.
- **App (Android):** milestone 1 — connect & pair — implemented.

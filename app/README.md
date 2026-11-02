# TUF Remote — Android client (Expo)

React Native (Expo, SDK 58) client for the TUF Remote agent. The phone
connects to the agent running on a Windows PC over the LAN: it probes
health, pairs with a PIN from the PC, stores a bearer token in the device
keystore, and (from milestone 2 onwards) drives the remote-control modules.

## Requirements

- Node.js 22+ and npm
- **Expo Go** on the phone (SDK 58 — must match this project's SDK)
- The TUF Remote agent running on the PC (`agent/windows`, default port `8765`)
- Phone and PC on the same network

## Commands

```bash
npm install            # install dependencies
npx expo start         # dev server; scan the QR with Expo Go
npx expo start --android
```

Verification (run all four before declaring work done):

```bash
npx tsc --noEmit       # typecheck
npx expo lint          # lint
npm test               # unit tests
npm run test:integration  # end-to-end test against a real agent
npx expo-doctor        # dependency/config health
```

## Flow implemented so far (Milestone 1 — connect & pair)

1. **Connect** (`src/app/connect.tsx`) — scan the pairing QR code with the
   camera, or type the agent address manually (`host`, `host:port`, or a
   full `https://` URL). CONTINUE always probes `GET /api/v1/health` first,
   so a wrong address fails here with an inline message.
2. **Pair** (`src/app/pair.tsx`) — enter the 6-digit PIN shown on the PC
   (prefilled when it came from the QR payload), give the device a name,
   and confirm. The agent answers `201` with a bearer token.
3. **Home** (`src/app/home.tsx`) — paired status dashboard: agent identity
   and liveness from `/health` + `/discovery/info`, this device's record,
   refresh, and "forget device" (wipes the token).

The token is stored as one atomic JSON record (`tuf.session.v1`) in
`expo-secure-store` (Android Keystore), behind an injectable
`KeyValueBackend` so tests run against memory.

## Project structure

```
src/
  api/         wire contract types + AgentClient (typed HTTP client)
  auth/        session state machine, credential store, secure backend
  components/  shared UI (Screen, Button, Field, Pill, Card, header)
  config/      constants mirroring the agent's contract values
  connection/  address parsing + QR payload parsing
  theme/       design tokens from design/network_scanner_pairing_deck
  utils/       formatters
  app/         expo-router routes (screens)
tests/
  integration/ end-to-end pairing contract test (real agent binary)
```

Design tokens (dark OLED surfaces, lime `#CAF300` accent, Syne / Plus
Jakarta Sans / JetBrains Mono) come from `design/network_scanner_pairing_deck`
— the product mockups are the visual source of truth.

## Tests

- **Unit** (`npm test`): jest-expo. The API client runs against a fake
  `fetch`, the credential store against a memory backend.
- **Integration** (`npm run test:integration`): builds `agent/windows` with
  `go build`, spawns it on port `18765` with a throwaway database, and
  drives health → pairing start → confirm → authenticated call → rotation
  (grace window) → revocation → rejection. Teardown kills the process tree
  and removes the temp directory.

  The agent binds `0.0.0.0` for this test so requests arrive from a
  **non-loopback** address — the vantage point a real phone uses, and the
  only one where the agent demands a bearer token (`RequireAuth` treats
  loopback as the PC's own user). The test therefore needs at least one
  reachable non-loopback IPv4 address on the machine.

## Known limitations (Milestone 1)

- Not yet run on a physical device — verified by typecheck, lint, unit and
  integration tests only.
- App icon/splash are the Expo template assets.
- TLS: the agent's TLS mode is honoured in the QR payload (`https://`),
  but certificate trust/pinning is not implemented yet.
- Token expiry is not probed continuously; a rejected token surfaces as a
  link error on the dashboard (rotate/re-auth flows come later).
- Milestones 2–5 (dashboard telemetry, WS streaming, input/audio/power/
  clipboard control) are not implemented.

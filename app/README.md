# TUF Remote — Mobile Client (Expo / React Native)

React Native client for TUF Remote built with Expo (SDK 58). Connects to the host Windows agent over the local area network (LAN) to provide tactile, low-latency control over cursor, keyboard macros, audio bus, process monitoring, power states, and file transfer.

---

## 🛠️ Requirements & Setup

- **Node.js**: 22+ & npm
- **Mobile Environment**: **Expo Go (SDK 58)** or standalone development build
- **Host**: Windows PC running `agent/windows` on the same Wi-Fi subnet

### Commands

```bash
cd app
npm install            # Install dependencies
npx expo start         # Start dev server (scan QR with Expo Go)
npx expo start --android
```

---

## 🧪 Verification Gates

Run before declaring any changes ready:

```bash
npx tsc --noEmit       # Strict TypeScript typecheck (0 errors)
npm test               # Jest unit tests (4 suites, 40 tests)
npx expo lint          # ESLint hygiene
```

---

## 📱 Implemented Feature Modules

1. **Kinetic Trackpad & Gyroscopic Air Mouse (`trackpad.tsx`):**
   - Single-finger cursor gliding with pointer acceleration.
   - Dual-finger scrolling quantized to 120-unit Windows `WHEEL_DELTA` notches.
   - Press-to-drag holding with zero frame drops.
   - 40Hz Gyroscope Air Mouse with deadzone filtering.
   - Quick soft keyboard text injector.
   - Bidirectional clipboard sync ("Paste to PC" and "Copy from PC").

2. **Master Audio Console & Tactical TV Remote (`media.tsx`):**
   - Vertical soundboard master volume fader with 10% notch haptic ticking.
   - Multi-channel dancing stereo VU meter isolated with `React.memo` for 60fps rendering.
   - 5-Way circular D-Pad (`UP`, `DOWN`, `LEFT`, `RIGHT`, `OK`) for leanback video and TV navigation.
   - Dedicated 10s seek mode (Web/YouTube `J`/`L` vs Media Player arrow keys).
   - Audio endpoint direct WASAPI feedback.

3. **Stream Deck / Macro Grid (`macro-deck.tsx`):**
   - Quick application launchers: Chrome, Spotify, VS Code, Calculator, Task Manager, Terminal.
   - One-tap system chords: `Win+D`, `Win+Shift+S`, `Alt+Tab`, `Alt+F4`, `F11`, `F5`.

4. **Telemetry & Process Killer (`telemetry.tsx`):**
   - Real-time CPU, RAM, and Disk storage gauges.
   - Active Windows Workload Matrix: interactive process monitor with live PID/Memory tracking and single-tap process termination (`OpenProcess` + `TerminateProcess`).

5. **Power & Wake-on-LAN (`power.tsx`):**
   - Biometric fingerprint / Face ID challenge (`expo-local-authentication`) guarding Shutdown, Restart, and Sleep commands.
   - Wake-on-LAN (WoL) Magic Packet UDP broadcaster.

6. **Settings & File Beam (`settings.tsx`):**
   - AirDrop-style file beam directly to PC `%USERPROFILE%\Downloads`.
   - Sensitivity slider and connection diagnostic suite.

---

## 🎨 Theme & Design Tokens

Built with dark cyberpunk aesthetics:
- **Obsidian Dark Surface:** `#0B0E14` / `#10141D`
- **Electric Citrus Accent:** `#CAF300`
- **Cyan Accent:** `#38BDF8`
- **Slate Borders:** `#1E2430` / `#334155`
- **Typography:** JetBrains Mono (monospaced metrics) and Syne.

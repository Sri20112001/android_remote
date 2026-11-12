import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const host = process.env.TAURI_DEV_HOST;
  const env = loadEnv(mode, process.cwd(), "");

  // Where the local agent listens. Override in `.env` when the PC agent runs
  // on a different host or port.
  const agentTarget = env.VITE_AGENT_BASE_URL || "http://127.0.0.1:8765";

  return {
    plugins: [react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
      proxy: {
        // `npm run dev` doubles as a plain-browser preview. A browser cannot
        // call the loopback agent directly: its CSRF guard rejects cross-site
        // fetches. Routing through the dev server keeps the request
        // same-origin. These blocks are only ever used by `vite dev`.
        "/agent-api": {
          target: agentTarget,
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/agent-api/, ""),
        },
        "/agent-ws": {
          target: agentTarget,
          changeOrigin: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/agent-ws/, ""),
        },
      },
    },
  };
});

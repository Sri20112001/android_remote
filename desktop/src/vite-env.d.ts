/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base origin of the local agent, e.g. `http://127.0.0.1:8765`. */
  readonly VITE_AGENT_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Centralized constants shared across the app. Mirrors the agent-side
 * defaults in `agent/windows/internal/constants` — if the agent changes a
 * contract value, it changes here too (see `src/api/types.ts`).
 */

/** Base path of every versioned REST endpoint on the agent. */
export const API_PREFIX = '/api/v1';

/** Default agent port (`agent/windows` `constants.DefaultPort`). */
export const DEFAULT_PORT = 8765;

/** Per-request timeout for agent calls. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Pairing PIN length accepted by the agent (`^[0-9]{6}$`). */
export const PIN_LENGTH = 6;

/** Maximum device name length accepted by the agent (`MaxDeviceNameLength`). */
export const MAX_DEVICE_NAME_LENGTH = 64;

/**
 * SecureStore key for the persisted session (single key so origin, token
 * and device are written atomically and can never disagree).
 */
export const SESSION_STORAGE_KEY = 'remotedeck.session.v1';

/** mDNS service type the agent advertises (informational; unused yet). */
export const MDNS_SERVICE_TYPE = '_remotedeck._tcp';

/**
 * Backend origin baked in at build time from `.env`
 * (`EXPO_PUBLIC_AGENT_URL`, see `.env.example`).
 *
 * Empty when unset — the connect screen then offers QR scanning and manual
 * entry only. When set, the app prefills the address and automatically
 * probes the PC, so scanning is not required just to reach your own machine.
 */
export const ENV_AGENT_URL = (process.env.EXPO_PUBLIC_AGENT_URL ?? '').trim();

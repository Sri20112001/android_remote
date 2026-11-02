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
export const SESSION_STORAGE_KEY = 'tuf.session.v1';

/** mDNS service type the agent advertises (informational; unused yet). */
export const MDNS_SERVICE_TYPE = '_tufremote._tcp';

/**
 * Wire contract types. Field names and shapes mirror the agent's Go structs
 * under `agent/windows/internal/modules` (models.go in each module);
 * keep them in sync.
 */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  app_name: string;
  version: string;
  agent_uptime_seconds: number;
  timestamp: string;
}

export interface SystemInfoResponse {
  app_name: string;
  version: string;
  hostname: string;
  os: string;
  os_version?: string;
  ip_addresses: string[];
  uptime_seconds?: number;
}

/** Payload of GET /api/v1/discovery/info (public). */
export interface DiscoveryInfo {
  agent_name: string;
  version: string;
  hostname: string;
  addresses: string[];
  port: number;
  tls_enabled: boolean;
}

/**
 * JSON payload encoded in the pairing QR code the PC displays
 * (GET /api/v1/discovery/qr on loopback, then rendered as a QR image).
 */
export interface QrPayload {
  agent_name: string;
  version: string;
  hostname: string;
  ip_addresses: string[];
  port: number;
  tls_enabled: boolean;
  session_id?: string;
  pin?: string;
}

/** Payload of POST /api/v1/pairing/confirm. */
export interface ConfirmPairingRequest {
  pin: string;
  name: string;
  model?: string;
  os_version?: string;
  platform?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  model?: string;
  os_version?: string;
  paired_at: string;
  last_seen_at?: string;
  status: 'active' | 'revoked';
}

export interface TokenInfo {
  /** Raw bearer token — present exactly once, when handed over. */
  token?: string;
  expires_at?: string;
}

export interface ConfirmPairingResponse {
  device: DeviceInfo;
  token: TokenInfo;
}

export interface RotateResponse {
  token: TokenInfo;
}

/** Standard failure envelope: `{ "error": { "code", "message" } }`. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

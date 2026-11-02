/**
 * Typed HTTP client for the TUF Remote agent.
 *
 * Design rules:
 * - one class, constructor injection (origin, token, fetch, timeout) — no
 *   module-level state, so tests drive it with a fake `fetch`;
 * - every failure becomes an `ApiError` with a `kind` the UI can switch on.
 *   Server messages come from the agent's error envelope, which is written
 *   to be safe to display; anything else degrades to a generic message so
 *   internals never leak into the UI or logs;
 * - the bearer token is attached only when present, and never logged.
 */

import { API_PREFIX, DEFAULT_PORT, REQUEST_TIMEOUT_MS } from '@/config/constants';
import type {
  ConfirmPairingRequest,
  ConfirmPairingResponse,
  DiscoveryInfo,
  ErrorEnvelope,
  HealthResponse,
  RotateResponse,
} from '@/api/types';

export type ApiErrorKind =
  /** Device could not reach the agent (DNS/TCP failure). */
  | 'network'
  /** Agent accepted the connection but did not answer in time. */
  | 'timeout'
  /** Agent answered with an HTTP error status. */
  | 'http'
  /** Agent answered 2xx with something that is not the expected JSON. */
  | 'protocol';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, present for `http` errors. */
  readonly status?: number;
  /** Stable error code from the agent's envelope, present when available. */
  readonly code?: string;

  constructor(kind: ApiErrorKind, message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export interface AgentClientOptions {
  /** Origin of the agent, e.g. `http://192.168.1.104:8765` (no trailing slash). */
  origin: string;
  /** Bearer token; omitted while unpaired. */
  token?: string | null;
  /** Injectable for tests; defaults to the runtime `fetch`. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class AgentClient {
  private readonly origin: string;
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AgentClientOptions) {
    const origin = options.origin.replace(/\/+$/, '');
    if (!/^https?:\/\/.+/.test(origin)) {
      throw new Error(`invalid agent origin: ${origin}`);
    }
    this.origin = origin;
    this.token = options.token ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  /** GET /api/v1/health — liveness, no credential required. */
  getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  /** GET /api/v1/discovery/info — public agent identity, no credential. */
  getDiscoveryInfo(): Promise<DiscoveryInfo> {
    return this.request<DiscoveryInfo>('GET', '/discovery/info');
  }

  /**
   * POST /api/v1/pairing/confirm — exchanges the PIN for a device token.
   * Returns `201` with the raw token, shown exactly once.
   */
  confirmPairing(req: ConfirmPairingRequest): Promise<ConfirmPairingResponse> {
    return this.request<ConfirmPairingResponse>('POST', '/pairing/confirm', req);
  }

  /**
   * POST /api/v1/auth/rotate — requires a valid token even from loopback.
   * The previous token keeps working for the agent's grace period.
   */
  rotateToken(): Promise<RotateResponse> {
    return this.request<RotateResponse>('POST', '/auth/rotate');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.origin}${API_PREFIX}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (cause) {
      throw this.toTransportError(cause);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw await this.toHttpError(response);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('protocol', 'Agent sent an unexpected response.');
    }
  }

  private toTransportError(cause: unknown): ApiError {
    const host = hostOf(this.origin);
    if (cause instanceof Error && cause.name === 'AbortError') {
      const seconds = Math.round(this.timeoutMs / 1000);
      return new ApiError('timeout', `${host} did not respond within ${seconds}s.`);
    }
    return new ApiError('network', `Cannot reach the agent at ${host}.`);
  }

  private async toHttpError(response: Response): Promise<ApiError> {
    const fallback = `Agent request failed (HTTP ${response.status}).`;
    try {
      const envelope = (await response.json()) as Partial<ErrorEnvelope>;
      const message = envelope.error?.message;
      const code = envelope.error?.code;
      if (message) {
        return new ApiError('http', message, response.status, code);
      }
    } catch {
      // Non-envelope body (proxy, crash page): fall through to generic text.
    }
    return new ApiError('http', fallback, response.status);
  }
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** Human-readable form of an origin for compact UI rows (scheme removed). */
export function displayOrigin(origin: string): string {
  return origin.replace(/^https?:\/\//, '');
}

/** Default origin used when the port is known but no address was entered. */
export function originFromParts(scheme: 'http' | 'https', host: string, port = DEFAULT_PORT): string {
  const hostPart = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${scheme}://${hostPart}:${port}`;
}

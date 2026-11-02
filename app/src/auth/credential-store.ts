/**
 * Persistence for the paired session (origin + bearer token + device).
 *
 * The token is a credential: it lives only in the platform keystore via
 * `expo-secure-store` (see `secure-backend.ts`), never in plain storage.
 * All three values are stored under a single key so they are written
 * atomically — a half-saved session cannot exist.
 *
 * The backend is injected so unit tests run against memory.
 */

import type { DeviceInfo } from '@/api/types';
import { SESSION_STORAGE_KEY } from '@/config/constants';

export interface KeyValueBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PairedSession {
  /** Origin of the paired agent, e.g. `http://192.168.1.104:8765`. */
  origin: string;
  /** Raw bearer token, shown to the user exactly once at pairing. */
  token: string;
  /** Device record as the agent knows it. */
  device: DeviceInfo;
  /** Local ISO timestamp of when this phone completed pairing. */
  pairedAt: string;
}

export class CredentialStore {
  private readonly backend: KeyValueBackend;
  private readonly key: string;

  constructor(backend: KeyValueBackend, key: string = SESSION_STORAGE_KEY) {
    this.backend = backend;
    this.key = key;
  }

  /** Load the paired session; a corrupt entry is cleared and returns null. */
  async load(): Promise<PairedSession | null> {
    let raw: string | null;
    try {
      raw = await this.backend.get(this.key);
    } catch {
      return null;
    }
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<PairedSession>;
      if (
        typeof parsed.origin !== 'string' ||
        typeof parsed.token !== 'string' ||
        parsed.token === '' ||
        typeof parsed.device !== 'object' ||
        parsed.device === null
      ) {
        throw new Error('malformed session');
      }
      return {
        origin: parsed.origin,
        token: parsed.token,
        device: parsed.device as DeviceInfo,
        pairedAt: typeof parsed.pairedAt === 'string' ? parsed.pairedAt : '',
      };
    } catch {
      await this.clear().catch(() => undefined);
      return null;
    }
  }

  async save(session: PairedSession): Promise<void> {
    await this.backend.set(this.key, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    await this.backend.remove(this.key);
  }
}

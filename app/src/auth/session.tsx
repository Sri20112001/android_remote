/**
 * Session context: owns the pairing state machine and the single source of
 * truth for "which agent, with which token".
 *
 *   loading ──► unpaired ──beginConnect──► (pending origin) ──pair──► paired
 *      ▲                                              │                 │
 *      └──────────────────── forget ◄─────────────────┴─────────────────┘
 *
 * Construction is dependency-injected (`store`, `clock`) so tests can run
 * against a memory backend; `_layout.tsx` is the composition root.
 */

import { AgentClient } from '@/api/client';
import type { HealthResponse } from '@/api/types';
import { CredentialStore, type PairedSession } from '@/auth/credential-store';
import { parseAddressInput } from '@/connection/address';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SessionStatus = 'loading' | 'unpaired' | 'paired';

/** Device metadata sent with the pairing confirmation. */
export interface PairingMetadata {
  name: string;
  model?: string;
  osVersion?: string;
  platform?: string;
}

export interface SessionValue {
  status: SessionStatus;
  /** Present once status is `paired`. */
  paired: PairedSession | null;
  /** Agent origin selected on the connect screen; null before that. */
  pendingOrigin: string | null;
  /** PIN carried over from a scanned QR payload, consumed by the pair screen. */
  pendingPin: string | null;
  /** Client bound to the paired session (null while unpaired). */
  client: AgentClient | null;

  /** Validate + remember an origin (and optional QR PIN) before pairing. */
  beginConnect(origin: string, pin?: string): void;
  /** Drop a stale pending origin (e.g. backing out of the flow). */
  cancelConnect(): void;
  /** Liveness probe against the pending origin, pre-pairing. */
  probePending(): Promise<HealthResponse>;
  /** Confirm pairing (PIN from the pair screen); persists on success. */
  pair(pin: string, metadata: PairingMetadata): Promise<void>;
  /** Forget this device: wipe the stored session and return to connect. */
  forget(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function defaultIsoNow(): string {
  return new Date().toISOString();
}

export interface SessionProviderProps {
  store: CredentialStore;
  /** Injectable clock so tests get deterministic timestamps. */
  now?: () => string;
  children: ReactNode;
}

export function SessionProvider({ store, now, children }: SessionProviderProps) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [paired, setPaired] = useState<PairedSession | null>(null);
  const [pending, setPending] = useState<{ origin: string; pin: string | null } | null>(null);

  // Restore the persisted session once, on mount.
  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((restored) => {
        if (cancelled) return;
        if (restored) {
          setPaired(restored);
          setStatus('paired');
        } else {
          setStatus('unpaired');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unpaired');
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const beginConnect = useCallback((origin: string, pin?: string) => {
    const checked = parseAddressInput(origin);
    if (!checked.ok) {
      throw new Error(checked.reason);
    }
    setPending({ origin: checked.origin, pin: pin ?? null });
  }, []);

  const cancelConnect = useCallback(() => setPending(null), []);

  const probePending = useCallback(async (): Promise<HealthResponse> => {
    if (!pending) throw new Error('No agent selected.');
    const client = new AgentClient({ origin: pending.origin });
    return client.getHealth();
  }, [pending]);

  const pair = useCallback(
    async (pin: string, metadata: PairingMetadata): Promise<void> => {
      if (!pending) throw new Error('No agent selected.');
      const client = new AgentClient({ origin: pending.origin });
      const response = await client.confirmPairing({
        pin,
        name: metadata.name,
        model: metadata.model,
        os_version: metadata.osVersion,
        platform: metadata.platform,
      });
      const token = response.token.token;
      if (!token) {
        throw new Error('Agent did not return a token.');
      }
      const session: PairedSession = {
        origin: pending.origin,
        token,
        device: response.device,
        pairedAt: (now ?? defaultIsoNow)(),
      };
      await store.save(session);
      setPaired(session);
      setPending(null);
      setStatus('paired');
    },
    [pending, store, now],
  );

  const forget = useCallback(async (): Promise<void> => {
    await store.clear();
    setPaired(null);
    setPending(null);
    setStatus('unpaired');
  }, [store]);

  const client = useMemo(
    () => (paired ? new AgentClient({ origin: paired.origin, token: paired.token }) : null),
    [paired],
  );

  const value = useMemo<SessionValue>(
    () => ({
      status,
      paired,
      pendingOrigin: pending?.origin ?? null,
      pendingPin: pending?.pin ?? null,
      client,
      beginConnect,
      cancelConnect,
      probePending,
      pair,
      forget,
    }),
    [status, paired, pending, client, beginConnect, cancelConnect, probePending, pair, forget],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}

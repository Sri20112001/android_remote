import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/auth/session';
import { AgentWSClient, ConnectionState } from './ws-client';

/**
 * One socket shared by every screen — `useAgentWS()` is called by four tabs
 * and they must not open four connections.
 *
 * The singleton is created and torn down inside an effect, never during
 * render, and published through `useSyncExternalStore`: that is what makes
 * the components re-read it after a swap (a plain module read would leave
 * the first render holding the previous socket).
 */
let sharedClient: AgentWSClient | null = null;
let sharedKey = '';

const clientListeners = new Set<() => void>();

function publishClient(): void {
  clientListeners.forEach((listener) => listener());
}

function subscribeToClient(listener: () => void): () => void {
  clientListeners.add(listener);
  return () => {
    clientListeners.delete(listener);
  };
}

function getSharedClient(): AgentWSClient | null {
  return sharedClient;
}

/** Reuse the socket for this origin+token, replacing any other one. */
function acquireClient(origin: string, token: string): AgentWSClient {
  const key = `${origin}_${token}`;
  if (!sharedClient || sharedKey !== key) {
    sharedClient?.disconnect();
    sharedClient = new AgentWSClient(origin, token);
    sharedKey = key;
    publishClient();
  }
  return sharedClient;
}

function releaseClient(): void {
  if (sharedClient) {
    sharedClient.disconnect();
    sharedClient = null;
    sharedKey = '';
    publishClient();
  }
}

/* ── Power contract ───────────────────────────────────────────────────────
 * The agent exposes exactly three power commands: `lock`, `request` and
 * `confirm`. Destructive actions are a two-step flow — `request` mints a
 * 30 s confirmation token, `confirm` spends it. The screens think in terms
 * of "restart"/"shutdown", so the translation lives here rather than in
 * every view.
 */

interface PowerRequestResponse {
  confirmation_token: string;
  action: string;
  /** RFC 3339 timestamp, 30 s after the request. */
  expires_at: string;
}

interface PowerConfirmResponse {
  action: string;
  status: string;
}

/** Whole seconds left on an RFC 3339 expiry; the agent's window is 30 s. */
function secondsUntil(expiresAt: string): number {
  const remaining = Date.parse(expiresAt) - Date.now();
  return Number.isFinite(remaining) ? Math.max(1, Math.round(remaining / 1000)) : 30;
}

export function useAgentWS() {
  const { paired } = useSession();
  const client = useSyncExternalStore(subscribeToClient, getSharedClient);

  /**
   * The latest state reported, tagged with the client that reported it: a
   * socket swapped in mid-session starts at `disconnected` instead of
   * inheriting its predecessor's `connected`.
   */
  const [reported, setReported] = useState<{
    client: AgentWSClient | null;
    state: ConnectionState;
  }>({ client: null, state: 'disconnected' });

  const origin = paired?.origin;
  const token = paired?.token;

  useEffect(() => {
    if (!origin || !token) {
      releaseClient();
      return;
    }

    const next = acquireClient(origin, token);
    const unsubscribe = next.onStateChange((state) => {
      setReported({ client: next, state });
    });
    next.connect();

    return () => {
      unsubscribe();
    };
  }, [origin, token]);

  const connectionState: ConnectionState =
    client && reported.client === client ? reported.state : 'disconnected';

  const sendMouseMove = useCallback((dx: number, dy: number) => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `m_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'mouse_move',
      payload: { action: 'move', dx: Math.round(dx), dy: Math.round(dy) },
    });
  }, [client]);

  const sendMouseClick = useCallback((button: 'left' | 'right' | 'middle' = 'left', double = false) => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'mouse_click',
      payload: { action: 'click', button, double },
    });
  }, [client]);

  const sendMouseDown = useCallback((button: 'left' | 'right' | 'middle' = 'left') => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `md_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'mouse',
      payload: { action: 'down', button },
    });
  }, [client]);

  const sendMouseUp = useCallback((button: 'left' | 'right' | 'middle' = 'left') => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `mu_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'mouse',
      payload: { action: 'up', button },
    });
  }, [client]);

  const sendMouseScroll = useCallback((dy: number) => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `s_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'mouse_scroll',
      payload: { action: 'scroll', dy: Math.round(dy) },
    });
  }, [client]);

  const sendKeyTap = useCallback((key: string, modifiers: string[] = []) => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `k_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'key_tap',
      payload: { action: 'tap', key: key.toLowerCase(), modifiers },
    });
  }, [client]);

  const sendTypeText = useCallback((text: string) => {
    if (!client) return;
    client.send({
      type: 'command',
      id: `t_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      module: 'input',
      action: 'type_text',
      payload: { action: 'text', text },
    });
  }, [client]);

  const setVolume = useCallback((level: number) => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('audio', 'set_volume', { level: Math.round(level) });
  }, [client]);

  const toggleMute = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('audio', 'toggle_mute');
  }, [client]);

  const getAudioStatus = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand<{ level: number; muted: boolean }>('audio', 'get_volume');
  }, [client]);

  const getMetrics = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('monitoring', 'metrics');
  }, [client]);

  const onMetrics = useCallback((handler: (metrics: any) => void) => {
    if (!client) return () => {};
    return client.on('monitoring.metrics', handler);
  }, [client]);

  /** Mint a 30 s confirmation token for a destructive power action. */
  const requestPowerConfirmation = useCallback(
    (action: 'sleep' | 'restart' | 'shutdown') => {
      if (!client) return Promise.reject(new Error('Offline'));
      return client.sendCommand<PowerRequestResponse>('power', 'request', { action });
    },
    [client],
  );

  const confirmPowerAction = useCallback(
    (confirmationToken: string) => {
      if (!client) return Promise.reject(new Error('Offline'));
      return client.sendCommand<PowerConfirmResponse>('power', 'confirm', {
        confirmation_token: confirmationToken,
      });
    },
    [client],
  );

  const lockWorkstation = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('power', 'lock');
  }, [client]);

  /**
   * Sleep has no separate confirmation screen: the app already asked, so it
   * spends the token immediately.
   */
  const sleepWorkstation = useCallback(() => {
    return requestPowerConfirmation('sleep').then((grant) =>
      confirmPowerAction(grant.confirmation_token),
    );
  }, [requestPowerConfirmation, confirmPowerAction]);

  /** Hand the token to the screen, which runs its own countdown. */
  const requestRestart = useCallback(() => {
    return requestPowerConfirmation('restart').then((grant) => ({
      token: grant.confirmation_token,
      expires_in_seconds: secondsUntil(grant.expires_at),
    }));
  }, [requestPowerConfirmation]);

  const confirmRestart = useCallback(
    (confirmationToken: string) => confirmPowerAction(confirmationToken),
    [confirmPowerAction],
  );

  const requestShutdown = useCallback(() => {
    return requestPowerConfirmation('shutdown').then((grant) => ({
      token: grant.confirmation_token,
      expires_in_seconds: secondsUntil(grant.expires_at),
    }));
  }, [requestPowerConfirmation]);

  const confirmShutdown = useCallback(
    (confirmationToken: string) => confirmPowerAction(confirmationToken),
    [confirmPowerAction],
  );

  const launchApp = useCallback((app: string) => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('input', 'launch_app', { app });
  }, [client]);

  const getProcesses = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand<{ pid: number; name: string; memory_mb: number }[]>('monitoring', 'processes');
  }, [client]);

  const killProcess = useCallback((pid: number) => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('monitoring', 'kill_process', { pid });
  }, [client]);

  const getClipboard = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand<{ text: string }>('clipboard', 'get');
  }, [client]);

  const setClipboard = useCallback((text: string) => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('clipboard', 'set', { text });
  }, [client]);

  /**
   * The agent has no file-transfer module, so there is no endpoint to call.
   * Reject explicitly instead of probing a route that only answers 404 — a
   * clear "not implemented" is honest, a silent network probe is not.
   */
  const uploadFile = useCallback(
    (
      fileUri: string,
      fileName: string,
      mimeType: string = 'application/octet-stream',
    ): Promise<never> => {
      // Parameters are kept so call sites stay valid; nothing is transmitted.
      void fileUri;
      void fileName;
      void mimeType;
      return Promise.reject(
        new Error(
          'File transfer is not available: this agent build has no file module.',
        ),
      );
    },
    [],
  );

  return {
    client,
    origin,
    token,
    connectionState,
    isConnected: connectionState === 'connected',
    sendMouseMove,
    sendMouseClick,
    sendMouseDown,
    sendMouseUp,
    sendMouseScroll,
    sendKeyTap,
    sendTypeText,
    setVolume,
    toggleMute,
    getAudioStatus,
    getMetrics,
    onMetrics,
    lockWorkstation,
    sleepWorkstation,
    requestRestart,
    confirmRestart,
    requestShutdown,
    confirmShutdown,
    launchApp,
    getProcesses,
    killProcess,
    getClipboard,
    setClipboard,
    uploadFile,
  };
}

/**
 * Live round-trip time to the agent in milliseconds, or `null` while it
 * cannot be measured.
 *
 * Deliberately separate from `useAgentWS()`: the ping fires every two seconds
 * and only the telemetry screen wants the number, so only that screen
 * re-renders for it.
 */
export function useAgentRTT(): number | null {
  const client = useSyncExternalStore(subscribeToClient, getSharedClient);
  const [reported, setReported] = useState<{
    client: AgentWSClient | null;
    ms: number | null;
  }>({ client: null, ms: null });

  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.onRTT((ms) => {
      setReported({ client, ms });
    });
    return () => {
      unsubscribe();
    };
  }, [client]);

  return reported.client === client ? reported.ms : null;
}

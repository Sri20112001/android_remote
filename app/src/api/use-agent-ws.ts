import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from '@/auth/session';
import { AgentWSClient, ConnectionState } from './ws-client';

let globalClient: AgentWSClient | null = null;
let currentKey = '';

export function useAgentWS() {
  const { paired } = useSession();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const client = useMemo(() => {
    if (!paired) {
      if (globalClient) {
        globalClient.disconnect();
        globalClient = null;
        currentKey = '';
      }
      return null;
    }

    const key = `${paired.origin}_${paired.token}`;
    if (!globalClient || currentKey !== key) {
      if (globalClient) {
        globalClient.disconnect();
      }
      globalClient = new AgentWSClient(paired.origin, paired.token);
      currentKey = key;
    }
    return globalClient;
  }, [paired]);

  useEffect(() => {
    if (!client) {
      setConnectionState('disconnected');
      return;
    }

    const unsubscribe = client.onStateChange(setConnectionState);
    client.connect();

    return () => {
      unsubscribe();
    };
  }, [client]);

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

  const lockWorkstation = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('power', 'lock');
  }, [client]);

  const sleepWorkstation = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('power', 'sleep');
  }, [client]);

  const requestRestart = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand<{ token: string; expires_in_seconds: number }>('power', 'restart');
  }, [client]);

  const confirmRestart = useCallback((confirmationToken: string) => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('power', 'confirm_restart', { token: confirmationToken });
  }, [client]);

  const requestShutdown = useCallback(() => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand<{ token: string; expires_in_seconds: number }>('power', 'shutdown');
  }, [client]);

  const confirmShutdown = useCallback((confirmationToken: string) => {
    if (!client) return Promise.reject(new Error('Offline'));
    return client.sendCommand('power', 'confirm_shutdown', { token: confirmationToken });
  }, [client]);

  return {
    client,
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
  };
}

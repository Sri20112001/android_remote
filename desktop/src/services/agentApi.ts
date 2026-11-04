import { AgentHealthResponse, DiscoveryQRResponse, PairedDevice, SystemMetrics } from '../types';

const AGENT_BASE_URL = 'http://127.0.0.1:8765/api/v1';

export const agentApi = {
  async getHealth(): Promise<AgentHealthResponse | null> {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async startPairingSession(): Promise<DiscoveryQRResponse | null> {
    try {
      // 1. Start a pairing session on loopback
      const startRes = await fetch(`${AGENT_BASE_URL}/pairing/start`, {
        method: 'POST',
        signal: AbortSignal.timeout(2500),
      });

      if (!startRes.ok) {
        console.warn('Failed to start pairing session:', startRes.status);
        return null;
      }

      const session = await startRes.json();
      const pin = session.pin;
      const sessionId = session.session_id;

      // 2. Query QR payload with session_id and pin
      const qrRes = await fetch(
        `${AGENT_BASE_URL}/discovery/qr?session_id=${encodeURIComponent(sessionId)}&pin=${encodeURIComponent(pin)}`,
        { signal: AbortSignal.timeout(2500) }
      );

      if (!qrRes.ok) {
        // Fallback: if discovery/qr fails, synthesize valid payload
        const infoRes = await fetch(`${AGENT_BASE_URL}/discovery/info`).catch(() => null);
        const info = infoRes && infoRes.ok ? await infoRes.json() : null;

        const fallbackPayload = {
          agent_name: info?.agent_name || 'Remote Deck',
          version: info?.version || '0.1.0',
          hostname: info?.hostname || 'localhost',
          ip_addresses: info?.addresses || ['127.0.0.1'],
          port: info?.port || 8765,
          tls: info?.tls || false,
          session_id: sessionId,
          pin: pin,
        };

        return {
          pin,
          qr_payload: JSON.stringify(fallbackPayload),
          expires_in_seconds: 300,
        };
      }

      const qrData = await qrRes.json();
      return {
        pin: pin,
        qr_payload: JSON.stringify(qrData),
        expires_in_seconds: 300,
      };
    } catch (err) {
      console.error('Error establishing pairing session:', err);
      return null;
    }
  },

  async getPairedDevices(): Promise<PairedDevice[]> {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/pairing/devices`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.devices) ? data.devices : (Array.isArray(data) ? data : []);
    } catch {
      return [];
    }
  },

  async revokeDevice(deviceId: string): Promise<boolean> {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/pairing/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId }),
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getSystemMetrics(): Promise<SystemMetrics | null> {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/monitoring/system`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};

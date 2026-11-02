/**
 * QR payload parsing and address selection — the scan path's core logic.
 */

import type { QrPayload } from '@/api/types';
import { originFromPayload, parseQrData } from '@/connection/qr';

function payload(overrides: Partial<QrPayload> = {}): QrPayload {
  return {
    agent_name: 'TUF Remote',
    version: '0.1.0',
    hostname: 'WIN11-PC',
    ip_addresses: ['192.168.1.104'],
    port: 8765,
    tls_enabled: false,
    ...overrides,
  };
}

describe('parseQrData', () => {
  it('parses a full agent payload and picks a reachable origin', () => {
    const data = JSON.stringify(
      payload({ ip_addresses: ['127.0.0.1', '192.168.1.104', '10.0.0.5'], pin: '492815' }),
    );

    const result = parseQrData(data);

    expect(result.kind).toBe('payload');
    if (result.kind !== 'payload') return;
    expect(result.origin).toBe('http://192.168.1.104:8765');
    expect(result.pin).toBe('492815');
    expect(result.payload.agent_name).toBe('TUF Remote');
  });

  it('uses https when the agent reports TLS', () => {
    const result = parseQrData(JSON.stringify(payload({ tls_enabled: true })));
    expect(result.kind === 'payload' && result.origin).toBe('https://192.168.1.104:8765');
  });

  it('falls back to the hostname when only loopback addresses are listed', () => {
    const result = parseQrData(
      JSON.stringify(payload({ ip_addresses: ['127.0.0.1'], hostname: 'my-pc.local' })),
    );
    expect(result.kind === 'payload' && result.origin).toBe('http://my-pc.local:8765');
  });

  it('drops a malformed PIN instead of passing it along', () => {
    const result = parseQrData(JSON.stringify(payload({ pin: '12ab56' })));
    expect(result.kind).toBe('payload');
    if (result.kind !== 'payload') return;
    expect(result.pin).toBeUndefined();
  });

  it('accepts a plain URL code', () => {
    const result = parseQrData('http://192.168.1.9:9000');
    expect(result).toEqual({ kind: 'origin', origin: 'http://192.168.1.9:9000' });
  });

  it('rejects a payload without a valid port', () => {
    const result = parseQrData(JSON.stringify({ ...payload(), port: 'eighty' }));
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.reason).toMatch(/port/);
  });

  it('rejects a payload with no usable address', () => {
    const result = parseQrData(JSON.stringify(payload({ ip_addresses: ['127.0.0.1'], hostname: '' })));
    expect(result.kind).toBe('error');
  });

  it('rejects non-JSON, non-URL content', () => {
    expect(parseQrData('hello world').kind).toBe('error');
    expect(parseQrData('{not json').kind).toBe('error');
    expect(parseQrData('').kind).toBe('error');
  });
});

describe('originFromPayload', () => {
  it('ranks private LAN IPv4 above public addresses', () => {
    const origin = originFromPayload(payload({ ip_addresses: ['8.8.8.8', '192.168.1.104'] }));
    expect(origin).toBe('http://192.168.1.104:8765');
  });

  it('never selects a loopback address', () => {
    const origin = originFromPayload(payload({ ip_addresses: ['127.0.0.1', '10.1.2.3'] }));
    expect(origin).toBe('http://10.1.2.3:8765');
  });

  it('returns null when nothing is reachable', () => {
    expect(originFromPayload(payload({ ip_addresses: ['127.0.0.1'], hostname: '' }))).toBeNull();
  });

  it('brackets IPv6 targets', () => {
    const origin = originFromPayload(payload({ ip_addresses: ['fd00::1:2:3:4'] }));
    expect(origin).toBe('http://[fd00::1:2:3:4]:8765');
  });
});

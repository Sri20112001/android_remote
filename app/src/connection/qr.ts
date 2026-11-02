/**
 * Parsing for QR codes shown by the PC (GET /api/v1/discovery/qr payload)
 * and for plain URL codes, plus selection of the address the phone should
 * actually dial.
 *
 * The agent lists every address it has; the phone must pick one it can
 * reach: private LAN IPv4 first, then any other non-loopback address, then
 * the hostname. Loopback addresses are useless from another device.
 */

import type { QrPayload } from '@/api/types';
import { parseAddressInput } from '@/connection/address';

export type QrParseResult =
  | { kind: 'payload'; payload: QrPayload; origin: string; pin?: string }
  | { kind: 'origin'; origin: string }
  | { kind: 'error'; reason: string };

/** Parse the raw string scanned from a QR code. */
export function parseQrData(data: string): QrParseResult {
  const trimmed = data.trim();
  if (trimmed === '') {
    return { kind: 'error', reason: 'Empty QR code.' };
  }

  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { kind: 'error', reason: 'QR code is not a valid TUF Remote payload.' };
    }
    const checked = validatePayload(parsed);
    if ('reason' in checked) {
      return { kind: 'error', reason: checked.reason };
    }
    const origin = originFromPayload(checked);
    if (origin === null) {
      return { kind: 'error', reason: 'QR payload contains no reachable address.' };
    }
    return {
      kind: 'payload',
      payload: checked,
      origin,
      pin: checked.pin && /^\d{6}$/.test(checked.pin) ? checked.pin : undefined,
    };
  }

  const asAddress = parseAddressInput(trimmed);
  if (asAddress.ok) {
    return { kind: 'origin', origin: asAddress.origin };
  }
  return { kind: 'error', reason: 'QR code is not a TUF Remote address or payload.' };
}

type PayloadCheck = QrPayload | { reason: string };

function validatePayload(value: unknown): PayloadCheck {
  if (typeof value !== 'object' || value === null) {
    return { reason: 'QR payload must be an object.' };
  }
  const v = value as Record<string, unknown>;

  const port = v.port;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { reason: 'QR payload has no valid port.' };
  }

  const addresses = Array.isArray(v.ip_addresses)
    ? v.ip_addresses.filter((a): a is string => typeof a === 'string' && a.length > 0)
    : [];
  const hostname = typeof v.hostname === 'string' ? v.hostname : '';
  if (addresses.length === 0 && hostname === '') {
    return { reason: 'QR payload has no address.' };
  }

  return {
    agent_name: typeof v.agent_name === 'string' ? v.agent_name : '',
    version: typeof v.version === 'string' ? v.version : '',
    hostname,
    ip_addresses: addresses,
    port,
    tls_enabled: v.tls_enabled === true,
    session_id: typeof v.session_id === 'string' ? v.session_id : undefined,
    pin: typeof v.pin === 'string' ? v.pin : undefined,
  };
}

/** Best origin for the phone to dial: LAN IPv4 first, loopback last (never). */
export function originFromPayload(payload: QrPayload): string | null {
  const host = chooseAddress(payload);
  if (host === null) return null;
  const scheme = payload.tls_enabled ? 'https' : 'http';
  const hostPart = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${scheme}://${hostPart}:${payload.port}`;
}

export function chooseAddress(payload: QrPayload): string | null {
  const candidates = payload.ip_addresses
    .map((a) => a.trim())
    .filter((a) => a !== '' && !isLoopback(a));

  const ranked = [...candidates].sort((a, b) => rankAddress(b) - rankAddress(a));
  const best = ranked[0];
  if (best !== undefined) return best;

  const host = payload.hostname.trim();
  if (host !== '' && host !== 'localhost') return host;
  return null;
}

function isLoopback(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === 'localhost') return true;
  if (lower.startsWith('127.')) return true;
  return false;
}

/** Higher is better: private IPv4 > public IPv4 > global IPv6 > others. */
function rankAddress(address: string): number {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    const isPrivate =
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254); // link-local: better than nothing, still local
    return isPrivate ? 3 : 2;
  }
  if (address.includes(':')) {
    const lower = address.toLowerCase();
    if (lower.startsWith('fe80')) return 0; // link-local IPv6, needs scope id
    if (lower.startsWith('fc') || lower.startsWith('fd')) return 3; // ULA
    return 1;
  }
  return 1; // hostname
}

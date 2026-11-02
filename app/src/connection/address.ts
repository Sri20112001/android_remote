/**
 * Parsing and validation for manually entered agent addresses.
 *
 * Accepted inputs (after trimming):
 *   192.168.1.104
 *   192.168.1.104:9000
 *   my-pc.local
 *   https://192.168.1.104:8765
 *
 * The result is a normalized origin (`scheme://host[:port]`, no trailing
 * slash, no path). Rejected inputs return a human-readable reason that is
 * safe to show inline under the field.
 */

import { DEFAULT_PORT } from '@/config/constants';

export type AddressParse =
  | { ok: true; origin: string }
  | { ok: false; reason: string };

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function parseAddressInput(raw: string): AddressParse {
  const input = raw.trim();
  if (input === '') {
    return { ok: false, reason: 'Enter the agent address.' };
  }
  if (/\s/.test(input)) {
    return { ok: false, reason: 'Address must not contain spaces.' };
  }

  const hasScheme = /^https?:\/\//i.test(input);
  const withScheme = hasScheme ? input : `http://${input}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'That is not a valid address.' };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'Address must not contain credentials.' };
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return { ok: false, reason: 'Address must not contain a path.' };
  }
  if (url.search || url.hash) {
    return { ok: false, reason: 'Address must not contain a query or fragment.' };
  }

  const scheme = url.protocol === 'https:' ? 'https' : 'http';
  // WHATWG keeps IPv6 brackets in `hostname`; normalize them away.
  let host = url.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  if (!isAcceptableHost(host)) {
    return { ok: false, reason: 'Address must be an IP address or host name.' };
  }

  const port = url.port !== '' ? Number(url.port) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, reason: 'Port must be between 1 and 65535.' };
  }

  const hostPart = host.includes(':') ? `[${host}]` : host;
  return { ok: true, origin: `${scheme}://${hostPart}:${port}` };
}

function isAcceptableHost(host: string): boolean {
  if (host === '') return false;
  if (host.includes(':')) return true; // bare IPv6 literal (brackets removed)

  const v4 = IPV4.exec(host);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255);
  }
  // Four dot-separated numbers that are not a valid IPv4 are typos, not
  // host names — reject them here instead of failing at connect time.
  if (/^\d+(\.\d+){3}$/.test(host)) {
    return false;
  }
  return HOSTNAME.test(host);
}

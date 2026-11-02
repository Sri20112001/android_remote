/**
 * Address input parsing: what the user may type into the manual field.
 */

import { parseAddressInput } from '@/connection/address';

describe('parseAddressInput', () => {
  it('accepts a bare IPv4 and applies the agent default port', () => {
    expect(parseAddressInput('192.168.1.104')).toEqual({
      ok: true,
      origin: 'http://192.168.1.104:8765',
    });
  });

  it('keeps an explicit port', () => {
    expect(parseAddressInput('192.168.1.104:9000')).toEqual({
      ok: true,
      origin: 'http://192.168.1.104:9000',
    });
  });

  it('keeps an explicit https scheme and lowercases the host', () => {
    expect(parseAddressInput('HTTPS://My-PC.local')).toEqual({
      ok: true,
      origin: 'https://my-pc.local:8765',
    });
  });

  it('accepts a hostname with a port', () => {
    expect(parseAddressInput('my-pc.local:9000')).toEqual({
      ok: true,
      origin: 'http://my-pc.local:9000',
    });
  });

  it('accepts a trailing slash but no path', () => {
    expect(parseAddressInput('http://192.168.1.5/')).toEqual({
      ok: true,
      origin: 'http://192.168.1.5:8765',
    });
  });

  it('rejects an empty input', () => {
    const result = parseAddressInput('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Enter the agent address/);
  });

  it('rejects out-of-range IPv4 octets instead of treating them as a name', () => {
    const result = parseAddressInput('999.1.1.1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/valid address|IP address or host name/);
  });

  it('rejects an out-of-range port', () => {
    expect(parseAddressInput('192.168.1.5:70000').ok).toBe(false);
    expect(parseAddressInput('192.168.1.5:0').ok).toBe(false);
  });

  it('rejects credentials, paths and queries', () => {
    expect(parseAddressInput('http://user:pass@192.168.1.5').ok).toBe(false);
    expect(parseAddressInput('http://192.168.1.5/admin').ok).toBe(false);
    expect(parseAddressInput('http://192.168.1.5?x=1').ok).toBe(false);
  });

  it('rejects spaces and garbage', () => {
    expect(parseAddressInput('192.168.1.5 9000').ok).toBe(false);
    expect(parseAddressInput('not a url at all').ok).toBe(false);
    expect(parseAddressInput('ftp://192.168.1.5').ok).toBe(false);
  });

  it('brackets IPv6 literals', () => {
    expect(parseAddressInput('http://[fe80::1]:9000')).toEqual({
      ok: true,
      origin: 'http://[fe80::1]:9000',
    });
  });
});

/**
 * Credential store: the session is one atomic record, and corruption can
 * never produce a half-paired state (it degrades to "unpaired").
 */

import { CredentialStore, type KeyValueBackend } from '@/auth/credential-store';
import type { DeviceInfo } from '@/api/types';

function memoryBackend(): KeyValueBackend & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value);
    },
    remove: async (key) => {
      map.delete(key);
    },
  };
}

const device: DeviceInfo = {
  id: 'b3e7d1a95f4c2e8b7d6a0c3f5e1b9a47',
  name: 'Pixel 8',
  platform: 'android',
  paired_at: '2026-11-01T07:18:12Z',
  status: 'active',
};

describe('CredentialStore', () => {
  it('round-trips a session', async () => {
    const backend = memoryBackend();
    const store = new CredentialStore(backend);

    await store.save({
      origin: 'http://192.168.1.104:8765',
      token: 'tuf_abc',
      device,
      pairedAt: '2026-11-02T10:00:00Z',
    });

    const loaded = await store.load();
    expect(loaded).toEqual({
      origin: 'http://192.168.1.104:8765',
      token: 'tuf_abc',
      device,
      pairedAt: '2026-11-02T10:00:00Z',
    });
    expect(backend.map.size).toBe(1);
  });

  it('returns null when nothing is stored', async () => {
    const store = new CredentialStore(memoryBackend());
    expect(await store.load()).toBeNull();
  });

  it('clears the session', async () => {
    const backend = memoryBackend();
    const store = new CredentialStore(backend);
    await store.save({ origin: 'http://pc:8765', token: 'tuf_x', device, pairedAt: 't' });

    await store.clear();

    expect(await store.load()).toBeNull();
    expect(backend.map.size).toBe(0);
  });

  it('treats corrupt JSON as unpaired and wipes it', async () => {
    const backend = memoryBackend();
    const store = new CredentialStore(backend);
    await backend.set('remotedeck.session.v1', '{"origin": "http://pc:8765", ');

    expect(await store.load()).toBeNull();
    expect(backend.map.size).toBe(0);
  });

  it('treats a structurally wrong record as unpaired and wipes it', async () => {
    const backend = memoryBackend();
    const store = new CredentialStore(backend);
    await backend.set('remotedeck.session.v1', JSON.stringify({ origin: 'http://pc:8765', token: '' }));

    expect(await store.load()).toBeNull();
    expect(backend.map.size).toBe(0);
  });
});

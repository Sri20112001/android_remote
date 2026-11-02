/**
 * Contract tests for the agent HTTP client: URL construction, auth header,
 * status handling, and the error taxonomy the UI switches on.
 */

import { AgentClient, ApiError, displayOrigin, originFromParts } from '@/api/client';

const ORIGIN = 'http://192.168.1.104:8765';

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function brokenJson(status: number): FakeResponse {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error('not json');
    },
  };
}

type Handler = (url: string, init: RequestInit) => Promise<FakeResponse>;

function fakeFetch(
  handler: Handler,
): { fetchImpl: typeof fetch; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const requestInit = init ?? {};
    calls.push({ url, init: requestInit });
    return handler(url, requestInit) as unknown as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('AgentClient requests', () => {
  it('builds the versioned health URL with no auth header when unpaired', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse({ status: 'ok' }));
    const client = new AgentClient({ origin: ORIGIN, fetchImpl });

    const health = await client.getHealth();

    expect(health.status).toBe('ok');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ORIGIN}/api/v1/health`);
    expect(calls[0].init.method).toBe('GET');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers.Accept).toBe('application/json');
  });

  it('attaches the bearer token when present', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse({ token: { token: 'tuf_new' } }));
    const client = new AgentClient({ origin: ORIGIN, token: 'tuf_old', fetchImpl });

    await client.rotateToken();

    const headers = calls[0].init.headers as Record<string, string>;
    expect(calls[0].url).toBe(`${ORIGIN}/api/v1/auth/rotate`);
    expect(headers.Authorization).toBe('Bearer tuf_old');
  });

  it('posts the pairing payload as a single JSON object', async () => {
    const body = {
      device: { id: 'a'.repeat(32), name: 'Pixel 8', platform: 'android', paired_at: 't', status: 'active' },
      token: { token: 'tuf_abc' },
    };
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse(body, 201));
    const client = new AgentClient({ origin: ORIGIN, fetchImpl });

    const response = await client.confirmPairing({ pin: '492815', name: 'Pixel 8' });

    expect(response.token.token).toBe('tuf_abc');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toContain('application/json');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ pin: '492815', name: 'Pixel 8' });
  });

  it('normalizes a trailing slash on the origin', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse({ status: 'ok' }));
    const client = new AgentClient({ origin: `${ORIGIN}/`, fetchImpl });

    await client.getHealth();

    expect(calls[0].url).toBe(`${ORIGIN}/api/v1/health`);
  });

  it('rejects a non-http origin at construction', () => {
    expect(() => new AgentClient({ origin: 'ftp://pc' })).toThrow(/invalid agent origin/);
  });
});

describe('AgentClient errors', () => {
  it('maps the agent error envelope to an http ApiError', async () => {
    const { fetchImpl } = fakeFetch(async () =>
      jsonResponse({ error: { code: 'unauthorized', message: 'invalid pairing PIN' } }, 401),
    );
    const client = new AgentClient({ origin: ORIGIN, fetchImpl });

    const error = await client
      .confirmPairing({ pin: '000000', name: 'x' })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.kind).toBe('http');
    expect(apiError.status).toBe(401);
    expect(apiError.code).toBe('unauthorized');
    expect(apiError.message).toBe('invalid pairing PIN');
  });

  it('degrades a non-envelope error body to a generic message', async () => {
    const { fetchImpl } = fakeFetch(async () => brokenJson(500));
    const client = new AgentClient({ origin: ORIGIN, fetchImpl });

    const error = (await client
      .getHealth()
      .then(() => null)
      .catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.message).toBe('Agent request failed (HTTP 500).');
  });

  it('reports unreachable agents as a network error naming the host', async () => {
    const { fetchImpl } = fakeFetch(async () => {
      throw new TypeError('Network request failed');
    });
    const client = new AgentClient({ origin: ORIGIN, fetchImpl });

    const error = (await client
      .getHealth()
      .then(() => null)
      .catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe('network');
    expect(error.message).toContain('192.168.1.104:8765');
  });

  it('aborts and reports a timeout when the agent goes quiet', async () => {
    const hangingFetch = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      })) as typeof fetch;
    const client = new AgentClient({ origin: ORIGIN, fetchImpl: hangingFetch, timeoutMs: 25 });

    const error = (await client
      .getHealth()
      .then(() => null)
      .catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe('timeout');
    expect(error.message).toContain('did not respond');
  });

  it('flags a 2xx body that is not the expected JSON', async () => {
    const okButBroken: FakeResponse = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('nope');
      },
    };
    const { fetchImpl } = fakeFetch(async () => okButBroken);
    const client = new AgentClient({ origin: ORIGIN, fetchImpl });

    const error = (await client
      .getDiscoveryInfo()
      .then(() => null)
      .catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe('protocol');
  });
});

describe('origin helpers', () => {
  it('displayOrigin strips the scheme only', () => {
    expect(displayOrigin('https://pc.local:8765')).toBe('pc.local:8765');
    expect(displayOrigin('http://192.168.1.5:8765')).toBe('192.168.1.5:8765');
  });

  it('originFromParts brackets IPv6 hosts', () => {
    expect(originFromParts('http', 'fe80::1')).toBe('http://[fe80::1]:8765');
    expect(originFromParts('https', 'pc.local', 443)).toBe('https://pc.local:443');
  });
});

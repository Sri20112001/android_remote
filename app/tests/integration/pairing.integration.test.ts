/**
 * End-to-end pairing contract test against a real agent.
 *
 * Builds `./cmd/agent` from `agent/windows`, spawns it on a private port
 * with a throwaway database, and drives the exact HTTP flow the app
 * performs: health probe → pairing start → confirm → authenticated call →
 * rotation (grace window) → revocation → rejection.
 *
 * Two vantage points matter and both are exercised:
 *   - loopback (127.0.0.1): what the PC user reaches — `/pairing/start` is
 *     loopback-only, and `RequireAuth` treats loopback as the machine's own
 *     user (no token needed there);
 *   - LAN address: what the phone reaches — feature endpoints demand a
 *     valid bearer token from this vantage point.
 *
 * The app's own `AgentClient` is used for the happy path (with a real
 * `node:http` fetch, since jest mocks the global one), so this test
 * verifies the client against the real wire contract, not a mock.
 *
 * Run with: npm run test:integration
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { mkdtempSync, rmSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';

import { AgentClient, ApiError } from '@/api/client';

const AGENT_DIR = path.resolve(__dirname, '../../../agent/windows');
const PORT = 18765;
/** Loopback origin: the PC's own vantage point (pairing administration). */
const LOCAL_ORIGIN = `http://127.0.0.1:${PORT}`;
/** LAN origin: the phone's vantage point. Resolved in `beforeAll`. */
let REMOTE_ORIGIN = '';

jest.setTimeout(180_000);

/**
 * Real HTTP over `node:http`, shaped like `fetch`.
 *
 * The jest-expo environment installs a mocked global `fetch`, which cannot
 * reach a socket. `AgentClient` takes its fetch by injection, so the test
 * feeds it this implementation and still exercises the client's real URL,
 * header, status and timeout handling.
 */
function nodeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = new URL(String(input));
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method: init?.method ?? 'GET',
        headers: (init?.headers as Record<string, string> | undefined) ?? {},
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(text) as unknown,
          } as unknown as Response);
        });
      },
    );

    request.on('error', reject);
    const signal = init?.signal;
    if (signal !== null && signal !== undefined) {
      const onAbort = () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        request.destroy();
        reject(abortError);
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    if (typeof init?.body === 'string') {
      request.write(init.body);
    }
    request.end();
  });
}

const realFetch = nodeFetch as unknown as typeof fetch;

let agent: ChildProcess | null = null;
let workDir = '';
const agentLog: string[] = [];

async function probe(origin: string): Promise<boolean> {
  try {
    const response = await realFetch(`${origin}/api/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(origin: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  let reported = false;
  while (Date.now() < deadline) {
    if (agent?.exitCode !== null && agent?.exitCode !== undefined) {
      throw new Error(`agent exited early (${agent.exitCode}):\n${agentLog.join('')}`);
    }
    try {
      const response = await realFetch(`${origin}/api/v1/health`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause);
    }
    if (!reported) {
      console.log(`[int] first health attempt failed: ${lastError}`);
      reported = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`agent never became healthy (${lastError}):\n${agentLog.join('')}`);
}

/** Raw request helper for cases the typed client does not model. */
async function call(
  origin: string,
  method: string,
  route: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const response = await realFetch(`${origin}/api/v1${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

/** Non-loopback IPv4 addresses of this machine, for the phone vantage. */
function lanCandidates(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      const family = entry.family;
      if (family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

beforeAll(async () => {
  const startedAt = Date.now();
  workDir = mkdtempSync(path.join(tmpdir(), 'tuf-int-'));
  const exe = path.join(workDir, 'tuf-remote-agent.exe');

  execFileSync('go', ['build', '-o', exe, './cmd/agent'], {
    cwd: AGENT_DIR,
    stdio: 'pipe',
  });
  console.log(`[int] build ok in ${Date.now() - startedAt}ms`);

  // Bind every interface so the test can reach the agent from a non-loopback
  // address — the vantage point a real phone uses.
  agent = spawn(exe, [], {
    cwd: workDir,
    env: {
      ...process.env,
      TUF_REMOTE_SERVER_HOST: '0.0.0.0',
      TUF_REMOTE_SERVER_PORT: String(PORT),
      TUF_REMOTE_DATABASE_PATH: path.join(workDir, 'agent.db'),
      TUF_REMOTE_LOGGING_LEVEL: 'error',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  agent.stdout?.on('data', (chunk: Buffer) => agentLog.push(chunk.toString()));
  agent.stderr?.on('data', (chunk: Buffer) => agentLog.push(chunk.toString()));
  agent.on('exit', (code, signal) => {
    agentLog.push(`[int] agent exited code=${code} signal=${signal}\n`);
  });
  console.log(`[int] spawned pid=${agent.pid} in ${Date.now() - startedAt}ms`);

  await waitForHealth(LOCAL_ORIGIN);

  // Pick the first non-loopback address that actually answers.
  for (const address of lanCandidates()) {
    const origin = `http://${address}:${PORT}`;
    if (await probe(origin)) {
      REMOTE_ORIGIN = origin;
      break;
    }
  }
  if (REMOTE_ORIGIN === '') {
    throw new Error(
      `no reachable non-loopback address (tried: ${lanCandidates().join(', ')}); ` +
        'this test needs a LAN vantage point to assert token enforcement.\n' +
        agentLog.join(''),
    );
  }

  console.log(`[int] local=${LOCAL_ORIGIN} remote=${REMOTE_ORIGIN} in ${Date.now() - startedAt}ms`);
}, 300_000);

afterAll(() => {
  if (agent?.pid !== undefined && agent.exitCode === null) {
    // /T kills the whole tree; the agent owns DB handles and listeners.
    try {
      execFileSync('taskkill', ['/PID', String(agent.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Already gone.
    }
  }
  if (workDir !== '') {
    rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  }
});

describe('agent pairing contract (end-to-end)', () => {
  let token = '';
  let deviceID = '';

  it('answers the health probe without credentials', async () => {
    const client = new AgentClient({ origin: REMOTE_ORIGIN, fetchImpl: realFetch });
    const health = await client.getHealth();

    expect(health.status).toBe('ok');
    expect(health.app_name).toBe('Remote Deck');
    expect(typeof health.version).toBe('string');
  });

  it('exposes public discovery info', async () => {
    const client = new AgentClient({ origin: REMOTE_ORIGIN, fetchImpl: realFetch });
    const info = await client.getDiscoveryInfo();

    expect(info.port).toBe(PORT);
    expect(info.tls_enabled).toBe(false);
    expect(info.hostname.length).toBeGreaterThan(0);
  });

  it('opens a pairing session on loopback and returns a 6-digit PIN', async () => {
    const started = await call(LOCAL_ORIGIN, 'POST', '/pairing/start');
    expect(started.status).toBe(201);

    const body = started.json as { session_id: string; pin: string; expires_at: string };
    expect(body.session_id.length).toBeGreaterThan(0);
    expect(body.pin).toMatch(/^\d{6}$/);
    expect(body.expires_at.length).toBeGreaterThan(0);
  });

  it('issues a device token for the correct PIN', async () => {
    const started = await call(LOCAL_ORIGIN, 'POST', '/pairing/start');
    expect(started.status).toBe(201);
    const { pin } = started.json as { pin: string };

    const client = new AgentClient({ origin: REMOTE_ORIGIN, fetchImpl: realFetch });
    const confirmed = await client.confirmPairing({
      pin,
      name: 'Integration Phone',
      model: 'Pixel 8',
      os_version: '15',
      platform: 'android',
    });

    expect(confirmed.device.name).toBe('Integration Phone');
    expect(confirmed.device.status).toBe('active');
    token = confirmed.token.token ?? '';
    deviceID = confirmed.device.id;
    expect(token.length).toBeGreaterThan(0);
    expect(deviceID.length).toBeGreaterThan(0);
  });

  it('refuses an authenticated endpoint from the network without a token', async () => {
    const anonymous = await call(REMOTE_ORIGIN, 'GET', '/monitoring/system');
    expect(anonymous.status).toBe(401);
    expect((anonymous.json as { error: { code: string } }).error.code).toBe('unauthorized');
  });

  it('accepts the issued token from the network', async () => {
    const authed = await call(REMOTE_ORIGIN, 'GET', '/monitoring/system', token);
    expect(authed.status).toBe(200);
  });

  it('rotates the token, keeping the old one alive through its grace window', async () => {
    const client = new AgentClient({ origin: REMOTE_ORIGIN, token, fetchImpl: realFetch });
    const rotated = await client.rotateToken();
    const fresh = rotated.token.token ?? '';
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh).not.toBe(token);

    // The retired token still works inside the grace window…
    const oldStillWorks = await call(REMOTE_ORIGIN, 'GET', '/monitoring/system', token);
    expect(oldStillWorks.status).toBe(200);

    // …and the fresh one works immediately.
    const newWorks = await call(REMOTE_ORIGIN, 'GET', '/monitoring/system', fresh);
    expect(newWorks.status).toBe(200);

    token = fresh;
  });

  it('revokes the device and rejects every token it held', async () => {
    const revoked = await call(LOCAL_ORIGIN, 'POST', '/pairing/revoke', undefined, {
      device_id: deviceID,
    });
    expect(revoked.status).toBe(200);

    const afterRevoke = await call(REMOTE_ORIGIN, 'GET', '/monitoring/system', token);
    expect(afterRevoke.status).toBe(401);
  });

  it('refuses a wrong PIN with the generic 401 envelope', async () => {
    const started = await call(LOCAL_ORIGIN, 'POST', '/pairing/start');
    expect(started.status).toBe(201);

    const client = new AgentClient({ origin: REMOTE_ORIGIN, fetchImpl: realFetch });
    const error = await client
      .confirmPairing({ pin: '000000', name: 'Intruder' })
      .then(() => null)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.kind).toBe('http');
    expect(apiError.status).toBe(401);
    expect(apiError.code).toBe('unauthorized');
  });
});

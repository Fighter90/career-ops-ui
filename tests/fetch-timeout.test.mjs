/**
 * v1.63.0 — scan fetch timeout. Guards that a stalled upstream can't hang
 * the scanner: `withTimeout` produces a signal that fires, and
 * `makeTimeoutFetch` rejects a never-resolving fetch instead of hanging.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, makeTimeoutFetch, DEFAULT_SCAN_TIMEOUT_MS } from '../server/lib/fetch-timeout.mjs';

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test('DEFAULT_SCAN_TIMEOUT_MS is a positive number', () => {
  assert.ok(Number.isFinite(DEFAULT_SCAN_TIMEOUT_MS) && DEFAULT_SCAN_TIMEOUT_MS > 0);
});

// v1.68.1 — default raised to 60000 (one minute). 10s (v1.67.1) failed fast
// but cut off slow-but-alive Ashby boards; user preference is to wait up to a
// minute so those return. Env-overridable via SCAN_FETCH_TIMEOUT_MS.
test('DEFAULT_SCAN_TIMEOUT_MS defaults to 60s', () => {
  if (!process.env.SCAN_FETCH_TIMEOUT_MS) {
    assert.equal(DEFAULT_SCAN_TIMEOUT_MS, 60000);
  }
});

test('withTimeout: aborts after ms with a TimeoutError', async () => {
  const { signal, clear } = withTimeout(undefined, 20);
  assert.equal(signal.aborted, false);
  await tick(40);
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason?.name, 'TimeoutError');
  clear();
});

test('withTimeout: already-aborted upstream aborts immediately', () => {
  const ac = new AbortController();
  ac.abort(new Error('client gone'));
  const { signal, clear } = withTimeout(ac.signal, 10_000);
  assert.equal(signal.aborted, true);
  clear();
});

test('withTimeout: upstream abort propagates', async () => {
  const ac = new AbortController();
  const { signal, clear } = withTimeout(ac.signal, 10_000);
  assert.equal(signal.aborted, false);
  ac.abort(new Error('client disconnect'));
  await tick(5);
  assert.equal(signal.aborted, true);
  clear();
});

test('withTimeout: clear() cancels the pending timeout', async () => {
  const { signal, clear } = withTimeout(undefined, 20);
  clear();
  await tick(40);
  assert.equal(signal.aborted, false); // timer was cleared → never fired
});

test('makeTimeoutFetch: rejects a never-resolving fetch (no hang)', async () => {
  // base fetch that only settles when its signal aborts — i.e. a stalled upstream
  const stalledFetch = (_url, { signal } = {}) =>
    new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true });
    });
  const tFetch = makeTimeoutFetch(stalledFetch, 25);
  await assert.rejects(
    tFetch('https://example.test/stall'),
    (err) => err?.name === 'TimeoutError',
  );
});

test('makeTimeoutFetch: passes through a fast response and clears the timer', async () => {
  const okFetch = async () => ({ ok: true, status: 200 });
  const tFetch = makeTimeoutFetch(okFetch, 1000);
  const res = await tFetch('https://example.test/ok');
  assert.equal(res.status, 200);
});

// ── a spent timeout is not retried (upstream #6132, composed) ────────────────
// The scanners inject makeTimeoutFetch as their fetchImpl. When the deadline
// fires, the retry helpers in http-json.mjs must NOT re-run the request: one
// hung board used to cost three full timeouts (about 94s upstream for Ashby's
// 30s budget × 2 retries).
test('fetchJsonWithRetry(makeTimeoutFetch(hung)) makes exactly ONE attempt', async () => {
  const { fetchJsonWithRetry } = await import('../server/lib/http-json.mjs');
  let attempts = 0;
  // Base fetch that only settles when its signal aborts — a stalled upstream.
  const stalledFetch = (_url, { signal } = {}) =>
    new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => { attempts += 1; reject(signal.reason || new Error('aborted')); }, { once: true });
    });
  const t0 = Date.now();
  await assert.rejects(
    () => fetchJsonWithRetry(makeTimeoutFetch(stalledFetch, 60), 'https://example.test/jobs', { retries: 2, retryDelayMs: 5, maxDelayMs: 5 }),
    (err) => err?.name === 'TimeoutError',
  );
  const ms = Date.now() - t0;
  assert.equal(attempts, 1, 'one attempt — a retry would spend the same budget again');
  assert.ok(ms < 2000, `must fail fast on the first deadline, took ${ms}ms`);
});

// ── #6580 / parent — the default budget is read PER REQUEST ─────────────────
// The scanner module is imported before the server's loadEnvFile() runs, so a
// module-load read of the env var misses every .env value. The budget must be
// resolved when the request starts. CAREER_OPS_HTTP_TIMEOUT_MS is the parent's
// documented name; SCAN_FETCH_TIMEOUT_MS stays as the legacy web-ui fallback.

import { resolveDefaultTimeoutMs, makeTimeoutFetch as mtf } from '../server/lib/fetch-timeout.mjs';

const stalledFetch = (_url, { signal } = {}) =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true });
  });

const withEnv = async (vars, fn) => {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  // process.env coerces assignments — `undefined` must DELETE the key, not
  // set the string "undefined".
  const set = (k, v) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
  try {
    for (const [k, v] of Object.entries(vars)) set(k, v);
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) set(k, v);
  }
};

test('resolveDefaultTimeoutMs: unusable env values fall back, bounds are inclusive', () => {
  for (const bad of [undefined, null, '', '   ', 'abc', '0', '-5', 'Infinity', 'NaN', '0.5', '2147483648']) {
    assert.equal(resolveDefaultTimeoutMs(bad, 60000), 60000, `value: ${JSON.stringify(bad)}`);
  }
  assert.equal(resolveDefaultTimeoutMs('1', 60000), 1);
  assert.equal(resolveDefaultTimeoutMs('300', 60000), 300);
  assert.equal(resolveDefaultTimeoutMs('2147483647', 60000), 2147483647);
});

test('CAREER_OPS_HTTP_TIMEOUT_MS set AFTER import reaches the request budget', async () => {
  await withEnv({ CAREER_OPS_HTTP_TIMEOUT_MS: '300', SCAN_FETCH_TIMEOUT_MS: undefined }, async () => {
    const t0 = Date.now();
    await assert.rejects(
      mtf(stalledFetch)('https://example.test/stall'),
      (err) => err?.name === 'TimeoutError',
    );
    const elapsed = Date.now() - t0;
    assert.ok(elapsed >= 250, `must wait out the env budget before aborting (took ${elapsed}ms)`);
    assert.ok(elapsed < 5000, `per-request env read — not the 60s module default (took ${elapsed}ms)`);
  });
});

test('CAREER_OPS_HTTP_TIMEOUT_MS takes precedence over SCAN_FETCH_TIMEOUT_MS', async () => {
  await withEnv({ CAREER_OPS_HTTP_TIMEOUT_MS: '200', SCAN_FETCH_TIMEOUT_MS: '3000' }, async () => {
    const t0 = Date.now();
    await assert.rejects(mtf(stalledFetch)('https://example.test/stall'), (err) => err?.name === 'TimeoutError');
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 2000, `parent's var wins — abort near 200ms, not 3000 (took ${elapsed}ms)`);
  });
});

test('SCAN_FETCH_TIMEOUT_MS (legacy web-ui name) is still honored per request', async () => {
  await withEnv({ CAREER_OPS_HTTP_TIMEOUT_MS: undefined, SCAN_FETCH_TIMEOUT_MS: '200' }, async () => {
    const t0 = Date.now();
    await assert.rejects(mtf(stalledFetch)('https://example.test/stall'), (err) => err?.name === 'TimeoutError');
    const elapsed = Date.now() - t0;
    assert.ok(elapsed >= 150 && elapsed < 2000, `abort near 200ms (took ${elapsed}ms)`);
  });
});

// ── #6582 / parent — a per-call timeoutMs overrides the wrapper's budget ────
test('opts.timeoutMs wins over the wrapper default and over the env budget', async () => {
  await withEnv({ CAREER_OPS_HTTP_TIMEOUT_MS: '5000' }, async () => {
    const t0 = Date.now();
    await assert.rejects(
      mtf(stalledFetch)('https://example.test/stall', { timeoutMs: 30 }),
      (err) => err?.name === 'TimeoutError',
    );
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 2000, `the per-call value won (took ${elapsed}ms)`);
  });
});

test('an unusable opts.timeoutMs falls back to the wrapper budget', async () => {
  for (const bad of [0, 'abc', 1.5, 2147483648, null]) {
    const t0 = Date.now();
    await assert.rejects(
      mtf(stalledFetch, 30)('https://example.test/stall', { timeoutMs: bad }),
      (err) => err?.name === 'TimeoutError',
    );
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 2000, `${String(bad)} ignored — wrapper 30ms won (took ${elapsed}ms)`);
  }
});

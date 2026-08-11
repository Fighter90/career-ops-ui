/**
 * Tests for the shared JSON-over-fetch helper + abort-aware delay
 * (v1.75.1 robustness polish on the v1.75.0 config-driven sources).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, fetchJsonWithRetry, delay } from '../server/lib/http-json.mjs';

test('fetchJson: returns parsed JSON on 2xx', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ a: 1 }) });
  assert.deepEqual(await fetchJson(fake, 'https://x/api'), { a: 1 });
});

test('fetchJson: throws with .status on non-ok', async () => {
  const fake = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchJson(fake, 'https://x/api'), (e) => e.status === 503 && /503/.test(e.message));
});

test('fetchJson: non-JSON 2xx surfaces a descriptive error, not a bare SyntaxError', async () => {
  const fake = async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  await assert.rejects(
    () => fetchJson(fake, 'https://x/api'),
    (e) => /non-JSON 2xx response from https:\/\/x\/api/.test(e.message),
  );
});

test('fetchJson: forwards method/body/headers/redirect to fetchImpl', async () => {
  let seen;
  const fake = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({}) }; };
  await fetchJson(fake, 'https://x/api', { method: 'POST', body: '{}', headers: { a: 'b' } });
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.body, '{}');
  assert.equal(seen.opts.redirect, 'error');
  assert.equal(seen.opts.headers.a, 'b');
});

test('delay: resolves after the timeout when not aborted', async () => {
  const t0 = process.hrtime.bigint();
  await delay(20);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms >= 15, `expected ≥~20ms, got ${ms}`);
});

test('delay: resolves immediately when the signal is already aborted', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  const t0 = process.hrtime.bigint();
  await delay(5000, ctrl.signal); // would hang the test if it actually waited
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 100, `expected immediate, got ${ms}`);
});

test('delay: resolves promptly when aborted mid-wait', async () => {
  const ctrl = new AbortController();
  const t0 = process.hrtime.bigint();
  const p = delay(5000, ctrl.signal);
  setTimeout(() => ctrl.abort(), 10);
  await p;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 500, `expected to unblock on abort, got ${ms}`);
});

test('delay: zero/negative ms is a no-op', async () => {
  await delay(0);
  await delay(-5);
});

// --- fetchJsonWithRetry (parent #2506 — transient-failure retry) ------------

test('fetchJsonWithRetry: returns immediately on first success (no retries used)', async () => {
  let calls = 0;
  const fake = async () => { calls += 1; return { ok: true, json: async () => ({ a: 1 }) }; };
  assert.deepEqual(await fetchJsonWithRetry(fake, 'https://x/api', { retryDelayMs: 0 }), { a: 1 });
  assert.equal(calls, 1);
});

test('fetchJsonWithRetry: retries a transient 503 then succeeds', async () => {
  let calls = 0;
  const fake = async () => {
    calls += 1;
    return calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ ok: 1 }) };
  };
  assert.deepEqual(await fetchJsonWithRetry(fake, 'https://x/api', { retries: 2, retryDelayMs: 0 }), { ok: 1 });
  assert.equal(calls, 2);
});

test('fetchJsonWithRetry: retries a network error (no .status) then succeeds', async () => {
  let calls = 0;
  const fake = async () => {
    calls += 1;
    if (calls === 1) throw new Error('ECONNRESET'); // transient, no HTTP status
    return { ok: true, json: async () => ({ ok: 1 }) };
  };
  assert.deepEqual(await fetchJsonWithRetry(fake, 'https://x/api', { retries: 2, retryDelayMs: 0 }), { ok: 1 });
  assert.equal(calls, 2);
});

test('fetchJsonWithRetry: does NOT retry a permanent 404 — throws on the first attempt', async () => {
  let calls = 0;
  const fake = async () => { calls += 1; return { ok: false, status: 404 }; };
  await assert.rejects(() => fetchJsonWithRetry(fake, 'https://x/api', { retries: 3, retryDelayMs: 0 }), /HTTP 404/);
  assert.equal(calls, 1);
});

test('fetchJsonWithRetry: does NOT retry a refused redirect (deterministic, #2657)', async () => {
  let calls = 0;
  const fake = async () => {
    calls += 1;
    // shape undici throws for `fetch(url, { redirect: 'error' })` meeting a 3xx
    const err = new TypeError('fetch failed');
    err.cause = new Error('unexpected redirect');
    throw err;
  };
  await assert.rejects(() => fetchJsonWithRetry(fake, 'https://x/api', { retries: 3, retryDelayMs: 0 }), TypeError);
  assert.equal(calls, 1); // refused redirect is non-retryable — one attempt only
});

test('fetchJsonWithRetry: a plain network TypeError (no redirect cause) is still retried', async () => {
  let calls = 0;
  const fake = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('network error'); // no .cause → transient
    return { ok: true, json: async () => ({ ok: 1 }) };
  };
  assert.deepEqual(await fetchJsonWithRetry(fake, 'https://x/api', { retries: 2, retryDelayMs: 0 }), { ok: 1 });
  assert.equal(calls, 2);
});

test('fetchJsonWithRetry: propagates the last error after exhausting retries', async () => {
  let calls = 0;
  const fake = async () => { calls += 1; return { ok: false, status: 502 }; };
  await assert.rejects(() => fetchJsonWithRetry(fake, 'https://x/api', { retries: 2, retryDelayMs: 0 }), /HTTP 502/);
  assert.equal(calls, 3); // initial + 2 retries
});

test('fetchJsonWithRetry: stops retrying once the signal is aborted', async () => {
  const ctrl = new AbortController();
  let calls = 0;
  const fake = async () => { calls += 1; ctrl.abort(); return { ok: false, status: 500 }; };
  await assert.rejects(() => fetchJsonWithRetry(fake, 'https://x/api', { retries: 3, retryDelayMs: 0, signal: ctrl.signal }), /HTTP 500/);
  assert.equal(calls, 1); // aborted after the first attempt — no further tries
});

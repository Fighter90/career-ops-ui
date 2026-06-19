/**
 * Tests for the shared JSON-over-fetch helper + abort-aware delay
 * (v1.75.1 robustness polish on the v1.75.0 config-driven sources).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, delay } from '../server/lib/http-json.mjs';

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

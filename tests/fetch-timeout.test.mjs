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

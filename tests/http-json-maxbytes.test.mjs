/**
 * CAR-264 (parent parity, providers/_http.mjs) — the per-call body ceiling
 * (`opts.maxBytes`) on the scanner JSON transport, and the non-retryable
 * classification of a refused body.
 *
 * The parent's scanner transport caps every board response (10 MB default)
 * and refuses a bigger body with a `response_too_large` error; greenhouse's
 * oversized-board fallback (parent #6673) keys on that refusal. web-ui opts
 * in per call, so the historic uncapped read stays the default for every
 * other consumer. CI-isolated: real `Response` objects, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, fetchJsonWithRetry } from '../server/lib/http-json.mjs';

test('fetchJson: a body over opts.maxBytes is refused with response_too_large', async () => {
  const big = 'x'.repeat(4096);
  const impl = async () => new Response(JSON.stringify({ jobs: [big] }));
  await assert.rejects(
    () => fetchJson(impl, 'https://example.com/board', { maxBytes: 1024 }),
    (e) => e.code === 'response_too_large' && e.maxBytes === 1024,
  );
});

test('fetchJson: a body under the cap parses normally through the capped path', async () => {
  const impl = async () => new Response(JSON.stringify({ jobs: [1, 2] }));
  const data = await fetchJson(impl, 'https://example.com/board', { maxBytes: 1024 });
  assert.deepEqual(data, { jobs: [1, 2] });
});

test('fetchJson: capped path still wraps a non-JSON 2xx like the uncapped path', async () => {
  const impl = async () => new Response('<html>oops</html>');
  await assert.rejects(
    () => fetchJson(impl, 'https://example.com/board', { maxBytes: 1024 }),
    /non-JSON 2xx/,
  );
});

test('fetchJson: a declared content-length over the cap refuses before reading the body', async () => {
  let read = false;
  const res = {
    ok: true,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-length' ? '99999999' : null) },
    json: async () => { read = true; return {}; },
  };
  await assert.rejects(
    () => fetchJson(async () => res, 'https://example.com/board', { maxBytes: 1024 }),
    (e) => e.code === 'response_too_large',
  );
  assert.equal(read, false, 'body must not be read when content-length already exceeds the cap');
});

test('fetchJson: no maxBytes keeps the historic uncapped path (plain stub still works)', async () => {
  const impl = async () => ({ ok: true, json: async () => ({ jobs: [] }) });
  assert.deepEqual(await fetchJson(impl, 'https://example.com/board'), { jobs: [] });
});

test('fetchJson: an invalid maxBytes is refused, never silently disabling the cap', async () => {
  for (const bad of [0, -1, 'x', Number.NaN]) {
    await assert.rejects(
      () => fetchJson(async () => ({ ok: true, json: async () => ({}) }), 'https://example.com/board', { maxBytes: bad }),
      /maxBytes/,
    );
  }
});

test('fetchJsonWithRetry: a response_too_large body is deterministic — not retried', async () => {
  let calls = 0;
  const impl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ jobs: ['x'.repeat(4096)] }));
  };
  await assert.rejects(
    () => fetchJsonWithRetry(impl, 'https://example.com/board', { maxBytes: 1024, sleep: async () => {} }),
    (e) => e.code === 'response_too_large',
  );
  assert.equal(calls, 1, 'the same response would be refused again — a retry only downloads the oversize body twice');
});

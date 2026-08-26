/**
 * v1.221.0 — DNS-rebinding defence-in-depth on the scanner fetch path.
 *
 * `http-json.mjs`'s fetchJson/fetchText resolve the URL's hostname on the REAL
 * network path and reject a private/loopback/cloud-metadata address before the
 * fetch. A test's injected `fetchImpl` (≠ global fetch) is never resolved, so the
 * mocked source suites are unaffected. CI-isolated: no outbound network — the
 * numeric-IP cases resolve to themselves and the mock case never touches DNS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, fetchText } from '../server/lib/http-json.mjs';

test('real fetch to a loopback host is blocked before connecting', async () => {
  await assert.rejects(
    () => fetchJson(globalThis.fetch, 'http://127.0.0.1:59999/x'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS' && e.address === '127.0.0.1',
  );
});

test('real fetch to the cloud-metadata / link-local range is blocked', async () => {
  await assert.rejects(
    () => fetchText(globalThis.fetch, 'http://169.254.169.254/latest/meta-data/'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS',
  );
  await assert.rejects(
    () => fetchJson(globalThis.fetch, 'http://10.0.0.5/x'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS',
  );
});

test('an injected mock fetchImpl skips the guard entirely (mocked suites unaffected)', async () => {
  const mock = async () => ({ ok: true, json: async () => ({ ok: 1 }), text: async () => 'ok' });
  assert.deepEqual(await fetchJson(mock, 'http://127.0.0.1:1/x'), { ok: 1 });
  assert.equal(await fetchText(mock, 'http://169.254.169.254/x'), 'ok');
});

test('a malformed URL is left for fetch to surface, not turned into a BLOCKED error', async () => {
  // guardResolvedHost returns early on an unparseable URL; the mock still answers.
  const mock = async () => ({ ok: true, json: async () => ({ ok: 1 }) });
  assert.deepEqual(await fetchJson(mock, 'not a url'), { ok: 1 });
});

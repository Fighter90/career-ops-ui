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
import { fetchJson, fetchText, guardResolvedHost, _setGuardLookup } from '../server/lib/http-json.mjs';

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

// ─── IPv6 literals (CAR-90) ────────────────────────────────────────
// `new URL(u).hostname` keeps the brackets, `dns.lookup('[::1]')` throws
// ENOTFOUND, and the old guard's `catch { return; }` FAILED OPEN — so fetch
// connected straight to the loopback / cloud-metadata address the guard
// exists to refuse. A literal IP needs no DNS at all: classify it directly.

test('an IPv6 loopback literal is blocked before connecting', async () => {
  await assert.rejects(
    () => guardResolvedHost(globalThis.fetch, 'http://[::1]:59999/x'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS' && e.address === '::1',
  );
});

test('IPv4-mapped IPv6 literals naming the cloud-metadata endpoint are blocked', async () => {
  // new URL() normalises the dotted form to hex: hostname `[::ffff:a9fe:a9fe]`.
  await assert.rejects(
    () => guardResolvedHost(globalThis.fetch, 'http://[::ffff:169.254.169.254]/latest/meta-data/'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS' && e.address === '::ffff:a9fe:a9fe',
  );
});

test('an IPv6 unique-local-address literal (AWS IMDSv6) is blocked', async () => {
  await assert.rejects(
    () => guardResolvedHost(globalThis.fetch, 'http://[fd00:ec2::254]/x'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS',
  );
});

test('a public IPv6 literal passes the guard without a DNS round-trip', async () => {
  // 2606:4700:4700::1111 is a public Cloudflare resolver address; a literal
  // needs no resolution, so the guard must return (never throw) for it.
  await guardResolvedHost(globalThis.fetch, 'http://[2606:4700:4700::1111]/x');
});

// ─── FULL-M2 — the guard must fail CLOSED on a resolver error ───────
// `catch { return; }` let a hostile resolver WIN the TOCTOU race by failing
// the GUARD's lookup and answering a private address on fetch's own second
// lookup — the one bypass the resolve-time check exists to close. A resolver
// error here is either a stub, an outage, or an attack; safe-fetch.mjs'
// resolvePinned already fails closed for the same reason.

test('a resolver error fails the guard CLOSED (hostile-resolver TOCTOU, FULL-M2)', async () => {
  const undoLookup = _setGuardLookup(async () => {
    const err = new Error('getaddrinfo EAI_AGAIN hostile.example');
    err.code = 'EAI_AGAIN';
    throw err;
  });
  try {
    await assert.rejects(
      () => guardResolvedHost(globalThis.fetch, 'https://hostile.example/search'),
      (e) => e.code === 'ECAREEROPS_BLOCKED_DNS' && e.ssrfRefused === true && e.hostname === 'hostile.example',
    );
  } finally { undoLookup(); }
});

test('the guard still passes a public hostname through the injected resolver', async () => {
  const undoLookup = _setGuardLookup(async () => [{ address: '93.184.216.34', family: 4 }]);
  try {
    await guardResolvedHost(globalThis.fetch, 'https://public.example/search');
  } finally { undoLookup(); }
});

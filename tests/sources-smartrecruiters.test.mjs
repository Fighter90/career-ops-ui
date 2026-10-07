/**
 * SmartRecruiters source — Phase-2 (v1.242.0) correctness.
 *
 * Covers what smartrecruiters-pagination.test.mjs does not: the SSRF guard,
 * the shape contract (a 200 with the wrong envelope THROWS on page 1), and
 * the partials contract (a later-page failure keeps what was collected).
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchSmartRecruiters,
  assertSmartRecruitersUrl,
  SMARTRECRUITERS_API_HOST,
  meta,
} from '../server/lib/sources/smartrecruiters.mjs';

const API = `https://${SMARTRECRUITERS_API_HOST}/v1/companies/Foo/postings`;

const page = (n, count, total) => ({
  offset: n * 100,
  totalFound: total ?? count,
  content: Array.from({ length: count }, (_, i) => ({
    id: `${n}-${i}`, name: `Role ${n}-${i}`, company: { name: 'Foo' }, ref: `https://r/${n}-${i}`,
  })),
});

/** Transport serving whole JSON bodies per offset; records calls.
 *  Returns `{ impl, calls }` so a typo can never fall back to global fetch. */
function jsonTransport(bodies) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const offset = Number((url.match(/[?&]offset=(\d+)/) || [])[1] || 0);
    const entry = bodies.find((b) => b.offset === offset) ?? bodies[bodies.length - 1];
    const payload = entry && entry.body !== undefined ? entry.body : entry;
    if (payload instanceof Error) throw payload;
    if (entry && entry.body === undefined && typeof entry.status === 'number') {
      return { ok: false, status: entry.status };
    }
    return { ok: true, status: 200, json: async () => payload };
  };
  return { impl, calls };
}

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'smartrecruiters', label: 'SmartRecruiters', region: 'en' });
});

// ── SSRF guard ────────────────────────────────────────────────────────

test('assertSmartRecruitersUrl pins https + api.smartrecruiters.com exactly', () => {
  assert.equal(assertSmartRecruitersUrl(API), API);
  assert.equal(SMARTRECRUITERS_API_HOST, 'api.smartrecruiters.com');
  assert.throws(() => assertSmartRecruitersUrl('http://api.smartrecruiters.com/v1/companies/Foo/postings'), /HTTPS/);
  assert.throws(() => assertSmartRecruitersUrl('https://api.smartrecruiters.com.evil.test/v1/companies/Foo/postings'), /untrusted hostname/);
  assert.throws(() => assertSmartRecruitersUrl('https://evil.test/v1/companies/Foo/postings'), /untrusted hostname/);
  assert.throws(() => assertSmartRecruitersUrl('https://jobs.smartrecruiters.com/Foo'), /untrusted hostname/);
  assert.throws(() => assertSmartRecruitersUrl('not a url'), /invalid URL/);
});

test('fetchSmartRecruiters: guard fires before any I/O on an untrusted URL', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; };
  await assert.rejects(
    () => fetchSmartRecruiters('https://evil.test/v1/companies/Foo/postings', { fetchImpl }),
    /untrusted hostname/,
  );
  await assert.rejects(
    () => fetchSmartRecruiters('http://api.smartrecruiters.com/v1/companies/Foo/postings', { fetchImpl }),
    /HTTPS/,
  );
  assert.equal(called, false, 'no request may leave for an untrusted URL');
});

// ── Shape contract (Phase 2): a wrong-shape 200 THROWS on page 1 ─────

test('page-1 200 with a malformed envelope throws instead of reading as an empty board', async () => {
  for (const body of [{}, { content: null }, { content: 'nope' }, null, [1, 2], 'garbage']) {
    const t = jsonTransport([{ offset: 0, body }]);
    await assert.rejects(
      () => fetchSmartRecruiters(API, { fetchImpl: t.impl }),
      (err) => !/HTTP \d/.test(err.message),
      `expected a shape error for ${JSON.stringify(body)}, got a transport/other error`,
    );
    assert.equal(t.calls.length, 1, JSON.stringify(body));
  }
});

test('a healthy empty board ({ content: [] }) still reads as []', async () => {
  const t = jsonTransport([page(0, 0)]);
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl });
  assert.deepEqual(jobs, []);
});

// ── Partials contract: later-page failure keeps what was collected ───

test('a later-page transport failure keeps the first page\'s partials', async () => {
  const t = jsonTransport([page(0, 100, 250), { offset: 100, status: 503 }]);
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl });
  assert.equal(jobs.length, 100, 'page-1 partials must not be discarded');
  assert.equal(t.calls.length, 2);
});

test('a later-page wrong-shape 200 keeps the partials too', async () => {
  const t = jsonTransport([page(0, 100, 250), { offset: 100, body: '<html>challenge</html>' }]);
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl });
  assert.equal(jobs.length, 100);
});

// ── Transport hardening ───────────────────────────────────────────────

test('every request is made with redirect:error', async () => {
  const t = jsonTransport([page(0, 1)]);
  await fetchSmartRecruiters(API, { fetchImpl: t.impl });
  assert.ok(t.calls.length >= 1);
  assert.ok(t.calls.every((c) => c.init && c.init.redirect === 'error'));
});

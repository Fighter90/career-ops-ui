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
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl, sleep: async () => {} });
  assert.equal(jobs.length, 100, 'page-1 partials must not be discarded');
  // Parent #6799 — a transient failure (429/5xx/network) is retried
  // SR_RETRIES times inside the walk before the partials are kept: the
  // failing page is asked 1 + SR_RETRIES times, never fewer.
  assert.equal(t.calls.length, 2 + 3, 'the 503 page is retried 3 times before the partials are kept');
});

test('a permanent 4xx is NOT retried — one request per page', async () => {
  const t = jsonTransport([page(0, 100, 250), { offset: 100, status: 404 }]);
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl });
  assert.equal(jobs.length, 100);
  assert.equal(t.calls.length, 2, 'a deterministic 4xx rethrows on the first attempt');
});

test('a transient page-1 failure is retried, then throws (dead-board contract)', async () => {
  const t = jsonTransport([{ offset: 0, status: 503 }]);
  await assert.rejects(() => fetchSmartRecruiters(API, { fetchImpl: t.impl, sleep: async () => {} }));
  assert.equal(t.calls.length, 1 + 3, 'the 503 first page is retried 3 times, then the board throws');
});

test('a transient failure that recovers does not lose the page', async () => {
  // Page 2 answers 503 twice, then succeeds: the walk continues past it.
  let page2Attempts = 0;
  const impl = async (url) => {
    const offset = Number((url.match(/[?&]offset=(\d+)/) || [])[1] || 0);
    if (offset === 0) return { ok: true, status: 200, json: async () => page(0, 100, 140) };
    if (offset === 100) {
      page2Attempts += 1;
      if (page2Attempts <= 2) return { ok: false, status: 503 };
      return { ok: true, status: 200, json: async () => page(1, 40, 140) };
    }
    return { ok: true, status: 200, json: async () => page(2, 0, 140) };
  };
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: impl, sleep: async () => {} });
  assert.equal(jobs.length, 140);
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

// ── Parent #6799: opt-in max_pages raise + page-cap truncation reporting ────

test('resolveMaxPages: default, opt-in raise, hard ceiling, junk refused', async () => {
  const { resolveMaxPages, SR_HARD_MAX_PAGES } = await import('../server/lib/sources/smartrecruiters.mjs');
  assert.equal(SR_HARD_MAX_PAGES, 100);
  assert.equal(resolveMaxPages({}), 30, 'no max_pages → the 30-page default');
  assert.equal(resolveMaxPages(undefined), 30);
  assert.equal(resolveMaxPages({ max_pages: 60 }), 60, 'a positive integer raises the cap');
  assert.equal(resolveMaxPages({ max_pages: 99999 }), 100, 'raised above the ceiling is clamped to SR_HARD_MAX_PAGES');
  assert.equal(resolveMaxPages({ max_pages: 0 }), 30);
  assert.equal(resolveMaxPages({ max_pages: -5 }), 30);
  assert.equal(resolveMaxPages({ max_pages: 2.5 }), 30);
  assert.equal(resolveMaxPages({ max_pages: '60' }), 30, 'a non-integer is refused, not coerced');
});

test('an endless board truncated at the default cap warns and carries the canonical truncated tag', async () => {
  // 40 full pages, NO totalFound in the envelope: the walk stops at the
  // 30-page default with postings still unread and "total unknown".
  const bodies = Array.from({ length: 40 }, (_, n) => ({
    offset: n * 100,
    content: Array.from({ length: 100 }, (_, i) => ({
      id: `${n}-${i}`, name: `Role ${n}-${i}`, company: { name: 'Bosch' }, ref: `https://r/${n}-${i}`,
    })),
  }));
  const t = jsonTransport(bodies);
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  try {
    const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl, sleep: async () => {}, company: { name: 'Bosch', max_pages: undefined } });
    assert.equal(jobs.length, 3000);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /Bosch truncated at max_pages=30 \(3000 jobs fetched, total unknown\)/);
    assert.match(warns[0], /raise max_pages on this entry for more \(up to 100\)/);
    // Canonical shape read by board-truncation.mjs: reason page-cap, fetched
    // 3000, no total (the API never reported one).
    assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: 3000 });
  } finally {
    console.error = origErr;
  }
});

test('a raised max_pages reads past the default cap; a total past the fetched set is truncation too', async () => {
  const t = jsonTransport(Array.from({ length: 60 }, (_, n) => page(n, 100, 6500)));
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  try {
    const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl, sleep: async () => {}, company: { name: 'Big', max_pages: 60 } });
    assert.equal(jobs.length, 6000, 'the opt-in raise walks past the 30-page default');
    assert.equal(t.calls.length, 60);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /Big truncated at max_pages=60 \(6000 of 6500 jobs\)/);
    assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: 6000, total: 6500 });
  } finally {
    console.error = origErr;
  }
});

test('no truncation warning when the walk ends naturally before the cap', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  const cases = [
    // Total reached within the cap.
    () => jsonTransport([page(0, 100, 250), page(1, 100, 250), page(2, 50, 250)]),
    // Empty page ends the walk with the total still pending.
    () => jsonTransport([page(0, 100, 300), page(1, 0, 300)]),
  ];
  try {
    for (const make of cases) {
      warns.length = 0;
      const t = make();
      const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl, sleep: async () => {} });
      assert.equal(warns.length, 0, 'a natural end is not a truncation');
      assert.equal(jobs.truncated, undefined);
    }
  } finally {
    console.error = origErr;
  }
});

test('pages of a raised walk are paced', async () => {
  const bodies = [
    { offset: 0, content: Array.from({ length: 100 }, (_, i) => ({ id: `0-${i}`, name: `R0-${i}`, ref: `https://r/0-${i}` })) },
    { offset: 100, content: Array.from({ length: 100 }, (_, i) => ({ id: `1-${i}`, name: `R1-${i}`, ref: `https://r/1-${i}` })) },
    { offset: 200, content: [] },
  ];
  const t = jsonTransport(bodies);
  const slept = [];
  const jobs = await fetchSmartRecruiters(API, { fetchImpl: t.impl, sleep: async (ms) => slept.push(ms) });
  assert.equal(jobs.length, 200);
  assert.deepEqual(slept, [250, 250], 'every page after the first waits SR_INTER_PAGE_DELAY_MS');
});

// ── Parent #6936: the posting's ATS-native listingIdentity ──────────────────

test('a string payload id becomes the listingIdentity; raw ids never leak', async () => {
  const { smartRecruitersListingIdentity } = await import('../server/lib/sources/smartrecruiters.mjs');
  const t = jsonTransport([{ offset: 0, totalFound: 1, content: [{ id: '744000012345678', name: 'Staff Engineer', ref: `https://r/744000012345678` }] }]);
  const [row] = await fetchSmartRecruiters(API, { fetchImpl: t.impl });
  assert.deepEqual(row.listingIdentity, { ats_provider: 'smartrecruiters', board_slug: 'Foo', posting_id: '744000012345678' });
  assert.ok(!('postingId' in row), 'the internal postingId never reaches a Job row');

  // The board slug comes from the configured endpoint path, not the posting URL.
  const pinned = jsonTransport([{ offset: 0, totalFound: 1, content: [{ id: '42', name: 'Role', ref: 'https://r/42' }] }]);
  const [p] = await fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/Continental/postings', { fetchImpl: pinned.impl });
  assert.deepEqual(p.listingIdentity, { ats_provider: 'smartrecruiters', board_slug: 'Continental', posting_id: '42' });

  // No usable id → no identity, so the scan falls back to URL dedup.
  const unusable = jsonTransport([{ offset: 0, totalFound: 3, content: [
    { name: 'No id', ref: 'https://api.smartrecruiters.com/v1/companies/foo/postings/1' },
    { id: ' 7 ', name: 'Padded id' },
    { id: 'a\u0007b', name: 'Control in id' },
  ] }]);
  const rows = await fetchSmartRecruiters(API, { fetchImpl: unusable.impl });
  assert.equal(rows.length, 3);
  assert.ok(rows.every((j) => !('listingIdentity' in j)));

  // A numeric payload id keeps its URL/row id but gets no identity (never coerced).
  const numeric = jsonTransport([{ offset: 0, totalFound: 1, content: [{ id: 1, name: 'Numeric id' }] }]);
  const [n] = await fetchSmartRecruiters(API, { fetchImpl: numeric.impl });
  assert.ok(!('listingIdentity' in n));
  assert.equal(n.url, 'https://jobs.smartrecruiters.com/Foo/1-numeric-id');

  // The helper itself refuses an incomplete triple.
  assert.equal(smartRecruitersListingIdentity('', '1'), undefined);
  assert.equal(smartRecruitersListingIdentity(null, '1'), undefined);
  assert.equal(smartRecruitersListingIdentity('acme', 1), undefined);
  assert.equal(smartRecruitersListingIdentity('acme', ''), undefined);
  assert.equal(smartRecruitersListingIdentity('acme', 'ok')?.posting_id, 'ok');
});

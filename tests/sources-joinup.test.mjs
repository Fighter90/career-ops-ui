/**
 * joinup.ch source + adapter — CI-isolated tests (fake fetchImpl, no network,
 * no parent-project dependency). Parent career-ops `providers/joinup.mjs`
 * parity: joinup server-renders the newest results page into __NEXT_DATA__, so
 * the parser must FAIL CLOSED on both a missing and an unparseable payload — a
 * silent zero would look like an empty board and quietly drop the source from
 * every scan. Also covers hostname-anchored detection, redirect:'error', the
 * ISO/epoch `created` handling, and slug/title filtering.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toEpochMs,
  normalizeJoinupHit,
  parseJoinupHtml,
  assertJoinupUrl,
  fetchJoinup,
  BROWSE_URL,
  JOINUP_HOST_RE,
  meta,
} from '../server/lib/sources/joinup.mjs';
import { joinupAdapter } from '../server/lib/portals/adapters/joinup.mjs';

// --- fixtures ---------------------------------------------------------------

const nextWith = (hits) => ({
  props: { pageProps: { serverState: { initialResults: { jobs: { results: [{ hits }] } } } } },
});

const htmlFor = (nextData) =>
  `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;

const hit = {
  title: 'Head of Finance',
  startup: 'Acme',
  slug: 'acme-head-of-finance',
  location: 'Zurich',
  created: '2026-01-02',
};

// A Response-like fake that records what fetchText passed through.
function fakeFetch(body, capture) {
  return async (url, opts) => {
    if (capture) { capture.url = url; capture.opts = opts; }
    return { ok: true, status: 200, text: async () => body };
  };
}

// ---------------------------------------------------------------------------
// meta + adapter surface: host-detected, host-pinned
// ---------------------------------------------------------------------------

test('meta: id/label/region + BROWSE_URL + adapter.id', () => {
  assert.equal(meta.value, 'joinup');
  assert.equal(meta.label, 'JOINUP');
  assert.equal(meta.region, 'en');
  assert.equal(BROWSE_URL, 'https://joinup.ch/browse/jobs');
  assert.equal(joinupAdapter.id, 'joinup');
  assert.equal(joinupAdapter.label, 'JOINUP');
  assert.equal(joinupAdapter.fetch, fetchJoinup);
});

test('adapter: matches a joinup.ch careers_url; buildEndpoint returns BROWSE_URL', () => {
  assert.ok(joinupAdapter.matches({ careers_url: 'https://joinup.ch/browse/jobs' }));
  assert.ok(joinupAdapter.matches({ careers_url: 'https://www.joinup.ch/anything' })); // subdomain
  assert.equal(joinupAdapter.buildEndpoint({ careers_url: 'https://joinup.ch/browse/jobs' }), BROWSE_URL);
});

test('adapter: rejects path-spoofed / off-host / empty (SSRF), buildEndpoint → null', () => {
  assert.equal(joinupAdapter.matches({ careers_url: 'https://evil.example/joinup.ch' }), false);
  assert.equal(joinupAdapter.matches({ careers_url: 'https://notjoinup.ch/jobs' }), false);
  assert.equal(joinupAdapter.matches({ careers_url: 'https://example.com/jobs' }), false);
  assert.equal(joinupAdapter.matches({}), false);
  assert.equal(joinupAdapter.matches(null), false);
  assert.equal(joinupAdapter.buildEndpoint({ careers_url: 'https://example.com/jobs' }), null);
});

// ---------------------------------------------------------------------------
// toEpochMs — ISO strings, Unix seconds, ms, and "missing" (non-positive) values
// ---------------------------------------------------------------------------

test('toEpochMs: ISO string, seconds, ms, and non-positive/unparseable → null', () => {
  assert.equal(toEpochMs('2026-01-02'), Date.parse('2026-01-02'));
  assert.equal(toEpochMs(1_735_776_000), 1_735_776_000 * 1000); // Unix seconds → ms
  assert.equal(toEpochMs(1_735_776_000_000), 1_735_776_000_000); // already ms
  assert.equal(toEpochMs(0), null);
  assert.equal(toEpochMs(-5), null);
  assert.equal(toEpochMs(''), null);
  assert.equal(toEpochMs(null), null);
  assert.equal(toEpochMs(undefined), null);
  assert.equal(toEpochMs('not a date'), null);
});

// ---------------------------------------------------------------------------
// normalizeJoinupHit — field mapping + slug/title filter + location shapes
// ---------------------------------------------------------------------------

test('normalizeJoinupHit: maps a hit into the web-ui shape', () => {
  const n = normalizeJoinupHit(hit, 'Fallback');
  assert.ok(n);
  assert.equal(n.id, 'joinup-acme-head-of-finance');
  assert.equal(n.title, 'Head of Finance');
  assert.equal(n.company, 'Acme');
  assert.equal(n.url, 'https://joinup.ch/job/acme-head-of-finance');
  assert.equal(n.location, 'Zurich');
  assert.equal(n.salary, '');
  assert.equal(n.snippet, '');
  assert.equal(n.isRemote, false);
  assert.equal(n.workplaceType, '');
  assert.equal(n.relocates, false);
  assert.equal(n.source, 'joinup');
  assert.equal(n.date, new Date(Date.parse('2026-01-02')).toISOString());
});

test('normalizeJoinupHit: title falls back to headline; company falls back to entry name', () => {
  const n = normalizeJoinupHit({ headline: 'Ops Lead', slug: 's1' }, 'EntryCo');
  assert.equal(n.title, 'Ops Lead');
  assert.equal(n.company, 'EntryCo');
  assert.equal(normalizeJoinupHit({ headline: 'Ops Lead', slug: 's1' }).company, '');
});

test('normalizeJoinupHit: drops slug-less and title-less rows', () => {
  assert.equal(normalizeJoinupHit({ title: 'No Slug', slug: '' }), null);
  assert.equal(normalizeJoinupHit({ title: 'No Slug' }), null);
  assert.equal(normalizeJoinupHit({ slug: 'has-slug' }), null); // no title/headline
  assert.equal(normalizeJoinupHit({ slug: 'has-slug', title: '' }), null);
  assert.equal(normalizeJoinupHit(null), null);
});

test('normalizeJoinupHit: location accepts a string or an object (.name/.city)', () => {
  assert.equal(normalizeJoinupHit({ ...hit, location: { name: 'Bern' } }).location, 'Bern');
  assert.equal(normalizeJoinupHit({ ...hit, location: { city: 'Geneva' } }).location, 'Geneva');
  assert.equal(normalizeJoinupHit({ ...hit, location: undefined }).location, '');
});

test('normalizeJoinupHit: a hit without `created` yields date ""', () => {
  const n = normalizeJoinupHit({ title: 'X', slug: 'x', created: '' });
  assert.equal(n.date, '');
});

// ---------------------------------------------------------------------------
// parseJoinupHtml — extraction, filtering, dedupe, fail-closed on __NEXT_DATA__
// ---------------------------------------------------------------------------

test('parseJoinupHtml: extracts + maps hits from __NEXT_DATA__', () => {
  const jobs = parseJoinupHtml(htmlFor(nextWith([hit])), { company: { name: 'JOINUP' } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://joinup.ch/job/acme-head-of-finance');
  assert.equal(jobs[0].company, 'Acme');
});

test('parseJoinupHtml: filters slug-less / title-less rows, keeps the valid one', () => {
  const jobs = parseJoinupHtml(htmlFor(nextWith([
    hit,
    { title: 'No slug here', location: 'X' }, // no slug → dropped
    { slug: 'title-less-role', location: 'Y' }, // no title/headline → dropped
  ])));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'joinup-acme-head-of-finance');
});

test('parseJoinupHtml: dedupes hits sharing a url (slug)', () => {
  const jobs = parseJoinupHtml(htmlFor(nextWith([hit, { ...hit, startup: 'Acme (dup)' }])));
  assert.equal(jobs.length, 1);
});

test('parseJoinupHtml: a structurally valid payload with no hits is an empty board → []', () => {
  const jobs = parseJoinupHtml(htmlFor(nextWith([])));
  assert.deepEqual(jobs, []);
});

test('parseJoinupHtml: THROWS on missing __NEXT_DATA__ (fails closed)', () => {
  assert.throws(() => parseJoinupHtml('<html>no data here</html>'), /__NEXT_DATA__/);
  assert.throws(() => parseJoinupHtml(null), /__NEXT_DATA__/);
});

test('parseJoinupHtml: THROWS on malformed __NEXT_DATA__ JSON (fails closed)', () => {
  const bad = '<script id="__NEXT_DATA__" type="application/json">{"props": {oops,,}</script>';
  assert.throws(() => parseJoinupHtml(bad), /__NEXT_DATA__/);
});

// ---------------------------------------------------------------------------
// assertJoinupUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertJoinupUrl: https + host-pinned to joinup.ch', () => {
  assert.equal(assertJoinupUrl(BROWSE_URL), BROWSE_URL);
  assert.ok(JOINUP_HOST_RE.test('joinup.ch'));
  assert.throws(() => assertJoinupUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertJoinupUrl('http://joinup.ch/x'), /HTTPS/);
  assert.throws(() => assertJoinupUrl('nonsense'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// fetchJoinup — single host-pinned request, redirect:'error', fail-closed
// ---------------------------------------------------------------------------

test('fetchJoinup: one host-pinned request to BROWSE_URL with redirect:"error"', async () => {
  const capture = {};
  const jobs = await fetchJoinup(BROWSE_URL, {
    fetchImpl: fakeFetch(htmlFor(nextWith([hit])), capture),
    company: { name: 'JOINUP' },
  });
  assert.equal(capture.url, BROWSE_URL);
  assert.equal(capture.opts.redirect, 'error');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://joinup.ch/job/acme-head-of-finance');
  assert.ok(jobs.every((j) => j.source === 'joinup'));
});

test('fetchJoinup: ignores a caller-supplied endpoint and still fetches BROWSE_URL', async () => {
  const capture = {};
  await fetchJoinup('https://joinup.ch/some/other/path', {
    fetchImpl: fakeFetch(htmlFor(nextWith([hit])), capture),
  });
  assert.equal(capture.url, BROWSE_URL);
});

test('fetchJoinup: a failing sole request THROWS (dead-board contract)', async () => {
  const failing = async () => ({ ok: false, status: 503, text: async () => '' });
  await assert.rejects(() => fetchJoinup(BROWSE_URL, { fetchImpl: failing }), /HTTP 503/);
});

test('fetchJoinup: a fetch that returns a page without __NEXT_DATA__ THROWS', async () => {
  await assert.rejects(
    () => fetchJoinup(BROWSE_URL, { fetchImpl: fakeFetch('<html>nope</html>') }),
    /__NEXT_DATA__/,
  );
});

/**
 * Glints source — v1.242.0 Phase-2 correctness. CI-isolated: fake fetchImpl,
 * no network. Covers the https-only job URL rule, the maxPages/pageSize
 * clamps (a negative or absurd config value used to reach the GraphQL
 * variables unchecked), and the out-of-range postedAt guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGlints, parseGlintsItem, assertGlintsUrl, DEFAULT_API } from '../server/lib/sources/glints.mjs';

const okJson = (payload) => async () => ({ ok: true, status: 200, json: async () => payload });

const gqlBody = (data, totalCount = 1000) => ({
  data: { opportunities: { data, totalCount } },
});

const row = (over = {}) => ({
  id: 1,
  title: 'Backend Engineer',
  url: 'https://glints.com/j/1',
  company: { name: 'Tokopedia' },
  location: 'Jakarta',
  ...over,
});

test('meta', () => {
  assert.equal(assertGlintsUrl(DEFAULT_API), DEFAULT_API);
});

test('parseGlintsItem: a job url that is not https is dropped (scheme unchecked before)', () => {
  assert.equal(parseGlintsItem(row({ url: 'http://glints.com/j/1' }), 'https://glints.com', ''), null,
    'http is a downgrade, not a posting');
  // even a correct glints.com hostname on a non-https scheme
  assert.equal(parseGlintsItem(row({ url: 'http://www.glints.com/j/2' }), 'https://glints.com', ''), null);
  // https rows on the allowlisted hosts survive
  const ok = parseGlintsItem(row(), 'https://glints.com', '');
  assert.equal(ok.url, 'https://glints.com/j/1');
});

test('fetchGlints clamps pageSize into the request variables (negative / absurd → bounded)', async () => {
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => gqlBody([]) }; // empty page → stop after page 0
  };
  for (const pageSize of [-30, 0, 100000, 1e9]) {
    seen.length = 0;
    await fetchGlints(DEFAULT_API, { fetchImpl, company: { glints: { searchKeywords: 'ML', pageSize } } });
    const limit = seen[0].variables.limit;
    assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 100, `pageSize=${pageSize} → clamped, got ${limit}`);
  }
  // the configured value is honoured when sane
  seen.length = 0;
  await fetchGlints(DEFAULT_API, { fetchImpl, company: { glints: { searchKeywords: 'ML', pageSize: 10 } } });
  assert.equal(seen[0].variables.limit, 10);
});

test('fetchGlints clamps maxPages — absurd → hard cap, negative → default', async () => {
  // A full page (data.length == pageSize) makes the walk want to continue;
  // totalCount stays far so only maxPages can stop it. The abort signal is
  // there to skip the 300ms pacing delays between pages (delay is
  // abort-aware), keeping this test in milliseconds.
  let calls = 0;
  const full = gqlBody([row({ id: 9, url: 'https://glints.com/j/9' })]);
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 750);
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, json: async () => full }; };
  await fetchGlints(DEFAULT_API, {
    fetchImpl,
    signal: ac.signal,
    company: { glints: { searchKeywords: 'ML', pageSize: 1, maxPages: 100000 } },
  });
  assert.ok(calls > 1, 'the walk paginates');
  assert.ok(calls <= 22, `hard cap respected — got ${calls} calls (uncapped walked to totalCount)`);

  // A negative maxPages used to flow into `page < maxPages` unchecked — the
  // loop iterated zero times and the board silently read as empty.
  calls = 0;
  await fetchGlints(DEFAULT_API, {
    fetchImpl: async () => { calls += 1; return { ok: true, status: 200, json: async () => gqlBody([]) }; },
    company: { glints: { searchKeywords: 'ML', maxPages: -5 } },
  });
  assert.equal(calls, 1, 'negative maxPages reads as the default — page 0 is still fetched');
});

test('fetchGlints: an out-of-range postedAt yields date "" instead of RangeError-ing the board', async () => {
  // A postedAt Date.parse cannot turn into a finite value regresses to an
  // Invalid Date; the source must leave the date empty rather than call
  // toISOString() on it (RangeError → whole board lost).
  const jobs = await fetchGlints(DEFAULT_API, {
    fetchImpl: okJson(gqlBody([
      row({ id: 2, url: 'https://glints.com/j/2', postedAt: '999999999-01-01T00:00:00Z' }),
      row({ id: 3, url: 'https://glints.com/j/3', postedAt: '2026-01-15T00:00:00Z' }),
    ])),
    company: { glints: { searchKeywords: 'ML' } },
  });
  assert.equal(jobs.length, 2, 'one absurd timestamp must not abort the board');
  assert.equal(jobs.find((j) => j.url.endsWith('/2')).date, '');
  assert.equal(jobs.find((j) => j.url.endsWith('/3')).date, '2026-01-15T00:00:00.000Z');
});

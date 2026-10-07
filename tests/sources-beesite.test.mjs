/**
 * beesite (milch & zucker GJB) source — CI-isolated tests (fake fetchImpl, no
 * network). Covers the v1.242.0 phase-2 rules for this source:
 *   - a 200 without the documented SearchResult container THROWS on page 1
 *     (previously `Array.isArray(sr.SearchResultItems)` quietly read a
 *     challenge page as "0 postings"),
 *   - a later-page failure keeps the collected partials and logs,
 *   - pagination stops on the RAW item count, not the post-filter row count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchBeesite,
  parseSearchResult,
  resolveConfig,
} from '../server/lib/sources/beesite.mjs';

const ENDPOINT = 'https://mb-jobs.app.beesite.de/search';

const item = (n, overrides = {}) => ({
  MatchedObjectId: String(n),
  MatchedObjectDescriptor: {
    PositionID: String(n),
    PositionTitle: `Role ${n}`,
    PositionURI: `https://jobs.mercedes-benz.com/j/${n}`,
    PositionLocation: [{ CityName: 'Bremen' }],
    PublicationStartDate: '2026-07-04',
    ...overrides,
  },
});

const fullItems = (start, n) => Array.from({ length: n }, (_, k) => item(start + k + 1));

const pageBody = (items, total = items.length) => ({
  SearchResult: { SearchResultCountAll: total, SearchResultItems: items },
});

test('parseSearchResult: maps the documented envelope', () => {
  const { total, jobs } = parseSearchResult(pageBody([item(1)]), 'MB');
  assert.equal(total, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'beesite-1');
  assert.equal(jobs[0].title, 'Role 1');
  assert.equal(jobs[0].company, 'MB');
  assert.equal(jobs[0].url, 'https://jobs.mercedes-benz.com/j/1');
  assert.equal(jobs[0].location, 'Bremen');
  assert.equal(jobs[0].date, '2026-07-04');
  assert.equal(jobs[0].source, 'beesite');
});

test('parseSearchResult: a legit empty page (items: []) still reads as empty', () => {
  assert.deepEqual(parseSearchResult(pageBody([]), 'MB'), { total: 0, jobs: [], raw: 0 });
});

test('parseSearchResult: a wrong-shape 200 throws instead of reading as an empty board', () => {
  assert.throws(() => parseSearchResult({ html: 'Access denied' }, 'MB'), /beesite/);
  assert.throws(() => parseSearchResult(null, 'MB'), /beesite/);
  assert.throws(
    () => parseSearchResult({ SearchResult: { SearchResultCountAll: 0 } }, 'MB'), // items missing
    /beesite/,
  );
});

test('fetchBeesite: a wrong-shape page 1 throws (challenge page, no silent empty board)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ html: 'Access denied' }) }; };
  await assert.rejects(
    () => fetchBeesite(ENDPOINT, { fetchImpl, company: { name: 'MB' } }),
    /beesite/,
  );
  assert.equal(calls, 1);
});

test('fetchBeesite: a later-page failure keeps the collected jobs (partials, logged)', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, json: async () => pageBody(fullItems(0, 100), 150) };
    return { ok: false, status: 503, json: async () => ({}) };
  };
  const jobs = await fetchBeesite(ENDPOINT, { fetchImpl, company: { name: 'MB' } });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 100, "a page-2 blip must not discard page 1's jobs");
});

test('fetchBeesite: pagination stops on the RAW item count — dropped rows do not end the walk', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      const items = fullItems(0, 100);
      // One unparseable row: the parser drops it, but the page was RAW-full.
      items[0].MatchedObjectDescriptor.PositionURI = 'javascript:alert(1)';
      return { ok: true, status: 200, json: async () => pageBody(items, 200) };
    }
    return { ok: true, status: 200, json: async () => pageBody([], 200) }; // past the last page
  };
  const jobs = await fetchBeesite(ENDPOINT, { fetchImpl, company: { name: 'MB' } });
  assert.equal(calls, 2, '99 parsed rows on a RAW-full page must not stop pagination');
  assert.equal(jobs.length, 99);
});

test('resolveConfig: https *.beesite.de only', () => {
  assert.ok(resolveConfig({ api: ENDPOINT }));
  assert.equal(resolveConfig({ api: 'http://mb-jobs.app.beesite.de/search' }), null);
  assert.equal(resolveConfig({ api: 'https://evil.com/?x=beesite.de' }), null);
});

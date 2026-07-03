/**
 * Amazon / AWS source + adapter (parent career-ops providers/amazon.mjs parity).
 * Public amazon.jobs search JSON, company/host-selected. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAmazonJob, fetchAmazon, assertAmazonUrl, FEED_BASE, ORIGIN, meta,
} from '../server/lib/sources/amazon.mjs';
import { amazonAdapter } from '../server/lib/portals/adapters/amazon.mjs';

const posting = (over = {}) => ({
  title: 'Machine Learning Engineer',
  job_path: '/en/jobs/12345/ml-engineer',
  company_name: 'Amazon Web Services',
  normalized_location: 'Berlin, Germany',
  posted_date: 'July  3, 2026',
  ...over,
});

// Fake fetch keyed on the `offset` query param → page index. Avoids matching
// result_limit=100 (the `[?&]offset=` guard is the pagination-regex footgun).
const jsonFetch = (byOffset) => async (url) => {
  const offset = Number((String(url).match(/[?&]offset=(\d+)/) || [])[1] || 0);
  return { ok: true, status: 200, json: async () => ({ jobs: byOffset[offset] || [] }) };
};

test('meta + adapter surface: provider- and host-selected, host-pinned', () => {
  assert.equal(meta.value, 'amazon');
  assert.equal(meta.region, 'en');
  assert.equal(amazonAdapter.id, 'amazon');
  assert.equal(amazonAdapter.label, 'Amazon');

  // matches: explicit provider, or an amazon.jobs careers_url/api host
  assert.ok(amazonAdapter.matches({ provider: 'amazon' }));
  assert.ok(amazonAdapter.matches({ careers_url: 'https://amazon.jobs/en/search' }));
  assert.ok(amazonAdapter.matches({ careers_url: 'https://www.amazon.jobs/en/jobs/1' }));
  assert.ok(amazonAdapter.matches({ api: 'https://www.amazon.jobs/en/search.json' }));
  assert.ok(!amazonAdapter.matches({ careers_url: 'https://amazon.jobs.evil.com/x' }));
  assert.ok(!amazonAdapter.matches({ careers_url: 'https://boards.greenhouse.io/x' }));
  assert.ok(!amazonAdapter.matches({}));

  // buildEndpoint: canonical feed by default, config passed through
  assert.equal(amazonAdapter.buildEndpoint({}), FEED_BASE);
  const ep = new URL(amazonAdapter.buildEndpoint({ amazon: { loc_query: 'Germany', base_query: 'ml' } }));
  assert.equal(`${ep.protocol}//${ep.host}`, ORIGIN);
  assert.equal(ep.searchParams.get('loc_query'), 'Germany');
  assert.equal(ep.searchParams.get('base_query'), 'ml');

  // array config → bracket facet form
  const facet = new URL(amazonAdapter.buildEndpoint({ amazon: { normalized_country_code: ['DEU', 'FRA'] } }));
  assert.deepEqual(facet.searchParams.getAll('normalized_country_code[]'), ['DEU', 'FRA']);
});

test('normalizeAmazonJob: field mapping, relative/absolute url, remote, drops bad rows', () => {
  const j = normalizeAmazonJob(posting());
  assert.equal(j.title, 'Machine Learning Engineer');
  assert.equal(j.company, 'Amazon Web Services');
  assert.equal(j.url, 'https://www.amazon.jobs/en/jobs/12345/ml-engineer');
  assert.equal(j.location, 'Berlin, Germany');
  assert.equal(j.isRemote, false);
  assert.equal(j.workplaceType, '');
  assert.equal(j.source, 'amazon');
  assert.equal(j.salary, '');
  assert.equal(j.snippet, '');
  assert.equal(j.relocates, false);
  assert.equal(j.id, `amazon-${j.url}`);
  assert.match(j.date, /^\d{4}-\d{2}-\d{2}$/);

  // absolute amazon.jobs job_path is kept as-is
  const abs = normalizeAmazonJob(posting({ job_path: 'https://www.amazon.jobs/en/jobs/9/x' }));
  assert.equal(abs.url, 'https://www.amazon.jobs/en/jobs/9/x');

  // company fallback when company_name missing
  const f = normalizeAmazonJob(posting({ company_name: undefined }), 'Amazon / AWS');
  assert.equal(f.company, 'Amazon / AWS');
  assert.equal(normalizeAmazonJob(posting({ company_name: undefined })).company, 'Amazon');

  // remote flag: is_remote true → Remote workplace type
  const r = normalizeAmazonJob(posting({ is_remote: true }));
  assert.equal(r.isRemote, true);
  assert.equal(r.workplaceType, 'Remote');
  // remote inferred from a "Virtual" location token
  const v = normalizeAmazonJob(posting({ normalized_location: 'Virtual, USA' }));
  assert.equal(v.isRemote, true);

  // missing/unparseable posted_date → empty date
  assert.equal(normalizeAmazonJob(posting({ posted_date: undefined })).date, '');
  assert.equal(normalizeAmazonJob(posting({ posted_date: '10 minutes' })).date, '');

  // dropped: no title, no path, off-host absolute path, malformed path
  assert.equal(normalizeAmazonJob(posting({ title: '' })), null);
  assert.equal(normalizeAmazonJob(posting({ job_path: undefined })), null);
  assert.equal(normalizeAmazonJob(posting({ job_path: 'https://evil.com/x' })), null);
  assert.equal(normalizeAmazonJob(posting({ job_path: 'http://www.amazon.jobs/x' })), null); // non-https
  assert.equal(normalizeAmazonJob(null), null);
});

test('assertAmazonUrl: https + host-pinned to www.amazon.jobs', () => {
  assert.equal(assertAmazonUrl(FEED_BASE), FEED_BASE);
  assert.throws(() => assertAmazonUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertAmazonUrl('https://amazon.jobs/x'), /untrusted hostname/); // bare host is not www
  assert.throws(() => assertAmazonUrl('http://www.amazon.jobs/x'), /HTTPS/);
  assert.throws(() => assertAmazonUrl('nonsense'), /invalid URL/);
});

test('fetchAmazon: paginates by offset until a short page, CI-isolated', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => posting({ title: `Role ${i}`, job_path: `/en/jobs/p1-${i}` }));
  const page2 = [posting({ title: 'Last', job_path: '/en/jobs/p2-0' })];
  let calls = 0;
  const fetchImpl = (url, optsArg) => {
    calls += 1;
    assert.equal(optsArg.redirect, 'error');
    return jsonFetch({ 0: page1, 100: page2 })(url);
  };
  const jobs = await fetchAmazon(FEED_BASE, { fetchImpl });
  assert.equal(calls, 2); // page 2 is short → stop
  assert.equal(jobs.length, 101);
  assert.ok(jobs.every((j) => j.source === 'amazon'));
});

test('fetchAmazon: dedups rows repeated across full pages (offset ignored)', async () => {
  // A full page (100) whose rows repeat on the next full page → dedup makes
  // fresh=0 on page 2, so the loop stops without walking all 20 pages.
  const p1 = Array.from({ length: 100 }, (_, i) => posting({ job_path: `/en/jobs/dup-${i}` }));
  let calls = 0;
  const fetchImpl = (url) => { calls += 1; return jsonFetch({ 0: p1, 100: p1, 200: p1 })(url); };
  const jobs = await fetchAmazon(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 100); // page 2's rows are all dupes → dropped
  assert.equal(calls, 2); // page 1 full → continue; page 2 fresh=0 → stop
});

test('fetchAmazon: a short page ends pagination after one call', async () => {
  const partial = [posting({ job_path: '/en/jobs/only' })];
  let calls = 0;
  const fetchImpl = (url) => { calls += 1; return jsonFetch({ 0: partial, 100: partial })(url); };
  const jobs = await fetchAmazon(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(calls, 1); // 1 < PAGE_SIZE → last page
});

test('fetchAmazon: empty first page → no jobs, one call', async () => {
  let calls = 0;
  const fetchImpl = (url) => { calls += 1; return jsonFetch({})(url); };
  const jobs = await fetchAmazon(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 0);
  assert.equal(calls, 1);
});

test('fetchAmazon: rejects an off-host feed base before any fetch', async () => {
  let calls = 0;
  const fetchImpl = () => { calls += 1; return jsonFetch({})(''); };
  await assert.rejects(() => fetchAmazon('https://evil.com/search.json', { fetchImpl }), /untrusted hostname/);
  assert.equal(calls, 0);
});

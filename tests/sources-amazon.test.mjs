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

// Phase-2 (v1.242.0): a 200 without the documented {jobs:[...]} envelope is a
// shape change — loud on page 1; a later-page failure keeps the partials.
test('fetchAmazon: a wrong-shape 200 on page 1 throws (no silent empty board)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ postings: [] }) }; };
  await assert.rejects(() => fetchAmazon(FEED_BASE, { fetchImpl }), /Amazon search/);
  assert.equal(calls, 1);
});

test('fetchAmazon: a later-page HTTP failure keeps the collected jobs (partials, logged)', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => posting({ title: `Keep ${i}`, job_path: `/en/jobs/keep-${i}` }));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, json: async () => ({ jobs: page1 }) };
    return { ok: false, status: 503, json: async () => ({}) };
  };
  const jobs = await fetchAmazon(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 100, 'a page-2 blip must not discard page 1');
});

test('fetchAmazon: a wrong-shape later page keeps partials instead of discarding', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => posting({ title: `WS ${i}`, job_path: `/en/jobs/ws-${i}` }));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1
      ? { ok: true, status: 200, json: async () => ({ jobs: page1 }) }
      : { ok: true, status: 200, json: async () => ({ error: 'challenge page' }) }; // "jobs" gone
  };
  const jobs = await fetchAmazon(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 100);
});

// ---------------------------------------------------------------------------
// Hits-bounded walk (upstream parity, parent #6938): MAX_PAGES caps a walk
// only while the total is unknown; a reported `hits` sizes the page budget
// (one page past it, up to HARD_MAX_PAGES) and a cap stop is reported partial.
// ---------------------------------------------------------------------------

/** Fake fetch serving `hits` postings in 100-row pages, recording each `hits`
 *  value under its offset; `withHits: false` omits the field entirely. */
const hitsFetch = (hits, counter, withHits = true) => async (url) => {
  counter.n += 1;
  const off = Number((String(url).match(/[?&]offset=(\d+)/) || [])[1] || 0);
  const n = Math.max(0, Math.min(100, hits - off));
  const jobs = Array.from({ length: n }, (_, i) => posting({ title: `R${off + i}`, job_path: `/en/jobs/${off + i}/r` }));
  return { ok: true, status: 200, json: async () => ({ ...(withHits ? { hits } : {}), jobs }) };
};

/** Run `fn` with console.error captured; returns what it logged. */
async function captureErrors(fn) {
  const lines = [];
  const real = console.error;
  console.error = (...args) => lines.push(args.join(' '));
  try {
    return { result: await fn(), lines };
  } finally {
    console.error = real;
  }
}

test('fetchAmazon: a reported hits past the 20-page default is read in full (CA+NY board, 3,171 postings)', async () => {
  const HITS = 3171;
  const counter = { n: 0 };
  const { result: big, lines } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl: hitsFetch(HITS, counter) }));
  assert.equal(big.length, HITS);
  assert.equal(counter.n, Math.ceil(HITS / 100), 'the walk follows the reported hits, one short page ends it');
  assert.equal(big.truncated, undefined, 'the walk ended naturally — nothing is marked');
  assert.deepEqual(lines, [], 'a full read is silent');
});

test('fetchAmazon: stops at the 100-page ceiling and marks the board truncated', async () => {
  const counter = { n: 0 };
  const { result: huge, lines } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl: hitsFetch(25000, counter) }));
  assert.equal(counter.n, 100, 'HARD_MAX_PAGES bounds the hits-raised budget');
  assert.equal(huge.length, 10000);
  assert.deepEqual(huge.truncated, { reason: 'page-cap', fetched: 10000, total: 25000 });
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes('10000 of 25000'), `warning names the counts: ${lines[0]}`);
});

test('fetchAmazon: keeps the 20-page default when the API reports no hits, and marks the cut', async () => {
  const counter = { n: 0 };
  const { result: noHits, lines } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl: hitsFetch(5000, counter, false) }));
  assert.equal(counter.n, 20, 'MAX_PAGES caps a walk with no reported total');
  assert.equal(noHits.length, 2000);
  assert.deepEqual(noHits.truncated, { reason: 'page-cap', fetched: 2000 });
  assert.equal(lines.length, 1);
});

test('fetchAmazon: never treats an understated hits as the end — reads one page past it and marks the cut', async () => {
  // 2,000 reported, 2,500 real: the budget is one page past hits, the walk ends
  // on a full page, and that is partial.
  const counter = { n: 0 };
  const real = hitsFetch(2500, counter);
  const fetchImpl = async (url) => {
    const res = await real(url);
    const body = await res.json();
    return { ok: true, status: 200, json: async () => ({ ...body, hits: 2000 }) };
  };
  const { result: under, lines } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl }));
  assert.equal(counter.n, 21, 'the budget is ceil(2000/100) + 1');
  assert.equal(under.length, 2100);
  assert.deepEqual(under.truncated, { reason: 'page-cap', fetched: 2100, total: 2000 });
  assert.equal(lines.length, 1);
});

test('fetchAmazon: an exact-multiple board ends on the observed empty page, untruncated', async () => {
  const counter = { n: 0 };
  const { result: exact, lines } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl: hitsFetch(3000, counter) }));
  assert.equal(counter.n, 31, '30 full pages plus the empty page after them');
  assert.equal(exact.length, 3000);
  assert.equal(exact.truncated, undefined);
  assert.deepEqual(lines, []);
});

test('fetchAmazon: a health probe (opts.maxPages = 1) reads one page and is not a truncation', async () => {
  const counter = { n: 0 };
  const { result: probe, lines } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl: hitsFetch(3171, counter), maxPages: 1 }));
  assert.equal(counter.n, 1);
  assert.equal(probe.length, 100);
  assert.equal(probe.truncated, undefined, 'the probe budget is never a cap stop');
  assert.deepEqual(lines, []);
});

test('fetchAmazon: a later-page failure is marked fetch-error, not page-cap', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => posting({ title: `Keep ${i}`, job_path: `/en/jobs/keep-${i}` }));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, json: async () => ({ hits: 5000, jobs: page1 }) };
    return { ok: false, status: 503, json: async () => ({}) };
  };
  const { result: jobs } = await captureErrors(() => fetchAmazon(FEED_BASE, { fetchImpl }));
  assert.equal(jobs.length, 100, 'a page-2 blip must not discard page 1');
  assert.deepEqual(jobs.truncated, { reason: 'fetch-error', fetched: 100 }, 'a failed page is a fetch-error stop, never page-cap');
});

// Off-by-one east of UTC: Date.parse reads "July 3, 2026" in the runner's local
// zone and toISOString() then shifted the calendar day back. Run with
// TZ=Asia/Shanghai to see the old code fail this.
test('normalizeAmazonJob: posted_date reads the printed calendar day (Date.UTC, no TZ shift)', () => {
  assert.equal(normalizeAmazonJob(posting({ posted_date: 'July  3, 2026' })).date, '2026-07-03');
  assert.equal(normalizeAmazonJob(posting({ posted_date: 'January 31, 2026' })).date, '2026-01-31');
  assert.equal(normalizeAmazonJob(posting({ posted_date: 'December 31, 2026' })).date, '2026-12-31');
});

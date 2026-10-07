/**
 * Getro source + adapter — CI-isolated tests (fake fetchImpl, no network, no
 * parent-project dependency). Contract under test:
 * a numeric collection id interpolated straight into the API URL (so non-numeric
 * ids must be rejected), created_at-DESCENDING pagination with an age-based
 * pagination bound, portfolio-employer attribution, url dedup, and the
 * dead-board contract (page-0 failure throws; a later page failing keeps
 * partials).
 *
 * The age cutoff uses Date.now() at runtime. Tests that don't exercise it pass
 * `getro_max_age_days: 0` to disable it, so results are deterministic and no
 * assertion depends on the wall clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toEpochMs,
  resolveCollection,
  httpsCareersUrl,
  extractCollectionId,
  resolveCollectionId,
  assertGetroUrl,
  normalizeGetroJob,
  getroSalary,
  getroLocation,
  deriveWorkplace,
  fetchGetro,
  API_BASE,
  meta,
} from '../server/lib/sources/getro.mjs';
import { getroAdapter } from '../server/lib/portals/adapters/getro.mjs';

// Response-like helper: fetchJson expects `res.ok` + `res.json()`.
const ok = (payload) => ({ ok: true, json: async () => payload });
// A minimal Getro board page carrying the id in __NEXT_DATA__ (Next.js shape).
const nextDataHtml = (id) =>
  '<!doctype html><html><head></head><body>'
  + '<script id="__NEXT_DATA__" type="application/json">'
  + JSON.stringify({ props: { pageProps: { network: { id } } } })
  + '</script></body></html>';
// Build a canned jobs page.
const job = (i, extra = {}) => ({
  title: `Role ${i}`,
  url: `https://jobs.b2venture.vc/${i}`,
  organization: { name: 'Acme' },
  locations: ['Zurich'],
  ...extra,
});

// ---------------------------------------------------------------------------
// meta + adapter surface: provider-selected, host-pinned
// ---------------------------------------------------------------------------

test('meta: id/label/region + API_BASE + adapter.id', () => {
  assert.equal(meta.value, 'getro');
  assert.equal(meta.label, 'Getro');
  assert.equal(meta.region, 'en');
  assert.equal(API_BASE, 'https://api.getro.com/api/v2/collections');
  assert.equal(getroAdapter.id, 'getro');
  assert.equal(getroAdapter.label, 'Getro');
});

test('adapter: matches provider=getro with a numeric collection OR an https careers_url', () => {
  // explicit numeric collection
  assert.ok(getroAdapter.matches({ provider: 'getro', getro_collection: 4283 }));
  // https careers_url alone now matches — the id auto-resolves at scan time
  assert.ok(getroAdapter.matches({ provider: 'getro', careers_url: 'https://jobs.b2venture.vc' }));
  // provider set but neither a usable id nor an https careers_url → no match
  assert.equal(getroAdapter.matches({ provider: 'getro' }), false);
  assert.equal(getroAdapter.matches({ provider: 'getro', getro_collection: 'abc' }), false);
  // an http (non-https) careers_url is not a usable auto-resolve source
  assert.equal(getroAdapter.matches({ provider: 'getro', careers_url: 'http://jobs.b2venture.vc' }), false);
  // careers_url WITHOUT provider:getro never claims a getro board
  assert.equal(getroAdapter.matches({ careers_url: 'https://jobs.b2venture.vc' }), false);
  assert.equal(getroAdapter.matches({ getro_collection: 4283 }), false);
  assert.equal(getroAdapter.matches({}), false);
  assert.equal(getroAdapter.matches(null), false);
});

test('adapter: buildEndpoint = the collection API for an explicit id, else the https careers_url', () => {
  assert.equal(
    getroAdapter.buildEndpoint({ provider: 'getro', getro_collection: 4283 }),
    'https://api.getro.com/api/v2/collections/4283/search/jobs',
  );
  // auto-resolve entry: the board page URL is the informational probe endpoint
  assert.equal(
    getroAdapter.buildEndpoint({ provider: 'getro', careers_url: 'https://jobs.b2venture.vc/' }),
    'https://jobs.b2venture.vc/',
  );
  // nothing usable → null
  assert.equal(getroAdapter.buildEndpoint({ provider: 'getro' }), null);
  assert.equal(getroAdapter.buildEndpoint({ provider: 'getro', getro_collection: 'x; DROP' }), null);
  assert.equal(getroAdapter.buildEndpoint({ provider: 'getro', careers_url: 'http://jobs.b2venture.vc' }), null);
});

// ---------------------------------------------------------------------------
// resolveCollection — the id is interpolated into the URL, so reject non-numeric
// ---------------------------------------------------------------------------

test('resolveCollection: accepts a numeric id (string or number), rejects the rest', () => {
  assert.equal(resolveCollection({ getro_collection: 4283 }), '4283');
  assert.equal(resolveCollection({ getro_collection: '4283' }), '4283');
  for (const bad of ['abc', '4283; DROP', '../evil', '4283/../../x', '', null, undefined]) {
    assert.equal(resolveCollection({ getro_collection: bad }), null, `should reject ${JSON.stringify(bad)}`);
  }
  assert.equal(resolveCollection({}), null);
});

// ---------------------------------------------------------------------------
// httpsCareersUrl — the board page auto-resolution reads from (https only)
// ---------------------------------------------------------------------------

test('httpsCareersUrl: https only, normalized; other schemes/junk → null', () => {
  assert.equal(httpsCareersUrl({ careers_url: 'https://jobs.b2venture.vc' }), 'https://jobs.b2venture.vc/');
  assert.equal(httpsCareersUrl({ careers_url: '  https://jobs.b2venture.vc/jobs  ' }), 'https://jobs.b2venture.vc/jobs');
  assert.equal(httpsCareersUrl({ careers_url: 'http://jobs.b2venture.vc' }), null);
  assert.equal(httpsCareersUrl({ careers_url: 'ftp://x' }), null);
  assert.equal(httpsCareersUrl({ careers_url: 'not a url' }), null);
  assert.equal(httpsCareersUrl({ careers_url: '   ' }), null);
  assert.equal(httpsCareersUrl({}), null);
  assert.equal(httpsCareersUrl(null), null);
});

// ---------------------------------------------------------------------------
// extractCollectionId — parse network.id out of __NEXT_DATA__
// ---------------------------------------------------------------------------

test('extractCollectionId: reads network.id (number or string) from __NEXT_DATA__, else null', () => {
  assert.equal(extractCollectionId(nextDataHtml(4283)), '4283');
  assert.equal(extractCollectionId(nextDataHtml('4283')), '4283');
  // extra attributes + a CSP nonce + reordered attrs + single quotes tolerated
  assert.equal(
    extractCollectionId(
      '<script type="application/json" nonce="abc123" id=\'__NEXT_DATA__\'>'
      + JSON.stringify({ props: { pageProps: { network: { id: 77 } } } })
      + '</script>',
    ),
    '77',
  );
  // a data-id attribute must NOT false-match
  assert.equal(extractCollectionId('<div data-id="__NEXT_DATA__">x</div>'), null);
  assert.equal(extractCollectionId('<script id="__NEXT_DATA__">not json</script>'), null);
  assert.equal(extractCollectionId('<html>no next data</html>'), null);
  assert.equal(extractCollectionId(nextDataHtml(0)), null);   // non-positive id
  assert.equal(extractCollectionId(nextDataHtml(-5)), null);
  assert.equal(extractCollectionId(nextDataHtml('0')), null);
  assert.equal(extractCollectionId(42), null);                // non-string input
  assert.equal(extractCollectionId(null), null);
});

// ---------------------------------------------------------------------------
// resolveCollectionId — explicit id wins; else auto-resolve from careers_url
// ---------------------------------------------------------------------------

test('resolveCollectionId: an explicit numeric id wins with no network call', async () => {
  let called = false;
  const id = await resolveCollectionId(
    { getro_collection: 4283, careers_url: 'https://jobs.b2venture.vc' },
    { safeGetImpl: async () => { called = true; return { status: 200, text: nextDataHtml(999) }; } },
  );
  assert.equal(id, '4283');
  assert.equal(called, false, 'explicit id must short-circuit the fetch');
});

test('resolveCollectionId: auto-resolves from an https careers_url via safeGet', async () => {
  let seenUrl = null;
  let seenOpts = null;
  const id = await resolveCollectionId(
    { name: 'b2v', careers_url: 'https://jobs.b2venture.vc/jobs' },
    { safeGetImpl: async (url, o) => { seenUrl = url; seenOpts = o; return { status: 200, text: nextDataHtml(4283) }; } },
  );
  assert.equal(id, '4283');
  assert.equal(seenUrl, 'https://jobs.b2venture.vc/jobs');
  assert.ok(seenOpts && Number.isFinite(seenOpts.maxBytes) && seenOpts.maxBytes > 0, 'a byte cap is passed to safeGet');
  assert.ok(seenOpts && Number.isFinite(seenOpts.timeoutMs) && seenOpts.timeoutMs > 0, 'a timeout is passed to safeGet');
});

test('resolveCollectionId: fail-soft null on non-https / non-200 / bad html / fetch error / nothing', async () => {
  // http:// is never fetched at all
  assert.equal(
    await resolveCollectionId({ careers_url: 'http://x' }, { safeGetImpl: async () => { throw new Error('must not be called'); } }),
    null,
  );
  // non-200 response
  assert.equal(await resolveCollectionId({ careers_url: 'https://x' }, { safeGetImpl: async () => ({ status: 403, text: '' }) }), null);
  // 200 but no __NEXT_DATA__
  assert.equal(await resolveCollectionId({ careers_url: 'https://x' }, { safeGetImpl: async () => ({ status: 200, text: '<html>nope</html>' }) }), null);
  // the fetch throws → null (caller turns that into a helpful error)
  assert.equal(await resolveCollectionId({ careers_url: 'https://x' }, { safeGetImpl: async () => { throw new Error('DNS'); } }), null);
  // neither an id nor a careers_url
  assert.equal(await resolveCollectionId({ name: 'x' }, {}), null);
});

// v1.242.0 — safeGet ignores `timeoutMs` whenever a `signal` is present, and
// the scanner always passes one: the 15s bound was DEAD, so a stalled
// careers_url held the worker until the scanner's own (much longer) signal
// fired — or forever. resolveCollectionId now combines the caller's signal
// with a hard deadline (withTimeout). `opts.timeoutMs` is an injectable
// override so this is testable in milliseconds.
test('resolveCollectionId: a stalled careers page fails soft AT the deadline (timeout is live even with a signal)', async () => {
  const stalled = (signal) => new Promise((_, reject) => {
    const bail = setTimeout(() => reject(new Error('test bailout: no deadline fired')), 1200);
    signal?.addEventListener('abort', () => {
      clearTimeout(bail);
      reject(signal?.reason ?? new Error('aborted'));
    }, { once: true });
    if (signal?.aborted) {
      clearTimeout(bail);
      reject(signal.reason ?? new Error('aborted'));
    }
  });
  const t0 = Date.now();
  const id = await resolveCollectionId(
    { careers_url: 'https://jobs.b2venture.vc' },
    { timeoutMs: 40, safeGetImpl: (_url, opts) => stalled(opts.signal) },
  );
  assert.equal(id, null, 'a stalled page resolves to null, never a hang');
  assert.ok(Date.now() - t0 < 1000, `bounded by the 40ms deadline (took ${Date.now() - t0}ms)`);
});

test('resolveCollectionId: an already-aborted upstream signal fails immediately', async () => {
  const ac = new AbortController();
  ac.abort();
  const id = await resolveCollectionId(
    { careers_url: 'https://jobs.b2venture.vc' },
    {
      signal: ac.signal,
      timeoutMs: 5000,
      safeGetImpl: (_url, opts) => new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => reject(opts.signal.reason ?? new Error('aborted')), { once: true });
        if (opts.signal.aborted) reject(opts.signal.reason ?? new Error('aborted'));
      }),
    },
  );
  assert.equal(id, null, 'the caller signal must still cancel the board-page GET');
});

// ---------------------------------------------------------------------------
// assertGetroUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertGetroUrl: https + host-pinned to api.getro.com', () => {
  const good = `${API_BASE}/4283/search/jobs`;
  assert.equal(assertGetroUrl(good), good);
  assert.throws(() => assertGetroUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertGetroUrl('http://api.getro.com/x'), /HTTPS/);
  assert.throws(() => assertGetroUrl('nonsense'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// toEpochMs — Unix seconds → ms, ISO strings, junk → null
// ---------------------------------------------------------------------------

test('toEpochMs: Unix seconds → ms, ISO string → ms, non-positive/junk → null', () => {
  assert.equal(toEpochMs(1_900_000_000), 1_900_000_000_000); // seconds → ms
  assert.equal(toEpochMs(1_900_000_000_000), 1_900_000_000_000); // already ms
  assert.equal(toEpochMs('2026-01-01T00:00:00.000Z'), Date.parse('2026-01-01T00:00:00.000Z'));
  assert.equal(toEpochMs(0), null);
  assert.equal(toEpochMs(-5), null);
  assert.equal(toEpochMs(null), null);
  assert.equal(toEpochMs(''), null);
  assert.equal(toEpochMs('not-a-date'), null);
});

// v1.242.0 — an epoch beyond new Date()'s range made new Date(ms).toISOString()
// throw RangeError from inside the row loop, aborting the WHOLE board for one
// garbage row. Out-of-range values now drop just that row's date (null).
test('toEpochMs: absurd epochs (past the ECMAScript max date) → null, not a downstream RangeError', () => {
  assert.equal(toEpochMs(1e300), null, '1e300 must not survive into new Date().toISOString()');
  assert.equal(toEpochMs(8_640_000_000_000_001), null); // one past the ECMA-262 max (±8.64e15 ms)
  assert.equal(toEpochMs(8_640_000_000_000_000), 8_640_000_000_000_000, 'the boundary itself is representable');
});

test('normalizeGetroJob: a job url that is not https is dropped (scheme unchecked before)', () => {
  assert.equal(normalizeGetroJob({ title: 'x', url: 'http://jobs.b2venture.vc/1' }), null, 'http is a downgrade, not a posting');
  assert.equal(normalizeGetroJob({ title: 'x', url: 'javascript:alert(1)' }), null);
  assert.equal(normalizeGetroJob({ title: 'x', url: 'not a url' }), null);
  assert.equal(normalizeGetroJob({ title: 'x', url: '   ' }), null);
  const n = normalizeGetroJob(job(1));
  assert.equal(n.url, 'https://jobs.b2venture.vc/1', 'https rows keep their url');
});

test('fetchGetro: a row with an absurd created_at is kept with date "" — one bad row, not a dead board', async () => {
  const jobs = await fetchGetro(null, {
    fetchImpl: async () => ok({
      results: { count: 2, jobs: [job('a', { created_at: 1e300 }), job('b')] },
    }),
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 30 },
  });
  assert.equal(jobs.length, 2, 'the RangeError used to abort the whole board here');
  assert.equal(jobs.find((j) => j.url.endsWith('/a')).date, '');
  assert.ok(jobs.find((j) => j.url.endsWith('/b')).date !== undefined);
});

// ---------------------------------------------------------------------------
// normalizeGetroJob — shape + portfolio-employer attribution
// ---------------------------------------------------------------------------

test('normalizeGetroJob: maps into the web-ui shape; url-less rows are dropped', () => {
  const n = normalizeGetroJob(job(1, { created_at: 1_900_000_000 }), 'b2venture');
  assert.ok(n);
  assert.equal(n.title, 'Role 1');
  assert.equal(n.company, 'Acme'); // portfolio employer, not the fund
  assert.equal(n.url, 'https://jobs.b2venture.vc/1');
  assert.equal(n.location, 'Zurich');
  assert.equal(n.salary, '');
  assert.equal(n.relocates, false);
  assert.equal(n.source, 'getro');
  assert.equal(n.date, new Date(1_900_000_000_000).toISOString());
  assert.ok(n.id.startsWith('getro-'));
  assert.equal(normalizeGetroJob({ title: 'x' }), null); // no url
  assert.equal(normalizeGetroJob(null), null);
});

test('normalizeGetroJob: employer falls back organization.name → organization_name → entry name', () => {
  assert.equal(
    normalizeGetroJob({ url: 'https://x/a', organization: { name: 'Portfolio Co' } }, 'Fund').company,
    'Portfolio Co',
  );
  assert.equal(
    normalizeGetroJob({ url: 'https://x/b', organization_name: 'Flat Co' }, 'Fund').company,
    'Flat Co',
  );
  assert.equal(
    normalizeGetroJob({ url: 'https://x/c' }, 'Fund Fallback').company,
    'Fund Fallback',
  );
});

// ---------------------------------------------------------------------------
// fetchGetro — collection required, redirect:'error', pagination, dedup,
// dead-board contract, age cutoff
// ---------------------------------------------------------------------------

test('fetchGetro: throws when neither a numeric getro_collection nor a resolvable careers_url is present', async () => {
  await assert.rejects(
    () => fetchGetro(null, { fetchImpl: async () => ok({}), company: { name: 'b2v' } }),
    /getro_collection/,
  );
  // a careers_url is present but the page carries no network.id → still throws
  await assert.rejects(
    () => fetchGetro(null, {
      company: { name: 'b2v', careers_url: 'https://jobs.b2venture.vc' },
      safeGetImpl: async () => ({ status: 200, text: '<html>no next data</html>' }),
      fetchImpl: async () => ok({}),
    }),
    /getro_collection|careers_url/,
  );
});

test('fetchGetro: auto-resolves the collection id from careers_url, then scans that collection', async () => {
  let apiUrl = null;
  let safeGetCalls = 0;
  const jobs = await fetchGetro(null, {
    company: { name: 'b2v', careers_url: 'https://jobs.b2venture.vc/jobs', getro_max_age_days: 0 },
    safeGetImpl: async () => { safeGetCalls += 1; return { status: 200, text: nextDataHtml(4283) }; },
    fetchImpl: async (url) => { apiUrl = url; return ok({ results: { count: 1, jobs: [job(1)] } }); },
  });
  assert.equal(safeGetCalls, 1, 'the board page is fetched exactly once to resolve the id');
  assert.equal(apiUrl, 'https://api.getro.com/api/v2/collections/4283/search/jobs');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Acme');
});

test('fetchGetro: an explicit getro_collection skips the careers_url fetch entirely', async () => {
  let safeGetCalls = 0;
  await fetchGetro(null, {
    company: { name: 'b2v', getro_collection: 4283, careers_url: 'https://jobs.b2venture.vc', getro_max_age_days: 0 },
    safeGetImpl: async () => { safeGetCalls += 1; return { status: 200, text: nextDataHtml(999) }; },
    fetchImpl: async () => ok({ results: { count: 1, jobs: [job(1)] } }),
  });
  assert.equal(safeGetCalls, 0, 'explicit id must not trigger a board-page fetch');
});

test('fetchGetro: host-pins the URL and passes POST + redirect:"error"', async () => {
  let seenUrl = null;
  let seenOpts = null;
  await fetchGetro(null, {
    fetchImpl: async (url, opts) => { seenUrl = url; seenOpts = opts; return ok({ results: { count: 1, jobs: [job(1)] } }); },
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 0 },
  });
  assert.equal(seenUrl, 'https://api.getro.com/api/v2/collections/4283/search/jobs');
  assert.equal(seenOpts.method, 'POST');
  assert.equal(seenOpts.redirect, 'error');
  assert.deepEqual(JSON.parse(seenOpts.body), { hitsPerPage: 20, page: 0 });
});

test('fetchGetro: paginates newest-first, count-bounded, across pages', async () => {
  // count=45 with 20/page ⇒ pages 0,1 full (20 each), page 2 partial (5) → 45.
  let calls = 0;
  const pages = [
    Array.from({ length: 20 }, (_, i) => job(`p0-${i}`)),
    Array.from({ length: 20 }, (_, i) => job(`p1-${i}`)),
    Array.from({ length: 5 }, (_, i) => job(`p2-${i}`)),
  ];
  const jobs = await fetchGetro(null, {
    fetchImpl: async (_url, opts) => {
      calls += 1;
      const page = JSON.parse(opts.body).page;
      return ok({ results: { count: 45, jobs: pages[page] || [] } });
    },
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 0 },
  });
  assert.equal(calls, 3, 'fetches exactly pages 0,1,2 then stops (page*20 >= count)');
  assert.equal(jobs.length, 45);
  assert.ok(jobs.every((j) => j.source === 'getro'));
});

test('fetchGetro: dedupes jobs repeated by url across pages', async () => {
  // page 0: A,B ; page 1: B(dup),C → 3 unique. count=40 keeps page 1 in range.
  const pages = [
    [job('A'), job('B')],
    [job('B'), job('C')],
  ];
  const jobs = await fetchGetro(null, {
    fetchImpl: async (_url, opts) => {
      const page = JSON.parse(opts.body).page;
      return ok({ results: { count: 40, jobs: pages[page] || [] } });
    },
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 0 },
  });
  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((j) => j.url).sort(), [
    'https://jobs.b2venture.vc/A',
    'https://jobs.b2venture.vc/B',
    'https://jobs.b2venture.vc/C',
  ]);
});

test('fetchGetro: DEAD BOARD — a page-0 failure throws (nothing collected)', async () => {
  await assert.rejects(
    () => fetchGetro(null, {
      fetchImpl: async () => ({ ok: false, status: 503 }),
      company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 0 },
    }),
    /HTTP 503/,
  );
});

test('fetchGetro: a page-2 failure after ≥1 success keeps the partials', async () => {
  let calls = 0;
  const jobs = await fetchGetro(null, {
    fetchImpl: async (_url, opts) => {
      calls += 1;
      const page = JSON.parse(opts.body).page;
      if (page === 0) return ok({ results: { count: 40, jobs: [job('A'), job('B')] } });
      return { ok: false, status: 500 }; // second request (page 1) blows up
    },
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 0 },
  });
  assert.equal(calls, 2, 'fetched page 0 (ok) then page 1 (failed)');
  assert.equal(jobs.length, 2, 'the 2 jobs from page 0 are kept, no throw');
  assert.deepEqual(jobs.map((j) => j.url), [
    'https://jobs.b2venture.vc/A',
    'https://jobs.b2venture.vc/B',
  ]);
});

test('fetchGetro: age cutoff breaks pagination once a dated job is older than the window', async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const recent = job('recent', { created_at: nowSec }); // now → kept
  const undated = job('undated'); // no created_at → kept ("missing = pass")
  const old = job('old', { created_at: nowSec - 100 * 86_400 }); // 100d ago → past a 30d window
  let calls = 0;
  const jobs = await fetchGetro(null, {
    fetchImpl: async (_url, opts) => {
      calls += 1;
      const page = JSON.parse(opts.body).page;
      // count is huge so only the age cutoff can stop the walk.
      return ok({ results: { count: 100_000, jobs: page === 0 ? [recent, undated, old] : [job(`later-${page}`)] } });
    },
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 30 },
  });
  assert.equal(calls, 1, 'the stale row triggers reachedOld → no further pages fetched');
  assert.equal(jobs.length, 2, 'recent + undated kept, the old one dropped');
  assert.deepEqual(jobs.map((j) => j.url).sort(), [
    'https://jobs.b2venture.vc/recent',
    'https://jobs.b2venture.vc/undated',
  ]);
});

// ---------------------------------------------------------------------------
// salary, all-locations, work_mode remote-detect
// ---------------------------------------------------------------------------

test('getroSalary: annual comp cents → display string the client can re-parse', () => {
  assert.equal(
    getroSalary({ compensation_amount_min_cents: 10_000_000, compensation_amount_max_cents: 15_000_000, compensation_currency: 'usd' }),
    '100000–150000 USD',
  );
  assert.equal(getroSalary({ compensation_amount_min_cents: 12_000_000, compensation_currency: 'EUR' }), '≥ 120000 EUR');
  assert.equal(getroSalary({ compensation_amount_max_cents: 9_000_000 }), '≤ 90000');
  // min > max is normalised low→high.
  assert.equal(getroSalary({ compensation_amount_min_cents: 15_000_000, compensation_amount_max_cents: 10_000_000, compensation_currency: 'USD' }), '100000–150000 USD');
});

test('getroSalary: a non-annual period or absent figure yields "" (missing = pass)', () => {
  assert.equal(getroSalary({ compensation_amount_min_cents: 5000, compensation_period: 'hour' }), '', 'hourly is not an annual figure');
  assert.equal(getroSalary({ compensation_period: 'month', compensation_amount_min_cents: 500_000 }), '', 'monthly is not annual');
  assert.equal(getroSalary({}), '', 'no comp fields');
  assert.equal(getroSalary({ compensation_amount_min_cents: 0, compensation_amount_max_cents: -1 }), '', 'zero/negative are unusable');
  assert.equal(getroSalary(null), '');
  // period 'year' (explicit) is accepted.
  assert.equal(getroSalary({ compensation_period: 'year', compensation_amount_min_cents: 8_000_000, compensation_currency: 'gbp' }), '≥ 80000 GBP');
});

test('getroLocation: joins ALL locations, falls back to searchable_locations', () => {
  assert.equal(getroLocation({ locations: ['Zurich', 'Berlin', ' '] }), 'Zurich, Berlin');
  assert.equal(getroLocation({ locations: [], searchable_locations: ['London', 'Remote - EU'] }), 'London, Remote - EU');
  assert.equal(getroLocation({}), '');
});

test('deriveWorkplace: work_mode:"remote" marks the job remote', () => {
  assert.equal(deriveWorkplace({ work_mode: 'remote' }).isRemote, true);
  assert.equal(deriveWorkplace({ work_mode: 'onsite' }, 'Zurich').isRemote, false);
});

test('normalizeGetroJob: carries the salary string + all-locations + work_mode remote', () => {
  const n = normalizeGetroJob({
    title: 'Staff Engineer',
    url: 'https://jobs.b2venture.vc/x',
    organization: { name: 'Acme' },
    locations: ['Zurich', 'Berlin'],
    work_mode: 'remote',
    compensation_amount_min_cents: 12_000_000,
    compensation_amount_max_cents: 16_000_000,
    compensation_currency: 'CHF',
  });
  assert.equal(n.salary, '120000–160000 CHF');
  assert.equal(n.location, 'Zurich, Berlin');
  assert.equal(n.isRemote, true);
  assert.equal(n.workplaceType, 'Remote');
});

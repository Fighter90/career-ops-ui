/**
 * Oracle Recruiting Cloud (ORC) source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops `tests/providers/oraclecloud.test.mjs` parity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOraclecloud,
  parseOraclecloud,
  resolveSite,
  buildApiUrl,
  buildJobUrl,
  assertOraclecloudUrl,
  resolveMaxPages,
  ORACLE_HOST_RE,
  PAGE_SIZE,
  MAX_PAGES,
  HARD_MAX_PAGES,
} from '../server/lib/sources/oraclecloud.mjs';
import { oraclecloudAdapter } from '../server/lib/portals/adapters/oraclecloud.mjs';

const CAREERS = 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/jobs';
const SITE = { host: 'jpmc.fa.oraclecloud.com', lang: 'en', siteNumber: 'CX_1002' };

// Validate derived URLs by their parsed hostname, never by substring-matching
// the whole URL string (CodeQL js/incomplete-url-substring-sanitization).
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };

// ---------------------------------------------------------------------------
// Fake response helpers
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
  return {
    Id: '210577366',
    Title: 'Client Service Associate',
    PrimaryLocation: 'Newark, DE, United States',
    PostedDate: '2026-07-15',
    WorkplaceTypeCode: 'ORA_ON_SITE',
    ShortDescriptionStr: 'Support the Private Bank &amp; clients',
    ...overrides,
  };
}

function makePage(reqs, total, hasMore = false) {
  return { items: [{ TotalJobsCount: total ?? reqs.length, requisitionList: reqs }], hasMore };
}

function fakeFetch(bodyForUrl) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const body = typeof bodyForUrl === 'function' ? bodyForUrl(url, calls.length) : bodyForUrl;
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// assertOraclecloudUrl / ORACLE_HOST_RE — SSRF guard
// ---------------------------------------------------------------------------

test('assertOraclecloudUrl: accepts base, <region>, and .ocs. host variants', () => {
  assert.equal(assertOraclecloudUrl(CAREERS), CAREERS);
  const region = 'https://oracle.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
  assert.equal(assertOraclecloudUrl(region), region);
  const ocs = 'https://acme.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs';
  assert.equal(assertOraclecloudUrl(ocs), ocs);
  // Numbered apex family oraclecloud1.com … oraclecloud99.com (parent #2683).
  const numbered = 'https://tenant.fa.ocs.oraclecloud26.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs';
  assert.equal(assertOraclecloudUrl(numbered), numbered);
});

test('assertOraclecloudUrl: the numbered apex stays a BOUNDED family (no leading zero, ≤2 digits)', () => {
  // oraclecloud100.com (3 digits) and oraclecloud0.com (leading zero) must NOT
  // widen into a wildcard apex — the pin enumerates a finite family only.
  assert.throws(() => assertOraclecloudUrl('https://t.fa.oraclecloud100.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertOraclecloudUrl('https://t.fa.oraclecloud0.com/jobs'), /untrusted hostname/);
});

test('assertOraclecloudUrl: rejects lookalike hosts, plain HTTP, and junk', () => {
  // Host-suffix spoof: trusted fragment inside a longer evil host.
  assert.throws(
    () => assertOraclecloudUrl('https://x.fa.oraclecloud.com.evil.example/hcmUI/CandidateExperience/en/sites/CX_1/jobs'),
    /untrusted hostname/,
  );
  // Path spoof: oracle host in the path, not the host.
  assert.throws(
    () => assertOraclecloudUrl('https://evil.example/x.fa.oraclecloud.com/sites/CX_1/jobs'),
    /untrusted hostname/,
  );
  // Missing the .fa. label entirely.
  assert.throws(() => assertOraclecloudUrl('https://tenant.oraclecloud.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertOraclecloudUrl('http://jpmc.fa.oraclecloud.com/jobs'), /HTTPS/);
  assert.throws(() => assertOraclecloudUrl('not a url'), /invalid URL/);
  assert.ok(!ORACLE_HOST_RE.test('fa.oraclecloud.com')); // no tenant label
});

// ---------------------------------------------------------------------------
// resolveSite
// ---------------------------------------------------------------------------

test('resolveSite: extracts host, lang and the sites/<n> segment; defaults CX_1', () => {
  assert.deepEqual(resolveSite(CAREERS), {
    host: 'jpmc.fa.oraclecloud.com', lang: 'en', siteNumber: 'CX_1002', locationId: null,
  });
  // No /sites/<n>/ in the path → CX_1; lang read after CandidateExperience.
  const bare = resolveSite('https://acme.fa.oraclecloud.com/hcmUI/CandidateExperience/fr/');
  assert.deepEqual(bare, { host: 'acme.fa.oraclecloud.com', lang: 'fr', siteNumber: 'CX_1', locationId: null });
});

test('resolveSite: honors siteNumber/locationId overrides, rejects non-ORC URLs', () => {
  const over = resolveSite(CAREERS, { siteNumber: 'CX_2001', locationId: 300000000123456 });
  assert.equal(over.siteNumber, 'CX_2001');
  assert.equal(over.locationId, '300000000123456');
  assert.equal(resolveSite('https://example.com/careers'), null);
  assert.equal(resolveSite('http://jpmc.fa.oraclecloud.com/x'), null);
  assert.equal(resolveSite(''), null);
  assert.equal(resolveSite(null), null);
});

// ---------------------------------------------------------------------------
// buildApiUrl / buildJobUrl
// ---------------------------------------------------------------------------

test('buildApiUrl: expand + findReqs; finder grammar, limit/offset in both places', () => {
  const url = buildApiUrl({ ...SITE, locationId: '30012' }, 200, 200);
  assert.equal(hostOf(url), 'jpmc.fa.oraclecloud.com');
  assert.equal(new URL(url).pathname, '/hcmRestApi/resources/latest/recruitingCEJobRequisitions');
  assert.ok(url.includes('onlyData=true'));
  assert.ok(url.includes(`expand=${encodeURIComponent('requisitionList.workLocation,requisitionList.secondaryLocations')}`));
  // Finder grammar: a ';' after findReqs, then comma-separated pairs.
  assert.ok(url.includes('finder=findReqs;siteNumber=CX_1002,'));
  assert.ok(!url.includes('findReqs,siteNumber'));
  assert.ok(url.includes('facetsList=LOCATIONS%3B'));
  assert.ok(url.includes('sortBy=POSTING_DATES_DESC'));
  assert.ok(url.includes('locationId=30012'));
  // limit/offset in BOTH the finder and top-level (some tenants honor only one).
  assert.ok(url.includes(',limit=200,') && url.includes(',offset=200'));
  assert.ok(url.includes('&limit=200&offset=200'));
});

test('buildJobUrl: builds the /sites/<site>/job/<Id> posting URL', () => {
  assert.equal(
    buildJobUrl(SITE, '210577366'),
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/job/210577366',
  );
});

// ---------------------------------------------------------------------------
// parseOraclecloud
// ---------------------------------------------------------------------------

test('parseOraclecloud: maps requisitions to the web-ui job shape', () => {
  const page = makePage([
    makeReq(),
    makeReq({
      Id: '999',
      Title: 'Remote Engineer &amp; Architect',
      PrimaryLocation: undefined,
      PostedDate: undefined,
      WorkplaceTypeCode: 'ORA_REMOTE',
      workLocation: [{ TownOrCity: 'Austin', Region: 'TX', Country: 'United States' }],
      ShortDescriptionStr: undefined,
    }),
  ], 2);
  const { jobs, total, listLen } = parseOraclecloud(page, SITE, 'JPMorgan Chase');
  assert.equal(total, 2);
  assert.equal(listLen, 2);
  assert.equal(jobs.length, 2);

  const [a, b] = jobs;
  assert.equal(a.id, 'oraclecloud-210577366');
  assert.equal(a.title, 'Client Service Associate');
  assert.equal(a.company, 'JPMorgan Chase');
  assert.equal(a.url, 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/job/210577366');
  assert.equal(a.location, 'Newark, DE, United States');
  assert.equal(a.workplaceType, 'Onsite');
  assert.equal(a.isRemote, false);
  assert.equal(a.date, '2026-07-15T00:00:00.000Z');
  assert.equal(a.snippet, 'Support the Private Bank & clients'); // entities decoded
  assert.equal(a.source, 'oraclecloud');
  assert.equal(a.salary, '');
  assert.equal(a.relocates, false);

  // Entity decoding of titles + expanded workLocation + remote flag.
  assert.equal(b.title, 'Remote Engineer & Architect');
  assert.equal(b.location, 'Austin, TX, United States');
  assert.equal(b.workplaceType, 'Remote');
  assert.equal(b.isRemote, true);
  assert.equal(b.date, '');
});

test('parseOraclecloud: prefers a same-host ExternalURL, pins off-host ones back to the built URL', () => {
  const ext = 'https://jpmc.fa.oraclecloud.com/some/external/link';
  const page = makePage([
    makeReq({ ExternalURL: ext }),
    makeReq({ Id: '2', ExternalURL: 'https://evil.example/hijack' }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs[0].url, ext);
  assert.equal(jobs[1].url, buildJobUrl(SITE, '2')); // off-host → built URL
});

test('parseOraclecloud: RequisitionNumber fallback; rows with no resolvable URL dropped', () => {
  const page = makePage([
    { RequisitionNumber: 'R-42', Title: 'Fallback' },
    { Title: 'No Id No URL' },
    makeReq({ Id: '1', Title: 'Keep' }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs.length, 2);
  assert.ok(jobs[0].url.endsWith('/job/R-42'));
  assert.equal(jobs[1].title, 'Keep');
});

test('parseOraclecloud: epoch-0 and invalid PostedDate are guarded (NaN-safe)', () => {
  const page = makePage([
    makeReq({ Id: '1', PostedDate: '1970-01-01' }), // epoch 0 — must survive
    makeReq({ Id: '2', PostedDate: 'not-a-date' }),
    makeReq({ Id: '3', PostedDate: null }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs[0].date, '1970-01-01T00:00:00.000Z');
  assert.equal(jobs[1].date, '');
  assert.equal(jobs[2].date, '');
});

test('parseOraclecloud: returns empty for null/{}/{items:null}/non-array bodies (no crash)', () => {
  for (const body of [null, {}, { items: null }, { items: [] }, { items: [{ requisitionList: 'nope' }] }, 'string']) {
    const { jobs, listLen } = parseOraclecloud(body, SITE, 'X');
    assert.equal(jobs.length, 0);
    assert.equal(listLen, 0);
  }
});

// ---------------------------------------------------------------------------
// fetchOraclecloud — headers, SSRF, pagination, caps, fail-soft
// ---------------------------------------------------------------------------

test('fetchOraclecloud: GETs the trusted host with browser UA, Accept json, redirect:error', async () => {
  const fetchImpl = fakeFetch(makePage([makeReq({ Id: '5', Title: 'Solo' })], 1));
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl, company: { name: 'JPMC' } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'JPMC');
  assert.ok(jobs[0].url.endsWith('/job/5'));
  assert.equal(fetchImpl.calls.length, 1);
  const { url, opts } = fetchImpl.calls[0];
  assert.equal(hostOf(url), 'jpmc.fa.oraclecloud.com');
  assert.ok(new URL(url).pathname.startsWith('/hcmRestApi/'));
  assert.equal(opts.redirect, 'error');
  assert.match(opts.headers['User-Agent'], /Mozilla/);
  assert.equal(opts.headers.Accept, 'application/json');
});

test('fetchOraclecloud: rejects a non-ORC endpoint before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(
    () => fetchOraclecloud('https://example.com/careers', { fetchImpl }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

test('fetchOraclecloud: paginates by offset and stops on a short page (3 pages → 450)', async () => {
  const fetchImpl = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    const len = offset < 400 ? PAGE_SIZE : 50; // offsets 0/200 full, 400 short
    return makePage(
      Array.from({ length: len }, (_, i) => makeReq({ Id: `p${offset}-${i}`, Title: `Role ${i}` })),
      450,
      true, // hasMore:true even on the last page — length/total drive the stop
    );
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(jobs.length, 450);
});

test('fetchOraclecloud: ignores unreliable hasMore:false while pages are full (JPMC quirk)', async () => {
  // total 350: page 0 full (200), page 1 short (150) → 2 requests, even though
  // every response claims hasMore:false (parent parity — trusting it would cap
  // the scan at one page).
  const fetchImpl = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    const len = offset === 0 ? PAGE_SIZE : 150;
    return makePage(
      Array.from({ length: len }, (_, i) => makeReq({ Id: `h${offset}-${i}`, Title: `R${i}` })),
      350,
      false,
    );
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 350);
});

test('fetchOraclecloud: honors max_pages from the entry, hard-capped at MAX_PAGES', async () => {
  const fullPage = () => makePage(
    Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `${Math.random()}-${i}` })),
    100000,
    true,
  );
  const capped = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: capped, company: { max_pages: 2 } });
  assert.equal(capped.calls.length, 2);

  const uncapped = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: uncapped, company: { max_pages: 9999 }, sleep: async () => {} });
  assert.equal(uncapped.calls.length, HARD_MAX_PAGES, 'an oversized opt-in clamps at the 100-page ceiling (upstream #6690)');

  // Cheap cap-math pin: default unchanged, opt-in ceiling finite.
  assert.equal(resolveMaxPages({}), MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 30 }), 30);
  assert.equal(resolveMaxPages({ max_pages: 9999 }), HARD_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 0 }), MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: '5' }), MAX_PAGES);
});

// CAR-255 parity (upstream #6690) — the opt-in ceiling is raised to
// HARD_MAX_PAGES (100): JPMorgan Chase alone has 7000+ postings, which the old
// 25-page opt-in cannot cover; the bound stays finite so a typo can't walk a
// board forever.
// Auto-raise (upstream parity): an entry's own max_pages is the user's choice
// and is kept as set. Without one, a tenant that reports TotalJobsCount
// already bounds the walk, so the default rises to cover that total, up to
// HARD_MAX_PAGES; MAX_PAGES stays the cap only for a tenant that reports no
// total, where nothing else ends the walk.
test('fetchOraclecloud: max_pages opts in up to the 100-page ceiling (CAR-255 parity, upstream #6690)', async () => {
  const fullPage = () => makePage(
    Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `${Math.random()}-${i}` })),
    100000,
    true,
  );
  const noSleep = async () => {};
  // An entry may opt in past the old 25-page ceiling.
  const optIn = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: optIn, company: { max_pages: 30 }, sleep: noSleep });
  assert.equal(optIn.calls.length, 30);

  // The opt-in bound is finite: 9999 clamps at the 100-page ceiling.
  const ceiling = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: ceiling, company: { max_pages: 9999 }, sleep: noSleep });
  assert.equal(ceiling.calls.length, 100);

  // An explicit max_pages is NOT auto-raised: the user's cap is kept as set.
  const explicit = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: explicit, company: { max_pages: 3 }, sleep: noSleep });
  assert.equal(explicit.calls.length, 3, 'an explicit max_pages is kept as set');
});

// Auto-raise (upstream parity): no max_pages + a reported total follows the
// total past 25 pages, silently — the whole board is read and nothing is cut.
test('fetchOraclecloud: with no max_pages the walk follows the reported total (auto-raise)', async () => {
  const noSleep = async () => {};
  const fullPage = () => makePage(
    Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `${Math.random()}-${i}` })),
    100000,
    true,
  );
  // A 7118-posting tenant (JPMC's real size): ceil(7118/200) = 36 pages.
  const totalWalk = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    const len = Math.max(0, Math.min(PAGE_SIZE, 7118 - offset));
    return makePage(
      Array.from({ length: len }, (_, i) => makeReq({ Id: `t${offset + i}`, Title: `R${i}` })),
      7118,
      true,
    );
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl: totalWalk, sleep: noSleep });
  assert.equal(totalWalk.calls.length, 36, '36 pages for a 7118-posting board');
  assert.equal(jobs.length, 7118);
  assert.equal(jobs.truncated, undefined, 'the reported total bounded the walk — nothing is cut');

  // A total beyond HARD_MAX_PAGES: read up to the ceiling and report the cut
  // the same way a max_pages cut is reported.
  const huge = fakeFetch(() => fullPage());
  const jobsHuge = await fetchOraclecloud(CAREERS, { fetchImpl: huge, sleep: noSleep });
  assert.equal(huge.calls.length, HARD_MAX_PAGES, 'the ceiling bounds the auto-raised walk');
  assert.equal(jobsHuge.length, HARD_MAX_PAGES * PAGE_SIZE);
  assert.deepEqual(jobsHuge.truncated, { reason: 'page-cap', fetched: HARD_MAX_PAGES * PAGE_SIZE, total: 100000 });
});

// No max_pages and no reported total: the 25-page default still bounds the walk
// (nothing else would end it), and the cut is reported.
test('fetchOraclecloud: keeps the 25-page default when the tenant reports no total', async () => {
  const noSleep = async () => {};
  const noTotal = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    return {
      items: [{
        requisitionList: Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `n${offset + i}`, Title: `R${i}` })),
      }],
    };
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl: noTotal, sleep: noSleep });
  assert.equal(noTotal.calls.length, MAX_PAGES, 'the default 25-page cap bounds a total-less walk');
  assert.equal(jobs.length, MAX_PAGES * PAGE_SIZE);
  assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: MAX_PAGES * PAGE_SIZE });
});

// CAR-255 parity (upstream oraclecloud) — a cap stop with the tenant still
// reporting more is a partial read, reported in the canonical shape instead
// of returning a silent prefix.
test('fetchOraclecloud: a cap stop marks the board partial (canonical truncation signal)', async () => {
  const fetchImpl = fakeFetch(() => makePage(
    Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `${Math.random()}-${i}` })),
    100000,
    true,
  ));
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl, company: { max_pages: 2 } });
  assert.equal(fetchImpl.calls.length, 2);
  assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: PAGE_SIZE * 2, total: 100000 });
});

test('fetchOraclecloud: a complete board carries no truncation mark', async () => {
  const fetchImpl = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    const len = offset < 400 ? PAGE_SIZE : 50;
    return makePage(
      Array.from({ length: len }, (_, i) => makeReq({ Id: `c${offset}-${i}`, Title: `Role ${i}` })),
      450,
      true,
    );
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.equal(jobs.length, 450);
  assert.equal(jobs.truncated, undefined, 'the walk ended on the tenant total — the board is whole');
});

test('fetchOraclecloud: an opts.maxPages probe costs one request and marks nothing', async () => {
  const fetchImpl = fakeFetch(() => makePage(
    Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `${Math.random()}-${i}` })),
    100000,
    true,
  ));
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl, company: { max_pages: 5 }, maxPages: 1 });
  assert.equal(fetchImpl.calls.length, 1, 'the probe budget bounds the walk');
  assert.equal(jobs.truncated, undefined, 'a probe never reads as a cap stop');
});

test('fetchOraclecloud: first-request failure throws; mid-run blip keeps collected jobs', async () => {
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchOraclecloud(CAREERS, { fetchImpl: failing }), /HTTP 503/);

  let call = 0;
  const blippy = async () => {
    call++;
    if (call === 1) {
      return {
        ok: true,
        json: async () => makePage(
          Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `q-${i}` })),
          1000,
        ),
      };
    }
    return { ok: false, status: 429 };
  };
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl: blippy });
  assert.equal(jobs.length, PAGE_SIZE);
});

// ---------------------------------------------------------------------------
// v1.242.0 — page-0 dead-board guard + the offset-ignored walk
// ---------------------------------------------------------------------------

test('fetchOraclecloud: page 0 with TotalJobsCount>0 but NO requisitionList throws (expand lost)', async () => {
  // The response speaks ORC's envelope but ships no list — the expand= clause
  // was dropped (or a WAF interstitial parsed as JSON). Reading it as an empty
  // board reported a 5000-job tenant as healthy-but-empty forever.
  const fetchImpl = fakeFetch({ items: [{ TotalJobsCount: 5000 }] });
  await assert.rejects(
    () => fetchOraclecloud(CAREERS, { fetchImpl }),
    /page 0 reported TotalJobsCount=5000 but no requisitionList/,
  );
});

test('fetchOraclecloud: page 0 with neither a total nor a list throws (wrong shape)', async () => {
  for (const body of [{}, { items: [] }, { items: [{}] }]) {
    await assert.rejects(
      () => fetchOraclecloud(CAREERS, { fetchImpl: fakeFetch(body) }),
      /page 0 .*response shape changed/,
    );
  }
});

test('fetchOraclecloud: a genuinely empty board (TotalJobsCount=0) still reads as []', async () => {
  const fetchImpl = fakeFetch({ items: [{ TotalJobsCount: 0, requisitionList: [] }] });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.deepEqual(jobs, []);
});

test('fetchOraclecloud: a tenant that ignores offset re-serving page 1 stops after 2 calls', async () => {
  // Every page is "full" with the same rows and the total is stale — only the
  // no-fresh-urls stop condition can end this walk.
  const repeat = makePage(
    Array.from({ length: 3 }, (_, i) => makeReq({ Id: `same-${i}`, Title: `R${i}` })),
    9999,
    true,
  );
  const fetchImpl = fakeFetch(repeat);
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 3);
});

test('parseOraclecloud: ExternalURL must be https on the tenant host', () => {
  const page = makePage([
    // javascript://host/… parses WITH the trusted hostname — the old
    // hostname-only check emitted it as a job link.
    makeReq({ Id: '1', ExternalURL: 'javascript://jpmc.fa.oraclecloud.com/alert(1)' }),
    makeReq({ Id: '2', ExternalURL: 'http://jpmc.fa.oraclecloud.com/insecure' }),
    makeReq({ Id: '3', ExternalURL: 'https://jpmc.fa.oraclecloud.com/ok' }),
    makeReq({ Id: '4' }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs.length, 4);
  for (const j of jobs) {
    const u = new URL(j.url);
    assert.equal(u.protocol, 'https:');
    assert.equal(u.hostname, 'jpmc.fa.oraclecloud.com');
  }
  assert.ok(jobs[0].url.endsWith('/job/1')); // scheme rejected → built URL
  assert.ok(jobs[1].url.endsWith('/job/2'));
  assert.equal(jobs[2].url, 'https://jpmc.fa.oraclecloud.com/ok'); // https same-host kept
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('oraclecloudAdapter: matches provider or ORC host (incl. variants), endpoint host-pinned', () => {
  assert.equal(oraclecloudAdapter.id, 'oraclecloud');
  assert.equal(oraclecloudAdapter.label, 'Oracle Cloud (ORC)');
  assert.ok(oraclecloudAdapter.matches({ provider: 'oraclecloud' }));
  assert.ok(oraclecloudAdapter.matches({ careers_url: CAREERS }));
  assert.ok(oraclecloudAdapter.matches({ careers_url: 'https://oracle.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs' }));
  assert.ok(oraclecloudAdapter.matches({ careers_url: 'https://acme.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs' }));
  assert.ok(!oraclecloudAdapter.matches({ careers_url: 'https://x.fa.oraclecloud.com.evil.example/jobs' }));
  assert.ok(!oraclecloudAdapter.matches({ careers_url: 'https://evil.example/x.fa.oraclecloud.com/jobs' }));
  assert.ok(!oraclecloudAdapter.matches({ careers_url: 'http://jpmc.fa.oraclecloud.com/jobs' }));
  assert.ok(!oraclecloudAdapter.matches(null));

  // Endpoint is the entry's own host-pinned URL; `api:` wins over careers_url.
  assert.equal(oraclecloudAdapter.buildEndpoint({ careers_url: CAREERS }), CAREERS);
  const api = 'https://tenant.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1005/jobs';
  assert.equal(
    oraclecloudAdapter.buildEndpoint({ careers_url: 'https://careers.branded.com', api }),
    api,
  );
  // Explicit provider with an un-pinnable URL → null endpoint (never fetched).
  assert.equal(
    oraclecloudAdapter.buildEndpoint({ provider: 'oraclecloud', careers_url: 'https://careers.branded.com' }),
    null,
  );
});

// ---------------------------------------------------------------------------
// CAR-266 (upstream #6635) — the opt-in `oracle_host` branded-host pin
//
// Dell serves ORC only on its own domain (enterpriseplatform.dell.com — CDN,
// a *.dell.com-only certificate, no *.oraclecloud.com pod host anywhere), so
// there is nothing for the ORC_HOST pattern to match. An entry names that ONE
// host exactly in `oracle_host:`; the pin is exact (never a pattern), checked
// before every fetch, and never widens the https-only rule.
// ---------------------------------------------------------------------------

test('resolveSite: oracle_host admits exactly the named branded host (Dell)', () => {
  const dellApi = 'https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
  // Mixed case in the entry → lowercased exact compare against the URL host.
  const site = resolveSite(dellApi, { oracle_host: 'EnterprisePlatform.dell.com' });
  assert.deepEqual(site, { host: 'enterpriseplatform.dell.com', lang: 'en', siteNumber: 'CX_1001', locationId: null });
});

test('resolveSite: the branded pin is exact — sibling, wildcard, scheme and http: refused', () => {
  const dellApi = 'https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
  // Without oracle_host a branded host is refused exactly as today.
  assert.equal(resolveSite(dellApi), null);
  // A sibling host is not the host the entry named.
  assert.equal(resolveSite(dellApi, { oracle_host: 'other.dell.com' }), null);
  // Wildcards and full URLs are junk → no usable oracle_host → refused.
  assert.equal(resolveSite(dellApi, { oracle_host: '*.dell.com' }), null);
  assert.equal(resolveSite(dellApi, { oracle_host: 'https://enterpriseplatform.dell.com' }), null);
  // A lookalike suffix is not an exact match.
  assert.equal(
    resolveSite('https://enterpriseplatform.dell.com.evil.example/jobs', { oracle_host: 'enterpriseplatform.dell.com' }),
    null,
  );
  // http: stays refused even with the pin — the pin never widens the scheme.
  assert.equal(
    resolveSite('http://enterpriseplatform.dell.com/x', { oracle_host: 'enterpriseplatform.dell.com' }),
    null,
  );
});

test('assertOraclecloudUrl: an exact oracle_host is admitted; sibling and http: rejected', () => {
  const url = 'https://enterpriseplatform.dell.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions';
  assert.equal(assertOraclecloudUrl(url, 'enterpriseplatform.dell.com'), url);
  assert.throws(() => assertOraclecloudUrl(url), /untrusted hostname/);
  assert.throws(() => assertOraclecloudUrl(url, 'other.dell.com'), /untrusted hostname/);
  assert.throws(
    () => assertOraclecloudUrl('http://enterpriseplatform.dell.com/jobs', 'enterpriseplatform.dell.com'),
    /HTTPS/,
  );
});

test('fetchOraclecloud: fetches only from the pinned branded host (Dell end-to-end)', async () => {
  const dellApi = 'https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
  const fetchImpl = fakeFetch(makePage([
    makeReq({ Id: '1', Title: 'Corporate Strategy Manager', PrimaryLocation: 'Round Rock, TX' }),
  ], 1));
  const jobs = await fetchOraclecloud(dellApi, {
    fetchImpl,
    company: { name: 'Dell', oracle_host: 'EnterprisePlatform.dell.com' },
  });
  assert.equal(jobs.length, 1);
  assert.equal(hostOf(fetchImpl.calls[0].url), 'enterpriseplatform.dell.com');
  assert.ok(new URL(fetchImpl.calls[0].url).pathname.startsWith('/hcmRestApi/'));
  // Postings stay on the branded host (built from the resolved site).
  assert.ok(jobs[0].url.startsWith('https://enterpriseplatform.dell.com/hcmUI/'));
  assert.ok(jobs[0].url.endsWith('/job/1'));

  // The same branded endpoint with NO oracle_host never reaches the network.
  let called = false;
  const nosyFetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(
    () => fetchOraclecloud(dellApi, { fetchImpl: nosyFetch }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

test('oraclecloudAdapter: oracle_host claims a branded host exactly (detect parity, #6635)', () => {
  const dellUrl = 'https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
  const dell = { name: 'Dell', careers_url: dellUrl, oracle_host: 'EnterprisePlatform.dell.com' };
  assert.ok(oraclecloudAdapter.matches(dell));
  assert.equal(oraclecloudAdapter.buildEndpoint(dell), dellUrl);
  // Without oracle_host the branded entry is refused (the pattern never claims it).
  const bare = { name: 'Dell', careers_url: dellUrl };
  assert.ok(!oraclecloudAdapter.matches(bare));
  assert.equal(oraclecloudAdapter.buildEndpoint(bare), null);
  // A sibling oracle_host does not claim the entry either.
  const sibling = { ...dell, oracle_host: 'other.dell.com' };
  assert.ok(!oraclecloudAdapter.matches(sibling));
  assert.equal(oraclecloudAdapter.buildEndpoint(sibling), null);
  // An explicit provider pin still needs a trusted URL — now incl. oracle_host.
  assert.equal(
    oraclecloudAdapter.buildEndpoint({ provider: 'oraclecloud', careers_url: dellUrl }),
    null,
  );
  assert.equal(
    oraclecloudAdapter.buildEndpoint({ provider: 'oraclecloud', careers_url: dellUrl, oracle_host: 'enterpriseplatform.dell.com' }),
    dellUrl,
  );
});

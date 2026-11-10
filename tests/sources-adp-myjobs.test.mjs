// ADP myjobs source (CAR-254 port of the parent's providers/adp-myjobs.mjs,
// upstream #6678) — CI-isolated suite.
//
// ADP Recruiting Management career sites live at
// `https://myjobs.adp.com/{site}/cx/...` and serve a public no-auth JSON API
// on the same host. Every list/detail call needs the tenant's `orgoid`
// header (resolved once from the site slug through /career-site/{site} and
// cached), an explicit `Accept-Language` (Accept-Language: * silently
// answers an empty board), and a `$top`/`$skip` page walk. The parser fails
// CLOSED on a body without jobRequisitions[]; a present-and-empty array is
// []. A walk the API stalls (repeated pages) or a max_pages cap ends is
// tagged `adpMyjobsTruncated` and warned, never presented as complete. No
// network — fetchAdpMyjobs runs on a fake fetchImpl with an injectable
// sleep and idCache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  HOST,
  PAGE_SIZE,
  MAX_PAGES_CAP,
  resolveSite,
  assertAdpMyjobsUrl,
  buildListUrl,
  buildDetailUrl,
  buildPostingUrl,
  extractLocation,
  parseListPage,
  parseAdpMyjobsConfig,
  fetchAdpMyjobs,
} from '../server/lib/sources/adp-myjobs.mjs';
import { adpMyjobsAdapter } from '../server/lib/portals/adapters/adp-myjobs.mjs';

const ORGOID = 'ABCDEFGH12345678';
const CAREERS_URL = 'https://myjobs.adp.com/examplesite/cx/job-listing';
const ENTRY = { name: 'ExampleCo', careers_url: CAREERS_URL };

/** One list row in the shape /job-requisitions returns. */
const row = (reqId, jobTitle, extra = {}) => ({
  reqId, jobTitle, clientRequisitionID: `R-${reqId}`, requisitionLocations: [], ...extra,
});

/** A fake fetchImpl answering by URL from a handler; records every call. */
function makeFetch(handler) {
  const calls = [];
  const impl = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const answer = await handler(String(url), opts, calls.length);
    return answer;
  };
  return { calls, impl };
}

const okJson = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
const badStatus = (status) => ({ ok: false, status, headers: { get: () => null }, text: async () => '' });

const SLEEP = async () => {};
const siteResp = okJson({ orgoid: ORGOID, clientName: 'Example' });
const skipOf = (url) => Number(new URL(url).searchParams.get('$skip'));
const mkRows = (start, n) => Array.from({ length: n }, (_, i) => row(String(start + i), `Job ${start + i}`));
const fetchBoard = async (handler, opts = {}) => {
  const f = makeFetch(handler);
  const jobs = await fetchAdpMyjobs(buildListUrl(0), {
    fetchImpl: f.impl, sleep: SLEEP, idCache: new Map(), company: ENTRY, ...opts,
  });
  return { jobs, calls: f.calls };
};

// ── registry meta + adapter contract ─────────────────────────────────────────

test('adp-myjobs: meta — value, label, region en; adapter contract shape', () => {
  assert.deepEqual(meta, { value: 'adp-myjobs', label: 'ADP myjobs', region: 'en' });
  assert.equal(adpMyjobsAdapter.id, 'adp-myjobs');
  assert.equal(typeof adpMyjobsAdapter.matches, 'function');
  assert.equal(typeof adpMyjobsAdapter.buildEndpoint, 'function');
  assert.equal(typeof adpMyjobsAdapter.fetch, 'function');
});

test('adp-myjobs: adapter claims a myjobs.adp.com/{site}/... entry and builds the list endpoint', () => {
  assert.equal(adpMyjobsAdapter.matches(ENTRY), true);
  assert.equal(adpMyjobsAdapter.matches({ name: 'X', careers_url: 'https://myjobs.adp.com/examplesite' }), true);
  assert.equal(adpMyjobsAdapter.matches({ name: 'X', careers_url: 'https://example.com/careers', api: CAREERS_URL }), true);
  assert.equal(adpMyjobsAdapter.matches({ name: 'X', provider: 'adp-myjobs', careers_url: 'https://example.com/' }), true);
  for (const bad of [
    { careers_url: 'https://evil.com/myjobs.adp.com/examplesite/cx' },
    { careers_url: 'https://myjobs.adp.com.evil.com/examplesite/cx' },
    { careers_url: 'http://myjobs.adp.com/examplesite/cx' },
    { careers_url: 'https://myjobs.adp.com/' },
    { careers_url: 'https://myjobs.adp.com/public/staffing/v1/job-requisitions' },
    { careers_url: 'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=a&ccId=b' },
    { careers_url: 'not a url' },
    { careers_url: '' }, { careers_url: null }, { careers_url: 42 }, {}, null,
  ]) {
    assert.equal(adpMyjobsAdapter.matches(bad), false, JSON.stringify(bad));
  }
  assert.equal(adpMyjobsAdapter.buildEndpoint(ENTRY), buildListUrl(0));
  assert.equal(adpMyjobsAdapter.buildEndpoint({ careers_url: 'https://example.com/x' }), null);
});

test('adp-myjobs: resolveSite keeps the slug as written and matches the host case-insensitively', () => {
  assert.equal(resolveSite({ careers_url: 'https://MyJobs.ADP.com/Apply/cx' }), 'Apply');
  assert.equal(resolveSite({ api: CAREERS_URL, careers_url: 'https://example.com/x' }), 'examplesite');
  assert.equal(resolveSite({ careers_url: 'https://myjobs.adp.com/examplesite/cx/job-details?reqId=5001' }), 'examplesite');
  assert.equal(resolveSite({ careers_url: 'https://myjobs.adp.com/' }), null);
  assert.equal(resolveSite({ careers_url: 'https://myjobs.adp.com/public/x' }), null);
  assert.equal(resolveSite({ careers_url: 'https://myjobs.adp.com/myadp_prefix/x' }), null);
  assert.equal(resolveSite({ careers_url: 'https://myjobs.adp.com/admin/x' }), null);
  assert.equal(resolveSite(null), null);
});

test('adp-myjobs: assertAdpMyjobsUrl accepts only the exact API host on https', () => {
  const list = buildListUrl(0);
  assert.equal(assertAdpMyjobsUrl(list), list);
  assert.throws(() => assertAdpMyjobsUrl('http://myjobs.adp.com/public/staffing/v1/job-requisitions'), /HTTPS/);
  assert.throws(() => assertAdpMyjobsUrl('https://evil.com/public/staffing/v1/job-requisitions'), /myjobs/);
  assert.throws(() => assertAdpMyjobsUrl('https://myjobs.adp.com.evil.com/x'), /myjobs/);
  assert.equal(HOST, 'myjobs.adp.com');
  assert.equal(PAGE_SIZE, 200);
  assert.equal(MAX_PAGES_CAP, 1500);
});

// ── URL builders ─────────────────────────────────────────────────────────────

test('adp-myjobs: buildPostingUrl/buildDetailUrl/buildListUrl', () => {
  assert.equal(
    buildPostingUrl('apply', '5001236109606'),
    'https://myjobs.adp.com/apply/cx/job-details?rb=CareerSite&reqId=5001236109606',
  );
  assert.equal(buildPostingUrl('apply', '\uD800'), null);
  const list = new URL(buildListUrl(40));
  assert.equal(`${list.origin}${list.pathname}`, 'https://myjobs.adp.com/public/staffing/v1/job-requisitions');
  assert.equal(list.searchParams.get('rb'), 'CareerSite');
  assert.equal(list.searchParams.get('$top'), '200');
  assert.equal(list.searchParams.get('$skip'), '40');
  assert.ok(!list.search.includes('limit=') && !list.search.includes('offset='));
  const detail = new URL(buildDetailUrl('5001236109606'));
  assert.equal(detail.pathname, '/public/staffing/v1/job-requisitions/5001236109606');
  assert.equal(detail.searchParams.get('rb'), 'CareerSite');
  assert.equal(detail.searchParams.get('lang'), 'en_US');
  assert.equal(buildDetailUrl('\uD800'), null);
});

// ── extractLocation ──────────────────────────────────────────────────────────

test('adp-myjobs: extractLocation builds City, ST, Country, dedupes, and falls back to the nameCode label', () => {
  assert.equal(
    extractLocation({ requisitionLocations: [
      { address: { cityName: 'Stamford', countrySubdivisionLevel1: { codeValue: 'CT', longName: 'Connecticut' }, country: { codeValue: 'USA' } }, nameCode: { longName: 'Stamford CT (1266 East Main St. - 17011)' } },
      { address: { cityName: 'Stamford', countrySubdivisionLevel1: { codeValue: 'CT' }, country: { codeValue: 'USA' } } },
      { address: { cityName: 'Hyderabad', countrySubdivisionLevel1: { codeValue: 'IND-TG', longName: 'Telangana' }, country: { longName: 'India' } } },
      { nameCode: { longName: 'Remote - US' } },
    ] }),
    'Stamford, CT, USA / Hyderabad, Telangana, India / Remote - US',
  );
  assert.equal(extractLocation({}), '');
  assert.equal(extractLocation(null), '');
});

// ── parseListPage ────────────────────────────────────────────────────────────

test('adp-myjobs: parseListPage drops rows without id/title, keeps count and the raw row count', () => {
  const cfg = { site: 'examplesite', companyName: 'ExampleCo' };
  const parsed = parseListPage({ count: 5, jobRequisitions: [
    row('1', 'Engineer'),
    { reqId: '2', clientRequisitionID: 'x', type: 'Sourcing' },  // no title at all — talent pool, dropped
    row('3', '   '),                                             // blank title — dropped
    row('', 'No id'),                                            // no reqId — dropped
    null, 'junk',
    { reqId: 4, publishedJobTitle: 'Published Title' },          // numeric id, alt title field
  ] }, cfg);
  assert.equal(parsed.jobs.length, 2);
  assert.equal(parsed.total, 5);
  assert.equal(parsed.rawCount, 7);
  assert.equal(parsed.jobs[0].requisitionId, 'R-1');
  assert.equal(parsed.jobs[0].company, 'ExampleCo');
  assert.equal(parsed.jobs[1].title, 'Published Title');
  assert.ok(parsed.jobs[1].url.endsWith('reqId=4'));
  assert.equal(parseListPage({ jobRequisitions: [] }, cfg).total, null);
});

test('adp-myjobs: parseListPage throws on a body without jobRequisitions[], naming the keys', () => {
  const cfg = { site: 'examplesite', companyName: 'ExampleCo' };
  for (const bad of [null, '', 42, true, [], {}, { jobRequisitions: null }, { jobRequisitions: {} }, { message: 'x' }]) {
    assert.throws(() => parseListPage(bad, cfg), /adp-myjobs: unexpected response/, JSON.stringify(bad));
  }
  let msg = '';
  try { parseListPage({ count: 4 }, cfg); } catch (err) { msg = err.message; }
  assert.match(msg, /expected jobRequisitions\[\], got: \[count\]/);
});

// ── config parsing ───────────────────────────────────────────────────────────

test('adp-myjobs: parseAdpMyjobsConfig clamps detailLimit and validates orgoid', () => {
  assert.deepEqual(parseAdpMyjobsConfig(ENTRY), { orgoid: null, fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(
    parseAdpMyjobsConfig({ ...ENTRY, adpMyjobs: { orgoid: '  ABCDEFGH12345678 ', fetchDetails: true, detailLimit: 999 } }),
    { orgoid: 'ABCDEFGH12345678', fetchDetails: true, detailLimit: 100 },
  );
  assert.deepEqual(
    parseAdpMyjobsConfig({ ...ENTRY, adpMyjobs: { orgoid: 'short', detailLimit: 0 } }),
    { orgoid: null, fetchDetails: false, detailLimit: 1 },
  );
});

// ── fetchAdpMyjobs ───────────────────────────────────────────────────────────

test('adp-myjobs: fetch resolves the orgoid first, then walks $top/$skip to the count, deduping', async () => {
  const { jobs, calls } = await fetchBoard((url) => {
    if (url.includes('/career-site/')) return siteResp;
    const skip = skipOf(url);
    if (skip === 0) return okJson({ count: 205, jobRequisitions: mkRows(1, 200) });
    return okJson({ count: 205, jobRequisitions: [row('200', 'dup'), ...mkRows(201, 5)] });
  });
  const lists = calls.filter((c) => c.url.includes('/job-requisitions'));
  assert.equal(calls[0].url, 'https://myjobs.adp.com/public/staffing/v1/career-site/examplesite');
  assert.equal(lists.length, 2);
  assert.equal(lists.map((c) => skipOf(c.url)).join(','), '0,200');
  assert.ok(lists.every((c) => new URL(c.url).searchParams.get('$top') === '200'));
  assert.equal(jobs.length, 205);
  assert.ok(calls.every((c) => c.opts.redirect === 'error'));
  assert.ok(lists.every((c) => c.opts.headers.orgoid === ORGOID && c.opts.headers['accept-language'] === 'en-US'));
  assert.equal(calls[0].opts.headers['accept-language'], 'en-US');
  assert.ok(jobs.every((j) => !('_reqId' in j)));
  assert.equal(jobs[0].url, 'https://myjobs.adp.com/examplesite/cx/job-details?rb=CareerSite&reqId=1');
  assert.equal(jobs[0].source, 'adp-myjobs');
  assert.equal(jobs[0].id, `adp-myjobs-${jobs[0].url}`);
  assert.equal(jobs[0].requisitionId, 'R-1');
  assert.ok(!jobs.adpMyjobsTruncated);
});

test('adp-myjobs: an explicit adpMyjobs.orgoid skips the lookup; no count → a short page ends the walk', async () => {
  const { jobs, calls } = await fetchBoard(() => okJson({ jobRequisitions: mkRows(1, 3) }), {
    company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } },
  });
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].url.includes('/career-site/'));
  assert.equal(jobs.length, 3);
});

test('adp-myjobs: the resolved orgoid is cached; the second fetch makes no lookup request', async () => {
  const cache = new Map();
  const handler = (url) => (url.includes('/career-site/') ? siteResp : okJson({ count: 1, jobRequisitions: mkRows(1, 1) }));
  const first = await fetchBoard(handler, { idCache: cache });
  const second = await fetchBoard(handler, { idCache: cache });
  assert.equal((await first).calls.length, 2);
  assert.equal((await second).calls.length, 1);
});

test('adp-myjobs: a bad career-site lookup fails loudly, naming the fix', async () => {
  for (const body of [{}, { orgoid: '' }, { orgoid: 'short' }, null]) {
    await assert.rejects(
      () => fetchBoard(() => okJson(body)),
      /could not resolve orgoid/,
      JSON.stringify(body),
    );
  }
  await assert.rejects(
    () => fetchAdpMyjobs(buildListUrl(0), {
      fetchImpl: makeFetch(() => okJson({})).impl, sleep: SLEEP, idCache: new Map(),
      company: { name: 'X', careers_url: 'https://example.com/x' },
    }),
    /cannot derive the career-site slug/,
  );
});

test('adp-myjobs: a response without jobRequisitions[] throws; a present-and-empty array is []', async () => {
  await assert.rejects(
    () => fetchBoard(() => okJson({ count: 4 }), { company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } }),
    /expected jobRequisitions\[\], got: \[count\]/,
  );
  const { jobs } = await fetchBoard(
    () => okJson({ count: 0, jobRequisitions: [] }),
    { company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } },
  );
  assert.deepEqual(jobs, []);
});

test('adp-myjobs: a 400 surfaces without retrying (the missing-orgoid case)', async () => {
  let attempts = 0;
  await assert.rejects(
    () => fetchAdpMyjobs(buildListUrl(0), {
      fetchImpl: makeFetch(() => { attempts += 1; return badStatus(400); }).impl,
      sleep: SLEEP, idCache: new Map(),
      company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } },
    }),
    (err) => err.status === 400,
  );
  assert.equal(attempts, 1);
});

test('adp-myjobs: a short-but-not-final page keeps walking until the count is reached', async () => {
  const { jobs, calls } = await fetchBoard((url) => {
    const skip = skipOf(url);
    return okJson({ count: 120, jobRequisitions: skip < 120 ? mkRows(skip + 1, Math.min(50, 120 - skip)) : [] });
  }, { company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } });
  assert.equal(jobs.length, 120);
  assert.equal(calls.length, 3);
});

test('adp-myjobs: max_pages truncates a full-page board, warns, and tags the result', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  let jobs;
  try {
    ({ jobs } = await fetchBoard(
      (url) => okJson({ count: 100000, jobRequisitions: mkRows(skipOf(url) + 1, 200) }),
      { company: { ...ENTRY, max_pages: 2, adpMyjobs: { orgoid: ORGOID } } },
    ));
  } finally { console.error = origErr; }
  assert.equal(jobs.length, 400);
  assert.equal(jobs.adpMyjobsTruncated, true);
  assert.ok(warns.some((w) => /raise max_pages/.test(w)));
});

test('adp-myjobs: a natural end on the last allowed page is not a truncation', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  let jobs;
  try {
    ({ jobs } = await fetchBoard(
      (url) => okJson({ count: 250, jobRequisitions: mkRows(skipOf(url) + 1, skipOf(url) === 0 ? 200 : 50) }),
      { company: { ...ENTRY, max_pages: 2, adpMyjobs: { orgoid: ORGOID } } },
    ));
  } finally { console.error = origErr; }
  assert.equal(jobs.length, 250);
  assert.ok(!jobs.adpMyjobsTruncated);
  assert.equal(warns.length, 0);
});

test('adp-myjobs: max_pages is capped hard even when the entry asks for more', async () => {
  const { calls } = await fetchBoard(
    (url) => okJson({ count: 1e9, jobRequisitions: mkRows(skipOf(url) + 1, 200) }),
    { company: { ...ENTRY, max_pages: 99999, adpMyjobs: { orgoid: ORGOID } } },
  );
  assert.equal(calls.length, 1500);
});

test('adp-myjobs: a walk the API stalls (same rows forever) ends after two repeated pages', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  let jobs;
  try {
    ({ jobs } = await fetchBoard(
      () => okJson({ count: 1000, jobRequisitions: mkRows(1, 200) }),
      { company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } },
    ));
  } finally { console.error = origErr; }
  assert.equal(jobs.length, 200);
  assert.equal(jobs.adpMyjobsTruncated, true);
  assert.ok(warns.some((w) => /incomplete/.test(w)));
  assert.ok(!warns.some((w) => /raise max_pages/.test(w)));
});

test('adp-myjobs: one repeated page does not end the walk, but the gap marks the board incomplete', async () => {
  const { jobs, calls } = await fetchBoard((url) => {
    const skip = skipOf(url);
    return okJson({ count: 600, jobRequisitions: skip === 200 ? mkRows(1, 200) : mkRows(skip + 1, 200) });
  }, { company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } });
  assert.equal(calls.length, 3);
  assert.equal(jobs.length, 400);
  assert.equal(jobs.adpMyjobsTruncated, true);
});

test('adp-myjobs: a page-2 5xx exhausts retries and throws — never blamed on max_pages', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  let attempts = 0;
  try {
    await fetchBoard((url) => {
      if (skipOf(url) === 0) return okJson({ count: 400, jobRequisitions: mkRows(1, 200) });
      attempts += 1;
      return badStatus(503);
    }, { company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.status, 503);
  } finally { console.error = origErr; }
  assert.equal(attempts, 3); // 1 attempt + 2 retries
  assert.ok(!warns.some((w) => /raise max_pages/.test(w)));
});

test('adp-myjobs: a maxPages probe makes one list request and no detail calls', async () => {
  const { jobs, calls } = await fetchBoard(
    () => okJson({ count: 500, jobRequisitions: mkRows(1, 200) }),
    { maxPages: 1, company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID, fetchDetails: true } } },
  );
  assert.equal(calls.length, 1);
  assert.equal(jobs.length, 200);
  assert.ok(!jobs.adpMyjobsTruncated);
});

test('adp-myjobs: fetchDetails fills description/snippet/date on the first detailLimit rows, paced and fail-open', async () => {
  const sleeps = [];
  const detail = () => okJson({
    jobRequisitions: [{ jobDescription: '<p>Build <b>things</b></p>', jobQualifications: '<ul><li>Node</li></ul>', postingDate: '2026-11-06T15:18:00Z' }],
  });
  const f = makeFetch((url) => (url.includes('/job-requisitions/') ? detail() : okJson({ count: 5, jobRequisitions: mkRows(1, 5) })));
  const jobs = await fetchAdpMyjobs(buildListUrl(0), {
    fetchImpl: f.impl, idCache: new Map(),
    company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID, fetchDetails: true } },
    sleep: async (ms) => { sleeps.push(ms); },
  });
  const jobsFull = jobs;
  assert.equal(jobsFull.length, 5);
  assert.equal(jobsFull[0].snippet, 'Build things Node');
  assert.equal(jobsFull[0].description, 'Build things Node');
  assert.equal(jobsFull[0].date, new Date(Date.parse('2026-11-06T15:18:00Z')).toISOString());
  const detailCalls = f.calls.filter((c) => /\/job-requisitions\/[^?]*$|\/job-requisitions\/.*lang=/.test(c.url) && !c.url.includes('skip'));
  assert.equal(detailCalls.length, 5); // detailLimit default 25 > 5 rows → all five enriched
  assert.ok(detailCalls.every((c) => c.opts.redirect === 'error' && c.opts.headers.orgoid === ORGOID));
  assert.ok(sleeps.length > 0);

  // detailLimit caps the enrichment…
  const f2 = makeFetch((url) => (url.includes('/job-requisitions/') ? detail() : okJson({ count: 5, jobRequisitions: mkRows(1, 5) })));
  const capped = await fetchAdpMyjobs(buildListUrl(0), {
    fetchImpl: f2.impl, idCache: new Map(), sleep: SLEEP,
    company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID, fetchDetails: true, detailLimit: 2 } },
  });
  assert.equal(f2.calls.filter((c) => /lang=en_US/.test(c.url)).length, 2);
  assert.ok(capped[0].snippet && !capped[2].snippet);

  // …is off unless adpMyjobs.fetchDetails is true…
  const f3 = makeFetch(() => okJson({ count: 1, jobRequisitions: mkRows(1, 1) }));
  await fetchAdpMyjobs(buildListUrl(0), { fetchImpl: f3.impl, idCache: new Map(), sleep: SLEEP, company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID } } });
  assert.equal(f3.calls.length, 1);

  // …and a failed detail fetch keeps the listing row; a bad date stays unset.
  const f4 = makeFetch((url) => (url.includes('lang=en_US') ? badStatus(400) : okJson({ count: 1, jobRequisitions: mkRows(1, 1) })));
  const kept = await fetchAdpMyjobs(buildListUrl(0), {
    fetchImpl: f4.impl, idCache: new Map(), sleep: SLEEP,
    company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID, fetchDetails: true } },
  });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].snippet, '');
  const f5 = makeFetch((url) => (url.includes('lang=en_US')
    ? okJson({ jobRequisitions: [{ jobDescription: 'x', postingDate: 'garbage' }] })
    : okJson({ count: 1, jobRequisitions: mkRows(1, 1) })));
  const badDate = await fetchAdpMyjobs(buildListUrl(0), {
    fetchImpl: f5.impl, idCache: new Map(), sleep: SLEEP,
    company: { ...ENTRY, adpMyjobs: { orgoid: ORGOID, fetchDetails: true } },
  });
  assert.equal(badDate[0].snippet, 'x');
  assert.equal(badDate[0].date, '');
});

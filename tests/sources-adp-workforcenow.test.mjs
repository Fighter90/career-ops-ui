/**
 * ADP Workforce Now source + adapter — CI-isolated tests (fake fetchImpl, no
 * network, no parent-project dependency, no port binding).
 *
 * Parity with parent career-ops `tests/providers/adp-workforcenow.test.mjs`.
 * URL assertions parse the URL and compare extracted pieces with strict
 * equality, never `String.includes` over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  parseTenantUrl,
  buildListUrl,
  buildDetailUrl,
  assertAdpUrl,
  extractExternalJobId,
  extractPostedAt,
  extractLocation,
  extractSalary,
  formatSalary,
  buildPostingUrl,
  parseListPage,
  parseAdpConfig,
  resolveMaxPages,
  fetchAdpWorkforcenow,
  MAX_PAGES_CAP,
} from '../server/lib/sources/adp-workforcenow.mjs';
import { adpWorkforcenowAdapter as adapter } from '../server/lib/portals/adapters/adp-workforcenow.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const CID = '11111111-2222-3333-4444-555555555555';
const CCID = '19000101_000001';
const BASE = '/mascsr/default/mdf/recruitment/recruitment.html';
const CAREERS_URL = `https://workforcenow.adp.com${BASE}?cid=${CID}&ccId=${CCID}`;
const API_PATH = '/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions';
const cfg = { cid: CID, ccId: CCID, companyName: 'ExampleCo' };
const noSleep = { sleep: async () => {}, retryDelayMs: 0 };

const mkJob = (itemId, title, externalId) => ({
  itemID: itemId,
  requisitionTitle: title,
  customFieldGroup: externalId ? { stringFields: [{ nameCode: { codeValue: 'ExternalJobID' }, stringValue: externalId }] } : {},
  requisitionLocations: [{ nameCode: { shortName: 'Toronto, ON' } }],
});
const fullPage = (start) => Array.from({ length: 20 }, (_, i) => mkJob(`item-${start + i}`, `Job ${start + i}`, `ext-${start + i}`));

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, headers: { get: () => null } };
}
/** Fake transport: handler(url, init) -> body | Response-like; records calls. */
function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const out = await handler(url, init, calls.length);
    return out && typeof out.ok === 'boolean' ? out : res(out);
  };
  return { impl, calls };
}
const isDetail = (url) => new URL(url).pathname !== API_PATH;
const skipOf = (url) => Number(new URL(url).searchParams.get('$skip'));
const ENDPOINT = buildListUrl(CID, CCID, 1);
const run = (r, company = { name: 'ExampleCo', careers_url: CAREERS_URL }, extra = {}) =>
  fetchAdpWorkforcenow(ENDPOINT, { fetchImpl: r.impl, company, ...noSleep, ...extra });

test('meta is the EN adp-workforcenow source', () => {
  assert.deepEqual(meta, { value: 'adp-workforcenow', label: 'ADP Workforce Now', region: 'en' });
});

test('adapter shape and endpoint', () => {
  assert.equal(adapter.id, 'adp-workforcenow');
  assert.equal(adapter.label, 'ADP Workforce Now');
  assert.equal(adapter.fetch, fetchAdpWorkforcenow);
  const entry = { name: 'ExampleCo', careers_url: CAREERS_URL };
  assert.equal(adapter.matches(entry), true);
  const endpoint = adapter.buildEndpoint(entry);
  const u = new URL(endpoint);
  assert.equal(u.origin, 'https://workforcenow.adp.com');
  assert.equal(u.pathname, API_PATH);
  assert.equal(u.searchParams.get('cid'), CID);
  assert.equal(u.searchParams.get('ccId'), CCID);
  assert.equal(u.searchParams.get('$skip'), '1');
  assert.equal(u.searchParams.get('$top'), '20');
});

test('detect: query order, api: precedence, explicit provider', () => {
  const swapped = { name: 'X', careers_url: `https://workforcenow.adp.com${BASE}?ccId=${CCID}&cid=${CID}` };
  assert.equal(adapter.matches(swapped), true);
  assert.deepEqual(parseTenantUrl(swapped.careers_url), { cid: CID, ccId: CCID });
  const viaApi = { name: 'X', careers_url: 'https://example.com/careers', api: CAREERS_URL };
  assert.equal(adapter.matches(viaApi), true);
  assert.equal(new URL(adapter.buildEndpoint(viaApi)).searchParams.get('cid'), CID);
  assert.equal(adapter.matches({ name: 'X', provider: 'adp-workforcenow', careers_url: CAREERS_URL }), true);
  assert.equal(adapter.matches({ name: 'X', provider: 'lever', careers_url: CAREERS_URL }), false);
});

for (const [label, careers_url] of [
  ['missing ccId', `https://workforcenow.adp.com${BASE}?cid=only-cid`],
  ['missing cid', `https://workforcenow.adp.com${BASE}?ccId=${CCID}`],
  ['path-spoofed host', `https://evil.com/workforcenow.adp.com/mdf/recruitment/recruitment.html?cid=${CID}&ccId=${CCID}`],
  ['suffix-spoofed host', `https://workforcenow.adp.com.evil.com${BASE}?cid=${CID}&ccId=${CCID}`],
  ['non-HTTPS', `http://workforcenow.adp.com${BASE}?cid=${CID}&ccId=${CCID}`],
  ['malformed', 'not a url'],
  ['null', null],
]) {
  test(`detect rejects: ${label}`, () => {
    const entry = { name: 'X', careers_url };
    assert.equal(adapter.matches(entry), false);
    assert.equal(adapter.buildEndpoint(entry), null);
  });
}

test('adapter never throws on null/undefined entries', () => {
  assert.equal(adapter.matches(null), false);
  assert.equal(adapter.matches(undefined), false);
  assert.equal(adapter.buildEndpoint(null), null);
  assert.equal(adapter.buildEndpoint({ name: 'X' }), null);
});

test('assertAdpUrl is host-pinned and HTTPS-only', () => {
  assert.equal(assertAdpUrl(ENDPOINT), ENDPOINT);
  assert.throws(() => assertAdpUrl('http://workforcenow.adp.com/x'), /HTTPS/);
  assert.throws(() => assertAdpUrl('https://workforcenow.adp.com.evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertAdpUrl('nope'), /invalid URL/);
});

test('buildDetailUrl encodes the id once and drops lone surrogates', () => {
  const u = new URL(buildDetailUrl('a/b 1', CID, CCID));
  assert.equal(u.pathname, `${API_PATH}/a%2Fb%201`);
  assert.equal(u.searchParams.get('lang'), 'en_US');
  assert.equal(u.searchParams.get('locale'), 'en_US');
  assert.equal(buildDetailUrl('\uD800', CID, CCID), null);
});

test('extractExternalJobId reads the ExternalJobID entry; null when absent', () => {
  const group = { stringFields: [
    { nameCode: { codeValue: 'Other' }, stringValue: 'ignore-me' },
    { nameCode: { codeValue: 'ExternalJobID' }, stringValue: ' 2026-1234 ' },
  ] };
  assert.equal(extractExternalJobId(group), '2026-1234');
  assert.equal(extractExternalJobId({ stringFields: [] }), null);
  assert.equal(extractExternalJobId(undefined), null);
  assert.equal(extractExternalJobId({}), null);
});

test('buildPostingUrl: canonical URL, itemID fallback, single encoding, surrogate fail-safe', () => {
  const u = new URL(buildPostingUrl(CID, CCID, '9200947568911_1', '2026-1234'));
  assert.equal(u.origin + u.pathname, `https://workforcenow.adp.com${BASE}`);
  assert.equal(u.searchParams.get('cid'), CID);
  assert.equal(u.searchParams.get('ccId'), CCID);
  assert.equal(u.searchParams.get('jobId'), '2026-1234');
  assert.equal(u.searchParams.get('jwId'), '9200947568911_1');
  assert.equal(u.searchParams.get('type'), 'JS');
  const fb = new URL(buildPostingUrl(CID, CCID, '9200947568911_1', null));
  assert.equal(fb.searchParams.get('jobId'), '9200947568911_1');
  const odd = buildPostingUrl(CID, CCID, 'item/1?part=2', 'REQ/2026 & hiring');
  const oddU = new URL(odd);
  assert.equal(oddU.searchParams.get('jobId'), 'REQ/2026 & hiring');
  assert.equal(oddU.searchParams.get('jwId'), 'item/1?part=2');
  assert.equal(odd.split('%252F').length, 1);
  assert.equal(buildPostingUrl(CID, CCID, 'item-1', '\uD800'), null);
  assert.equal(buildPostingUrl(CID, CCID, '\uD800', null), null);
});

test('extractPostedAt: postDate, PostingDate fallback, NaN-safe', () => {
  assert.equal(extractPostedAt({ postDate: '2026-07-01' }), Date.parse('2026-07-01'));
  assert.equal(extractPostedAt({ customFieldGroup: { dateFields: [{ nameCode: { codeValue: 'PostingDate' }, dateValue: '2026-06-15' }] } }), Date.parse('2026-06-15'));
  assert.equal(extractPostedAt({}), undefined);
  assert.equal(extractPostedAt({ postDate: 'garbage' }), undefined);
});

test('extractLocation: shortName, address fallback, dedupe + " / " join, empty', () => {
  assert.equal(extractLocation({ requisitionLocations: [{ nameCode: { shortName: 'Toronto, ON' } }] }), 'Toronto, ON');
  assert.equal(extractLocation({ requisitionLocations: [{ address: { cityName: 'London', countrySubdivisionLevel1: { codeValue: 'ON' }, country: { codeValue: 'CA' } } }] }), 'London, ON, CA');
  assert.equal(extractLocation({ requisitionLocations: [
    { nameCode: { shortName: 'Toronto, ON' } }, { nameCode: { shortName: 'Remote' } }, { nameCode: { shortName: 'Toronto, ON' } },
  ] }), 'Toronto, ON / Remote');
  assert.equal(extractLocation({}), '');
  assert.equal(extractLocation({ requisitionLocations: [] }), '');
});

test('extractSalary: structured, partial bounds, custom-field fallback, hourly skipped, none', () => {
  const rate = (v) => ({ amountValue: v, currencyCode: 'CAD' });
  assert.deepEqual(extractSalary({ payGradeRange: { minimumRate: rate(50000), maximumRate: rate(70000) } }), { min: 50000, max: 70000, currency: 'CAD' });
  assert.deepEqual(extractSalary({ payGradeRange: { minimumRate: rate(50000) } }), { min: 50000, currency: 'CAD' });
  assert.deepEqual(extractSalary({ payGradeRange: { maximumRate: rate(70000) } }), { max: 70000, currency: 'CAD' });
  const fields = (range, cur) => ({ customFieldGroup: { stringFields: [
    { nameCode: { codeValue: 'SalaryRange' }, stringValue: range },
    { nameCode: { codeValue: 'CurrencySymbolOrCode' }, stringValue: cur },
  ] } });
  assert.deepEqual(extractSalary(fields('$50,000 - $70,000', 'CAD')), { min: 50000, max: 70000, currency: 'CAD' });
  assert.deepEqual(extractSalary(fields('$60,000', '$')), { min: 60000, max: 60000, currency: '' });
  assert.equal(extractSalary(fields('Hourly Rate: $25.00 - $30.00', '$')), null);
  assert.equal(extractSalary({}), null);
});

test('formatSalary renders the display string', () => {
  assert.equal(formatSalary({ min: 50000, max: 70000, currency: 'CAD' }), '50000 - 70000 CAD');
  assert.equal(formatSalary({ min: 60000, max: 60000, currency: '' }), '60000');
  assert.equal(formatSalary({ max: 70000 }), '70000');
  assert.equal(formatSalary(null), '');
});

test('parseListPage: empty page, invalid payloads, positive total without array', () => {
  const empty = parseListPage({ jobRequisitions: [], meta: { totalNumber: 0 } }, cfg);
  assert.equal(empty.jobs.length, 0);
  assert.equal(empty.total, 0);
  for (const bad of [null, 'x', 42, true, []]) {
    assert.throws(() => parseListPage(bad, cfg), /^Error: adp-workforcenow: unrecognized job-requisitions response$/);
  }
  assert.throws(() => parseListPage({ meta: { totalNumber: 30 } }, cfg), /positive totalNumber/);
});

test('parseListPage maps the 12-field job shape and drops unusable rows', () => {
  const parsed = parseListPage({
    jobRequisitions: [
      { ...mkJob('9200947568911_1', 'Instructional Designer', '2026-001'), postDate: '2026-07-01',
        payGradeRange: { minimumRate: { amountValue: 1, currencyCode: 'CAD' } } },
      mkJob('9200947568912_1', 'No External ID Role', null),
      mkJob('r1', 'Remote Role', null),
      { itemID: '', requisitionTitle: 'No itemID' },
      { itemID: 'abc', requisitionTitle: '' },
      null,
    ],
    meta: { totalNumber: 42 },
  }, cfg);
  assert.equal(parsed.jobs.length, 3);
  assert.equal(parsed.total, 42);
  const [a, b] = parsed.jobs;
  assert.equal(a.id, `adp-workforcenow-${CID}-9200947568911_1`);
  assert.equal(a.title, 'Instructional Designer');
  assert.equal(a.company, 'ExampleCo');
  assert.equal(a.location, 'Toronto, ON');
  assert.equal(a.date, '2026-07-01');
  assert.equal(a.salary, '1 CAD');
  assert.equal(a.source, 'adp-workforcenow');
  assert.equal(new URL(a.url).searchParams.get('jobId'), '2026-001');
  assert.equal(new URL(a.url).searchParams.get('jwId'), '9200947568911_1');
  assert.equal(new URL(b.url).searchParams.get('jobId'), '9200947568912_1');
  assert.equal(b.date, '');
  assert.equal(b.salary, '');
});

test('parseAdpConfig / resolveMaxPages clamp', () => {
  assert.deepEqual(parseAdpConfig({}), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseAdpConfig({ adpWorkforcenow: { fetchDetails: true, detailLimit: 9999 } }), { fetchDetails: true, detailLimit: 100 });
  assert.equal(parseAdpConfig({ adpWorkforcenow: { fetchDetails: 'yes', detailLimit: 'x' } }).fetchDetails, false);
  assert.equal(resolveMaxPages({}), 100);
  assert.equal(resolveMaxPages({ max_pages: 5 }), 5);
  assert.equal(resolveMaxPages({ max_pages: 99999 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: -1 }), 100);
});

test('fetch: $skip is 1-based and advances by rows returned; dedups overlap; URL + UA pinned', async () => {
  const pages = [
    { jobRequisitions: fullPage(1), meta: { totalNumber: 25 } },
    { jobRequisitions: [mkJob('item-20', 'Job 20 dup', 'ext-20'), ...fullPage(21).slice(0, 5)], meta: { totalNumber: 25 } },
  ];
  const r = router((url, init, n) => pages[n - 1] ?? { jobRequisitions: [], meta: { totalNumber: 25 } });
  const jobs = await run(r);
  assert.deepEqual(r.calls.map((c) => skipOf(c.url)), [1, 21]);
  assert.equal(jobs.length, 25);
  assert.equal(jobs.every((j) => j._itemId === undefined), true);
  for (const c of r.calls) {
    const u = new URL(c.url);
    assert.equal(u.origin, 'https://workforcenow.adp.com');
    assert.equal(u.pathname, API_PATH);
    assert.equal(c.init.redirect, 'error');
    assert.equal(c.init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  }
});

test('fetch: max_pages is capped at MAX_PAGES_CAP', async () => {
  const r = router((url, init, n) => ({ jobRequisitions: fullPage(n * 20 + 1), meta: { totalNumber: 999999 } }));
  const origError = console.error;
  console.error = () => {};
  try {
    await run(r, { name: 'X', careers_url: CAREERS_URL, max_pages: 1501 });
  } finally { console.error = origError; }
  assert.equal(r.calls.length, MAX_PAGES_CAP);
});

async function withWarnings(fn) {
  const warnings = [];
  const orig = console.error;
  console.error = (m) => warnings.push(String(m));
  try { return { jobs: await fn(), warnings }; } finally { console.error = orig; }
}

test('fetch: cap hit before totalNumber warns and tags adpTruncated', async () => {
  const r = router((url, init, n) => ({ jobRequisitions: fullPage(n * 20 - 19), meta: { totalNumber: 999999 } }));
  const { jobs, warnings } = await withWarnings(() => run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, max_pages: 3 }));
  assert.equal(r.calls.length, 3);
  assert.equal(jobs.adpTruncated, true);
  assert.equal(warnings.some((w) => /truncated/i.test(w) && /raise max_pages/.test(w)), true);
});

test('fetch: cap exhaustion is tagged even when meta.totalNumber is absent', async () => {
  const r = router((url, init, n) => ({ jobRequisitions: fullPage(n * 20 - 19) }));
  const { jobs, warnings } = await withWarnings(() => run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, max_pages: 2 }));
  assert.equal(r.calls.length, 2);
  assert.equal(jobs.adpTruncated, true);
  assert.equal(warnings.some((w) => /truncated/i.test(w)), true);
});

test('fetch: a full page at the cap is potentially truncated even if total says complete', async () => {
  const r = router(() => ({ jobRequisitions: fullPage(1), meta: { totalNumber: 20 } }));
  const { jobs } = await withWarnings(() => run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, max_pages: 1 }));
  assert.equal(jobs.adpTruncated, true);
});

test('fetch: a short final page on the last allowed iteration is not truncated', async () => {
  const r = router((url, init, n) => (n === 1 ? { jobRequisitions: fullPage(1) } : { jobRequisitions: fullPage(21).slice(0, 5) }));
  const { jobs, warnings } = await withWarnings(() => run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, max_pages: 2 }));
  assert.equal(r.calls.length, 2);
  assert.equal(jobs.adpTruncated, undefined);
  assert.equal(jobs.length, 25);
  assert.equal(warnings.length, 0);
});

test('fetch: an empty page stops pagination even when totalNumber claims more', async () => {
  const r = router(() => ({ jobRequisitions: [], meta: { totalNumber: 999 } }));
  const jobs = await run(r);
  assert.equal(jobs.length, 0);
  assert.equal(r.calls.length, 1);
});

test('fetch: a page with no fresh ids stops (server ignored $skip)', async () => {
  const r = router(() => ({ jobRequisitions: fullPage(1), meta: { totalNumber: 999 } }));
  const jobs = await run(r, { name: 'X', careers_url: CAREERS_URL, max_pages: 10 });
  assert.equal(r.calls.length, 2);
  assert.equal(jobs.length, 20);
});

test('fetch: unrecognized shape and exhausted errors propagate, never "0 jobs"', async () => {
  await assert.rejects(run(router(() => ({ unexpectedShape: true }))), /unrecognized job-requisitions response/);
  const err429 = router(() => res({}, 429));
  await assert.rejects(run(err429), (e) => e.status === 429);
  assert.equal(err429.calls.length, 3); // 1 attempt + 2 retries
  const err503 = router(() => res({}, 503));
  await assert.rejects(run(err503), (e) => e.status === 503);
  const err404 = router(() => res({}, 404));
  await assert.rejects(run(err404), (e) => e.status === 404);
  assert.equal(err404.calls.length, 1); // permanent 4xx is not retried
  const bad = { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); }, headers: { get: () => null } };
  await assert.rejects(run(router(() => bad)), /non-JSON 2xx/);
});

test('fetch: a transient failure is retried then succeeds', async () => {
  const r = router((url, init, n) => (n === 1 ? res({}, 503) : { jobRequisitions: [mkJob('i1', 'Role', 'e1')], meta: { totalNumber: 1 } }));
  const jobs = await run(r);
  assert.equal(jobs.length, 1);
  assert.equal(r.calls.length, 2);
});

test('fetch: refuses to leave the ADP host and requires cid/ccId', async () => {
  const r = router(() => ({ jobRequisitions: [], meta: { totalNumber: 0 } }));
  await assert.rejects(fetchAdpWorkforcenow('https://evil.example/x?cid=a&ccId=b', { fetchImpl: r.impl, ...noSleep }), /untrusted hostname/);
  await assert.rejects(fetchAdpWorkforcenow(`https://workforcenow.adp.com${API_PATH}`, { fetchImpl: r.impl, company: { name: 'X' }, ...noSleep }), /cannot derive cid\/ccId/);
  assert.equal(r.calls.length, 0);
});

test('fetch: ctx maxPages probe makes one request and skips detail enrichment', async () => {
  const r = router((url) => (isDetail(url)
    ? { requisitionDescription: 'x' }
    : { jobRequisitions: fullPage(1), meta: { totalNumber: 200 } }));
  const jobs = await run(r, { name: 'X', careers_url: CAREERS_URL, adpWorkforcenow: { fetchDetails: true } }, { maxPages: 1 });
  assert.equal(r.calls.length, 1);
  assert.equal(jobs.adpTruncated, undefined); // a probe's cap is not an incomplete board
});

const oneJob = () => ({ jobRequisitions: [mkJob('item-1', 'Instructional Designer', 'ext-1')], meta: { totalNumber: 1 } });

test('fetch: fetchDetails enriches description + snippet; redirect:error on the detail request', async () => {
  const r = router((url) => (isDetail(url) ? { requisitionDescription: '<p>Great <b>role</b> &amp; team.</p>' } : oneJob()));
  const jobs = await run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, adpWorkforcenow: { fetchDetails: true, detailLimit: 5 } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description.includes('Great role & team.'), true);
  assert.equal(jobs[0].snippet, jobs[0].description);
  assert.equal(r.calls.length, 2);
  assert.equal(r.calls.every((c) => c.init.redirect === 'error'), true);
  const detail = new URL(r.calls[1].url);
  assert.equal(detail.pathname, `${API_PATH}/item-1`);
  assert.equal(detail.searchParams.get('cid'), CID);
});

test('fetch: no detail request unless fetchDetails is true', async () => {
  const r = router((url) => (isDetail(url) ? { requisitionDescription: 'x' } : oneJob()));
  const jobs = await run(r);
  assert.equal(r.calls.length, 1);
  assert.equal(jobs[0].description, undefined);
});

test('fetch: detailLimit bounds the enrichment calls', async () => {
  let detailCalls = 0;
  const r = router((url) => {
    if (isDetail(url)) { detailCalls += 1; return { requisitionDescription: `Description ${detailCalls}` }; }
    return { jobRequisitions: [mkJob('item-1', 'R1', 'e1'), mkJob('item-2', 'R2', 'e2'), mkJob('item-3', 'R3', 'e3')], meta: { totalNumber: 3 } };
  });
  const jobs = await run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, adpWorkforcenow: { fetchDetails: true, detailLimit: 2 } });
  assert.equal(detailCalls, 2);
  assert.equal(jobs.length, 3);
});

test('fetch: a detail failure keeps the listing row', async () => {
  const r = router((url) => (isDetail(url) ? res({}, 404) : oneJob()));
  const jobs = await run(r, { name: 'ExampleCo', careers_url: CAREERS_URL, adpWorkforcenow: { fetchDetails: true } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, undefined);
});

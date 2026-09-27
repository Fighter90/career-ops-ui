/**
 * PeopleSoft Fluid Candidate Gateway source — CI-isolated tests.
 * Fake fetchImpl + stub DNS lookup (no network, no parent-project dependency);
 * fixtures are inlined synthetic copies of the parent's
 * tests/fixtures/peoplesoft-*.html. Parent career-ops
 * `tests/providers/peoplesoft.test.mjs` parity, adapted to the web-ui
 * `fetch(endpoint, { fetchImpl, signal, company })` contract.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveConfig,
  buildSearchUrl,
  buildDetailUrl,
  assertPeoplesoftUrl,
  createCookieJar,
  updateCookieJar,
  cookieHeader,
  readSetCookies,
  extractById,
  extractTextById,
  parseFormState,
  parseReportedTotal,
  parsePeopleSoftDate,
  parseSearchPage,
  parseJobDetail,
  createSession,
  fetchSearchPage,
  fetchAdditionalResults,
  resolveMaxLoadMore,
  parseEntryConfig,
  fetchPeoplesoft,
  LOAD_MORE_ACTION,
  DEFAULT_MAX_LOAD_MORE,
  MAX_REDIRECTS,
} from '../server/lib/sources/peoplesoft.mjs';
import { peoplesoftAdapter } from '../server/lib/portals/adapters/peoplesoft.mjs';

const ORIGIN = 'https://recruit.exampleu.ca';
const SEARCH_URL = `${ORIGIN}/psc/exu1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_SCHJOB_FL&Action=U&FOCUS=Applicant&SiteId=1`;
const CONFIG = { origin: ORIGIN, site: 'exu1', searchUrl: buildSearchUrl(ORIGIN, 'exu1') };
const ACTION = '/psc/exu1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL';

const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };
const PUBLIC_DNS = async () => ({ address: '93.184.216.34' });

// ── Inline fixtures (synthetic, fictional ExampleU) ─────────────────────────

const SEARCH_FIXTURE = `<!DOCTYPE html><html><body><div id="ptifrmtgtframe">
<form name='win0' id='win0' method='post' action="${ACTION}">
<input type="hidden" name="ICAJAX" value="1">
<input type="hidden" name="ICType" value="Panel">
<input type="hidden" name="ICStateNum" value="4">
<input type="hidden" name="ICAction" value="">
<input type="hidden" name="ICSID" value="fake-session-id-0001">
<input type="checkbox" name="HRS_SCH_WRK_KEYWORD_SW" value="Y" checked>
<input type="checkbox" name="UNCHECKED_BOX" value="Y">
<select name="HRS_SCH_WRK_SORT"><option value="A">A</option><option value="B" selected>B</option></select>
<textarea name="NOTES">a &amp; b</textarea>
<span id='win0divHRS_AGNT_RSLT_Irowcnt$0'><span class='ps-text'>3 rows</span></span>
<ul id="win0divHRS_AGNT_RSLT_I$0">
<li class='ps_grid-row' id='HRS_AGNT_RSLT_I$0_row_0'>
  <span class='ps_box-value' id='SCH_JOB_TITLE$0'>Instructional Designer</span>
  <span class='ps_box-value' id='HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$0'>JR00012345</span>
  <span class='ps_box-value' id='LOCATION$0'>London, ON, Canada</span>
  <span class='ps_box-value' id='HRS_APP_JBSCH_I_HRS_DEPT_DESCR$0'>Faculty of Education</span>
  <span class='ps_box-value' id='SCH_OPENED$0'>08/15/2026</span>
</li>
<li class='ps_grid-row' id='HRS_AGNT_RSLT_I$0_row_1'>
  <span class='ps_box-value' id='SCH_JOB_TITLE$1'>Learning &amp; Development Specialist</span>
  <span class='ps_box-value' id='HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$1'>JR00012346</span>
  <span class='ps_box-value' id='LOCATION$1'>Remote - Ontario</span>
  <span class='ps_box-value' id='HRS_APP_JBSCH_I_HRS_DEPT_DESCR$1'>Human Resources</span>
  <span class='ps_box-value' id='SCH_OPENED$1'>08/10/2026</span>
</li>
<li class='ps_grid-row' id='HRS_AGNT_RSLT_I$0_row_2'>
  <span class='ps_box-value' id='SCH_JOB_TITLE$2'>Facilities Coordinator</span>
  <span class='ps_box-value' id='HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$2'>JR00012347</span>
  <span class='ps_box-value' id='LOCATION$2'>London, ON, Canada</span>
  <span class='ps_box-value' id='SCH_OPENED$2'>not-a-real-date</span>
</li>
</ul>
</form></div></body></html>`;

const FRENCH_FIXTURE = `<form name="win0" action="${ACTION}">
  <input type="hidden" name="ICStateNum" value="1">
  <span id="win0divHRS_AGNT_RSLT_Irowcnt$0">Ligne 1 sur 96</span>
  <li id="HRS_AGNT_RSLT_I$0_row_0"><span id="SCH_JOB_TITLE$0">Concepteur pédagogique</span><span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$0">FR-1</span></li>
  <li id="HRS_AGNT_RSLT_I$0_row_1"><span id="SCH_JOB_TITLE$1">Spécialiste en apprentissage</span><span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$1">FR-2</span></li>
</form>`;

const GERMAN_FIXTURE = `<form name="win0" action="${ACTION}">
  <input type="hidden" name="ICStateNum" value="1">
  <span id="win0divHRS_AGNT_RSLT_Irowcnt$0">Zeile 1 von 96</span>
  <li id="HRS_AGNT_RSLT_I$0_row_0"><span id="SCH_JOB_TITLE$0">Learning Designer</span><span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$0">DE-1</span></li>
</form>`;

const EMPTY_FIXTURE = `<!DOCTYPE html><html><body>
<form name="win0" id="win0" method="post" action="${ACTION}">
<input type="hidden" name="ICStateNum" value="2">
<input type="hidden" name="ICSID" value="fake-session-id-0002">
<span id="win0divHRS_AGNT_RSLT_Irowcnt$0">0 of 0 Results</span>
<ul id="win0divHRS_AGNT_RSLT_I$0"></ul>
<div id="win0divHRS_SCH_WRK_NO_RESULTS">No jobs found matching your search criteria.</div>
</form></body></html>`;

const LOGIN_FIXTURE = `<!DOCTYPE html><html><head><title>Oracle PeopleSoft Sign In</title></head><body>
<form name="login" id="login" method="post" action="/psc/exu1/EMPLOYEE/HRMS/?cmd=login">
<input type="text" name="userid" value=""><input type="password" name="pwd" value="">
<p>Your session has expired. Please sign in again to continue.</p>
</form></body></html>`;

const DETAIL_FIXTURE = `<!DOCTYPE html><html><body><div id="ptifrmtgtframe">
<span id='HRS_SCH_WRK2_HRS_JOB_OPENING_ID'>JR00012345</span>
<span id='HRS_SCH_WRK2_POSTING_TITLE'>Instructional Designer</span>
<span id='HRS_SCH_WRK_HRS_DESCRLONG'>London, ON, Canada</span>
<div id='win0divHRS_SCH_PSTDSC_row$0'>
  <span class='ps-text' id='HRS_SCH_WRK_DESCR100$0lbl'>Description</span>
  <span class='ps_box-value' id=HRS_SCH_PSTDSC_DESCRLONG$0 >
    <p>We are looking for an <strong>Instructional Designer</strong> to join our team &amp; help build engaging courses.</p>
  </span>
</div>
<div id='win0divHRS_SCH_PSTDSC_row$1'>
  <span class='ps-text' id='HRS_SCH_WRK_DESCR100$1lbl'>Qualifications</span>
  <span class='ps_box-value' id='HRS_SCH_PSTDSC_DESCRLONG$1'>
    <p onclick="alert('xss')">Master's degree in Education or related field required.</p>
    <script>alert('must never survive');</script>
    <img src="x" onerror="alert('xss2')">
  </span>
</div>
</div></body></html>`;

const DETAIL_MISMATCH_FIXTURE = `<!DOCTYPE html><html><body>
<span id="HRS_SCH_WRK2_HRS_JOB_OPENING_ID">JR99999999</span>
<span id="HRS_SCH_WRK2_POSTING_TITLE">Unrelated Generic Posting</span>
<div id="win0divHRS_SCH_PSTDSC_row$0">
  <span id="HRS_SCH_WRK_DESCR100$0lbl">Description</span>
  <div id="HRS_SCH_PSTDSC_DESCRLONG$0"><p>This is not the job you requested.</p></div>
</div></body></html>`;

/** A minimal win0 search page. @param {{total?: string|null, state?: string|null, rows: [string,string,string?][]}} o */
function page({ total = null, state = null, rows }) {
  return `<form name="win0" action="${ACTION}">`
    + (state !== null ? `<input type="hidden" name="ICStateNum" value="${state}">` : '')
    + (total !== null ? `<span id="win0divHRS_AGNT_RSLT_Irowcnt$0">${total}</span>` : '')
    + rows.map(([id, title, loc = 'Remote'], i) => `<li id="HRS_AGNT_RSLT_I$0_row_${i}"><a id="SCH_JOB_TITLE$${i}">${title}</a>`
      + `<span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$${i}">${id}</span><span id="LOCATION$${i}">${loc}</span></li>`).join('')
    + '</form>';
}

function res(body, { status = 200, headers = [] } = {}) {
  return new Response(body, { status, headers: new Headers(headers) });
}

/** Fake fetchImpl recording every call. */
function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return handler(String(url), opts, calls.length);
  };
  impl.calls = calls;
  return impl;
}

function run(fetchImpl, company = {}, extra = {}) {
  return fetchPeoplesoft(CONFIG.searchUrl, {
    fetchImpl,
    company: { name: 'ExampleU', careers_url: SEARCH_URL, ...company },
    delayMs: 0,
    retryDelayMs: 0,
    lookup: PUBLIC_DNS,
    ...extra,
  });
}

function httpError(status) {
  return res('error', { status });
}

// The fetcher warns (console.warn) on every incomplete sweep — keep test output clean.
let realWarn;
before(() => { realWarn = console.warn; console.warn = () => {}; });
after(() => { console.warn = realWarn; });

// ── meta / adapter ──────────────────────────────────────────────────────────

test('meta: value/label/region', () => {
  assert.deepEqual(meta, { value: 'peoplesoft', label: 'PeopleSoft Candidate Gateway', region: 'en' });
});

test('adapter: id, label and fetch wiring', () => {
  assert.equal(peoplesoftAdapter.id, 'peoplesoft');
  assert.equal(typeof peoplesoftAdapter.label, 'string');
  assert.equal(peoplesoftAdapter.fetch, fetchPeoplesoft);
});

test('adapter: matches the Fluid path signature on any branded host, or provider: peoplesoft', () => {
  assert.equal(peoplesoftAdapter.matches({ careers_url: SEARCH_URL }), true);
  assert.equal(peoplesoftAdapter.matches({ careers_url: 'https://careers.otheru.example/psc/otheru1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL' }), true);
  assert.equal(peoplesoftAdapter.matches({ provider: 'peoplesoft', careers_url: 'https://jobs.example.com/' }), true);
  assert.equal(peoplesoftAdapter.matches({ careers_url: 'https://jobs.example.com/careers' }), false);
  assert.equal(peoplesoftAdapter.matches({ careers_url: SEARCH_URL.replace('https://', 'http://') }), false);
  assert.equal(peoplesoftAdapter.matches(null), false);
});

test('adapter: buildEndpoint returns a canonical https search URL string, or null', () => {
  const ep = peoplesoftAdapter.buildEndpoint({ careers_url: `${ORIGIN}/psc/exu1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?foo=bar` });
  assert.equal(typeof ep, 'string');
  assert.equal(hostOf(ep), 'recruit.exampleu.ca');
  const u = new URL(ep);
  assert.equal(u.searchParams.get('Page'), 'HRS_APP_SCHJOB_FL');
  assert.equal(u.searchParams.get('foo'), null, 'untrusted query params are not carried over');
  // provider: peoplesoft without the path signature cannot guess the site segment.
  assert.equal(peoplesoftAdapter.buildEndpoint({ provider: 'peoplesoft', careers_url: 'https://jobs.example.com/' }), null);
  assert.equal(peoplesoftAdapter.buildEndpoint({}), null);
  // api: wins over careers_url.
  assert.equal(hostOf(peoplesoftAdapter.buildEndpoint({ careers_url: 'https://example.com/careers', api: SEARCH_URL })), 'recruit.exampleu.ca');
});

// ── resolveConfig ───────────────────────────────────────────────────────────

test('resolveConfig: extracts origin + site from the search-page URL', () => {
  const cfg = resolveConfig({ careers_url: SEARCH_URL });
  assert.equal(cfg.origin, ORIGIN);
  assert.equal(cfg.site, 'exu1');
  assert.equal(cfg.searchUrl, CONFIG.searchUrl);
});

test('resolveConfig: path-based, works on an entirely different branded host', () => {
  const cfg = resolveConfig({ careers_url: 'https://careers.otheru.example/psc/otheru1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_SCHJOB_FL' });
  assert.equal(cfg.origin, 'https://careers.otheru.example');
  assert.equal(cfg.site, 'otheru1');
});

test('resolveConfig: null (never throws) for non-HTTPS / wrong path / /psp/ / malformed / missing / null', () => {
  const cases = [
    { careers_url: SEARCH_URL.replace('https://', 'http://') },
    { careers_url: `${ORIGIN}/some/other/path.GBL` },
    { careers_url: `${ORIGIN}/psp/exu1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL` },
    { careers_url: 'not a url' },
    { careers_url: null },
    {},
    null,
    undefined,
  ];
  for (const c of cases) assert.equal(resolveConfig(c), null, JSON.stringify(c));
});

test('resolveConfig: honours api: over a non-matching careers_url', () => {
  assert.ok(resolveConfig({ careers_url: 'https://example.com/careers', api: SEARCH_URL }));
});

test('resolveConfig: refuses private/loopback literal hosts', () => {
  const path = '/psc/x/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL';
  for (const h of ['127.0.0.1', '169.254.169.254', '10.0.0.5', 'localhost', '[::1]']) {
    assert.equal(resolveConfig({ careers_url: `https://${h}${path}` }), null, h);
  }
});

// ── URL builders / SSRF guard ───────────────────────────────────────────────

test('buildSearchUrl: sets the documented query params', () => {
  const u = new URL(buildSearchUrl(ORIGIN, 'exu1'));
  assert.equal(u.searchParams.get('Page'), 'HRS_APP_SCHJOB_FL');
  assert.equal(u.searchParams.get('Action'), 'U');
  assert.equal(u.searchParams.get('FOCUS'), 'Applicant');
  assert.equal(u.searchParams.get('SiteId'), '1');
});

test('buildDetailUrl: sets Page/JobOpeningId/PostingSeq and honours postingSeq', () => {
  const u = new URL(buildDetailUrl(CONFIG, 'JR00012345', 1));
  assert.equal(u.searchParams.get('Page'), 'HRS_APP_JBPST_FL');
  assert.equal(u.searchParams.get('JobOpeningId'), 'JR00012345');
  assert.equal(u.searchParams.get('PostingSeq'), '1');
  assert.equal(new URL(buildDetailUrl(CONFIG, 'JR00012345', 2)).searchParams.get('PostingSeq'), '2');
});

test('assertPeoplesoftUrl: HTTPS + exact tenant origin + no private literal', () => {
  assert.equal(assertPeoplesoftUrl(SEARCH_URL, CONFIG), SEARCH_URL);
  assert.throws(() => assertPeoplesoftUrl(SEARCH_URL.replace('https://', 'http://'), CONFIG), /HTTPS/);
  assert.throws(() => assertPeoplesoftUrl('https://evil.example/steal', CONFIG), /untrusted origin/);
  assert.throws(() => assertPeoplesoftUrl('https://recruit.exampleu.ca:8443/x', CONFIG), /untrusted origin/);
  assert.throws(() => assertPeoplesoftUrl('https://127.0.0.1/x'), /private\/loopback/);
  assert.throws(() => assertPeoplesoftUrl('garbage'), /invalid URL/);
});

// ── Cookie jar ──────────────────────────────────────────────────────────────

test('cookie jar: builds a Cookie header, merges rotation, ignores junk', () => {
  const jar = createCookieJar();
  updateCookieJar(jar, ['PS_TOKEN=abc123; Path=/; HttpOnly', 'JSESSIONID=xyz789; Secure']);
  assert.equal(cookieHeader(jar), 'PS_TOKEN=abc123; JSESSIONID=xyz789');
  updateCookieJar(jar, ['PS_TOKEN=rotated456; Path=/']);
  assert.equal(cookieHeader(jar), 'PS_TOKEN=rotated456; JSESSIONID=xyz789');
  updateCookieJar(jar, ['garbage-no-equals', '=novaluename', null, 42]);
  assert.equal(cookieHeader(jar), 'PS_TOKEN=rotated456; JSESSIONID=xyz789');
  updateCookieJar(jar, undefined);
  assert.equal(cookieHeader(createCookieJar()), '');
});

test('readSetCookies: getSetCookie, joined-header fallback that keeps Expires dates, absent', () => {
  const h = new Headers();
  h.append('set-cookie', 'A=1; Path=/');
  h.append('set-cookie', 'B=2');
  assert.deepEqual(readSetCookies(h), ['A=1; Path=/', 'B=2']);
  const joined = { get: () => 'A=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT, B=2; Path=/' };
  assert.deepEqual(readSetCookies(joined), ['A=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT', 'B=2; Path=/']);
  assert.deepEqual(readSetCookies(undefined), []);
  assert.deepEqual(readSetCookies({ get: () => null }), []);
});

// ── extractById / extractTextById ───────────────────────────────────────────

test('extractById: inner HTML with nested same-tag depth; text form; missing; self-closing', () => {
  const html = '<div><span id="a">hello <b>world</b></span><span id="b">plain</span></div>';
  assert.equal(extractById(html, 'a'), 'hello <b>world</b>');
  assert.equal(extractTextById(html, 'a'), 'hello world');
  assert.equal(extractById(html, 'missing'), null);
  assert.equal(extractTextById('<input id="c" value="x"/>', 'c'), '');
  assert.equal(extractById('<div id="n"><div>inner</div> tail</div>', 'n'), '<div>inner</div> tail');
});

test('extractById: matches an UNQUOTED id and single-quoted ids; never guesses on a missing close tag', () => {
  assert.equal(extractTextById('<span id=X$0 >unq</span>', 'X$0'), 'unq');
  assert.equal(extractTextById("<span id='Y'>sq</span>", 'Y'), 'sq');
  assert.equal(extractById('<span id="z">never closed', 'z'), null);
  // An id prefix must not match a longer id.
  assert.equal(extractById('<span id=AB>x</span>', 'A'), null);
});

// ── parseFormState ──────────────────────────────────────────────────────────

test('parseFormState: action, every hidden field, checked checkbox only, select, textarea', () => {
  const state = parseFormState(SEARCH_FIXTURE);
  assert.equal(state.action, ACTION);
  assert.equal(state.fields.ICStateNum, '4');
  assert.equal(state.fields.ICSID, 'fake-session-id-0001');
  assert.equal(state.fields.ICAJAX, '1');
  assert.equal(state.fields.HRS_SCH_WRK_KEYWORD_SW, 'Y');
  assert.equal('UNCHECKED_BOX' in state.fields, false);
  assert.equal(state.fields.HRS_SCH_WRK_SORT, 'B');
  assert.equal(state.fields.NOTES, 'a & b');
  assert.equal(parseFormState(LOGIN_FIXTURE), null);
});

// ── parseReportedTotal / parsePeopleSoftDate ────────────────────────────────

test('parseReportedTotal: "of N", zero, localized position-first counters, grouped totals, absent', () => {
  assert.equal(parseReportedTotal('1-3 of 42 Results'), 42);
  assert.equal(parseReportedTotal('0 of 0 Results'), 0);
  assert.equal(parseReportedTotal('3 rows'), 3);
  assert.equal(parseReportedTotal('Ligne 1 sur 96'), 96);
  assert.equal(parseReportedTotal('Zeile 1 von 96'), 96);
  assert.equal(parseReportedTotal('Ligne 1 sur 1 234'), 1234);
  assert.equal(parseReportedTotal('Ligne 1 sur 1 234'), 1234);
  assert.equal(parseReportedTotal('Zeile 1 von 1.234'), 1234);
  assert.equal(parseReportedTotal('1-20 of 1,234 Results'), 1234);
  assert.equal(parseReportedTotal(null), null);
  assert.equal(parseReportedTotal(''), null);
  assert.equal(parseReportedTotal('no numbers here'), null);
});

test('parsePeopleSoftDate: M/D/YYYY only; never guesses; rejects out-of-range and rolled-over dates', () => {
  assert.equal(parsePeopleSoftDate('08/15/2026'), Date.UTC(2026, 7, 15));
  assert.equal(parsePeopleSoftDate('8/5/2026'), Date.UTC(2026, 7, 5));
  assert.equal(parsePeopleSoftDate('not-a-real-date'), undefined);
  assert.equal(parsePeopleSoftDate('2026-08-15'), undefined);
  assert.equal(parsePeopleSoftDate('13/40/2026'), undefined);
  assert.equal(parsePeopleSoftDate('4/31/2026'), undefined);
  assert.equal(parsePeopleSoftDate('2/30/2026'), undefined);
  assert.equal(parsePeopleSoftDate(null), undefined);
  assert.equal(parsePeopleSoftDate(''), undefined);
});

// ── parseSearchPage ─────────────────────────────────────────────────────────

test('parseSearchPage: valid page with 3 rows, fields, entity decoding, raw unparseable date, form state', () => {
  const p = parseSearchPage(SEARCH_FIXTURE);
  assert.equal(p.valid, true);
  assert.equal(p.rows.length, 3);
  assert.equal(p.reportedTotal, 3, '"N rows" counter (no "of") — the real observed live format');
  assert.deepEqual(
    { jobId: p.rows[0].jobId, title: p.rows[0].title, location: p.rows[0].location, department: p.rows[0].department },
    { jobId: 'JR00012345', title: 'Instructional Designer', location: 'London, ON, Canada', department: 'Faculty of Education' },
  );
  assert.equal(p.rows[0].postedAt, Date.UTC(2026, 7, 15));
  assert.equal(p.rows[1].title, 'Learning & Development Specialist');
  assert.equal(p.rows[2].postedAt, undefined);
  assert.equal(p.rows[2].postedRaw, 'not-a-real-date');
  assert.equal(p.rows[2].department, '', 'tenant-configurable column absent → empty, not a parse failure');
  assert.equal(p.formAction, ACTION);
  assert.equal(p.formFields.ICSID, 'fake-session-id-0001');
});

test('parseSearchPage: localized French/German totals; a total below the row count is rejected', () => {
  const fr = parseSearchPage(FRENCH_FIXTURE);
  const de = parseSearchPage(GERMAN_FIXTURE);
  assert.equal(fr.rows.length, 2);
  assert.equal(fr.reportedTotal, 96);
  assert.equal(fr.rows[0].title, 'Concepteur pédagogique');
  assert.equal(de.rows.length, 1);
  assert.equal(de.reportedTotal, 96);
  const impossible = parseSearchPage(FRENCH_FIXTURE.replace('Ligne 1 sur 96', 'Ligne 1 sur 1'));
  assert.equal(impossible.rows.length, 2);
  assert.equal(impossible.reportedTotal, null);
});

test('parseSearchPage: accepts an unquoted row id; skips rows missing jobId or title', () => {
  const unquoted = '<form name="win0"><li id=HRS_AGNT_RSLT_I$0_row_7><a id="SCH_JOB_TITLE$7">Unquoted Row</a><span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$7">J7</span></li></form>';
  const p = parseSearchPage(unquoted);
  assert.equal(p.valid, true);
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].jobId, 'J7');
  const partial = '<form name="win0"><li id="HRS_AGNT_RSLT_I$0_row_0"><a id="SCH_JOB_TITLE$0">No id</a></li>'
    + '<li id="HRS_AGNT_RSLT_I$0_row_1"><span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$1">J1</span></li>'
    + '<li id="HRS_AGNT_RSLT_I$0_row_2"><a id="SCH_JOB_TITLE$2">Kept</a><span id="HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$2">J2</span></li></form>';
  assert.deepEqual(parseSearchPage(partial).rows.map((r) => r.jobId), ['J2']);
});

test('parseSearchPage: a genuinely empty well-formed result is valid:true, rows:[]', () => {
  const p = parseSearchPage(EMPTY_FIXTURE);
  assert.equal(p.valid, true);
  assert.equal(p.rows.length, 0);
  assert.equal(p.reportedTotal, 0);
});

test('parseSearchPage: a login/session-expired page is valid:false — never "zero postings"', () => {
  const p = parseSearchPage(LOGIN_FIXTURE);
  assert.equal(p.valid, false);
  assert.equal(p.errorReason, 'unexpected-page');
  assert.equal(p.rows.length, 0);
});

// ── parseJobDetail ──────────────────────────────────────────────────────────

test('parseJobDetail: matching id → title/location, sections in DOM order, plain-text description', () => {
  const d = parseJobDetail(DETAIL_FIXTURE, 'JR00012345');
  assert.equal(d.valid, true);
  assert.equal(d.jobId, 'JR00012345');
  assert.equal(d.title, 'Instructional Designer');
  assert.equal(d.location, 'London, ON, Canada');
  assert.deepEqual(d.sections.map((s) => s.label), ['Description', 'Qualifications']);
  assert.ok(d.sections.every((s) => Object.keys(s).sort().join() === 'label,text'));
  assert.ok(d.descriptionText.includes('Instructional Designer'));
  assert.ok(d.descriptionText.includes('team & help'));
  assert.ok(d.descriptionText.includes("Master's degree"));
  assert.ok(!/<script|alert\('must never|onerror|onclick/.test(d.descriptionText), 'markup/script stripped');
  assert.equal('descriptionHtml' in d, false);
  assert.equal('employmentType' in d, false);
});

test('parseJobDetail: extracts a description from an unquoted section container id', () => {
  const html = `<div id="HRS_SCH_WRK2_HRS_JOB_OPENING_ID">JR00012345</div>
    <div id=win0divHRS_SCH_PSTDSC_row$0>
      <span id="HRS_SCH_WRK_DESCR100$0lbl">Description</span>
      <div id="HRS_SCH_PSTDSC_DESCRLONG$0"><p>Unquoted section body text</p></div>
    </div>`;
  const d = parseJobDetail(html, 'JR00012345');
  assert.equal(d.valid, true);
  assert.equal(d.sections.length, 1);
  assert.ok(d.descriptionText.includes('Unquoted section body text'));
});

test('parseJobDetail: rejects a mismatched id (same page, wrong request; dead-PostingSeq page)', () => {
  const a = parseJobDetail(DETAIL_FIXTURE, 'JR00099999');
  assert.deepEqual([a.valid, a.reason, a.jobId], [false, 'job-id-mismatch', 'JR00012345']);
  const b = parseJobDetail(DETAIL_MISMATCH_FIXTURE, 'JR00012345');
  assert.deepEqual([b.valid, b.reason, b.jobId], [false, 'job-id-mismatch', 'JR99999999']);
});

test('parseJobDetail: a page with no job-opening-id element is unexpected-page', () => {
  const d = parseJobDetail(LOGIN_FIXTURE, 'JR00012345');
  assert.deepEqual([d.valid, d.reason], [false, 'unexpected-page']);
});

// ── createSession / fetchSearchPage / fetchAdditionalResults ────────────────

test('fetchSearchPage: GETs under a session, parses, captures Set-Cookie into the jar', async () => {
  const f = fakeFetch((url, opts) => {
    assert.equal(opts.method, 'GET');
    return res(SEARCH_FIXTURE, { headers: [['set-cookie', 'PS_TOKEN=abc123; Path=/']] });
  });
  const session = createSession(CONFIG, { fetchImpl: f, lookup: PUBLIC_DNS, retryDelayMs: 0 });
  const p = await fetchSearchPage(session);
  assert.equal(p.valid, true);
  assert.equal(p.rows.length, 3);
  assert.equal(cookieHeader(session.jar), 'PS_TOKEN=abc123');
  assert.equal(f.calls[0].opts.headers['User-Agent'].includes('Mozilla/5.0'), true, 'browser-like UA');
});

test('fetchAdditionalResults: POST replay of the FULL form, ICAction override, cookie, redirect:manual', async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  const session = createSession(CONFIG, { fetchImpl: f, lookup: PUBLIC_DNS, retryDelayMs: 0 });
  updateCookieJar(session.jar, ['PS_TOKEN=abc123']);
  await fetchAdditionalResults(parseSearchPage(SEARCH_FIXTURE), session);
  const { url, opts } = f.calls[0];
  assert.equal(opts.method, 'POST');
  assert.equal(opts.redirect, 'manual');
  assert.equal(opts.headers.Cookie, 'PS_TOKEN=abc123');
  assert.equal(opts.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(hostOf(url), 'recruit.exampleu.ca');
  const posted = new URLSearchParams(opts.body);
  assert.equal(posted.get('ICAction'), LOAD_MORE_ACTION);
  assert.equal(posted.get('ICSID'), 'fake-session-id-0001');
  assert.equal(posted.get('ICStateNum'), '4');
});

test('fetchAdditionalResults: an off-origin form action is rejected before any network call (SSRF)', async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  const session = createSession(CONFIG, { fetchImpl: f, lookup: PUBLIC_DNS, retryDelayMs: 0 });
  await assert.rejects(fetchAdditionalResults({ formAction: 'https://evil.example/steal', formFields: {} }, session), /untrusted origin/);
  await assert.rejects(fetchAdditionalResults({ formAction: '//evil.example/steal', formFields: {} }, session), /untrusted origin/);
  assert.equal(f.calls.length, 0);
});

test('fetchAdditionalResults: no captured action falls back to the search URL', async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  const session = createSession(CONFIG, { fetchImpl: f, lookup: PUBLIC_DNS, retryDelayMs: 0 });
  await fetchAdditionalResults({ formAction: null, formFields: {} }, session);
  assert.equal(f.calls[0].url, CONFIG.searchUrl);
});

test('fetchAdditionalResults: a relative form action resolves beside the search page, not at the origin root', async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  const session = createSession(CONFIG, { fetchImpl: f, lookup: PUBLIC_DNS, retryDelayMs: 0 });
  await fetchAdditionalResults({ formAction: 'HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=X', formFields: {} }, session);
  assert.equal(f.calls[0].url, new URL('HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=X', CONFIG.searchUrl).href);
  assert.notEqual(new URL(f.calls[0].url).pathname, '/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL');
});

// ── fetchPeoplesoft — end to end ────────────────────────────────────────────

test('fetch: GET then POST, cross-page dedup, stops at the reported total, job shape', async () => {
  const p1 = page({ total: '1-2 of 3 Results', state: '1', rows: [['J1', 'Role A', 'Toronto'], ['J2', 'Role B', 'Toronto']] });
  const p2 = page({ total: '1-3 of 3 Results', state: '2', rows: [['J2', 'Role B dup', 'Toronto'], ['J3', 'Role C', 'Remote - Ottawa']] });
  const f = fakeFetch((url, opts, n) => res(n === 1 ? p1 : n === 2 ? p2 : '<form name="win0"></form>', { headers: [['set-cookie', `S=${n}`]] }));
  const jobs = await run(f);
  assert.equal(jobs.length, 3);
  assert.deepEqual(f.calls.map((c) => c.opts.method), ['GET', 'POST']);
  assert.equal(f.calls[1].opts.headers.Cookie, 'S=1', 'cookie from the GET replayed on the POST');
  assert.ok(jobs.every((j) => {
    const u = new URL(j.url);
    return hostOf(j.url) === 'recruit.exampleu.ca' && u.searchParams.get('Page') === 'HRS_APP_JBPST_FL' && u.searchParams.get('PostingSeq') === '1';
  }));
  assert.ok(jobs.every((j) => j._jobId === undefined), 'internal _jobId stripped');
  assert.equal(jobs.peoplesoftIncomplete, undefined);
  const b = jobs.find((j) => j.title === 'Role B');
  assert.ok(b, 'first-seen row wins over the later duplicate');
  assert.deepEqual(Object.keys(jobs[0]).sort(), ['company', 'date', 'id', 'isRemote', 'location', 'relocates', 'salary', 'snippet', 'source', 'title', 'url', 'workplaceType']);
  assert.equal(jobs[0].source, 'peoplesoft');
  assert.equal(jobs[0].company, 'ExampleU');
  assert.equal(jobs[0].id, 'peoplesoft-recruit.exampleu.ca-J1');
  const c = jobs.find((j) => j.title === 'Role C');
  assert.equal(c.isRemote, true);
  assert.equal(c.workplaceType, 'Remote');
});

test('fetch: posted date becomes an ISO date; unparseable stays ""', async () => {
  const f = fakeFetch(() => res(SEARCH_FIXTURE));
  const jobs = await run(f);
  assert.equal(jobs[0].date, new Date(Date.UTC(2026, 7, 15)).toISOString());
  assert.equal(jobs[2].date, '');
});

test('fetch: stuck "load more" (no new rows) stops and is marked incomplete with real numbers', async () => {
  const stuck = page({ total: '1-1 of 100 Results', rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch(() => res(stuck));
  const jobs = await run(f);
  assert.equal(jobs.length, 1);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(jobs.peoplesoftIncomplete, { complete: false, reason: 'load-more-no-progress', collected: 1, reportedTotal: 100 });
});

test('fetch: a repeated ICStateNum replay with no total is load-more-stale-state, not clean exhaustion', async () => {
  const stale = page({ state: '7', rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch(() => res(stale));
  const jobs = await run(f);
  assert.equal(f.calls.length, 2);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'load-more-stale-state');
});

test('fetch: a load-more fetch failure keeps page one and reports load-more-fetch-failed', async () => {
  const first = page({ total: '1-1 of 3 Results', rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch((url, opts, n) => (n === 1 ? res(first) : httpError(403)));
  const jobs = await run(f);
  assert.equal(jobs.length, 1);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'load-more-fetch-failed');
  assert.equal(f.calls.length, 2, '403 is not retried');
});

test('fetch: an unrecognized load-more response reports load-more-response-unrecognized', async () => {
  const first = page({ total: '1-1 of 3 Results', rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch((url, opts, n) => res(n === 1 ? first : LOGIN_FIXTURE));
  const jobs = await run(f);
  assert.equal(jobs.length, 1);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'load-more-response-unrecognized');
});

test('fetch: max_pages:1 is 1 page TOTAL — initial GET only — and reports pagination-ceiling-reached', async () => {
  const first = page({ total: '1-1 of 3 Results', rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch(() => res(first));
  const jobs = await run(f, { max_pages: 1 });
  assert.equal(f.calls.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'pagination-ceiling-reached');
});

test('resolveMaxLoadMore / parseEntryConfig: total-page semantics, caps, defaults', () => {
  assert.equal(resolveMaxLoadMore({ max_pages: 1 }), 0);
  assert.equal(resolveMaxLoadMore({ max_pages: 5 }), 4);
  assert.equal(resolveMaxLoadMore({ max_pages: 10_000 }), 100);
  assert.equal(resolveMaxLoadMore({ max_pages: 0 }), DEFAULT_MAX_LOAD_MORE);
  assert.equal(resolveMaxLoadMore({ max_pages: '3' }), DEFAULT_MAX_LOAD_MORE);
  assert.equal(resolveMaxLoadMore({}), DEFAULT_MAX_LOAD_MORE);
  assert.deepEqual(parseEntryConfig({}), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseEntryConfig({ peoplesoft: { fetchDetails: 'yes', detailLimit: 500 } }), { fetchDetails: false, detailLimit: 100 });
  assert.deepEqual(parseEntryConfig({ peoplesoft: { fetchDetails: true, detailLimit: 0 } }), { fetchDetails: true, detailLimit: 1 });
});

test('fetch: a login/session-expired first page THROWS a diagnosable error, never returns []', async () => {
  const f = fakeFetch(() => res(LOGIN_FIXTURE));
  await assert.rejects(run(f), /login|session|challenge/i);
});

test('fetch: a first-page 404 throws with .status (dead board → quarantine-able)', async () => {
  const f = fakeFetch(() => httpError(404));
  await assert.rejects(run(f), (err) => err.status === 404);
  assert.equal(f.calls.length, 1);
});

test("fetch: redirect:'manual' on every request (validated per hop, never a blind follow)", async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  await run(f);
  assert.ok(f.calls.length > 0);
  assert.ok(f.calls.every((c) => c.opts.redirect === 'manual'));
});

test('fetch: follows a same-origin redirect and captures Set-Cookie at every hop', async () => {
  const target = `${CONFIG.searchUrl}&`;
  const f = fakeFetch((url, opts, n) => (n === 1
    ? res(null, { status: 302, headers: [['location', target], ['set-cookie', 'HOP1=a']] })
    : res(EMPTY_FIXTURE, { headers: [['set-cookie', 'HOP2=b']] })));
  const jobs = await run(f);
  assert.deepEqual(jobs, []);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].url, target);
  assert.equal(f.calls[1].opts.headers.Cookie, 'HOP1=a', 'the 302 hop cookie is replayed');
});

test('fetch: a relative same-origin Location is resolved against the current URL', async () => {
  const f = fakeFetch((url, opts, n) => (n === 1
    ? res(null, { status: 302, headers: [['location', '/psc/exu1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_SCHJOB_FL&x=1']] })
    : res(EMPTY_FIXTURE)));
  await run(f);
  assert.equal(hostOf(f.calls[1].url), 'recruit.exampleu.ca');
});

test('fetch: an OFF-origin redirect is rejected before it is followed (the real SSRF guard)', async () => {
  const f = fakeFetch(() => res(null, { status: 302, headers: [['location', 'https://evil.example/steal']] }));
  await assert.rejects(run(f), /untrusted origin/i);
  assert.equal(f.calls.length, 1);
});

test('fetch: redirects to http:, a private host, or with no Location are refused', async () => {
  for (const loc of [CONFIG.searchUrl.replace('https://', 'http://'), 'https://169.254.169.254/latest/meta-data']) {
    const f = fakeFetch(() => res(null, { status: 302, headers: [['location', loc]] }));
    await assert.rejects(run(f), /HTTPS|untrusted origin|private/);
    assert.equal(f.calls.length, 1);
  }
  const noLoc = fakeFetch(() => res(null, { status: 302 }));
  await assert.rejects(run(noLoc), /no Location/);
});

test('fetch: a redirect loop throws after MAX_REDIRECTS instead of hanging', async () => {
  const f = fakeFetch((url) => res(null, { status: 302, headers: [['location', url]] }));
  await assert.rejects(run(f), /exceeded \d+ redirects/);
  assert.equal(f.calls.length, MAX_REDIRECTS + 1);
});

test('fetch: 302/303 downgrade a POST to a bodiless GET; 307 keeps POST + body', async () => {
  const first = page({ total: '1-1 of 2 Results', state: '1', rows: [['J1', 'A']] });
  const second = page({ total: '1-2 of 2 Results', state: '2', rows: [['J2', 'B']] });
  for (const [status, expectMethod] of [[302, 'GET'], [303, 'GET'], [307, 'POST']]) {
    const f = fakeFetch((url, opts, n) => {
      if (n === 1) return res(first);
      if (n === 2) return res(null, { status, headers: [['location', `${CONFIG.searchUrl}&hop=1`]] });
      return res(second);
    });
    const jobs = await run(f);
    assert.equal(jobs.length, 2, `status ${status}`);
    assert.equal(f.calls[2].opts.method, expectMethod, `status ${status}`);
    assert.equal(f.calls[2].opts.body === undefined, expectMethod === 'GET', `status ${status} body`);
  }
});

test('fetch: retries a transient 5xx on the initial GET, then succeeds', async () => {
  const f = fakeFetch((url, opts, n) => (n === 1 ? httpError(503) : res(EMPTY_FIXTURE)));
  const jobs = await run(f);
  assert.deepEqual(jobs, []);
  assert.equal(f.calls.length, 2);
});

test('fetch: a network error (no status) is retried; exhausted retries propagate', async () => {
  let n = 0;
  const flaky = async () => { n++; if (n < 3) throw new TypeError('fetch failed'); return res(EMPTY_FIXTURE); };
  assert.deepEqual(await run(flaky), []);
  assert.equal(n, 3);
  const dead = fakeFetch(() => httpError(502));
  await assert.rejects(run(dead), (err) => err.status === 502);
  assert.equal(dead.calls.length, 3, 'initial + 2 retries');
});

test('fetch: a non-retryable 403 fails on the first attempt', async () => {
  const f = fakeFetch(() => httpError(403));
  await assert.rejects(run(f), (err) => err.status === 403);
  assert.equal(f.calls.length, 1);
});

// ── probe mode (opts.maxPages) ──────────────────────────────────────────────

test('probe: maxPages:1 → one request, no load-more, no details, no incomplete marker', async () => {
  const big = page({ total: '1-1 of 500 Results', rows: [['J1', 'Role']] });
  const f = fakeFetch(() => res(big));
  const jobs = await run(f, { peoplesoft: { fetchDetails: true } }, { maxPages: 1 });
  assert.equal(f.calls.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, undefined);
  assert.equal(jobs.peoplesoftIncomplete, undefined);
});

test('probe: a load-more rejection propagates unwrapped (status preserved), never swallowed', async () => {
  const first = page({ total: '1-1 of 5 Results', rows: [['J1', 'Role']] });
  const f = fakeFetch((url, opts, n) => (n === 1 ? res(first) : httpError(403)));
  await assert.rejects(run(f, {}, { maxPages: 2 }), (err) => err.status === 403);
});

test('probe: a first-page 503 propagates with its status after retries', async () => {
  const f = fakeFetch(() => httpError(503));
  await assert.rejects(run(f, {}, { maxPages: 1 }), (err) => err.status === 503);
});

// ── detail enrichment ───────────────────────────────────────────────────────

const ONE_ROW = page({ total: '1-1 of 1 Results', rows: [['JR00012345', 'Instructional Designer', 'London, ON, Canada']] });
const isDetail = (url) => new URL(url).searchParams.get('Page') === 'HRS_APP_JBPST_FL';
const seqOf = (url) => new URL(url).searchParams.get('PostingSeq');

test('details: PostingSeq=1 mismatch → PostingSeq=2 succeeds → description attached', async () => {
  const f = fakeFetch((url) => {
    if (isDetail(url)) return res(seqOf(url) === '1' ? DETAIL_MISMATCH_FIXTURE : DETAIL_FIXTURE);
    return res(ONE_ROW);
  });
  const jobs = await run(f, { peoplesoft: { fetchDetails: true } });
  assert.equal(jobs.length, 1);
  assert.ok(jobs[0].description.includes('Instructional Designer'));
  const seqs = f.calls.filter((c) => isDetail(c.url)).map((c) => seqOf(c.url));
  assert.deepEqual(seqs, ['1', '2']);
});

test('details: both PostingSeq attempts mismatch → listing kept without a description (fail-open)', async () => {
  const f = fakeFetch((url) => res(isDetail(url) ? DETAIL_MISMATCH_FIXTURE : ONE_ROW));
  const jobs = await run(f, { peoplesoft: { fetchDetails: true } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, undefined);
});

test('details: a detail fetch error is swallowed; the listing survives', async () => {
  const f = fakeFetch((url) => (isDetail(url) ? httpError(404) : res(ONE_ROW)));
  const jobs = await run(f, { peoplesoft: { fetchDetails: true } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, undefined);
});

test('details: off by default — zero detail requests', async () => {
  const f = fakeFetch((url) => res(isDetail(url) ? DETAIL_FIXTURE : ONE_ROW));
  const jobs = await run(f);
  assert.equal(f.calls.filter((c) => isDetail(c.url)).length, 0);
  assert.equal(jobs[0].description, undefined);
});

test('details: detailLimit caps the burst (40 postings → 10 detail calls), sequentially', async () => {
  const rows = Array.from({ length: 40 }, (_, i) => [`J${i}`, `Role ${i}`]);
  const big = page({ total: '1-40 of 40 Results', rows });
  let inFlight = 0;
  let maxInFlight = 0;
  const f = fakeFetch(async (url) => {
    if (isDetail(url)) {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setImmediate(r));
      inFlight--;
      const id = new URL(url).searchParams.get('JobOpeningId');
      return res(`<div id="HRS_SCH_WRK2_HRS_JOB_OPENING_ID">${id}</div>`);
    }
    return res(big);
  });
  const jobs = await run(f, { name: 'BigU', peoplesoft: { fetchDetails: true, detailLimit: 10 } });
  assert.equal(jobs.length, 40);
  assert.equal(f.calls.filter((c) => isDetail(c.url)).length, 10);
  assert.equal(maxInFlight, 1, 'detail fetches share one cookie jar — never concurrent');
});

// ── null reportedTotal must not silently mean "complete" ────────────────────

test('null total + load-more failure → incomplete (load-more-fetch-failed, reportedTotal null)', async () => {
  const first = page({ rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch((url, opts, n) => (n === 1 ? res(first) : httpError(403)));
  const jobs = await run(f);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'load-more-fetch-failed');
  assert.equal(jobs.peoplesoftIncomplete?.reportedTotal, null);
});

test('null total + always-new rows → runs to the load-more ceiling → pagination-ceiling-reached', async () => {
  const f = fakeFetch((url, opts, n) => res(page({ rows: [[`J${n}`, `Role ${n}`]] })));
  const jobs = await run(f);
  assert.equal(f.calls.length, 1 + DEFAULT_MAX_LOAD_MORE);
  assert.equal(jobs.length, 1 + DEFAULT_MAX_LOAD_MORE);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'pagination-ceiling-reached');
  assert.equal(jobs.peoplesoftIncomplete?.reportedTotal, null);
});

test('null total + genuine exhaustion (no new rows, state advanced) → complete, no marker', async () => {
  const first = page({ rows: [['ONLY', 'Only Role']] });
  const f = fakeFetch(() => res(first));
  const jobs = await run(f);
  assert.equal(jobs.length, 1);
  assert.equal(jobs.peoplesoftIncomplete, undefined);
});

// ── transport SSRF / DNS / default fetch ────────────────────────────────────

test('fetch: refuses a tenant host that RESOLVES to a private address, before any request', async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  await assert.rejects(run(f, {}, { lookup: async () => ({ address: '10.1.2.3' }) }), /non-public address/);
  assert.equal(f.calls.length, 0);
  // Resolver failure is fail-open (the connect itself would fail).
  const g = fakeFetch(() => res(EMPTY_FIXTURE));
  assert.deepEqual(await run(g, {}, { lookup: async () => { throw new Error('ENOTFOUND'); } }), []);
});

test('fetch: rejects a non-HTTPS / non-PeopleSoft endpoint before any request', async () => {
  const f = fakeFetch(() => res(EMPTY_FIXTURE));
  await assert.rejects(fetchPeoplesoft(CONFIG.searchUrl.replace('https://', 'http://'), { fetchImpl: f, lookup: PUBLIC_DNS }), /HTTPS/);
  await assert.rejects(fetchPeoplesoft('https://jobs.example.com/careers', { fetchImpl: f, lookup: PUBLIC_DNS }), /cannot resolve/);
  assert.equal(f.calls.length, 0);
});

test('fetch: default transport (no fetchImpl) is globalThis.fetch — same-origin redirect followed, off-origin refused', async () => {
  const realFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response(null, { status: 302, headers: { location: `${ACTION}?Page=HRS_APP_SCHJOB_FL&Action=U&FOCUS=Applicant&SiteId=1&` } })
        : new Response(EMPTY_FIXTURE, { status: 200 });
    };
    const jobs = await fetchPeoplesoft(CONFIG.searchUrl, { company: { name: 'ExampleU' }, delayMs: 0, retryDelayMs: 0, lookup: PUBLIC_DNS });
    assert.deepEqual(jobs, []);
    assert.equal(calls, 2);

    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://evil.example/steal' } }); };
    await assert.rejects(
      fetchPeoplesoft(CONFIG.searchUrl, { company: { name: 'ExampleU' }, delayMs: 0, retryDelayMs: 0, lookup: PUBLIC_DNS }),
      /untrusted origin/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetch: an already-aborted signal stops the load-more walk (partial, marked incomplete)', async () => {
  const ac = new AbortController();
  const first = page({ total: '1-1 of 3 Results', rows: [['J1', 'Role']] });
  const f = fakeFetch(() => { ac.abort(); return res(first); });
  const jobs = await run(f, {}, { signal: ac.signal });
  assert.equal(f.calls.length, 1);
  assert.equal(jobs.peoplesoftIncomplete?.reason, 'aborted');
});

/**
 * Zoho Recruit source (v1.253.0 parent parity) — CI-isolated suite.
 * Covers the tenant-board resolution (https <tenant>.zohorecruit.com only,
 * fixed /jobs/Careers path, configured path discarded), the hidden-input
 * list extract (entity-escaped JSON; missing input throws with the page
 * title; non-JSON / non-array values throw), closed-row skipping
 * (Is_Locked / Publish:false), the record → job mapping (title fallback,
 * location parts + Remote, postedAt, description flattening, URL dedup),
 * the detail-page record reader (JS-string unescaping, no eval), the annual
 * salary parser (currency from text, list-currency fallback, non-annual
 * refused) and its string rendering, the opt-in detail enrichment with its
 * request budget, and the adapter's host/provider match. No network —
 * fetchZohoRecruit runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveZohoBoard,
  assertZohoBoardUrl,
  extractZohoListRecords,
  isZohoRecordClosed,
  parseZohoJobsPage,
  parseZohoDetailPage,
  parseZohoSalary,
  renderZohoSalary,
  parseZohoConfig,
  fetchZohoRecruit,
  BOARD_PATH,
  ZOHO_HOST_RE,
} from '../server/lib/sources/zoho-recruit.mjs';
import { zohoRecruitAdapter } from '../server/lib/portals/adapters/zoho-recruit.mjs';
import { REDIRECT_REFUSAL_CAUSE_MESSAGE } from '../server/lib/http-json.mjs';

const ORIGIN = 'https://exampleco.zohorecruit.com';
const BOARD = { origin: ORIGIN };
const ENTRY = { name: 'Example Co', careers_url: `${ORIGIN}/jobs/Careers` };

const record = (i, extra = {}) => ({
  id: 500 + i,
  Posting_Title: `Role ${i}`,
  City: 'Chennai',
  State: 'Tamil Nadu',
  Country: 'India',
  ...extra,
});

/** The board HTML with the job JSON entity-escaped into the hidden input. */
const listHtml = (records, title = 'Careers') =>
  `<!doctype html><html><head><title>${title}</title></head><body>` +
  `<input type="hidden" id="jobs" value="${JSON.stringify(records).replace(/"/g, '&quot;')}">` +
  `</body></html>`;

/** A detail page embedding the record as the career site's own script does. */
const detailHtml = (rec) =>
  `<html><body><script>var jobs = JSON.parse('${JSON.stringify(rec)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")}');</script></body></html>`;

const htmlResponse = (body) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => body });

test('zoho: resolveZohoBoard — https tenant host only; the configured path is discarded', () => {
  assert.deepEqual(
    resolveZohoBoard({ careers_url: `${ORIGIN}/jobs/Careers` }),
    { origin: ORIGIN, boardUrl: `${ORIGIN}${BOARD_PATH}` });
  assert.deepEqual(
    resolveZohoBoard({ careers_url: `${ORIGIN}/recruit/Portal.na?digest=xyz` }),
    { origin: ORIGIN, boardUrl: `${ORIGIN}${BOARD_PATH}` },
    'a legacy portal path still resolves to the fixed list');
  assert.deepEqual(
    resolveZohoBoard({ api: `${ORIGIN}/jobs/12345/some-role` }),
    { origin: ORIGIN, boardUrl: `${ORIGIN}${BOARD_PATH}` },
    'a posting URL resolves the same board');
  assert.equal(resolveZohoBoard({ careers_url: `http://exampleco.zohorecruit.com/jobs` }), null, 'http refused');
  assert.equal(resolveZohoBoard({ careers_url: 'https://evil.example/jobs/Careers' }), null);
  assert.equal(resolveZohoBoard({ careers_url: 'https://exampleco.zohorecruit.com.evil.dev/jobs' }), null,
    'a spoofed suffix never matches');
  assert.equal(resolveZohoBoard({ careers_url: 'not a url' }), null);
  assert.equal(resolveZohoBoard({}), null);
  assert.equal(resolveZohoBoard(null), null);
});

test('zoho: assertZohoBoardUrl — rebuilds the fixed list URL from the hostname alone', () => {
  assert.equal(assertZohoBoardUrl(`${ORIGIN}/anything/at/all?x=1`), `${ORIGIN}${BOARD_PATH}`);
  assert.throws(() => assertZohoBoardUrl('http://exampleco.zohorecruit.com/jobs/Careers'), /must use HTTPS/);
  assert.throws(() => assertZohoBoardUrl('https://evil.example/jobs/Careers'), /untrusted hostname/);
  assert.throws(() => assertZohoBoardUrl('not a url'), /invalid URL/);
});

test('zoho: extractZohoListRecords — entity-escaped JSON array out of the hidden input', () => {
  const records = extractZohoListRecords(listHtml([record(1)]));
  assert.equal(records.length, 1);
  assert.equal(records[0].Posting_Title, 'Role 1');
});

test('zoho: extractZohoListRecords — a missing input is an unknown tenant, not an empty board', () => {
  assert.throws(
    () => extractZohoListRecords('<html><head><title>Page does not exist</title></head><body></body></html>'),
    /no id="jobs" input .*an unknown tenant.*page title: "Page does not exist"/);
  assert.throws(() => extractZohoListRecords('   '), /empty careers page/);
  assert.throws(() => extractZohoListRecords(null), /empty careers page/);
});

test('zoho: extractZohoListRecords — a non-JSON and a non-array value throw', () => {
  const bad = '<input type="hidden" id="jobs" value="not json at all">';
  assert.throws(() => extractZohoListRecords(bad), /id="jobs" value is not JSON/);
  assert.throws(() => extractZohoListRecords(`<input id="jobs" value="{&quot;a&quot;:1}">`), /value is not an array, got: \{a\}/);
});

test('zoho: extractZohoListRecords — input variants: other ids skip, single-quoted values read, scalars and valueless inputs throw', () => {
  assert.equal(extractZohoListRecords(`<input type="hidden" id="jobs" value='[{"id":1}]'>`).length, 1,
    'a single-quoted value reads like a double-quoted one');
  assert.throws(
    () => extractZohoListRecords('<input type="hidden" id="other" value="[1]"><html><head><title>Tenant missing</title></head></html>'),
    /no id="jobs" input/,
    'an input whose id is not "jobs" is skipped, not read');
  assert.throws(
    () => extractZohoListRecords('<input type="hidden" id="jobs">'),
    /value is not JSON/,
    'an input without a value attribute reads as an empty value');
  assert.throws(
    () => extractZohoListRecords('<input id="jobs" value="42">'),
    /value is not an array, got: number/,
    'a scalar JSON value names its type in the error');
  assert.throws(
    () => extractZohoListRecords('<html><body><input type="hidden" id="other"></body></html>'),
    (err) => /no id="jobs" input/.test(err.message) && !err.message.includes('page title'),
    'a page without a title omits the title clause');
});

test('zoho: isZohoRecordClosed — Is_Locked or Publish:false reads as filled', () => {
  assert.equal(isZohoRecordClosed({ Is_Locked: true }), true);
  assert.equal(isZohoRecordClosed({ Publish: false }), true);
  assert.equal(isZohoRecordClosed({ Is_Locked: false, Publish: true }), false);
  assert.equal(isZohoRecordClosed({}), false);
  assert.equal(isZohoRecordClosed(null), false);
});

test('zoho: parseZohoJobsPage — closed rows skip, title falls back to Job_Opening_Name', () => {
  const jobs = parseZohoJobsPage(listHtml([
    record(1, { Is_Locked: true }),
    record(2, { Publish: false }),
    record(3, { Posting_Title: '' }),
    record(4, { Posting_Title: '', Job_Opening_Name: 'Fallback Title' }),
    record(5),
  ]), BOARD, 'Example Co');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Fallback Title');
  assert.equal(jobs[1].title, 'Role 5');
});

test('zoho: parseZohoJobsPage — URL from origin + fixed path + id; location parts; Remote flag', () => {
  const jobs = parseZohoJobsPage(listHtml([
    record(5, { Remote_Job: true, City: 'Chennai', State: '' }),
    record(5), // same id → same URL → deduped
  ]), BOARD, 'Example Co');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, `${ORIGIN}${BOARD_PATH}/505`);
  assert.equal(jobs[0].externalId, '505');
  assert.equal(jobs[0].company, 'Example Co');
  assert.equal(jobs[0].location, 'Chennai, India, Remote');
});

test('zoho: parseZohoJobsPage — postedAt and flattened description ride the list row', () => {
  const [job] = parseZohoJobsPage(listHtml([
    record(6, {
      Date_Opened: '2026-10-01',
      Job_Description: '<p>Own the roadmap</p><script>evil()</script>',
    }),
  ]), BOARD, 'Example Co');
  assert.equal(job.postedAt, Date.parse('2026-10-01'));
  assert.equal(job.description, 'Own the roadmap');
  const [unparsableDate] = parseZohoJobsPage(listHtml([
    record(7, { Date_Opened: 'soon' }),
  ]), BOARD, 'Example Co');
  assert.equal(unparsableDate.postedAt, undefined, 'an unparsable date is no date, never NaN');
});

test('zoho: parseZohoJobsPage — string ids read; empty and lone-surrogate ids skip the row', () => {
  const jobs = parseZohoJobsPage(listHtml([
    { id: 'str-9', Posting_Title: 'String Id' },
    { id: '', Posting_Title: 'No Id' },
    { id: '\uD800', Posting_Title: 'Lone Surrogate' },
    record(8),
  ]), BOARD, 'Example Co');
  assert.deepEqual(jobs.map((j) => j.externalId), ['str-9', '508'],
    'an id that cannot be percent-encoded drops its row instead of poisoning the URL');
});

test('zoho: parseZohoDetailPage — unescapes the JS string literal without evaluating anything', () => {
  const rec = { id: '507', Job_Description: '<p>Caf&eacute; role</p>', Salary: '80,000 - 95,000 USD', Date_Opened: '2026-10-02' };
  const parsed = parseZohoDetailPage(detailHtml(rec));
  assert.deepEqual(parsed, rec);

  // Quotes and unicode escapes inside the literal
  const escaped = `<script>var jobs = JSON.parse('{&q;}'.replace('&q;', String.fromCharCode(39)) || '{}');</script>`;
  assert.equal(parseZohoDetailPage(escaped), null, 'no JSON.parse literal → null');
  const quoted = `<script>var jobs = JSON.parse('{\\x22id\\x22:\\x22508\\x22,\\x22Salary\\x22:\\x2260k EUR\\x22}');</script>`;
  assert.deepEqual(parseZohoDetailPage(quoted), { id: '508', Salary: '60k EUR' });
  const unicode = `<script>var jobs = JSON.parse('{"Note":"caf\\u00e9"}');</script>`;
  assert.equal(parseZohoDetailPage(unicode).Note, 'café');

  assert.equal(parseZohoDetailPage('<html><body>error page</body></html>'), null);
  assert.equal(parseZohoDetailPage('<script>var jobs = JSON.parse(\'not json\');</script>'), null);
  assert.equal(parseZohoDetailPage('<script>var jobs = JSON.parse(\'[1,2]\');</script>'), null, 'a non-object record is null');
  assert.equal(parseZohoDetailPage(null), null);
});

test('zoho: parseZohoDetailPage — braced \\u{...} escapes decode; beyond the Unicode range drops', () => {
  const braced = `<script>var jobs = JSON.parse('{"Note":"caf\\u00e9 \\u{1F600} \\u{110000}end"}');</script>`;
  assert.equal(parseZohoDetailPage(braced).Note, 'café 😀 end',
    'a braced code point decodes (never through eval); a code point past U+10FFFF is dropped, not a crash');
  const continuation = `<script>var jobs = JSON.parse('{"Note":"a\\
b"}');</script>`;
  assert.equal(parseZohoDetailPage(continuation).Note, 'ab',
    'a JS line continuation inside the literal is dropped, never kept as a newline');
  for (const sep of ['\r', '\r\n', '\u2028', '\u2029']) {
    const page = `<script>var jobs = JSON.parse('{"Note":"a\\${sep}b"}');</script>`;
    assert.equal(parseZohoDetailPage(page).Note, 'ab',
      `a backslash-${JSON.stringify(sep)} line continuation is dropped, never kept`);
  }
  const unknownEscape = `<script>var jobs = JSON.parse('{"Note":"a\\-b"}');</script>`;
  assert.equal(parseZohoDetailPage(unknownEscape).Note, 'a-b',
    'an escape outside the known table passes its character through');
});

test('zoho: parseZohoSalary — annual figures only; currency from text, then the list record', () => {
  assert.deepEqual(parseZohoSalary('80-90k', 'USD'), { min: 80000, max: 90000, currency: 'USD' });
  assert.deepEqual(parseZohoSalary('65.000 EUR-75.000 EUR'), { min: 65000, max: 75000, currency: 'EUR' });
  assert.deepEqual(parseZohoSalary('$123,684—$254,644', 'INR'), { min: 123684, max: 254644, currency: 'INR' },
    'a bare $ is ambiguous (USD/CAD/AUD…), so the list currency is the fallback');
  assert.deepEqual(parseZohoSalary('80,000 - 90,000', 'usd'), { min: 80000, max: 90000, currency: 'USD' },
    'a 3-letter list currency is the fallback when the text names none');
  assert.deepEqual(parseZohoSalary('45.000,00 per year', ''), { min: 45000, max: 45000 });
  assert.equal(parseZohoSalary('$20-25/hr', 'USD'), null, 'an hourly period is refused, not annualized');
  assert.equal(parseZohoSalary('5.000 EUR per month'), null);
  assert.equal(parseZohoSalary('competitive', 'USD'), null);
  assert.equal(parseZohoSalary('', 'USD'), null);
  assert.deepEqual(parseZohoSalary('80-90k', 'DOLLAR'), { min: 80000, max: 90000 },
    'a non-3-letter list currency is ignored');
});

test('zoho: parseZohoSalary — ISO-4217 whitelist; LPA/CTC/lakh figures are refused outright', () => {
  // Indian-market magnitude tokens: rendering them as the raw number would be
  // wrong by ~100000x, so they return null rather than a unit-mangled figure.
  assert.equal(parseZohoSalary('12 LPA', 'INR'), null, 'an LPA figure is a lakh-magnitude, never an absolute annual amount');
  assert.equal(parseZohoSalary('8-12 CTC'), null, 'a CTC range carries its own magnitude unit');
  assert.equal(parseZohoSalary('10 lakhs per annum', 'INR'), null);
  assert.equal(parseZohoSalary('5 lac', 'INR'), null);
  // The whitelist, not any three capitals: a real ISO code reads as a
  // currency, a made-up one falls back to the list currency.
  assert.deepEqual(parseZohoSalary('5000 LAK'), { min: 5000, max: 5000, currency: 'LAK' },
    'the Lao Kip code is a currency (LAK, not the magnitude word "lakh")');
  assert.deepEqual(parseZohoSalary('3000 XYZ', 'USD'), { min: 3000, max: 3000, currency: 'USD' },
    'a non-ISO token is never a currency; the list currency falls back');
});

test('zoho: parseZohoSalary — a text naming two currencies is ambiguous: the amount stays, the currency drops', () => {
  assert.deepEqual(parseZohoSalary('80.000 EUR-90.000 USD', 'USD'), { min: 80000, max: 90000 },
    'two ISO codes name no single currency — and never the list currency either');
  assert.deepEqual(parseZohoSalary('€50.000-£60.000'), { min: 50000, max: 60000 },
    'two unambiguous symbols are just as ambiguous');
  assert.deepEqual(parseZohoSalary('€5.000', ''), { min: 5000, max: 5000, currency: 'EUR' },
    'one unambiguous symbol names the currency outright');
});

test('zoho: parseZohoSalary — separator orders and unreadable figures', () => {
  assert.deepEqual(parseZohoSalary('1,234.56', 'USD'), { min: 1234.56, max: 1234.56, currency: 'USD' },
    'comma-grouped, dot-decimal');
  assert.deepEqual(parseZohoSalary('1.234,56'), { min: 1234.56, max: 1234.56 },
    'dot-grouped, comma-decimal');
  assert.equal(parseZohoSalary('..-..'), null, 'an unreadable range is null, never NaN');
  assert.equal(parseZohoSalary('..'), null, 'an unreadable single figure is null');
  assert.equal(parseZohoSalary('?', 'USD'), null, 'the placeholder ? is no amount');
  assert.equal(parseZohoSalary('n/a', 'USD'), null);
});

test('zoho: renderZohoSalary — the web-ui STRING salary field', () => {
  assert.equal(renderZohoSalary({ min: 80000, max: 90000, currency: 'USD' }), '80000–90000 USD');
  assert.equal(renderZohoSalary({ min: 90000, max: 80000 }), '80000–90000', 'inverted bounds order');
  assert.equal(renderZohoSalary(null), '');
  assert.equal(renderZohoSalary({ min: 'x', max: 5 }), '');
});

test('zoho: parseZohoConfig — fetchDetails opt-in only; detailLimit clamped to 1..100', () => {
  assert.deepEqual(parseZohoConfig({}), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseZohoConfig({ zohoRecruit: { fetchDetails: true, detailLimit: 7 } }), { fetchDetails: true, detailLimit: 7 });
  assert.deepEqual(parseZohoConfig({ zohoRecruit: { fetchDetails: 'yes', detailLimit: 0 } }).detailLimit, 1,
    'a truthy non-true does not switch it on; 0 clamps to the minimum');
  assert.deepEqual(parseZohoConfig({ zohoRecruit: { fetchDetails: true, detailLimit: 999 } }).detailLimit, 100);
});

test('zoho: fetchZohoRecruit — one list request; normalized rows carry the web-ui shape', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    assert.equal(url, `${ORIGIN}${BOARD_PATH}`);
    return htmlResponse(listHtml([record(9, { Date_Opened: '2026-10-03', Job_Description: '<p>Desc</p>' })]));
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}/whatever/path`, { fetchImpl, company: ENTRY });
  assert.equal(calls, 1, 'the whole board arrives in one request');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'zoho-recruit-509');
  assert.equal(jobs[0].source, 'zoho-recruit');
  assert.equal(jobs[0].company, 'Example Co');
  assert.equal(jobs[0].date, '2026-10-03T00:00:00.000Z');
  assert.equal(jobs[0].snippet, 'Desc');
  assert.equal(jobs[0].salary, '');
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India');
});

test('zoho: fetchZohoRecruit — an unknown tenant rejects (missing input), never a quiet empty board', async () => {
  const fetchImpl = async () => htmlResponse('<html><head><title>Page does not exist</title></head><body></body></html>');
  await assert.rejects(
    () => fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, { fetchImpl, company: ENTRY }),
    /no id="jobs" input/);
});

test('zoho: fetchZohoRecruit — an off-host endpoint rejects before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchZohoRecruit('https://evil.example/jobs/Careers', { fetchImpl, company: ENTRY }),
    /untrusted hostname/);
});

test('zoho: fetchZohoRecruit — fetchDetails enriches description/date/salary from the posting page', async () => {
  const detail = detailHtml({
    id: '510',
    Job_Description: '<p>Full description from the detail page</p>',
    Date_Opened: '2026-10-05',
    Salary: '80,000 - 95,000 USD',
  });
  const detailCalls = [];
  const fetchImpl = async (url) => {
    if (String(url).endsWith(BOARD_PATH)) {
      return htmlResponse(listHtml([record(10, { Currency: 'USD' })]));
    }
    detailCalls.push(String(url));
    return htmlResponse(detail);
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true, detailLimit: 5 } },
    detailDelayMs: 0,
  });
  assert.equal(jobs.length, 1);
  assert.deepEqual(detailCalls, [`${ORIGIN}${BOARD_PATH}/510`]);
  assert.equal(jobs[0].snippet, 'Full description from the detail page');
  assert.equal(jobs[0].date, '2026-10-05T00:00:00.000Z');
  assert.equal(jobs[0].salary, '80000–95000 USD');
});

test('zoho: fetchZohoRecruit — a detail page for another posting keeps the list row', async () => {
  const wrongDetail = detailHtml({ id: '99999', Job_Description: '<p>someone else</p>' });
  const fetchImpl = async (url) => (String(url).endsWith(BOARD_PATH)
    ? htmlResponse(listHtml([record(11, { Job_Description: '<p>List description</p>' })]))
    : htmlResponse(wrongDetail));
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true } },
    detailDelayMs: 0,
  });
  assert.equal(jobs[0].snippet, 'List description', 'the mismatched detail never overwrites the row');
  assert.equal(jobs[0].salary, '');
});

test('zoho: fetchZohoRecruit — detailLimit caps the detail requests; failures keep the list rows', async () => {
  const detailCalls = [];
  const fetchImpl = async (url) => {
    if (String(url).endsWith(BOARD_PATH)) {
      return htmlResponse(listHtml([record(12), record(13), record(14)]));
    }
    detailCalls.push(String(url));
    return { ok: false, status: 500, headers: { get: () => null }, text: async () => '' };
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true, detailLimit: 1 } },
    detailDelayMs: 0,
    retries: 0,
  });
  assert.equal(jobs.length, 3, 'every list row is kept');
  assert.equal(detailCalls.length, 1,
    'the budget is EXACTLY 1 detail request — not one per posting, and every one failed');
  assert.ok(jobs.every((j) => j.snippet === ''), 'no detail survived');
});

test('zoho: fetchZohoRecruit — a retry outliving the budget draws the non-retryable budget error (400) mid-posting', async () => {
  const detailCalls = [];
  const fetchImpl = async (url) => {
    if (String(url).endsWith(BOARD_PATH)) {
      return htmlResponse(listHtml([record(12), record(13), record(14)]));
    }
    detailCalls.push(String(url));
    const err = new Error('HTTP 503');
    err.status = 503;
    throw err;
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true, detailLimit: 1 } },
    detailDelayMs: 0, retries: 2, retryDelayMs: 0,
  });
  assert.equal(jobs.length, 3, 'every list row is kept');
  assert.equal(detailCalls.length, 1,
    'the 1-request budget is spent inside ONE posting\'s retries; the next attempt fails fast (a 4xx, not retried)');
});

test('zoho: fetchZohoRecruit — a transient list failure is retried and the board still parses', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      const err = new Error('HTTP 503');
      err.status = 503;
      throw err;
    }
    return htmlResponse(listHtml([record(30)]));
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, { fetchImpl, retries: 1, retryDelayMs: 0 });
  assert.equal(calls, 2, 'one retry after the transient 503');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'zoho-recruit-530');
});

test('zoho: fetchZohoRecruit — a statusless error retries; a refused redirect never does', async () => {
  let bare = 0;
  const flaky = async (url) => {
    if (!String(url).endsWith(BOARD_PATH)) return htmlResponse(detailHtml({ id: '520' }));
    bare += 1;
    if (bare === 1) throw new Error('ECONNRESET'); // no .status — a network error
    return htmlResponse(listHtml([record(20)]));
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl: flaky, retries: 1, retryDelayMs: 0,
    signal: new AbortController().signal, // a live signal rides the retry delay
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true } },
    detailDelayMs: 0,
  });
  assert.equal(bare, 2, 'a statusless error is transient');
  assert.equal(jobs.length, 1);

  let refused = 0;
  const redirectRefused = async () => {
    refused += 1;
    const err = new TypeError('fetch failed');
    err.cause = new Error(REDIRECT_REFUSAL_CAUSE_MESSAGE);
    throw err;
  };
  await assert.rejects(
    () => fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, { fetchImpl: redirectRefused, retries: 2, retryDelayMs: 0 }),
    /fetch failed/);
  assert.equal(refused, 1, 'a redirect refusal is rethrown at once, never retried');
});

test('zoho: fetchZohoRecruit — an abort between detail requests keeps the rows', async () => {
  const ac = new AbortController();
  let detailCalls = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith(BOARD_PATH)) return htmlResponse(listHtml([record(40), record(41)]));
    detailCalls += 1;
    ac.abort(); // aborted while the first detail is being processed
    return htmlResponse(detailHtml({ id: String(540 + detailCalls - 1) }));
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true } },
    detailDelayMs: 0,
    signal: ac.signal,
  });
  assert.equal(detailCalls, 1);
  assert.equal(jobs.length, 2, 'an aborted enrichment is not an empty board');
});

test('zoho: fetchZohoRecruit — the inter-detail delay, Remote workplace and empty locations', async () => {
  const detailFor = (id) => detailHtml({ id: String(id), Job_Description: '<p>D</p>' });
  const fetchImpl = async (url) => {
    if (String(url).endsWith(BOARD_PATH)) {
      return htmlResponse(listHtml([
        record(40, { Remote_Job: true }),
        record(41, { City: '', State: '', Country: '' }),
      ]));
    }
    const id = Number(String(url).split('/').pop());
    return htmlResponse(detailFor(id));
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true } },
    detailDelayMs: 1,
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].workplaceType, 'Remote', 'a Remote_Job row reads as a Remote workplace');
  assert.equal(jobs[1].location, '', 'a record with no location parts reads as no location');
  assert.ok(jobs.every((j) => j.company === 'Example Co'));
});

test('zoho: fetchZohoRecruit — an explicitly null entry reads as no entry name', async () => {
  const fetchImpl = async () => htmlResponse(listHtml([record(50)]));
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, { fetchImpl, company: null });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, '', 'the entry name is never invented');
});

test('zoho adapter: provider- or tenant-host-selected; endpoint is the fixed list URL', () => {
  assert.equal(zohoRecruitAdapter.matches({ provider: 'zoho-recruit' }), true);
  assert.equal(zohoRecruitAdapter.matches({ careers_url: `${ORIGIN}/jobs/Careers` }), true);
  assert.equal(zohoRecruitAdapter.matches({ api: `${ORIGIN}/jobs/1/x` }), true);
  assert.equal(zohoRecruitAdapter.matches({ careers_url: 'https://exampleco.zohorecruit.com.evil.dev/jobs' }), false);
  assert.equal(zohoRecruitAdapter.matches({}), false);
  assert.equal(zohoRecruitAdapter.buildEndpoint(ENTRY), `${ORIGIN}${BOARD_PATH}`);
  assert.equal(zohoRecruitAdapter.buildEndpoint({ provider: 'zoho-recruit' }), null);
  assert.equal(zohoRecruitAdapter.id, 'zoho-recruit');
  assert.ok(ZOHO_HOST_RE.test('exampleco.zohorecruit.com'));
  assert.ok(!ZOHO_HOST_RE.test('exampleco.zohorecruit.com.evil.dev'));
});

test('zoho: parseZohoUrl tries candidates in order — a foreign careers_url never shadows a valid Zoho api', () => {
  // careers_url first (the old `careers_url || api`) resolved null and the
  // adapter never matched; the api-first candidate walk resolves the board.
  const entry = { careers_url: 'https://exampleco.example.com/careers', api: `${ORIGIN}/jobs/Careers` };
  assert.deepEqual(
    resolveZohoBoard(entry),
    { origin: ORIGIN, boardUrl: `${ORIGIN}${BOARD_PATH}` },
    'the Zoho api resolves even with a non-Zoho careers_url present');
  assert.equal(zohoRecruitAdapter.matches(entry), true);
  assert.equal(zohoRecruitAdapter.buildEndpoint(entry), `${ORIGIN}${BOARD_PATH}`);
  assert.deepEqual(
    resolveZohoBoard({ careers_url: `${ORIGIN}/jobs/Careers`, api: `${ORIGIN}/jobs/1/posting` }),
    { origin: ORIGIN, boardUrl: `${ORIGIN}${BOARD_PATH}` },
    'both candidates on-host resolve the same board (hostname-only)');
});

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
  const obj = `<input type="hidden" id="jobs" value="${'&quot;a&quot;:1'.replace(/"/g, '&quot;')}">`;
  assert.throws(() => extractZohoListRecords(`<input id="jobs" value="{&quot;a&quot;:1}">`), /value is not an array, got: \{a\}/);
  assert.ok(obj.length > 0); // fixture built, shape asserted above
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
  const fetchImpl = async (url) => {
    if (String(url).endsWith(BOARD_PATH)) {
      return htmlResponse(listHtml([record(12), record(13), record(14)]));
    }
    return { ok: false, status: 500, headers: { get: () => null }, text: async () => '' };
  };
  const jobs = await fetchZohoRecruit(`${ORIGIN}${BOARD_PATH}`, {
    fetchImpl,
    company: { ...ENTRY, zohoRecruit: { fetchDetails: true, detailLimit: 1 } },
    detailDelayMs: 0,
    retries: 0,
  });
  assert.equal(jobs.length, 3, 'every list row is kept');
  assert.ok(jobs.every((j) => j.snippet === ''), 'no detail survived');
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

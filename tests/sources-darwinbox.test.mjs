/**
 * Darwinbox source (upstream parent #6416 port) — CI-isolated suite.
 *
 * Reads the zero-auth `alljobs` JSON endpoint behind `<tenant>.darwinbox.in`
 * career sites, paginated at 50 rows per page (POST {companyId, page,
 * sort_option:'new', limit:50}). The company id MUST come from the careers
 * URL: a tenant asked with the wrong one answers with an empty `success`, so
 * a bare tenant host is never claimed. Cases ported from the parent's
 * provider-contract tests: resolveBoard's https + single-label host +
 * /ms/candidatev2/<companyId>/careers path rules (look-alike and spoofed
 * hosts rejected, the port silently dropped, api: wins over careers_url),
 * the normalization of the live response shape (posted_on epoch seconds →
 * created_on fallback, annual-only salary with one-sided bounds kept,
 * double-encoded jd, entity/whitespace-collapsed title, lone-surrogate id
 * drops one row), the empty-vs-broken envelope split (present-and-empty
 * data → [], any other envelope throws naming the keys it got), and the
 * paginated fetch contract (rebuild from host+companyId only, redirect:
 * 'error' on every page, paced between pages, short-page stop read from
 * the SOURCE's row count, cross-page dedup, max_pages caps + truncation
 * warning, probe cooperation via opts.maxPages, first-page failure throws /
 * later-page failure keeps the pages collected). No network — parse is
 * pure; fetch runs on a fake fetchImpl with an injected sleep.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  DARWINBOX_HOST_RE,
  CAREERS_PATH_RE,
  resolveBoard,
  resolveMaxPages,
  jobLocation,
  parseDarwinboxResponse,
  fetchDarwinbox,
} from '../server/lib/sources/darwinbox.mjs';
import { darwinboxAdapter } from '../server/lib/portals/adapters/darwinbox.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The #/scan facet helpers the emitted rows must feed (CAR-228): the salary
// tokenizer + range filter from public/js/lib/skills.js and the country
// detector from public/js/lib/countries.js, both browser IIFEs loaded under a
// synthetic window (the established tests/salary-filter.test.mjs pattern).
const __dirname = dirname(fileURLToPath(import.meta.url));
globalThis.window = {};
new Function(readFileSync(resolve(__dirname, '..', 'public', 'js', 'lib', 'skills.js'), 'utf8'))();
new Function(readFileSync(resolve(__dirname, '..', 'public', 'js', 'lib', 'countries.js'), 'utf8'))();
const Skills = globalThis.window.Skills;
const Countries = globalThis.window.Countries;

const ORIGIN = 'https://acme.darwinbox.in';
const BOARD = { origin: ORIGIN, companyId: 'main' };
const CAREERS = `${ORIGIN}/ms/candidatev2/main/careers/allJobs`;
const ENDPOINT = `${ORIGIN}/ms/candidateapi/job/alljobs?companyId=main`;
const PAGE_SIZE = 50;

// ── fixtures ─────────────────────────────────────────────────────────────────

const row = (id, extra = {}) => ({
  id,
  title: `Engineer ${id}`,
  jd: '&lt;p class=&quot;x&quot;&gt;Build &lt;b&gt;things&lt;/b&gt; &amp;amp; ship&lt;/p&gt;',
  tool_tip_locations: ['Head Office, Pune, Maharashtra, India'],
  locations: 'Head Office, Pune, Maharashtra\r, India',
  posted_on: 1790000000,
  created_on: '2026-09-01T07:56:42.000Z',
  internal_job_code: `JOB_${id}`,
  salary_min: '1600000',
  salary_max: '2300000',
  salary_currency: 'inr',
  salary_timeframe: 'Annual',
  ...extra,
});
const envelope = (rows, jobCounts = rows.length) => ({ status: 'success', data: rows, job_counts: jobCounts });
const fullPage = (prefix, jobCounts) => envelope(Array.from({ length: PAGE_SIZE }, (_, i) => row(`${prefix}${i}`)), jobCounts);

/** Run `fn` with console.error captured; returns what it logged. */
async function captureErrors(fn) {
  const real = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.error = real;
  }
  return lines;
}

/** A fake fetchImpl serving `pages` in order, recording url/opts/body; a
 *  no-op sleep recorder rides alongside (fetch receives it via opts.sleep). */
function pagedFetch(pages) {
  const calls = [];
  const sleeps = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    const page = pages[calls.length - 1];
    if (page instanceof Error) throw page;
    return { ok: true, status: 200, json: async () => page };
  };
  const sleep = async (ms) => { sleeps.push(ms); };
  return { calls, sleeps, fetchImpl, sleep };
}

// ── meta + adapter contract ──────────────────────────────────────────────────

test('darwinbox: meta — value, label, region en', () => {
  assert.deepEqual(meta, { value: 'darwinbox', label: 'Darwinbox', region: 'en' });
  assert.equal(darwinboxAdapter.id, 'darwinbox');
  assert.equal(darwinboxAdapter.label, 'Darwinbox');
});

test('darwinbox: the adapter matches a tenant careers URL on the pinned host shape, or the explicit provider', () => {
  assert.equal(darwinboxAdapter.matches({ name: 'Acme', careers_url: CAREERS }), true);
  assert.equal(darwinboxAdapter.matches({ name: 'Acme', api: CAREERS }), true, 'api: also detects');
  assert.equal(darwinboxAdapter.matches({ name: 'Acme', provider: 'darwinbox', careers_url: CAREERS }), true, 'explicit provider override');
  assert.equal(darwinboxAdapter.matches({ name: 'Acme', provider: 'darwinbox' }), true, 'provider alone matches (endpoint resolution is separate)');
  for (const [label, entry] of [
    ['a bare tenant host (no company id)', { careers_url: ORIGIN }],
    ['look-alike host', { careers_url: 'https://acme-darwinbox.in/ms/candidatev2/main/careers/allJobs' }],
    ['a branded careers page', { careers_url: 'https://careers.example.com/jobs' }],
    ['null', null],
    ['a non-object', 'darwinbox'],
  ]) {
    assert.equal(darwinboxAdapter.matches(entry), false, `${label} must not match`);
  }
});

test('darwinbox: buildEndpoint — the canonical allJobs careers URL for a resolvable board, null otherwise (fail-soft)', () => {
  assert.equal(darwinboxAdapter.buildEndpoint({ careers_url: CAREERS }), CAREERS);
  assert.equal(
    darwinboxAdapter.buildEndpoint({ careers_url: `${ORIGIN}/ms/candidatev2/5ffc190a05f27/careers/home` }),
    `${ORIGIN}/ms/candidatev2/5ffc190a05f27/careers/allJobs`,
    'any careers path reduces to the canonical allJobs URL',
  );
  assert.equal(darwinboxAdapter.buildEndpoint({ careers_url: ORIGIN }), null, 'a bare tenant host yields no endpoint');
  assert.equal(darwinboxAdapter.buildEndpoint({ provider: 'darwinbox' }), null, 'provider without a URL yields no endpoint');
  assert.equal(darwinboxAdapter.buildEndpoint(null), null);
});

// ── resolveBoard / host rules ────────────────────────────────────────────────

test('darwinbox: resolveBoard claims tenant careers URLs carrying a company id', () => {
  const cases = [
    [CAREERS, 'the allJobs page'],
    [`${ORIGIN}/ms/candidatev2/main/careers/home`, 'the careers home page'],
    [`${ORIGIN}/ms/candidatev2/main/careers`, 'the careers root'],
    [`${ORIGIN}/ms/candidatev2/main/careers/jobDetails/a123`, 'a posting permalink'],
    ['https://ACME.darwinbox.in/ms/candidatev2/main/careers/allJobs?x=1#y', 'an upper-case host with a query'],
    ['https://acme.darwinbox.in:8443/ms/candidatev2/main/careers/allJobs', 'a tenant host carrying a port'],
    [`${ORIGIN}/ms/candidatev2/5ffc190a05f27/careers/allJobs`, 'a tenant-specific company id'],
  ];
  for (const [url, label] of cases) {
    const board = resolveBoard({ careers_url: url });
    assert.ok(board, `${label} claimed`);
    assert.equal(board.companyId, new URL(url).pathname.match(CAREERS_PATH_RE)[1], `${label}: the company id is read off the path`);
    assert.equal(board.origin, `https://${new URL(url).hostname}`, `${label}: the origin is rebuilt from the host`);
  }
  assert.deepEqual(resolveBoard({ careers_url: CAREERS }), { origin: ORIGIN, companyId: 'main' });
});

test('darwinbox: resolveBoard — api: wins; a non-board api falls through to careers_url', () => {
  assert.deepEqual(resolveBoard({ api: CAREERS }), { origin: ORIGIN, companyId: 'main' });
  assert.deepEqual(
    resolveBoard({ api: 'https://www.example.com/', careers_url: CAREERS }),
    { origin: ORIGIN, companyId: 'main' },
    'falls through when api: is not a board',
  );
});

test('darwinbox: resolveBoard rejects look-alike, spoofed and unusable URLs', () => {
  const rejects = [
    ['non-HTTPS', 'http://acme.darwinbox.in/ms/candidatev2/main/careers/allJobs'],
    ['suffix-spoofed host', 'https://acme.darwinbox.in.evil.example/ms/candidatev2/main/careers/allJobs'],
    ['suffix look-alike host', 'https://evildarwinbox.in/ms/candidatev2/main/careers/allJobs'],
    ['hyphen look-alike host', 'https://acme-darwinbox.in/ms/candidatev2/main/careers/allJobs'],
    ['two tenant labels', 'https://a.b.darwinbox.in/ms/candidatev2/main/careers/allJobs'],
    ['label starting with a hyphen', 'https://-acme.darwinbox.in/ms/candidatev2/main/careers/allJobs'],
    ['the apex host', 'https://darwinbox.in/ms/candidatev2/main/careers/allJobs'],
    ['a bare tenant host (no company id to read)', ORIGIN],
    ['the employee login page', `${ORIGIN}/user/login`],
    ['an encoded slash in the company id', `${ORIGIN}/ms/candidatev2/ma%2Fin/careers/allJobs`],
    ['a branded careers page', 'https://careers.example.com/jobs'],
    ['a malformed URL', 'not a url'],
    ['null careers_url', null],
    ['non-string careers_url', 42],
    ['missing careers_url', undefined],
  ];
  for (const [label, url] of rejects) {
    assert.equal(resolveBoard({ careers_url: url }), null, `${label} must be rejected`);
  }
  assert.equal(resolveBoard(null), null);
  assert.equal(resolveBoard({}), null);
});

test('darwinbox: DARWINBOX_HOST_RE is the single-label tenant shape', () => {
  assert.ok(DARWINBOX_HOST_RE.test('acme.darwinbox.in'));
  assert.ok(DARWINBOX_HOST_RE.test('a-b.darwinbox.in'));
  assert.ok(!DARWINBOX_HOST_RE.test('darwinbox.in'));
  assert.ok(!DARWINBOX_HOST_RE.test('a.b.darwinbox.in'));
  assert.ok(!DARWINBOX_HOST_RE.test('-acme.darwinbox.in'));
  assert.ok(!DARWINBOX_HOST_RE.test('acme-darwinbox.in'));
  assert.ok(!DARWINBOX_HOST_RE.test('acme.darwinbox.in.evil.example'));
});

// ── max_pages ────────────────────────────────────────────────────────────────

test('darwinbox: resolveMaxPages honours a positive integer up to the hard ceiling', () => {
  assert.equal(resolveMaxPages({}), 20);
  assert.equal(resolveMaxPages(null), 20);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 99999 }), 200, 'capped at MAX_PAGES_CAP');
  assert.equal(resolveMaxPages({ max_pages: 0 }), 20);
  assert.equal(resolveMaxPages({ max_pages: 'many' }), 20);
  assert.equal(resolveMaxPages({ max_pages: 1.5 }), 20, 'a non-integer is not honoured');
});

// ── jobLocation ──────────────────────────────────────────────────────────────

test('darwinbox: jobLocation joins distinct sites, falls back to the display string, tolerates junk', () => {
  assert.equal(
    jobLocation({ tool_tip_locations: ['Pune, India', 'Pune, India', 'Dubai, UAE'], locations: 'Multiple Locations' }),
    'Pune, India; Dubai, UAE',
    'distinct sites joined, duplicates dropped, the display string loses to the tips',
  );
  assert.equal(
    jobLocation({ locations: 'Head Office, Pune, Maharashtra\r, India' }),
    'Head Office, Pune, Maharashtra, India',
    'the display string is cleaned',
  );
  assert.equal(jobLocation({ tool_tip_locations: [], locations: 'Pune' }), 'Pune');
  assert.equal(jobLocation({ tool_tip_locations: [null, 42] }), '');
  assert.equal(jobLocation({}), '');
  assert.equal(jobLocation(null), '');
});

// ── parseDarwinboxResponse ───────────────────────────────────────────────────

test('darwinbox: parse maps the live response shape — url/company/location/requisitionId/postedAt/salary/description', () => {
  const [j1] = parseDarwinboxResponse(envelope([row('a1')]), 'Acme', BOARD);
  assert.equal(j1.title, 'Engineer a1');
  assert.equal(j1.url, `${ORIGIN}/ms/candidatev2/main/careers/jobDetails/a1`);
  assert.equal(j1.company, 'Acme');
  assert.equal(j1.location, 'Head Office, Pune, Maharashtra, India');
  assert.equal(j1.requisitionId, 'JOB_a1');
  assert.equal(j1.postedAt, 1790000000 * 1000, 'posted_on is epoch SECONDS');
  assert.equal(j1.description, 'Build things & ship', 'the double-encoded jd reduces to plain text');
  assert.deepEqual(j1.salary, { min: 1600000, max: 2300000, currency: 'INR' }, 'annual figures to numbers, currency uppercased');
});

test('darwinbox: parse drops rows without a title or an id, and non-object rows', () => {
  const parsed = parseDarwinboxResponse(envelope([
    row('a1'),
    row('a3', { title: '   ' }),
    row(null),
    row(''),
    null,
    'junk',
  ]), 'Acme', BOARD);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Engineer a1');
});

test('darwinbox: posted_on 0 falls back to created_on; unreadable dates leave postedAt unset', () => {
  const [j2] = parseDarwinboxResponse(envelope([row('a2', { posted_on: 0 })]), 'Acme', BOARD);
  assert.equal(j2.postedAt, Date.parse('2026-09-01T07:56:42.000Z'), 'created_on is the fallback');
  const [j3] = parseDarwinboxResponse(envelope([row('a3', { posted_on: 'soon', created_on: 'later' })]), 'Acme', BOARD);
  assert.ok(!('postedAt' in j3), 'neither date parses → postedAt unset');
});

test('darwinbox: salary only for real annual figures; a one-sided bound keeps the side it states', () => {
  const salaryOf = (extra) => parseDarwinboxResponse(envelope([row('a1', extra)]), 'Acme', BOARD)[0].salary;
  assert.equal(salaryOf({ salary_timeframe: 'Monthly' }), undefined, 'a monthly salary is left out rather than converted');
  assert.equal(salaryOf({ salary_min: 'negotiable', salary_max: '0' }), undefined, 'non-numeric and zero figures left out');
  assert.equal(salaryOf({ salary_min: '', salary_max: '', salary_currency: '' }), undefined);
  const oneSided = salaryOf({ salary_min: '', salary_max: '900000' });
  assert.deepEqual(oneSided, { max: 900000, currency: 'INR' });
});

test('darwinbox: optional fields stay unset when empty; entities + whitespace collapse in a title', () => {
  const [j2] = parseDarwinboxResponse(envelope([row('a2', {
    posted_on: 0,
    jd: '',
    internal_job_code: '',
    salary_min: '',
    salary_max: '',
    tool_tip_locations: [],
    locations: '',
  })]), 'Acme', BOARD);
  assert.ok(!('description' in j2));
  assert.ok(!('requisitionId' in j2));
  assert.ok(!('salary' in j2));
  assert.equal(j2.location, '');
  const [j4] = parseDarwinboxResponse(envelope([row('a4', { title: '  R&amp;D   Engineer  ' })]), 'Acme', BOARD);
  assert.equal(j4.title, 'R&D Engineer');
});

test('darwinbox: a lone-surrogate id drops that posting, not the board', () => {
  const out = parseDarwinboxResponse(envelope([row('\uD800bad'), row('a7')]), 'Acme', BOARD);
  assert.equal(out.length, 1);
  assert.ok(out[0].url.endsWith('/jobDetails/a7'));
});

test('darwinbox: a present-and-empty data array is a real empty board ([])', () => {
  assert.deepEqual(parseDarwinboxResponse(envelope([]), 'Acme', BOARD), []);
});

test('darwinbox: any other envelope throws a descriptive error naming what arrived', () => {
  for (const [body, label] of [
    [{}, 'an empty object'],
    [{ status: 'success' }, 'a missing data key'],
    [{ status: 'success', data: null }, 'a null data key'],
    [{ status: 'success', data: {} }, 'a non-array data key'],
    [{ status: 'error', data: [] }, 'a status other than success'],
    [{ jobs: [] }, 'a different container key'],
    [[], 'a bare array'],
    [null, 'null'],
    ['', 'an empty body'],
    [42, 'a number'],
    ['<html>', 'an HTML body'],
  ]) {
    assert.throws(
      () => parseDarwinboxResponse(body, 'Acme', BOARD),
      /darwinbox: unexpected response|expected a JSON object/,
      `${label} must throw`,
    );
  }
});

test('darwinbox: the unexpected-response error names the keys it got', () => {
  assert.throws(
    () => parseDarwinboxResponse({ error: 'x', jobs: [] }, 'Acme', BOARD),
    /\[error, jobs\]/,
  );
});

// ── fetch — the paginated web-ui fetch contract ──────────────────────────────

test('darwinbox: fetch rejects an unresolvable board BEFORE any request', async () => {
  let calls = 0;
  for (const entry of [
    { name: 'Acme', careers_url: 'https://careers.example.com/jobs' },
    { name: 'Acme', careers_url: ORIGIN },
  ]) {
    await assert.rejects(
      () => fetchDarwinbox('', { fetchImpl: async () => { calls += 1; return { ok: true, json: async () => envelope([]) }; }, company: entry }),
      /cannot derive a board.*careers_url.*candidatev2/,
    );
  }
  assert.equal(calls, 0, 'no request leaves the process');
});

test('darwinbox: fetch POSTs the company id, a 1-based page and the page size — rebuilt from host + id only', async () => {
  const ctx = pagedFetch([envelope([row('a1'), row('a2')])]);
  const jobs = await fetchDarwinbox(
    'https://acme.darwinbox.in:9999/ms/candidatev2/main/careers/home?x=1',
    { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: 'https://acme.darwinbox.in:9999/ms/candidatev2/main/careers/home?x=1' }, retries: 0 },
  );
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(ctx.calls.length, 1, 'a short first page ends the walk');
  assert.equal(ctx.calls[0].url, ENDPOINT, 'the input port and path are discarded — the request is rebuilt');
  assert.equal(ctx.calls[0].opts.method, 'POST');
  assert.equal(ctx.calls[0].opts.redirect, 'error');
  assert.deepEqual(ctx.calls[0].body, { companyId: 'main', page: 1, sort_option: 'new', limit: PAGE_SIZE });
  assert.deepEqual(ctx.sleeps, [], 'no delay before the first page');
});

test('darwinbox: a tenant-specific company id reaches both the request and the posting URLs', async () => {
  const ctx = pagedFetch([envelope([row('a1')])]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl,
    sleep: ctx.sleep,
    company: { name: 'Acme', careers_url: `${ORIGIN}/ms/candidatev2/5ffc190a05f27/careers/allJobs` },
    retries: 0,
  });
  assert.equal(ctx.calls[0].url, `${ORIGIN}/ms/candidateapi/job/alljobs?companyId=5ffc190a05f27`);
  assert.equal(ctx.calls[0].body.companyId, '5ffc190a05f27');
  assert.equal(jobs[0].url, `${ORIGIN}/ms/candidatev2/5ffc190a05f27/careers/jobDetails/a1`);
});

test('darwinbox: fetch walks pages until a short one, paced between pages, redirect:"error" everywhere', async () => {
  const ctx = pagedFetch([fullPage('a', 72), fullPage('b', 72), envelope([row('c1'), row('c2')], 72)]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(jobs.length, 102);
  assert.equal(ctx.calls.map((c) => c.body.page).join(), '1,2,3');
  assert.ok(ctx.calls.every((c) => c.opts.redirect === 'error'));
  assert.deepEqual(ctx.sleeps, [200, 200], 'delays only between pages');
});

test('darwinbox: an exact multiple of the page size ends on the empty page after it', async () => {
  const ctx = pagedFetch([fullPage('a', PAGE_SIZE), envelope([], PAGE_SIZE)]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(jobs.length, PAGE_SIZE);
  assert.equal(ctx.calls.length, 2);
});

test('darwinbox: the short-page stop reads the SOURCE row count — a full page with one malformed row keeps walking', async () => {
  const withBadRow = fullPage('a', 51);
  withBadRow.data[0] = row('bad', { title: '' });
  const ctx = pagedFetch([withBadRow, envelope([row('b1')], 51)]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(ctx.calls.length, 2);
  assert.equal(jobs.length, PAGE_SIZE);
});

test('darwinbox: a posting that shifts across pages mid-walk is returned once', async () => {
  const ctx = pagedFetch([fullPage('a', 51), envelope([row('a49')], 51)]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(jobs.length, PAGE_SIZE);
});

test('darwinbox: fetch stops at DEFAULT_MAX_PAGES and warns when the ceiling truncated the board', async () => {
  const pages = Array.from({ length: 30 }, (_, i) => fullPage(`p${i}x`, 5000));
  const ctx = pagedFetch(pages);
  let jobs;
  const logged = await captureErrors(async () => {
    jobs = await fetchDarwinbox('', { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS } });
  });
  assert.equal(ctx.calls.length, 20);
  assert.equal(jobs.length, 20 * PAGE_SIZE);
  assert.ok(
    logged.some((l) => /truncated at max_pages=20 \(1000 of 5000 jobs\) — raise max_pages/.test(l)),
    `truncation warning: ${JSON.stringify(logged)}`,
  );
});

test('darwinbox: an entry max_pages is honoured', async () => {
  const ctx = pagedFetch([fullPage('a'), fullPage('b'), fullPage('c')]);
  await captureErrors(() => fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS, max_pages: 2 }, retries: 0,
  }));
  assert.equal(ctx.calls.length, 2);
});

test('darwinbox: no truncation warning when the cap lands exactly on the board end, or on a short page', async () => {
  const exactEnd = pagedFetch([fullPage('a', 100), fullPage('b', 100)]);
  const logged1 = await captureErrors(() => fetchDarwinbox('', {
    fetchImpl: exactEnd.fetchImpl, sleep: exactEnd.sleep, company: { name: 'Acme', careers_url: CAREERS, max_pages: 2 }, retries: 0,
  }));
  assert.deepEqual(logged1, [], 'fetched >= job_counts says the full last page was the end');

  const shortAtCap = pagedFetch([fullPage('a', 60), envelope([row('b1')], 60)]);
  const logged2 = await captureErrors(() => fetchDarwinbox('', {
    fetchImpl: shortAtCap.fetchImpl, sleep: shortAtCap.sleep, company: { name: 'Acme', careers_url: CAREERS, max_pages: 2 }, retries: 0,
  }));
  assert.deepEqual(logged2, [], 'a short page at the cap is a complete walk');
});

test('darwinbox: a later-page failure keeps the pages collected and warns without blaming max_pages', async () => {
  const unavailable = new Error('Service Unavailable');
  unavailable.status = 503;
  const ctx = pagedFetch([fullPage('a', 120), unavailable, unavailable, unavailable]);
  let jobs;
  const logged = await captureErrors(async () => {
    jobs = await fetchDarwinbox('', { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0 });
  });
  assert.equal(jobs.length, PAGE_SIZE);
  assert.ok(logged.some((l) => /stopped at page 2/.test(l)));
  assert.ok(!logged.some((l) => /raise max_pages/.test(l)));
});

test('darwinbox: a transient 503 is retried and the walk finishes', async () => {
  const unavailable = new Error('Service Unavailable');
  unavailable.status = 503;
  const ctx = pagedFetch([fullPage('a', 120), unavailable, fullPage('b', 120), envelope([row('c1')], 120)]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 1,
  });
  assert.equal(jobs.length, 2 * PAGE_SIZE + 1);
  assert.equal(ctx.calls.length, 4, 'page 2 retried once (retries: 1), then the walk continued');
});

test('darwinbox: a broken envelope on a later page keeps the pages collected and names the cause; on the first page it throws', async () => {
  const ctx = pagedFetch([fullPage('a', 120), { message: 'maintenance' }]);
  let jobs;
  const logged = await captureErrors(async () => {
    jobs = await fetchDarwinbox('', { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0 });
  });
  assert.equal(jobs.length, PAGE_SIZE);
  assert.ok(logged.some((l) => /stopped at page 2.*unexpected response/.test(l)));

  await assert.rejects(
    () => fetchDarwinbox('', { fetchImpl: pagedFetch([{ message: 'maintenance' }]).fetchImpl, sleep: async () => {}, company: { name: 'Acme', careers_url: CAREERS }, retries: 0 }),
    /unexpected response/,
  );
  const empty = await fetchDarwinbox('', {
    fetchImpl: pagedFetch([envelope([])]).fetchImpl, sleep: async () => {}, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.deepEqual(empty, [], 'a live empty board is []');
});

test('darwinbox: probe cooperation — opts.maxPages caps the walk at one request, no warning, failures propagate unwrapped', async () => {
  const ctx = pagedFetch([fullPage('a', 5000), fullPage('b', 5000)]);
  const logged = await captureErrors(() => fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, maxPages: 1,
  }));
  assert.equal(ctx.calls.length, 1);
  assert.deepEqual(logged, [], 'the probe cap must not fire the raise-max_pages warning');

  const boom = new Error('budget');
  await assert.rejects(
    () => fetchDarwinbox('', { fetchImpl: pagedFetch([boom]).fetchImpl, sleep: async () => {}, company: { name: 'Acme', careers_url: CAREERS }, maxPages: 1, retries: 0 }),
    (err) => err === boom,
    'a probe gets the rejection unwrapped so a budget stop keeps its identity',
  );
});

test('darwinbox: the first page failing throws — the board is broken, not empty', async () => {
  const dead = new Error('Internal Server Error');
  dead.status = 500;
  const ctx = pagedFetch([dead, dead, dead]);
  await assert.rejects(
    () => fetchDarwinbox('', { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS } }),
    (err) => err.status === 500,
    'the retry budget is spent, then the error propagates unchanged',
  );
  assert.equal(ctx.calls.length, 3, 'default retries: 2');
});

test('darwinbox: normalized rows carry the scanner 12-field shape', async () => {
  const ctx = pagedFetch([envelope([row('a1', { posted_on: 1790000000 })])]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  const [r] = jobs;
  assert.deepEqual(
    Object.keys(r).sort(),
    ['company', 'date', 'id', 'isRemote', 'location', 'relocates', 'salary', 'snippet', 'source', 'title', 'url', 'workplaceType'],
  );
  assert.equal(r.id, `darwinbox-${r.url}`);
  assert.equal(r.source, 'darwinbox');
  assert.equal(r.date, '2026-09-21');
  assert.equal(r.salary, '1600000–2300000 INR', 'annual figures render as a display string');
  assert.equal(r.isRemote, false);
  assert.equal(r.workplaceType, '');
  assert.equal(r.relocates, false);
  assert.equal(r.snippet, 'Build things & ship');
});

// ── CAR-228 — the emitted fields feed the #/scan filter panel ────────────────

test('darwinbox: normalized rows feed the REAL #/scan facets — INR salary range, country detection, age-facet date', async () => {
  const ctx = pagedFetch([envelope([row('a1')])]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  const [r] = jobs;
  // The display string "1600000–2300000 INR" (en dash, no grouping) parses to
  // raw rupees — the facet compares numbers currency-agnostically (documented
  // Skills behavior: no offline FX), which is exactly the intended contract.
  assert.deepEqual(Skills.parseSalaryRange(r.salary), { min: 1600000, max: 2300000 });
  assert.equal(Skills.salaryInRange(r, 1000000, 2000000), true, 'overlap semantics keep the row');
  assert.equal(Skills.salaryInRange(r, 3000000, 4000000), false);
  // A one-sided bound renders as "≥ N" / "≤ N" and still parses to one number.
  const oneSided = pagedFetch([envelope([row('b1', { salary_min: '', salary_max: '900000' })])]);
  const [r2] = await fetchDarwinbox('', {
    fetchImpl: oneSided.fetchImpl, sleep: oneSided.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(r2.salary, '≤ 900000 INR');
  assert.deepEqual(Skills.parseSalaryRange(r2.salary), { min: 900000, max: 900000 });
  // The "; "-joined location maps through the REAL country facet.
  assert.deepEqual(Countries.detectCountry(r.location), { code: 'in', name: 'India', flag: '🇮🇳' });
  assert.equal(Countries.rowInCountry(r, 'in'), true);
  // The date parses for the Posted-within facet.
  assert.ok(Number.isFinite(Date.parse(r.date)), `age facet reads ${r.date}`);
});

test('darwinbox: an ageless row keeps date as a defined "" — the Posted-within facet conservative-passes it', async () => {
  // Neither posted_on nor created_on parses → postedAt unset → date ''.
  const ctx = pagedFetch([envelope([row('a1', { posted_on: undefined, created_on: undefined })])]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].date, '');
  assert.equal(typeof jobs[0].date, 'string', 'an empty string, never undefined — the age facet guards on truthy r.date');
  assert.equal(jobs[0].salary, '1600000–2300000 INR', 'the silent date does not silence the other fields');
});

test('darwinbox: no-invention — a silent feed leaves the field empty, never a guess', async () => {
  // salary_timeframe Monthly → no salary (left out rather than converted);
  // no tool_tip_locations/locations → location ''. Both stay '' on the row.
  const ctx = pagedFetch([envelope([row('a1', {
    salary_timeframe: 'Monthly',
    tool_tip_locations: [],
    locations: '',
  })])]);
  const jobs = await fetchDarwinbox('', {
    fetchImpl: ctx.fetchImpl, sleep: ctx.sleep, company: { name: 'Acme', careers_url: CAREERS }, retries: 0,
  });
  assert.equal(jobs[0].salary, '', 'a non-annual figure is never annualized into a salary');
  assert.equal(jobs[0].location, '', 'a location-less row stays location-less');
  assert.equal(Skills.parseSalaryRange(jobs[0].salary), null);
});

test('darwinbox: fetch fails loud when the signal is already aborted (no empty board)', async () => {
  const controller = new AbortController();
  controller.abort();
  let entered = 0;
  await assert.rejects(
    () => fetchDarwinbox('', {
      fetchImpl: async () => { entered += 1; return { ok: true, json: async () => envelope([]) }; },
      company: { name: 'Acme', careers_url: CAREERS },
      signal: controller.signal,
    }),
    /abort/i,
  );
  assert.equal(entered, 0);
});

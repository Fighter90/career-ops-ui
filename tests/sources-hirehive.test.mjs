/**
 * HireHive source (upstream #6503 port) — CI-isolated suite.
 *
 * A HireHive tenant board (`<tenant>.hirehive.com`) serves its postings from
 * a public anonymous API, `GET /api/v2/jobs?page=N&page_size=100`, envelope
 * `{ meta, links, items[] }`. The parser must fail CLOSED on a body without
 * items[] (a silent zero would look like an empty board) while a
 * present-and-empty items[] is []. Ported cases: tenant resolution (https +
 * anchored host + vendor service labels www/app/accounts/apply never claimed,
 * any posting path claimed), the row mapping (hosted_url posting URL kept
 * even on a group sibling tenant, location+country fold, published date,
 * language, description HTML→text with entities decoded, salary from
 * displayed yearly tiers only), the fail-closed parse gates, the pagination
 * walk (has_next_page and the RAW page length both stop it, dedup by URL,
 * max_pages cap with a warning), and the web-ui partials contract (a page-1
 * failure throws — a 404 names the tenant — while a later-page failure keeps
 * what a complete first walk collected). No network — fetchHireHive runs on
 * a fake fetchImpl with an injectable sleep.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  PAGE_SIZE,
  HIREHIVE_HOST_RE,
  hireHiveTenantOf,
  resolveOrigin,
  resolveMaxPages,
  buildLocation,
  postingUrl,
  parseSalary,
  parseHireHiveJob,
  parseHireHivePage,
  fetchHireHive,
} from '../server/lib/sources/hirehive.mjs';
import { hirehiveAdapter } from '../server/lib/portals/adapters/hirehive.mjs';

const ORIGIN = 'https://acme.hirehive.com';
const API = `${ORIGIN}/api/v2/jobs`;

/** One item in the shape `/api/v2/jobs` returns. */
function item(over = {}) {
  return {
    id: 'job_Ab12Cd',
    title: 'Backend Engineer',
    location: 'Berlin',
    country: { name: 'Germany', code: 'DE' },
    description: { html: '<p>Build <strong>APIs</strong> &amp; tools.</p>', text: 'Build APIs & tools.' },
    language: { name: 'German', code: 'de-DE' },
    published_date: '2026-10-20T09:30:00.12Z',
    hosted_url: `${ORIGIN}/backend-engineer-berlin-Ab12Cd`,
    compensation_tiers: [],
    ...over,
  };
}

function envelope(items, { hasNext = false, page = 1 } = {}) {
  return {
    meta: { page_size: PAGE_SIZE, page, total_items: items.length, has_next_page: hasNext },
    links: { next: hasNext ? `/api/v2/jobs?page=${page + 1}` : null },
    items,
  };
}

/** A fake fetchImpl answering by `?page=`; records every call. */
function makeFetch(pages, extra = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const page = Number(new URL(url).searchParams.get('page'));
    const answer = typeof pages === 'function' ? pages(page, url) : pages[page - 1];
    if (answer instanceof Error) throw answer;
    return { ok: true, status: 200, json: async () => answer, headers: { get: () => null } };
  };
  return { calls, impl, ...extra };
}

const fullPage = (prefix, n = PAGE_SIZE) =>
  Array.from({ length: n }, (_, i) => item({ title: `${prefix} ${i}`, hosted_url: `${ORIGIN}/${prefix}-${i}-x${i}` }));

const SLEEP = async () => {};
const ENTRY = (extra = {}) => ({ name: 'Acme', careers_url: `${ORIGIN}/`, ...extra });

// ── registry meta + adapter contract ─────────────────────────────────────────

test('hirehive: meta — value, label, region en; adapter contract shape', () => {
  assert.deepEqual(meta, { value: 'hirehive', label: 'HireHive', region: 'en' });
  assert.equal(hirehiveAdapter.id, 'hirehive');
  assert.equal(hirehiveAdapter.label, 'HireHive');
  assert.equal(typeof hirehiveAdapter.matches, 'function');
  assert.equal(typeof hirehiveAdapter.buildEndpoint, 'function');
  assert.equal(typeof hirehiveAdapter.fetch, 'function');
});

test('hirehive: adapter claims the board root and both posting forms, rebuilt to the tenant API', () => {
  for (const careers_url of [
    'https://acme.hirehive.com/',
    'https://acme.hirehive.com',
    'https://ACME.hirehive.com/?countrycode=de',
    'https://acme.hirehive.com/backend-engineer-berlin-Ab12Cd',
    'https://acme.hirehive.com/job/214176/backend-engineer',
    'https://acme.hirehive.com:8443/anything#frag',
    'https://multi-word-co.hirehive.com/',
  ]) {
    assert.equal(hirehiveAdapter.matches({ name: 'Acme', careers_url }), true, careers_url);
  }
  assert.equal(hirehiveAdapter.matches({ name: 'Acme', api: `${API}` }), true, 'an explicit api: URL is claimed');
  assert.equal(hirehiveAdapter.matches({ name: 'Acme', provider: 'hirehive' }), true, 'explicit provider override');
  assert.equal(hirehiveAdapter.buildEndpoint({ careers_url: 'https://acme.hirehive.com/job/214176/x' }), `${API}`, 'the tenant origin is rebuilt; the endpoint is the jobs API');
  assert.equal(hirehiveAdapter.buildEndpoint({ careers_url: 'https://multi-word-co.hirehive.com/' }), 'https://multi-word-co.hirehive.com/api/v2/jobs');
  const rejects = [
    ['non-https', 'http://acme.hirehive.com/'],
    ['suffix-spoofed host', 'https://acme.hirehive.com.evil.example/'],
    ['prefix look-alike', 'https://evilhirehive.com/'],
    ['the bare vendor host', 'https://hirehive.com/'],
    ['two tenant labels', 'https://a.b.hirehive.com/'],
    ['label starting with a hyphen', 'https://-acme.hirehive.com/'],
    ['path-only mention', 'https://evil.example/acme.hirehive.com/'],
    ['the vendor marketing host', 'https://www.hirehive.com/'],
    ['the vendor app host', 'https://app.hirehive.com/'],
    ['the vendor apply host', 'https://apply.hirehive.com/214176/apply'],
    ['the vendor accounts host', 'https://accounts.hirehive.com/'],
    ['malformed', 'not a url'],
    ['empty', ''],
    ['non-string', 42],
  ];
  for (const [name, u] of rejects) {
    assert.equal(hirehiveAdapter.matches({ careers_url: u }), false, `${name} must be rejected`);
    assert.equal(hirehiveAdapter.buildEndpoint({ careers_url: u }), null, `${name} yields no endpoint`);
  }
  assert.equal(hirehiveAdapter.matches(null), false);
  assert.equal(hirehiveAdapter.matches({}), false);
});

test('hirehive: hireHiveTenantOf / resolveOrigin / resolveMaxPages / postingUrl basics', () => {
  assert.equal(hireHiveTenantOf('acme.hirehive.com'), 'acme');
  assert.equal(hireHiveTenantOf('www.hirehive.com'), null, 'vendor service hosts are not tenants');
  assert.equal(hireHiveTenantOf('acme.hirehive.com.evil.example'), null);
  assert.ok(HIREHIVE_HOST_RE.test('acme-corp.hirehive.com'));
  assert.ok(!HIREHIVE_HOST_RE.test('a.b.hirehive.com'));
  assert.equal(resolveOrigin({ api: 'https://acme.hirehive.com/api/v2/jobs', careers_url: 'https://example.com' }), ORIGIN);
  assert.equal(resolveOrigin({ careers_url: 'https://acme.hirehive.com/x' }), ORIGIN);
  assert.equal(resolveOrigin({}), null);
  assert.equal(resolveOrigin(null), null);
  assert.equal(resolveMaxPages({}), 20);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 100000 }), 100, 'the ceiling caps the override');
  assert.equal(postingUrl('https://acme-france.hirehive.com/role-paris-Zz99Yy'), 'https://acme-france.hirehive.com/role-paris-Zz99Yy');
  assert.equal(postingUrl('http://acme.hirehive.com/x'), null);
  assert.equal(postingUrl('https://evil.example/x'), null);
});

test('hirehive: fetch normalizes the API item shape — one page-1 request with page_size and redirect:"error"', async () => {
  const { calls, impl } = makeFetch([envelope([item()])]);
  const jobs = await fetchHireHive(API, { fetchImpl: impl, company: ENTRY(), sleep: SLEEP });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API}?page=1&page_size=${PAGE_SIZE}`);
  assert.equal(calls[0].opts.redirect, 'error');
  const [job] = jobs;
  assert.equal(job.id, `hirehive-${ORIGIN}/backend-engineer-berlin-Ab12Cd`);
  assert.equal(job.title, 'Backend Engineer');
  assert.equal(job.url, `${ORIGIN}/backend-engineer-berlin-Ab12Cd`, 'hosted_url is the posting URL, kept verbatim');
  assert.equal(job.company, 'Acme');
  assert.equal(job.location, 'Berlin, Germany');
  assert.equal(job.date, new Date(Date.parse('2026-10-20T09:30:00.12Z')).toISOString());
  assert.equal(job.language, 'de-DE');
  assert.equal(job.snippet, 'Build APIs & tools.');
  assert.equal(job.source, 'hirehive');
});

test('hirehive: buildLocation appends the country only when the text lacks it', () => {
  assert.equal(buildLocation(item({ location: 'Dublin', country: { name: 'Ireland' } })), 'Dublin, Ireland');
  assert.equal(buildLocation(item({ location: 'Draper, UT', country: { name: 'United States' } })), 'Draper, UT, United States');
  assert.equal(buildLocation(item({ location: 'Sydney, Australia', country: { name: 'Australia' } })), 'Sydney, Australia', 'no repeat');
  assert.equal(buildLocation(item({ location: '', country: { name: 'Ireland' } })), 'Ireland');
  assert.equal(buildLocation(item({ location: 'Remote', country: null })), 'Remote');
  assert.equal(buildLocation(item({ location: null, country: null })), '');
});

test('hirehive: parseHireHiveJob drops rows without a title or a trusted posting URL; optional fields omitted', () => {
  assert.equal(parseHireHiveJob(null, 'Acme'), null);
  assert.equal(parseHireHiveJob(item({ title: '   ' }), 'Acme'), null);
  assert.equal(parseHireHiveJob(item({ hosted_url: undefined }), 'Acme'), null);
  assert.equal(parseHireHiveJob(item({ hosted_url: 'https://evil.example/x' }), 'Acme'), null);
  assert.equal(parseHireHiveJob(item({ hosted_url: 'http://acme.hirehive.com/x' }), 'Acme'), null);
  assert.equal(parseHireHiveJob(item({ hosted_url: 'https://www.hirehive.com/x' }), 'Acme'), null);
  assert.equal(parseHireHiveJob(item({ hosted_url: 'not a url' }), 'Acme'), null);

  const bare = parseHireHiveJob(item({ published_date: 'not a date', language: null, description: null }), 'Acme');
  assert.ok(bare);
  assert.equal('postedAt' in bare, false);
  assert.equal('language' in bare, false);
  assert.equal('description' in bare, false);
  assert.equal('requisitionId' in bare, false, 'the posting id is never a requisition id');

  const epoch = parseHireHiveJob(item({ published_date: '1970-01-01T00:00:00Z' }), 'Acme');
  assert.equal(epoch?.postedAt, 0);

  const textOnly = parseHireHiveJob(item({ description: { html: '', text: 'Plain text body' } }), 'Acme');
  assert.equal(textOnly?.description, 'Plain text body');
});

test('hirehive: a group board keeps a posting hosted on another tenant of the same group', () => {
  const job = parseHireHiveJob(item({ hosted_url: 'https://acme-france.hirehive.com/role-paris-Zz99Yy' }), 'Acme Group');
  assert.equal(job?.url, 'https://acme-france.hirehive.com/role-paris-Zz99Yy');
});

test('hirehive: description HTML is reduced to text with its entities decoded', () => {
  const job = parseHireHiveJob(item({ title: 'R&D Engineer', description: { html: '<p>R&amp;D &#252;ber alles</p>' } }), 'Acme');
  assert.equal(job?.title, 'R&D Engineer', 'titles are plain JSON strings, never decoded twice');
  assert.equal(job?.description, 'R&D über alles');
});

test('hirehive: a present-and-empty items[] is an empty board; any other envelope throws via the shape guard', () => {
  assert.deepEqual(parseHireHivePage(envelope([]), 'Acme').jobs, []);
  for (const bad of [{}, { jobs: [] }, { items: null, meta: {} }, { items: {} }, '', null, 7]) {
    assert.throws(() => parseHireHivePage(bad, 'Acme'), /hirehive/, JSON.stringify(bad));
  }
});

test('hirehive: one malformed row is skipped and the rest of the page stands (rawCount keeps the RAW length)', () => {
  const { jobs, rawCount } = parseHireHivePage(envelope([item(), null, 'x', item({ title: '' }), item({ title: 'Second', hosted_url: `${ORIGIN}/second-Qq11Qq` })]), 'Acme');
  assert.equal(rawCount, 5);
  assert.deepEqual(jobs.map((j) => j.title), ['Backend Engineer', 'Second']);
});

test('hirehive: pagination walks until has_next_page is false; a short page ends the walk anyway', async () => {
  const pages = [envelope(fullPage('a'), { hasNext: true }), envelope(fullPage('b'), { hasNext: true, page: 2 }), envelope([item()], { page: 3 })];
  const { calls, impl } = makeFetch(pages);
  const jobs = await fetchHireHive(API, { fetchImpl: impl, company: ENTRY(), sleep: SLEEP });
  assert.equal(jobs.length, PAGE_SIZE * 2 + 1);
  assert.deepEqual(calls.map((c) => new URL(c.url).searchParams.get('page')), ['1', '2', '3']);
  for (const c of calls) assert.equal(c.opts.redirect, 'error');

  const short = makeFetch([envelope([item()], { hasNext: true }), envelope([item()])]);
  await fetchHireHive(API, { fetchImpl: short.impl, company: ENTRY(), sleep: SLEEP });
  assert.equal(short.calls.length, 1, 'the RAW page length beats has_next_page');
});

test('hirehive: the same posting on two pages is returned once', async () => {
  const first = fullPage('a');
  const { impl } = makeFetch([envelope(first, { hasNext: true }), envelope([first[0], item()], { page: 2 })]);
  const jobs = await fetchHireHive(API, { fetchImpl: impl, company: ENTRY(), sleep: SLEEP });
  assert.equal(jobs.length, PAGE_SIZE + 1);
});

test('hirehive: max_pages stops the walk and warns; a probe budget stays silent; a full last page never warns', async () => {
  const warnings = [];
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (m) => warnings.push(String(m));
  console.error = () => {};
  try {
    const capped = makeFetch((page) => envelope(fullPage(`p${page}`), { hasNext: true, page }));
    const jobs = await fetchHireHive(API, { fetchImpl: capped.impl, company: ENTRY({ max_pages: 2 }), sleep: SLEEP });
    assert.equal(capped.calls.length, 2);
    assert.equal(jobs.length, PAGE_SIZE * 2);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /raise max_pages/);

    warnings.length = 0;
    const probe = makeFetch((page) => envelope(fullPage(`p${page}`), { hasNext: true, page }));
    const probed = await fetchHireHive(API, { fetchImpl: probe.impl, company: ENTRY(), maxPages: 1, sleep: SLEEP });
    assert.equal(probe.calls.length, 1, 'a probe asks exactly one page');
    assert.equal(probed.length, PAGE_SIZE);
    assert.deepEqual(warnings, [], 'a probe budget is not the entry cap and never warns');

    const exact = makeFetch([envelope(fullPage('a'), { hasNext: false })]);
    await fetchHireHive(API, { fetchImpl: exact.impl, company: ENTRY({ max_pages: 1 }), sleep: SLEEP });
    assert.deepEqual(warnings, [], 'a complete board at the boundary does not warn');
  } finally {
    console.warn = origWarn;
    console.error = origError;
  }
});

test('hirehive: a page-1 failure throws — a 404 names the missing tenant; other page-1 errors propagate', async () => {
  const gone = makeFetch(() => Object.assign(new Error('HTTP 404'), { status: 404 }));
  await assert.rejects(
    () => fetchHireHive(API, { fetchImpl: gone.impl, company: ENTRY(), sleep: SLEEP }),
    (e) => e.status === 404 && /no such HireHive tenant/.test(e.message) && /acme\.hirehive\.com/.test(e.message),
  );

  const dead = makeFetch(() => Object.assign(new Error('HTTP 500'), { status: 500 }));
  await assert.rejects(
    () => fetchHireHive(API, { fetchImpl: dead.impl, company: ENTRY(), sleep: SLEEP }),
    /HTTP 500/,
  );
});

test('hirehive: a failed later page keeps the jobs already collected (partials contract), without the cap warning', async () => {
  const errors = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (m) => errors.push(String(m));
  console.warn = () => {};
  try {
    const err = Object.assign(new Error('HTTP 503'), { status: 503 });
    const { impl } = makeFetch((page) => (page === 1 ? envelope(fullPage('a'), { hasNext: true }) : err));
    const jobs = await fetchHireHive(API, { fetchImpl: impl, company: ENTRY({ max_pages: 2 }), sleep: SLEEP });
    assert.equal(jobs.length, PAGE_SIZE, 'page 1 survives a later-page failure');
    assert.match(errors.join('\n'), /page 2 failed .* keeping the 100 jobs collected/);
  } finally {
    console.error = origError;
    console.warn = origWarn;
  }
});

test('hirehive: salary comes only from a displayed yearly tier and rides the scanner row as text', () => {
  const tier = (over = {}) => ({
    label: null, type: 'range_salary', interval: 'year', currency_code: 'EUR',
    min_value: 50000, max_value: 69000, ...over,
  });
  assert.deepEqual(parseSalary([tier()]), { min: 50000, max: 69000, currency: 'EUR' });
  assert.deepEqual(parseSalary([tier({ type: 'fixed_salary', max_value: null, currency_code: 'usd' })]), { min: 50000, max: 50000, currency: 'USD' });
  assert.deepEqual(parseSalary([tier({ min_value: null, max_value: 80000, currency_code: null })]), { min: 80000, max: 80000 }, 'no currency → the key is left off');
  assert.deepEqual(parseSalary([tier({ min_value: 90000, max_value: 70000 })]), { min: 70000, max: 90000, currency: 'EUR' }, 'swapped bounds are ordered');
  assert.equal(parseSalary([tier({ type: 'none', min_value: 32700 })]), null, 'a `none` tier is not shown on the posting page, whatever figure it holds');
  assert.equal(parseSalary([tier({ type: 'fixed_salary', interval: 'month', min_value: 2550 })]), null, 'monthly figures are not annualized');
  assert.equal(parseSalary([tier({ type: 'fixed_salary', interval: 'hour', min_value: 35 })]), null);
  assert.equal(parseSalary([tier({ min_value: null, max_value: null })]), null);
  assert.equal(parseSalary([tier({ min_value: 'abc', max_value: -5 })]), null);
  assert.deepEqual(parseSalary([null, tier({ type: 'none' }), tier({ min_value: 60000, max_value: 70000 })]), { min: 60000, max: 70000, currency: 'EUR' }, 'the first usable yearly tier wins');
  assert.equal(parseSalary(null), null);
  assert.equal(parseSalary([]), null);
});

test('hirehive: fetch attaches the salary text to the job and omits it when absent', async () => {
  const tier = { type: 'range_salary', interval: 'year', currency_code: 'EUR', min_value: 50000, max_value: 69000 };
  const { impl } = makeFetch([envelope([item({ compensation_tiers: [tier] }), item({ title: 'No Pay', hosted_url: `${ORIGIN}/no-pay-Zz00Zz` })])]);
  const [paid, unpaid] = await fetchHireHive(API, { fetchImpl: impl, company: ENTRY(), sleep: SLEEP });
  assert.equal(paid.salary, '50000–69000 EUR');
  assert.equal(unpaid.salary, '');
});

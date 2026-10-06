/**
 * Gupy source + adapter — ported from parent career-ops
 * `tests/providers/gupy.test.mjs`, plus web-ui contract checks.
 *
 * Quirks pinned here, all easy to undo by accident:
 *   - pagination.total reports the PAGE SIZE; only a short page ends a sweep.
 *   - workplaceType is a singular string; confidential / employer-less rows drop.
 *   - Posting URLs are host-locked to HTTPS gupy.io / *.gupy.io.
 *   - ctx window is early-stop only; the entry's since_days also filters.
 *   - opts.maxPages is a TOTAL page budget; a probe failure propagates as-is.
 *   - A dead sweep never discards completed ones; all-dead rethrows the original.
 *
 * CI-isolated: fake fetchImpl, no network, no parent checkout, no profile read
 * (profile keywords are injected via opts.profileKeywords).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  API_BASE,
  PER_PAGE,
  assertGupyUrl,
  isSafeGupyUrl,
  isGupyPlatformUrl,
  buildGupyLocation,
  extractGupyRows,
  normalizeGupyJob,
  pageIsPastWindow,
  sinceDaysToCutoffMs,
  configKeywords,
  fetchGupy,
} from '../server/lib/sources/gupy.mjs';
import { gupyAdapter } from '../server/lib/portals/adapters/gupy.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const DAY = 86_400_000;
const okJson = (data) => ({ ok: true, json: async () => data });
const httpErr = (status) => ({ ok: false, status, json: async () => ({}) });
const FAST = { delayMs: 0, retries: 0 };

const mk = (i, company = `Co ${i}`) => ({
  name: `Role ${i}`,
  jobUrl: `https://acme.gupy.io/job/x${i}`,
  careerPageName: company,
  workplaceType: 'remote',
  country: 'Brasil',
  publishedDate: '2026-08-01T00:00:00.000Z',
});
const dated = (i, ageDays) => ({
  name: `Role ${i}`,
  jobUrl: `https://acme.gupy.io/job/w${i}`,
  careerPageName: 'Co',
  workplaceType: 'remote',
  publishedDate: new Date(Date.now() - ageDays * DAY).toISOString(),
});
const offsetOf = (url) => Number(new URL(url).searchParams.get('offset'));
const param = (url, key) => new URL(url).searchParams.get(key);

/** fetchImpl whose body comes from `handler(url, opts)`; records every URL. */
function fake(handler) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts, calls.length);
  };
  impl.calls = calls;
  return impl;
}
const emptyFeed = () => fake(() => okJson({ data: [], pagination: { total: 0 } }));

/** Silence console.error for the duration of fn, returning what was logged. */
async function captureErrors(fn) {
  const logged = [];
  const before = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    return { result: await fn(), logged };
  } finally {
    console.error = before;
  }
}

// ── meta + adapter ──────────────────────────────────────────────────────────

test('meta is { value: "gupy", label: "Gupy", region: "en" }', () => {
  assert.deepEqual(meta, { value: 'gupy', label: 'Gupy', region: 'en' });
});

test('adapter claims provider: gupy and the platform-wide hosts, never a tenant or lookalike', () => {
  assert.equal(gupyAdapter.id, 'gupy');
  assert.equal(gupyAdapter.matches({ provider: 'gupy' }), true);
  assert.equal(gupyAdapter.matches({ careers_url: 'https://portal.gupy.io' }), true);
  assert.equal(gupyAdapter.matches({ careers_url: 'https://portal.gupy.io/job-search/term=dev' }), true);
  assert.equal(gupyAdapter.matches({ api: 'https://employability-portal.gupy.io/api/v1/jobs' }), true);
  for (const careers_url of [
    'https://acme.gupy.io',
    'https://gupy.io',
    'http://portal.gupy.io',
    'https://portal.gupy.io.evil.example',
    'https://notgupy.io',
    'not a url',
    null,
    42,
  ]) {
    assert.equal(gupyAdapter.matches({ careers_url }), false, String(careers_url));
  }
  assert.equal(gupyAdapter.matches({ provider: 'vdab' }), false);
  assert.equal(gupyAdapter.matches({ name: 'no urls' }), false);
  assert.equal(gupyAdapter.matches(null), false);
});

test('adapter buildEndpoint is the pinned API unless api: overrides; fetch is fetchGupy', () => {
  assert.equal(gupyAdapter.buildEndpoint({ provider: 'gupy' }), API_BASE);
  assert.equal(gupyAdapter.buildEndpoint({ provider: 'gupy', api: 'https://x.example/y' }), 'https://x.example/y');
  assert.equal(gupyAdapter.fetch, fetchGupy);
});

// ── SSRF guards ─────────────────────────────────────────────────────────────

test('assertGupyUrl accepts only HTTPS on the pinned API host', () => {
  assert.equal(assertGupyUrl(API_BASE), API_BASE);
  assert.throws(() => assertGupyUrl('http://employability-portal.gupy.io/api/v1/jobs'), /HTTPS/);
  assert.throws(() => assertGupyUrl('https://portal.gupy.io/api/v1/jobs'), /untrusted hostname/);
  assert.throws(() => assertGupyUrl('https://employability-portal.gupy.io.evil.example/x'), /untrusted hostname/);
  assert.throws(() => assertGupyUrl('nope'), /invalid URL/);
});

test('fetchGupy refuses an off-host endpoint before any I/O', async () => {
  const impl = emptyFeed();
  await assert.rejects(
    fetchGupy('https://evil.example/api', { fetchImpl: impl, company: { gupy: { keywords: ['X'] } }, ...FAST }),
    /untrusted hostname/,
  );
  assert.equal(impl.calls.length, 0);
});

test('isSafeGupyUrl host-locks to HTTPS gupy.io and subdomains', () => {
  assert.equal(isSafeGupyUrl('https://acme.gupy.io/job/1'), true);
  assert.equal(isSafeGupyUrl('https://gupy.io/job/apex'), true);
  for (const bad of ['https://evil.example/x', 'https://notgupy.io/x', 'http://a.gupy.io/x', '', '  ', null, 7]) {
    assert.equal(isSafeGupyUrl(bad), false, String(bad));
  }
  assert.equal(isGupyPlatformUrl('https://portal.gupy.io'), true);
  assert.equal(isGupyPlatformUrl('https://acme.gupy.io'), false);
});

// ── normalizeGupyJob ────────────────────────────────────────────────────────

test('normalizeGupyJob maps fields to the web-ui job shape', () => {
  const job = normalizeGupyJob({
    name: '  Desenvolvedor Backend Sênior  ',
    jobUrl: 'https://acme.gupy.io/job/abc123',
    careerPageName: '  Acme  ',
    workplaceType: 'remote',
    city: 'Porto Alegre',
    state: 'Rio Grande do Sul',
    country: 'Brasil',
    description: 'JD body',
    publishedDate: '2026-08-01T12:00:00.000Z',
  });
  assert.equal(job.title, 'Desenvolvedor Backend Sênior');
  assert.equal(job.company, 'Acme');
  assert.equal(job.url, 'https://acme.gupy.io/job/abc123');
  assert.equal(job.location, 'Remoto, Porto Alegre, Rio Grande do Sul, Brasil');
  assert.equal(job.description, 'JD body');
  assert.equal(job.snippet, 'JD body');
  assert.equal(job.postedAt, Date.parse('2026-08-01T12:00:00.000Z'));
  assert.equal(job.date, '2026-08-01');
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
  assert.equal(job.source, 'gupy');
  assert.equal(job.id, 'gupy-https://acme.gupy.io/job/abc123');
  assert.equal(job.salary, '');
  assert.equal(job.relocates, false);
});

test('normalizeGupyJob omits postedAt/description when absent or unparseable', () => {
  const bare = normalizeGupyJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/1', careerPageName: 'Co' });
  assert.equal('postedAt' in bare, false);
  assert.equal('description' in bare, false);
  assert.equal(bare.date, '');
  const junk = normalizeGupyJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/2', careerPageName: 'Co', publishedDate: 'not-a-date' });
  assert.equal('postedAt' in junk, false);
});

test('normalizeGupyJob keeps a valid epoch-0 publishedDate', () => {
  const job = normalizeGupyJob({
    name: 'T', jobUrl: 'https://a.gupy.io/job/e0', careerPageName: 'Co', publishedDate: '1970-01-01T00:00:00.000Z',
  });
  assert.equal(job.postedAt, 0);
});

test('buildGupyLocation reads the SINGULAR workplaceType (hybrid is not lost)', () => {
  assert.equal(buildGupyLocation({ workplaceType: 'hybrid', city: 'Recife' }), 'Híbrido, Recife');
  assert.equal(buildGupyLocation({ workplaceType: 'on-site', state: 'SP' }), 'Presencial, SP');
  assert.equal(buildGupyLocation({ workplaceType: 'weird', country: 'Brasil' }), 'weird, Brasil');
  // Plural field does not exist in the payload and must be ignored.
  assert.equal(buildGupyLocation({ workplaceTypes: ['hybrid'], city: 'Recife' }), 'Recife');
  assert.equal(buildGupyLocation({ isRemoteWork: true, city: 'X' }), 'Remoto, X');
  assert.equal(buildGupyLocation({ workplaceType: 'remote', isRemoteWork: false }), 'Remoto');
  assert.equal(buildGupyLocation({}), '');
});

test('normalizeGupyJob classifies workplace type for the web-ui fields', () => {
  const base = { name: 'T', careerPageName: 'Co' };
  const hybrid = normalizeGupyJob({ ...base, jobUrl: 'https://a.gupy.io/job/h', workplaceType: 'hybrid' });
  assert.equal(hybrid.isRemote, false);
  assert.equal(hybrid.workplaceType, 'Hybrid');
  const onsite = normalizeGupyJob({ ...base, jobUrl: 'https://a.gupy.io/job/o', workplaceType: 'on-site' });
  assert.equal(onsite.workplaceType, 'Onsite');
  const legacyRemote = normalizeGupyJob({ ...base, jobUrl: 'https://a.gupy.io/job/r', isRemoteWork: true });
  assert.equal(legacyRemote.isRemote, true);
});

test('normalizeGupyJob drops rows with no employer name, confidential rows and bad hosts', () => {
  const noCompany = [
    normalizeGupyJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/3' }),
    normalizeGupyJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/4', careerPageName: '   ' }),
    normalizeGupyJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/5', careerPageName: 42 }),
  ];
  assert.ok(noCompany.every((r) => r === null));

  const drops = [
    normalizeGupyJob({ name: 'Off host', jobUrl: 'https://evil.example/job/x', careerPageName: 'Co' }),
    normalizeGupyJob({ name: 'Lookalike', jobUrl: 'https://notgupy.io/job/x', careerPageName: 'Co' }),
    normalizeGupyJob({ name: 'Insecure', jobUrl: 'http://a.gupy.io/job/x', careerPageName: 'Co' }),
    normalizeGupyJob({ name: 'No URL', careerPageName: 'Co' }),
    normalizeGupyJob({ name: '', jobUrl: 'https://a.gupy.io/job/x', careerPageName: 'Co' }),
    normalizeGupyJob(null),
    normalizeGupyJob('string'),
  ];
  assert.ok(drops.every((r) => r === null));

  const apex = normalizeGupyJob({ name: 'T', jobUrl: 'https://gupy.io/job/apex', careerPageName: 'Co' });
  assert.equal(apex?.url, 'https://gupy.io/job/apex');

  const confidential = normalizeGupyJob({
    name: 'Analista', jobUrl: 'https://acme.gupy.io/job/c1', careerPageName: 'Confidencial', isConfidentialCareerPage: true,
  });
  const attributed = normalizeGupyJob({
    name: 'Analista', jobUrl: 'https://acme.gupy.io/job/c2', careerPageName: 'Acme', isConfidentialCareerPage: false,
  });
  assert.equal(confidential, null);
  assert.equal(attributed?.company, 'Acme');
});

// ── extractGupyRows ─────────────────────────────────────────────────────────

test('extractGupyRows returns [] for a present-and-empty data array', () => {
  assert.deepEqual(extractGupyRows({ data: [], pagination: { total: 0 } }, 'X', 0), []);
});

test('extractGupyRows throws, naming the keys or type, on every off-contract envelope', () => {
  const shapes = [
    [{}, 'keys: []'],
    [{ data: null }, 'keys: [data]'],
    [{ data: {} }, 'keys: [data]'],
    [{ jobs: [] }, 'keys: [jobs]'],
    ['', 'type: string'],
    [42, 'type: number'],
    [true, 'type: boolean'],
    [null, 'type: null'],
  ];
  for (const [body, expected] of shapes) {
    assert.throws(
      () => extractGupyRows(body, 'X', 0),
      (err) => err.message.includes('expected { data: [...] }') && err.message.includes(expected),
      JSON.stringify(body),
    );
  }
});

// ── config + window helpers ────────────────────────────────────────────────

test('configKeywords prefers keywords[] (trimmed, deduped), then q, else empty', () => {
  assert.deepEqual(configKeywords({ keywords: [' A ', 'A', '', 3, 'B'] }), ['A', 'B']);
  assert.deepEqual(configKeywords({ keywords: [], q: ' AI Engineer ' }), ['AI Engineer']);
  assert.deepEqual(configKeywords({}), []);
});

test('sinceDaysToCutoffMs truncates to UTC midnight and survives an out-of-range day count', () => {
  const noon = Date.parse('2026-08-13T12:34:56Z');
  assert.equal(sinceDaysToCutoffMs(14, noon), Date.parse('2026-07-30T00:00:00Z'));
  assert.equal(sinceDaysToCutoffMs(null, noon), null);
  assert.equal(sinceDaysToCutoffMs(1e15, noon), null);
});

test('pageIsPastWindow ignores undated pages, trips on a fully stale one, no-ops without a window', () => {
  assert.equal(pageIsPastWindow([{}, {}], Date.now()), false);
  assert.equal(pageIsPastWindow([{ postedAt: Date.now() - 400 * DAY }], Date.now()), true);
  assert.equal(pageIsPastWindow([{ postedAt: Date.now() }], null), false);
  // inside the 2-day margin does not trip
  assert.equal(pageIsPastWindow([{ postedAt: Date.now() - DAY }], Date.now()), false);
});

// ── fetchGupy: requests ─────────────────────────────────────────────────────

test('every request is HTTPS on the pinned API, redirect:error, with the browser-like UA', async () => {
  const impl = emptyFeed();
  await fetchGupy(API_BASE, { fetchImpl: impl, company: { gupy: { q: 'AI Engineer' }, max_pages: 1 }, ...FAST });
  assert.equal(impl.calls.length, 1);
  const { url, opts } = impl.calls[0];
  assert.equal(new URL(url).origin + new URL(url).pathname, API_BASE);
  assert.equal(param(url, 'jobName'), 'AI Engineer');
  assert.equal(opts.redirect, 'error');
  assert.equal(opts.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
});

test('fetchGupy sweeps each keyword separately instead of joining them', async () => {
  const impl = fake((url, _o, n) => okJson({ data: [mk(n)], pagination: { total: 1 } }));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['Backend', 'Full Stack'] }, max_pages: 3 }, ...FAST,
  });
  assert.deepEqual(impl.calls.map((c) => param(c.url, 'jobName')), ['Backend', 'Full Stack']);
  assert.equal(jobs.length, 2);
});

test('fetchGupy sends optional filters comma-joined and omits unset ones', async () => {
  const withAll = emptyFeed();
  await fetchGupy(API_BASE, {
    fetchImpl: withAll,
    company: {
      gupy: {
        keywords: ['X'],
        workplace_types: ['remote', 'hybrid'],
        job_types: ['vacancy_type_effective'],
        state: 'Rio Grande do Sul',
        country: 'Brasil',
      },
      max_pages: 1,
    },
    ...FAST,
  });
  const url = withAll.calls[0].url;
  assert.equal(param(url, 'workplaceTypes'), 'remote,hybrid');
  assert.equal(param(url, 'jobTypes'), 'vacancy_type_effective');
  assert.equal(param(url, 'state'), 'Rio Grande do Sul');
  assert.equal(param(url, 'country'), 'Brasil');

  const bare = emptyFeed();
  await fetchGupy(API_BASE, {
    fetchImpl: bare, company: { gupy: { keywords: ['X'], workplace_types: [] }, max_pages: 1 }, ...FAST,
  });
  const sp = new URL(bare.calls[0].url).searchParams;
  for (const key of ['workplaceTypes', 'jobTypes', 'state', 'country']) assert.equal(sp.has(key), false, key);
});

test('fetchGupy sleeps delayMs before every request except the first', async () => {
  const sleeps = [];
  const impl = fake((url) => okJson({
    data: Array.from({ length: offsetOf(url) === 0 ? PER_PAGE : 5 }, (_, i) => mk(offsetOf(url) + i)),
    pagination: { total: 100 },
  }));
  await fetchGupy(API_BASE, {
    fetchImpl: impl,
    company: { gupy: { keywords: ['A', 'B'] }, max_pages: 3 },
    retries: 0,
    sleep: async (ms) => { sleeps.push({ ms, afterCall: impl.calls.length }); },
  });
  assert.equal(impl.calls.length, 4);
  assert.deepEqual(sleeps.map((s) => s.ms), [200, 200, 200]);
  assert.deepEqual(sleeps.map((s) => s.afterCall), [1, 2, 3]);
});

// ── fetchGupy: keyword resolution ──────────────────────────────────────────

test('fetchGupy falls back to injected profile keywords, and explicit keywords win', async () => {
  const fallback = emptyFeed();
  await fetchGupy(API_BASE, {
    fetchImpl: fallback, company: { name: 'Gupy', max_pages: 1 }, profileKeywords: ['Engenheiro de Dados', 'Analista de BI'], ...FAST,
  });
  assert.deepEqual(fallback.calls.map((c) => param(c.url, 'jobName')), ['Engenheiro de Dados', 'Analista de BI']);

  const override = emptyFeed();
  await fetchGupy(API_BASE, {
    fetchImpl: override, company: { gupy: { keywords: ['Só Esta'] }, max_pages: 1 }, profileKeywords: ['Ignored'], ...FAST,
  });
  assert.deepEqual(override.calls.map((c) => param(c.url, 'jobName')), ['Só Esta']);
});

test('fetchGupy reads search keys from the gupy: block only (top-level keywords ignored)', async () => {
  const impl = emptyFeed();
  await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { keywords: ['Top'], gupy: { keywords: ['Nested'] }, max_pages: 1 }, profileKeywords: ['P'], ...FAST,
  });
  assert.deepEqual(impl.calls.map((c) => param(c.url, 'jobName')), ['Nested']);

  const topOnly = emptyFeed();
  await fetchGupy(API_BASE, {
    fetchImpl: topOnly, company: { keywords: ['Top'], max_pages: 1 }, profileKeywords: ['P'], ...FAST,
  });
  assert.deepEqual(topOnly.calls.map((c) => param(c.url, 'jobName')), ['P']);
});

test('fetchGupy throws when there are no keywords and no profile fallback', async () => {
  const impl = emptyFeed();
  await assert.rejects(
    fetchGupy(API_BASE, { fetchImpl: impl, company: { name: 'Gupy' }, profileKeywords: [], ...FAST }),
    /no gupy\.keywords\[\]\/gupy\.q/,
  );
  assert.equal(impl.calls.length, 0);
});

// ── fetchGupy: pagination ──────────────────────────────────────────────────

test('fetchGupy paginates by offset/limit=100 and stops on a short page', async () => {
  const impl = fake((url) => okJson({
    data: Array.from({ length: offsetOf(url) === 0 ? PER_PAGE : 20 }, (_, i) => mk(offsetOf(url) + i)),
    pagination: { total: 120 },
  }));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['X'] }, max_pages: 5 }, ...FAST,
  });
  assert.deepEqual(impl.calls.map((c) => param(c.url, 'offset')), ['0', '100']);
  assert.ok(impl.calls.every((c) => param(c.url, 'limit') === '100'));
  assert.equal(jobs.length, 120);
});

test('REGRESSION: a pagination.total that reports the page size is ignored', async () => {
  const impl = fake((url) => {
    const offset = offsetOf(url);
    const remaining = Math.max(0, 370 - offset);
    return okJson({
      data: Array.from({ length: Math.min(PER_PAGE, remaining) }, (_, i) => mk(offset + i)),
      pagination: { total: 100, limit: 100, offset },
    });
  });
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['Desenvolvedor'] }, max_pages: 5 }, ...FAST,
  });
  assert.equal(impl.calls.length, 4);
  assert.equal(jobs.length, 370);
});

test('fetchGupy dedups by posting URL across keywords and within a page', async () => {
  const impl = fake(() => okJson({ data: [mk(1), mk(1)], pagination: { total: 2 } }));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['A', 'B'] }, max_pages: 1 }, ...FAST,
  });
  assert.equal(jobs.length, 1);
});

test('fetchGupy keeps walking a sweep whose first page fully overlaps an earlier one', async () => {
  const impl = fake((url) => {
    const kw = param(url, 'jobName');
    const offset = offsetOf(url);
    if (kw === 'A') return okJson({ data: Array.from({ length: 50 }, (_, i) => mk(i)) });
    if (offset === 0) return okJson({ data: Array.from({ length: PER_PAGE }, (_, i) => mk(i % 50)) });
    return okJson({ data: Array.from({ length: 10 }, (_, i) => mk(1000 + i)) });
  });
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['A', 'B'] }, max_pages: 5 }, ...FAST,
  });
  assert.deepEqual(impl.calls.map((c) => `${param(c.url, 'jobName')}@${param(c.url, 'offset')}`), ['A@0', 'B@0', 'B@100']);
  assert.equal(jobs.length, 60);
});

test('fetchGupy stops a never-ending feed at max_pages and warns', async () => {
  const impl = fake((_u, _o, n) => okJson({ data: Array.from({ length: PER_PAGE }, (_, i) => mk(n * 1000 + i)) }));
  const { result, logged } = await captureErrors(() => fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['X'] }, max_pages: 2 }, ...FAST,
  }));
  assert.equal(impl.calls.length, 2);
  assert.equal(result.length, 200);
  assert.ok(logged.some((w) => w.includes('truncated at max_pages=2')));
});

test('max_pages is clamped: invalid values fall back to the default of 5', async () => {
  for (const max_pages of [0, -1, 1.5, 'x', undefined]) {
    const impl = fake((_u, _o, n) => okJson({ data: Array.from({ length: PER_PAGE }, (_, i) => mk(n * 1000 + i)) }));
    await captureErrors(() => fetchGupy(API_BASE, {
      fetchImpl: impl, company: { gupy: { keywords: ['X'] }, max_pages }, ...FAST,
    }));
    assert.equal(impl.calls.length, 5, String(max_pages));
  }
});

test('opts.maxPages is a TOTAL page budget across keyword sweeps and stays quiet', async () => {
  const impl = fake(() => okJson({ data: Array.from({ length: PER_PAGE }, (_, i) => mk(i)) }));
  const { result, logged } = await captureErrors(() => fetchGupy(API_BASE, {
    fetchImpl: impl,
    company: { gupy: { keywords: ['A', 'B', 'C', 'D', 'E'] }, max_pages: 5 },
    maxPages: 1,
    ...FAST,
  }));
  assert.equal(impl.calls.length, 1);
  assert.equal(result.length, 100);
  assert.deepEqual(logged, []);
});

test('fetchGupy returns [] after one call per keyword on an empty feed', async () => {
  const impl = emptyFeed();
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['X'] }, max_pages: 3 }, ...FAST,
  });
  assert.equal(impl.calls.length, 1);
  assert.deepEqual(jobs, []);
});

// ── fetchGupy: failure handling ────────────────────────────────────────────

test('a malformed payload on the only sweep surfaces as an error, not an empty board', async () => {
  const impl = fake(() => okJson({ unexpected: true }));
  await assert.rejects(
    fetchGupy(API_BASE, { fetchImpl: impl, company: { gupy: { keywords: ['X'] }, max_pages: 1 }, ...FAST }),
    /unexpected API response/,
  );
});

test('one dead keyword sweep keeps the completed ones and warns', async () => {
  const impl = fake((url) => {
    const kw = param(url, 'jobName');
    if (kw === 'B') return httpErr(404);
    return okJson({ data: [mk(kw === 'A' ? 1 : 2)] });
  });
  const { result, logged } = await captureErrors(() => fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['A', 'B', 'C'] }, max_pages: 1 }, ...FAST,
  }));
  assert.equal(result.length, 2);
  assert.deepEqual(impl.calls.map((c) => param(c.url, 'jobName')), ['A', 'B', 'C']);
  assert.ok(logged.some((w) => w.includes('sweep "B" stopped')));
});

test('a failure mid-sweep keeps the pages already read', async () => {
  const impl = fake((url) => (offsetOf(url) > 0
    ? httpErr(500)
    : okJson({ data: Array.from({ length: PER_PAGE }, (_, i) => mk(i)) })));
  const { result } = await captureErrors(() => fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['A'] }, max_pages: 5 }, ...FAST,
  }));
  assert.equal(result.length, 100);
  assert.deepEqual(impl.calls.map((c) => offsetOf(c.url)), [0, 100]);
});

test('every sweep dead rethrows the ORIGINAL error with status intact', async () => {
  const impl = fake(() => httpErr(503));
  const { result: caught } = await captureErrors(() => fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['A', 'B'] }, max_pages: 2 }, ...FAST,
  }).then(() => null, (e) => e));
  assert.equal(caught?.status, 503);
  // one page per keyword: the sweep breaks on its first failure
  assert.equal(impl.calls.length, 2);
});

test('a transient 5xx is retried before the sweep gives up', async () => {
  let n = 0;
  const impl = fake(() => (++n === 1 ? httpErr(503) : okJson({ data: [mk(1)] })));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl,
    company: { gupy: { keywords: ['A'] }, max_pages: 1 },
    delayMs: 0,
    retries: 1,
    retryDelayMs: 0,
  });
  assert.equal(impl.calls.length, 2);
  assert.equal(jobs.length, 1);
});

test('the probe budget counts failed pages, so a broken board costs one request', async () => {
  const impl = fake(() => httpErr(404));
  const caught = await fetchGupy(API_BASE, {
    fetchImpl: impl,
    company: { gupy: { keywords: ['A', 'B', 'C', 'D', 'E'] }, max_pages: 5 },
    maxPages: 1,
    ...FAST,
  }).then(() => null, (e) => e);
  assert.equal(impl.calls.length, 1);
  assert.equal(caught?.status, 404);
});

test('during a probe a fetch rejection propagates as the SAME object', async () => {
  class FakeSentinel extends Error {}
  const sentinel = new FakeSentinel('probe budget reached');
  let n = 0;
  const impl = async () => {
    if (++n >= 2) throw sentinel;
    return okJson({ data: [mk(1)] });
  };
  const caught = await fetchGupy(API_BASE, {
    fetchImpl: impl,
    company: { gupy: { keywords: ['A', 'B'] }, max_pages: 1 },
    maxPages: 2,
    ...FAST,
  }).then(() => null, (e) => e);
  assert.equal(caught, sentinel);
});

// ── fetchGupy: recency window ──────────────────────────────────────────────

test('since_days stops the sweep at the window edge and drops the stale tail of the page', async () => {
  const impl = fake((url) => {
    const offset = offsetOf(url);
    return okJson({ data: Array.from({ length: PER_PAGE }, (_, i) => dated(offset + i, offset + i < 50 ? 3 : 90)) });
  });
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['X'], since_days: 14 }, max_pages: 5 }, ...FAST,
  });
  assert.equal(impl.calls.length, 1);
  assert.equal(jobs.length, 50);
});

test('opts.sinceMs overrides since_days (the run window wins)', async () => {
  const impl = fake((url) => okJson({
    data: Array.from({ length: offsetOf(url) === 0 ? PER_PAGE : 10 }, (_, i) => dated(offsetOf(url) + i, 30)),
  }));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl,
    company: { gupy: { keywords: ['X'], since_days: 14 }, max_pages: 5 },
    sinceMs: Date.now() - 60 * DAY,
    ...FAST,
  });
  assert.equal(impl.calls.length, 2);
  assert.equal(jobs.length, 110);
});

test('opts.sinceMs never filters postings out, it only stops pagination', async () => {
  const impl = fake(() => okJson({ data: [dated(1, 3), dated(2, 400)] }));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['X'] }, max_pages: 1 }, sinceMs: Date.now() - 14 * DAY, ...FAST,
  });
  assert.equal(jobs.length, 2);
});

test('since_days keeps undated postings and drops dated ones outside the window', async () => {
  const impl = fake(() => okJson({
    data: [{ name: 'No date', jobUrl: 'https://acme.gupy.io/job/nd', careerPageName: 'Co' }, dated(9, 400)],
  }));
  const jobs = await fetchGupy(API_BASE, {
    fetchImpl: impl, company: { gupy: { keywords: ['X'], since_days: 14 }, max_pages: 1 }, ...FAST,
  });
  assert.deepEqual(jobs.map((j) => j.url), ['https://acme.gupy.io/job/nd']);
});

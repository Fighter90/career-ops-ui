/**
 * ALDI Nord source (upstream #6529 port) — CI-isolated suite.
 *
 * www.aldi-nord.de and its country siblings answer POST /api/job/hr/query
 * with cumulative pages (page N = the first 10·N rows), so a full scan is
 * page 1 (the probe and the source's `total`) plus one covering page per
 * locale. The parser must fail CLOSED on a body without results[] (a silent
 * zero would look like an empty board) while a present-and-empty results[]
 * is []. Ported cases: site-host resolution (https + confirmed hosts +
 * www normalization), config validation (locales/categories throw on a typo
 * — a bad locale would read as an empty board), the row mapping
 * (slug-id posting URL, location fold, echoed locale, bad rows dropped,
 * lone-surrogate slug drops one row), the cumulative two-request walk with
 * dedup, the probe budget, the stop-reason warnings (cap / covering-page
 * failure keeps page 1), and the normalized scanner rows. No network —
 * fetchAldiNord runs on a fake fetchImpl with an injectable sleep.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  SITES,
  assertAldiNordUrl,
  resolveSiteHost,
  resolveConfig,
  resolveMaxPages,
  buildQueryBody,
  formatLocation,
  parseQueryResponse,
  fetchAldiNord,
} from '../server/lib/sources/aldi-nord.mjs';
import { aldiNordAdapter } from '../server/lib/portals/adapters/aldi-nord.mjs';

const DE = 'https://www.aldi-nord.de/karriere/jobs.html';
const API = 'https://www.aldi-nord.de/api/job/hr/query';

function row(n, extra = {}) {
  return {
    postingId: String(900000 + n),
    title: `Example Role ${n} (m/w/d)`,
    onlineFrom: '2026-10-01',
    locations: [{ zipCode: '12345', city: 'Musterstadt', street: 'Beispielweg 1', country: 'Germany' }],
    slugTitle: `example-role-${n}-m-w-d-musterstadt`,
    ...extra,
  };
}

/** A cumulative source of `total` rows: page N answers the first 10·N. */
function source(total, { locale = 'de-DE' } = {}) {
  const all = Array.from({ length: total }, (_, i) => row(i + 1));
  return (body) => {
    const rows = all.slice(0, Math.min(total, body.page * 10));
    return { total, hasNextPage: rows.length < total, page: body.page, locale, results: rows };
  };
}

/** A fake fetchImpl that answers POST bodies from `handler` and records calls. */
function makeFetch(handler) {
  const calls = [];
  const impl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, opts, body });
    const out = handler(body, calls.length);
    return { ok: true, status: 200, json: async () => out, headers: { get: () => null } };
  };
  return { calls, impl };
}

const SLEEP = async () => {};

// ── registry meta + adapter contract ─────────────────────────────────────────

test('aldi-nord: meta — value, label, region en; adapter contract shape', () => {
  assert.deepEqual(meta, { value: 'aldi-nord', label: 'ALDI Nord', region: 'en' });
  assert.equal(aldiNordAdapter.id, 'aldi-nord');
  assert.equal(aldiNordAdapter.label, 'ALDI Nord');
  assert.equal(typeof aldiNordAdapter.matches, 'function');
  assert.equal(typeof aldiNordAdapter.buildEndpoint, 'function');
  assert.equal(typeof aldiNordAdapter.fetch, 'function');
});

test('aldi-nord: adapter matches the confirmed country hosts only; endpoint is the canonical site URL', () => {
  for (const careers_url of [
    DE,
    'https://aldi-nord.de/karriere/jobs.html',
    'https://www.aldi.nl/carriere/vacatures.html',
    'https://www.aldi.be/fr/jobs/postuler.html',
    'https://WWW.ALDI.PL/praca/oferty-pracy.html',
    'https://www.aldi.lu/jobs/postuler.html',
  ]) {
    assert.equal(aldiNordAdapter.matches({ name: 'ALDI Nord', careers_url }), true, careers_url);
  }
  assert.equal(aldiNordAdapter.matches({ name: 'X', provider: 'aldi-nord' }), true, 'explicit provider override');
  assert.equal(aldiNordAdapter.buildEndpoint({ careers_url: 'https://u:p@aldi.be:8443/fr/jobs/x' }), 'https://www.aldi.be/', 'port/creds/path discarded — the endpoint is rebuilt from the pinned host');
  assert.equal(aldiNordAdapter.buildEndpoint({ careers_url: DE }), 'https://www.aldi-nord.de/');
  const rejects = [
    ['ALDI SÜD is a different group', 'https://www.aldi-sued.de/de/karriere.html'],
    ['aldi.dk does not serve the API', 'https://www.aldi.dk/'],
    ['not a confirmed host', 'https://www.aldi.com/'],
    ['subdomain is not the site', 'https://jobs.aldi-nord.de/'],
    ['suffix-spoofed host', 'https://www.aldi-nord.de.evil.example/'],
    ['prefix look-alike', 'https://evilaldi-nord.de/'],
    ['non-https', 'http://www.aldi-nord.de/'],
    ['credentials exfiltration host', 'https://www.aldi-nord.de@evil.example/'],
    ['query-only mention', 'https://evil.example/?u=www.aldi-nord.de'],
    ['malformed', '::'],
  ];
  for (const [name, u] of rejects) {
    assert.equal(aldiNordAdapter.matches({ careers_url: u }), false, `${name} must be rejected`);
    assert.equal(aldiNordAdapter.buildEndpoint({ careers_url: u }), null, `${name} yields no endpoint`);
  }
  assert.equal(aldiNordAdapter.matches(null), false);
  assert.equal(aldiNordAdapter.matches('www.aldi-nord.de'), false);
  assert.equal(aldiNordAdapter.matches({}), false);
});

test('aldi-nord: resolveSiteHost normalizes to the www host and drops port/creds/path', () => {
  assert.equal(resolveSiteHost('https://u:p@aldi.be:8443/fr/jobs/postuler.html?x=1'), 'www.aldi.be');
  assert.equal(resolveSiteHost('https://WWW.ALDI-NORD.DE/karriere'), 'www.aldi-nord.de');
  assert.equal(resolveSiteHost('https://www.aldi.dk/'), null);
  assert.equal(resolveSiteHost('not a url'), null);
  assert.equal(resolveSiteHost(undefined), null);
  assert.equal(resolveSiteHost(42), null);
});

test('aldi-nord: assertAldiNordUrl — https on a confirmed host, default port only', () => {
  assert.equal(assertAldiNordUrl('https://www.aldi-nord.de/'), 'https://www.aldi-nord.de/');
  assert.throws(() => assertAldiNordUrl('http://www.aldi-nord.de/'), /HTTPS/);
  assert.throws(() => assertAldiNordUrl('https://evil.example/'), /untrusted hostname/);
  assert.throws(() => assertAldiNordUrl('https://www.aldi-nord.de:8443/'), /port/);
  assert.throws(() => assertAldiNordUrl('not a url'), /invalid URL/);
});

test('aldi-nord: resolveConfig validates the aldi_nord block; resolveMaxPages caps', () => {
  assert.deepEqual(resolveConfig({}, 'www.aldi.be'), { locales: ['nl-BE', 'fr-BE'], categories: [] });
  assert.deepEqual(resolveConfig({ aldi_nord: { locales: ['FR-be', 'fr-BE'] } }, 'www.aldi.be'), { locales: ['fr-BE'], categories: [] }, 'overrides are case-insensitive and deduped');
  assert.deepEqual(resolveConfig({ aldi_nord: { categories: [10420, ' 19000 ', '10420'] } }, 'www.aldi-nord.de'), { locales: ['de-DE'], categories: ['10420', '19000'] }, 'ids become trimmed strings, deduped');
  assert.deepEqual(resolveConfig({ aldi_nord: null }, 'www.aldi-nord.de'), { locales: ['de-DE'], categories: [] });
  for (const bad of [{ aldi_nord: { locales: ['nl-NL'] } }, { aldi_nord: { locales: [] } }, { aldi_nord: { locales: 'de-DE' } }, { aldi_nord: { categories: ['Tech'] } }, { aldi_nord: { categories: '10420' } }, { aldi_nord: ['x'] }]) {
    assert.throws(() => resolveConfig(bad, 'www.aldi-nord.de'), /aldi-nord:/, JSON.stringify(bad));
  }
  assert.equal(resolveMaxPages({}), 500);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 99999 }), 1000, 'the ceiling caps the override');
  assert.equal(resolveMaxPages({ max_pages: 0 }), 500);
  assert.equal(resolveMaxPages({ max_pages: '7' }), 500);
});

test('aldi-nord: buildQueryBody is the shape the site sends', () => {
  assert.deepEqual(JSON.parse(buildQueryBody('de-DE', ['10420'], 3)), {
    careerLevelIds: [], jobTypeParams: { jobTypeIds: [] }, jobCategoryIds: ['10420'],
    title: '', location: { searchPhrase: '' }, page: 3, locale: 'de-DE',
  });
});

test('aldi-nord: formatLocation folds shared-country cities; multi-country joins per place', () => {
  assert.equal(formatLocation([{ city: 'Musterstadt', country: 'Germany' }]), 'Musterstadt, Germany');
  assert.equal(formatLocation([
    { city: 'Kamen', country: 'Germany', zipCode: '1' },
    { city: 'Bergdorf', country: 'Germany' },
    { city: 'Kamen', country: 'Germany', zipCode: '2' },
  ]), 'Kamen / Bergdorf, Germany', 'distinct cities, one country, zip/street dropped');
  assert.equal(formatLocation([{ city: 'Lille', country: 'France' }, { city: 'Mons', country: 'Belgium' }]), 'Lille, France; Mons, Belgium');
  assert.equal(formatLocation([{ country: 'Luxembourg' }]), 'Luxembourg');
  assert.equal(formatLocation([{ city: '  ', country: '' }, null]), '');
  assert.equal(formatLocation(undefined), '');
});

test('aldi-nord: parseQueryResponse maps rows to the site detail URL and skips bad ones', () => {
  const site = { host: 'www.aldi-nord.de', detailPath: '/karriere/detail/', locale: 'de-DE', company: 'ExampleCo' };
  const { jobs, rawCount, total, hasNextPage } = parseQueryResponse({
    total: 6, hasNextPage: false, page: 1, locale: 'de-DE',
    results: [
      row(1),
      row(2, { onlineFrom: 'not a date', title: '  Lead   Data & Analytics (m/w/d) ' }),
      row(3, { title: '' }),
      row(4, { slugTitle: undefined }),
      row(5, { postingId: null }),
      { title: 'Bad slug', slugTitle: 'ok-\uD800', postingId: '6' },
      null,
    ],
  }, site);
  assert.equal(rawCount, 7, 'the RAW page length counts every row, even skipped ones');
  assert.equal(total, 6);
  assert.equal(hasNextPage, false);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0], {
    title: 'Example Role 1 (m/w/d)',
    url: 'https://www.aldi-nord.de/karriere/detail/example-role-1-m-w-d-musterstadt-900001.html',
    company: 'ExampleCo',
    location: 'Musterstadt, Germany',
    language: 'de-DE',
    postedAt: Date.UTC(2026, 9, 1),
  });
  assert.equal(jobs[1].title, 'Lead Data & Analytics (m/w/d)');
  assert.equal(jobs[1].url, 'https://www.aldi-nord.de/karriere/detail/example-role-2-m-w-d-musterstadt-900002.html');
  assert.ok(!('postedAt' in jobs[1]), 'an unparseable date leaves postedAt off');
  assert.ok(!('description' in jobs[0]) && !('requisitionId' in jobs[0]), 'the list API carries neither');
});

test('aldi-nord: a malformed 200 throws (never reads as an empty board)', () => {
  const site = { host: 'www.aldi-nord.de', detailPath: '/karriere/detail/', locale: 'de-DE', company: 'ExampleCo' };
  assert.deepEqual(parseQueryResponse({ total: 0, hasNextPage: false, results: [] }, site).jobs, [], 'present-and-empty results[] is a real empty board');
  for (const bad of [{}, { results: null }, { results: {} }, { jobs: [] }, '', 42, true, null]) {
    assert.throws(() => parseQueryResponse(bad, site), /aldi-nord/, JSON.stringify(bad));
  }
});

test('aldi-nord: a full scan is page 1 then the covering page — POST, redirect:"error", dedup, normalized rows', async () => {
  const { calls, impl } = makeFetch(source(35));
  const jobs = await fetchAldiNord(DE, { fetchImpl: impl, company: { name: 'ExampleCo', careers_url: DE }, sleep: SLEEP });
  assert.equal(calls.length, 2, 'cumulative pages: two requests for 35 rows');
  assert.deepEqual(calls.map((c) => c.body.page), [1, 4], 'the covering page covers total');
  for (const c of calls) {
    assert.equal(c.url, API);
    assert.equal(c.opts.method, 'POST');
    assert.equal(c.opts.redirect, 'error');
    assert.equal(c.opts.headers['content-type'], 'application/json');
    assert.equal(c.body.locale, 'de-DE');
    assert.deepEqual(c.body.jobCategoryIds, []);
  }
  assert.equal(jobs.length, 35);
  assert.equal(new Set(jobs.map((j) => j.url)).size, 35, 'no duplicate rows');
  assert.equal(jobs[0].id, `aldi-nord-${jobs[0].url}`);
  assert.equal(jobs[0].source, 'aldi-nord');
  assert.equal(jobs[0].company, 'ExampleCo');
  assert.equal(jobs[0].location, 'Musterstadt, Germany');
  assert.equal(jobs[0].date, new Date(Date.UTC(2026, 9, 1)).toISOString());
  assert.equal(jobs[0].language, 'de-DE');
  assert.equal(jobs[0].salary, '');
});

test('aldi-nord: a one-page board makes one request; a probe budget never warns or continues', async () => {
  const one = makeFetch(source(7));
  assert.equal((await fetchAldiNord(DE, { fetchImpl: one.impl, company: { name: 'ExampleCo', careers_url: DE }, sleep: SLEEP })).length, 7);
  assert.equal(one.calls.length, 1);

  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const probe = makeFetch(source(3478));
    const jobs = await fetchAldiNord(DE, { fetchImpl: probe.impl, company: { name: 'ExampleCo', careers_url: DE, max_pages: 1 }, maxPages: 1, sleep: SLEEP });
    assert.equal(probe.calls.length, 1, 'a probe asks page 1 of the first locale only');
    assert.equal(jobs.length, 10);
    assert.equal(jobs.aldiNordTruncated, undefined, 'a probe budget is not the entry cap and never warns');
    assert.deepEqual(errors, []);
  } finally {
    console.error = orig;
  }
});

test('aldi-nord: stop reasons — a capped walk warns; a failed covering page keeps page 1; a failed first page throws', async () => {
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const capped = makeFetch(source(35));
    const cappedJobs = await fetchAldiNord(DE, { fetchImpl: capped.impl, company: { name: 'ExampleCo', careers_url: DE, max_pages: 2 }, sleep: SLEEP });
    assert.deepEqual(capped.calls.map((c) => c.body.page), [1, 2]);
    assert.equal(cappedJobs.length, 20);
    assert.equal(cappedJobs.aldiNordTruncated, 'cap');
    assert.match(errors.join('\n'), /truncated at max_pages=2/);

    errors.length = 0;
    const err = Object.assign(new Error('HTTP 503'), { status: 503 });
    const broken = makeFetch((body) => (body.page === 1 ? source(35)(body) : err));
    const kept = await fetchAldiNord(DE, { fetchImpl: broken.impl, company: { name: 'ExampleCo', careers_url: DE }, sleep: SLEEP });
    assert.equal(kept.length, 10, 'page 1 is kept when the covering page fails');
    assert.equal(kept.aldiNordTruncated, 'fetch-error');
    assert.match(errors.join('\n'), /kept the first 10 of 35 postings/);

    errors.length = 0;
    const dead = makeFetch(() => { throw Object.assign(new Error('HTTP 500'), { status: 500 }); });
    await assert.rejects(
      () => fetchAldiNord(DE, { fetchImpl: dead.impl, company: { name: 'ExampleCo', careers_url: DE }, sleep: SLEEP }),
      /HTTP 500/,
      'a locale whose first request fails is a broken board, not a short one',
    );
    assert.deepEqual(errors, []);
  } finally {
    console.error = orig;
  }
});

test('aldi-nord: fetch refuses an off-host endpoint before any request', async () => {
  let touched = 0;
  await assert.rejects(
    () => fetchAldiNord('https://evil.example/', { fetchImpl: async () => { touched += 1; return { ok: true, status: 200, json: async () => ({}) }; } }),
    /untrusted hostname/,
  );
  assert.equal(touched, 0, 'the endpoint is validated before the fetch');
});

test('aldi-nord: every confirmed site builds its posting URL on its own host', async () => {
  for (const [host, locales] of Object.entries(SITES)) {
    for (const [locale, path] of Object.entries(locales)) {
      const { calls, impl } = makeFetch(source(1, { locale }));
      const jobs = await fetchAldiNord(`https://${host}/`, {
        fetchImpl: impl,
        company: { name: 'ExampleCo', careers_url: `https://${host}/`, aldi_nord: { locales: [locale] } },
        sleep: SLEEP,
      });
      assert.equal(calls[0].url, `https://${host}/api/job/hr/query`, host);
      assert.equal(jobs[0].url, `https://${host}${path}example-role-1-m-w-d-musterstadt-900001.html`, host);
      assert.equal(jobs[0].language, locale, host);
    }
  }
});

test('aldi-nord: Belgium reads both locales on its own host, each under its own posting path', async () => {
  const nl = source(12, { locale: 'nl-BE' });
  const fr = source(2, { locale: 'fr-BE' });
  const { calls, impl } = makeFetch((body) => (body.locale === 'nl-BE' ? nl(body) : fr(body)));
  const jobs = await fetchAldiNord('https://www.aldi.be/jobs/solliciteren.html', {
    fetchImpl: impl,
    company: { name: 'ExampleCo BE', careers_url: 'https://www.aldi.be/jobs/solliciteren.html' },
    sleep: SLEEP,
  });
  assert.deepEqual(calls.map((c) => [c.body.locale, c.body.page]), [['nl-BE', 1], ['nl-BE', 2], ['fr-BE', 1]]);
  assert.ok(calls.every((c) => c.url === 'https://www.aldi.be/api/job/hr/query' && c.opts.redirect === 'error'));
  assert.equal(jobs.length, 14);
  assert.equal(jobs[0].url, 'https://www.aldi.be/jobs/detail/example-role-1-m-w-d-musterstadt-900001.html');
  assert.equal(jobs[0].language, 'nl-BE');
  assert.equal(jobs.at(-1).language, 'fr-BE');
});

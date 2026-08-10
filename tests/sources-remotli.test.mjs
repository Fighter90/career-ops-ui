/**
 * Remotli source + adapter — CI-isolated tests (fake fetchImpl, no network, no
 * parent-project dependency). Parent career-ops `providers/remotli.mjs` parity:
 * the fixtures mirror the doubly-nested `{ jobs, companies }` row shape and the
 * behaviours that decide this source — active-only liveness, applyUrl-preferred
 * URL with board fallback, salaryMin/Max/Currency as a display string, and a
 * single-pass entity decode that survives out-of-range entities.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRemotliJob,
  resolveSalary,
  resolveLocation,
  toEpochMs,
  htmlToText,
  assertRemotliUrl,
  fetchRemotli,
  FEED_BASE,
  meta,
} from '../server/lib/sources/remotli.mjs';
import { remotliAdapter } from '../server/lib/portals/adapters/remotli.mjs';

// `status` defaults to 'active' so a case exercises the thing it names (a
// non-active default would make the slug/title/salary cases below return null
// for the WRONG reason). Cases about status override it or build the row inline.
const row = (jobs, companies) => ({ jobs: { status: 'active', ...jobs }, companies: companies || {} });

// Response-like fetchImpl (matches the fetchJson contract: res.ok + res.json()).
const jsonResponse = (payload) => ({ ok: true, json: async () => payload });

// ---------------------------------------------------------------------------
// meta + adapter surface
// ---------------------------------------------------------------------------

test('meta: id/label/region + FEED_BASE + adapter.id', () => {
  assert.equal(meta.value, 'remotli');
  assert.equal(meta.label, 'Remotli');
  assert.equal(meta.region, 'en');
  assert.equal(FEED_BASE, 'https://remotli.ch/api/jobs');
  assert.equal(remotliAdapter.id, 'remotli');
  assert.equal(remotliAdapter.label, 'Remotli');
});

test('adapter: matches remotli.ch careers_url OR provider=remotli; buildEndpoint is the pinned base', () => {
  assert.ok(remotliAdapter.matches({ careers_url: 'https://remotli.ch/' }));
  assert.ok(remotliAdapter.matches({ careers_url: 'https://www.remotli.ch/jobs' }));
  assert.ok(remotliAdapter.matches({ provider: 'remotli' }));
  assert.equal(remotliAdapter.matches({ careers_url: 'https://evil.example/remotli.ch' }), false);
  assert.equal(remotliAdapter.matches({ careers_url: 'http://remotli.ch/' }), false); // non-HTTPS
  assert.equal(remotliAdapter.matches({ careers_url: 'https://remotli.ch.evil.example/' }), false);
  assert.equal(remotliAdapter.matches({}), false);
  assert.equal(remotliAdapter.matches(null), false);

  assert.equal(remotliAdapter.buildEndpoint({ provider: 'remotli' }), FEED_BASE);
  assert.equal(remotliAdapter.fetch, fetchRemotli);
});

// ---------------------------------------------------------------------------
// assertRemotliUrl — SSRF guard (HTTPS + remotli.ch only)
// ---------------------------------------------------------------------------

test('assertRemotliUrl: https + host-pinned to remotli.ch', () => {
  assert.equal(assertRemotliUrl(FEED_BASE), FEED_BASE);
  assert.equal(assertRemotliUrl('https://www.remotli.ch/api/jobs'), 'https://www.remotli.ch/api/jobs');
  assert.throws(() => assertRemotliUrl('http://remotli.ch/api/jobs'), /HTTPS/);
  assert.throws(() => assertRemotliUrl('https://evil.example/x'), /untrusted hostname/);
  assert.throws(() => assertRemotliUrl('nonsense'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// normalizeRemotliJob — nested-row mapping into the web-ui shape
// ---------------------------------------------------------------------------

test('normalizeRemotliJob: maps a nested { jobs, companies } row into the web-ui shape', () => {
  const full = normalizeRemotliJob(row({
    title: '  Head of Finance  ',
    slug: 'head-of-finance-at-acme',
    company: '  Acme AG  ',
    location: 'Zürich, Switzerland',
    allLocations: ['Zürich, Switzerland', 'Remote'],
    description: '<p>Own the <b>numbers</b>.</p><li>FP&amp;A</li>',
    applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/4012345',
    publishedAt: '2026-08-01T10:00:00.000Z',
    salaryMin: 180000, salaryMax: 220000, salaryCurrency: 'chf',
  }));
  assert.ok(full);
  assert.equal(full.title, 'Head of Finance'); // trimmed
  assert.equal(full.url, 'https://job-boards.greenhouse.io/acme/jobs/4012345'); // applyUrl wins
  assert.equal(full.company, 'Acme AG'); // real employer, not "Remotli"
  assert.equal(full.location, 'Zürich, Switzerland; Remote'); // folds allLocations
  assert.equal(full.salary, '180000–220000 CHF'); // string, currency uppercased
  assert.equal(full.date, '2026-08-01'); // publishedAt → YYYY-MM-DD
  assert.equal(full.isRemote, true); // derived from the location string
  assert.equal(full.workplaceType, 'Remote');
  assert.equal(full.relocates, false);
  assert.equal(full.source, 'remotli');
  assert.equal(full.id, 'remotli-head-of-finance-at-acme');
  assert.ok(!/[<>]/.test(full.snippet) && /Own the numbers/.test(full.snippet) && /FP&A/.test(full.snippet));
});

test('normalizeRemotliJob: company falls back job.company → companies.name → entry name → "Remotli"', () => {
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: 'f1' }, { name: 'Join Co' })).company, 'Join Co');
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: 'f2' }), 'Entry Name').company, 'Entry Name');
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: 'f3' })).company, 'Remotli');
  // job.company wins over the companies join row.
  assert.equal(
    normalizeRemotliJob(row({ title: 'T', slug: 'f4', company: 'Direct' }, { name: 'Join Co' })).company,
    'Direct',
  );
});

test('normalizeRemotliJob: omits date when no timestamp is present', () => {
  const n = normalizeRemotliJob(row({ title: 'T', slug: 'nd' }));
  assert.equal(n.date, '');
});

test('normalizeRemotliJob: drops path-unsafe slugs, empty title and malformed rows', () => {
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: '../../etc/passwd' })), null);
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: 'a/b' })), null);
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: 'a?b=c' })), null);
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: '' })), null);
  assert.equal(normalizeRemotliJob(row({ title: '', slug: 'ok' })), null);
  assert.equal(normalizeRemotliJob({ companies: {} }), null); // no jobs
  assert.equal(normalizeRemotliJob(null), null);
});

// ---------------------------------------------------------------------------
// active-only liveness (fails closed)
// ---------------------------------------------------------------------------

test('normalizeRemotliJob: emits only active rows; unknown status fails closed', () => {
  assert.equal(normalizeRemotliJob(row({ title: 'Closed', slug: 'c1', status: 'closed' })), null);
  assert.equal(normalizeRemotliJob(row({ title: 'Draft', slug: 'c2', status: 'draft' })), null);
  assert.equal(normalizeRemotliJob(row({ title: 'Expired', slug: 'c3', status: 'EXPIRED' })), null);
  // missing / null / non-string / blank → rejected
  assert.equal(normalizeRemotliJob({ jobs: { title: 'T', slug: 'ns' }, companies: {} }), null);
  assert.equal(normalizeRemotliJob({ jobs: { title: 'T', slug: 'ns', status: null }, companies: {} }), null);
  assert.equal(normalizeRemotliJob({ jobs: { title: 'T', slug: 'ns', status: 1 }, companies: {} }), null);
  assert.equal(normalizeRemotliJob({ jobs: { title: 'T', slug: 'ns', status: '  ' }, companies: {} }), null);
  // …but a well-formed active row survives, and status is trimmed + lowercased.
  assert.equal(normalizeRemotliJob(row({ title: 'T', slug: 'ns' })).url, 'https://remotli.ch/jobs/ns');
  assert.equal(
    normalizeRemotliJob({ jobs: { title: 'T', slug: 'ns', status: '  ACTIVE  ' }, companies: {} }).url,
    'https://remotli.ch/jobs/ns',
  );
});

// ---------------------------------------------------------------------------
// canonical URL — applyUrl preferred, board page fallback (parent parity)
// ---------------------------------------------------------------------------

test('normalizeRemotliJob: applyUrl is the canonical URL, board page is the fallback', () => {
  const cases = [
    ['applyUrl wins over the board page',
      row({ title: 'T', slug: 'ok', applyUrl: 'https://jobs.ashbyhq.com/acme/abc-123' }),
      'https://jobs.ashbyhq.com/acme/abc-123'],
    ['absent applyUrl → board page', row({ title: 'T', slug: 'ok' }), 'https://remotli.ch/jobs/ok'],
    ['blank applyUrl → board page', row({ title: 'T', slug: 'ok', applyUrl: '   ' }), 'https://remotli.ch/jobs/ok'],
    ['non-https applyUrl → board page', row({ title: 'T', slug: 'ok', applyUrl: 'http://jobs.example.com/1' }), 'https://remotli.ch/jobs/ok'],
    ['javascript: applyUrl → board page', row({ title: 'T', slug: 'ok', applyUrl: 'javascript:alert(1)' }), 'https://remotli.ch/jobs/ok'],
    ['malformed applyUrl → board page', row({ title: 'T', slug: 'ok', applyUrl: 'not a url' }), 'https://remotli.ch/jobs/ok'],
    ['non-string applyUrl → board page', row({ title: 'T', slug: 'ok', applyUrl: 42 }), 'https://remotli.ch/jobs/ok'],
    // The slug is only interpolated on the fallback path, so an unsafe slug no
    // longer costs a real posting when applyUrl is usable — it just goes unused.
    ['unsafe slug still emitted when applyUrl is usable',
      row({ title: 'T', slug: '../../etc/passwd', applyUrl: 'https://jobs.lever.co/acme/xyz' }),
      'https://jobs.lever.co/acme/xyz'],
  ];
  for (const [name, r, want] of cases) {
    const got = normalizeRemotliJob(r);
    assert.ok(got, `${name}: row was dropped`);
    assert.equal(got.url, want, name);
  }
});

// ---------------------------------------------------------------------------
// salary → STRING
// ---------------------------------------------------------------------------

test('resolveSalary: renders a display string, orders inverted bounds, "" when none', () => {
  assert.equal(resolveSalary({ salaryMin: 180000, salaryMax: 220000, salaryCurrency: 'chf' }), '180000–220000 CHF');
  assert.equal(resolveSalary({ salaryMin: 200, salaryMax: 100, salaryCurrency: 'CHF' }), '100–200 CHF'); // ordered
  assert.equal(resolveSalary({ salaryMin: 90000, salaryCurrency: 'CHF' }), 'from 90000 CHF'); // one-sided
  assert.equal(resolveSalary({ salaryMax: 120000 }), 'up to 120000'); // no currency
  assert.equal(resolveSalary({}), '');
});

// ---------------------------------------------------------------------------
// location fold + toEpochMs helpers
// ---------------------------------------------------------------------------

test('resolveLocation: folds allLocations, dedups case-insensitively', () => {
  assert.equal(resolveLocation({ location: 'Zürich', allLocations: ['zürich', 'Remote'] }), 'Zürich; Remote');
  assert.equal(resolveLocation({ allLocations: ['Bern'] }), 'Bern');
  assert.equal(resolveLocation({}), '');
});

test('toEpochMs: NaN-safe, undefined on absent/unparseable', () => {
  assert.equal(toEpochMs('2026-08-01T10:00:00.000Z'), Date.parse('2026-08-01T10:00:00.000Z'));
  assert.equal(toEpochMs('not a date'), undefined);
  assert.equal(toEpochMs(''), undefined);
  assert.equal(toEpochMs(undefined), undefined);
});

// ---------------------------------------------------------------------------
// entity decode — single pass, out-of-range entities survive verbatim
// ---------------------------------------------------------------------------

test('htmlToText: strips tags once then decodes entities once (nested tags + inner entities)', () => {
  const out = htmlToText('<div><p>Own the <b>numbers</b></p><li>FP&amp;A</li></div>');
  assert.ok(!/[<>]/.test(out));
  assert.match(out, /Own the numbers/);
  assert.match(out, /FP&A/);
  assert.equal(htmlToText('<p>R&amp;D team</p>'), 'R&D team');
});

test('htmlToText: passes out-of-range numeric/hex entities through verbatim (no RangeError, no data loss)', () => {
  const OUT_OF_RANGE = 'pay &#99999999; and &#xFFFFFFF; ok';
  assert.equal(htmlToText(OUT_OF_RANGE), OUT_OF_RANGE);
});

// ---------------------------------------------------------------------------
// fetch() — pagination, SSRF opts, caps
// ---------------------------------------------------------------------------

const mk = (i) => ({ jobs: { title: `Role ${i}`, slug: `role-${i}`, status: 'active' }, companies: { name: `Co ${i}` } });

test('fetchRemotli: walks pages, aggregates all rows, stops after the short page', async () => {
  const requested = [];
  const fetchImpl = async (url, opts) => {
    requested.push({ url, redirect: opts?.redirect });
    const page = Number(new URL(url).searchParams.get('page'));
    if (page === 1) return jsonResponse({ jobs: Array.from({ length: 50 }, (_, i) => mk(i)), pagination: { totalPages: 2 } });
    return jsonResponse({ jobs: Array.from({ length: 10 }, (_, i) => mk(50 + i)), pagination: { totalPages: 2 } });
  };
  const jobs = await fetchRemotli(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 60); // 50 + 10
  assert.equal(requested.length, 2);
  assert.equal(requested[0].url, 'https://remotli.ch/api/jobs?page=1&limit=50&remote=all');
  assert.equal(requested[1].url, 'https://remotli.ch/api/jobs?page=2&limit=50&remote=all');
  assert.ok(requested.every((r) => r.redirect === 'error')); // SSRF guard on every page
  assert.ok(jobs.every((j) => j.source === 'remotli'));
});

test('fetchRemotli: dedupes rows repeated by url across pages', async () => {
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get('page'));
    // Every page returns the SAME 50 rows → after dedup only 50 survive.
    return jsonResponse({ jobs: Array.from({ length: 50 }, (_, i) => mk(i)), pagination: { totalPages: 3 } });
  };
  const jobs = await fetchRemotli(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 50);
});

test('fetchRemotli: company.max_pages caps the walk', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return jsonResponse({ jobs: Array.from({ length: 50 }, (_, i) => mk(seen.length * 100 + i)), pagination: { totalPages: 10 } });
  };
  await fetchRemotli(FEED_BASE, { fetchImpl, company: { max_pages: 2 } });
  assert.equal(seen.length, 2);
});

// ---------------------------------------------------------------------------
// fetch() — dead-board contract
// ---------------------------------------------------------------------------

test('fetchRemotli: a page-1 transport failure throws (dead board stays dead)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchRemotli(FEED_BASE, { fetchImpl }), /HTTP 503/);
});

test('fetchRemotli: a malformed page-1 body throws (not proof of life)', async () => {
  const fetchImpl = async () => jsonResponse({ wrong: true });
  await assert.rejects(() => fetchRemotli(FEED_BASE, { fetchImpl }), /unexpected API response/);
});

test('fetchRemotli: keeps pages 1-2 when page 3 fails mid-scan (partial-keep, not total loss)', async () => {
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get('page'));
    if (page >= 3) throw new Error('ETIMEDOUT on page 3');
    return jsonResponse({ jobs: Array.from({ length: 50 }, (_, i) => mk(page * 100 + i)), pagination: { totalPages: 8 } });
  };
  const jobs = await fetchRemotli(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 100); // pages 1 + 2 kept
});

test('fetchRemotli: keeps page 1 when a later page returns a malformed body', async () => {
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get('page'));
    if (page >= 2) return jsonResponse({ garbage: true });
    return jsonResponse({ jobs: Array.from({ length: 50 }, (_, i) => mk(i)), pagination: { totalPages: 8 } });
  };
  const jobs = await fetchRemotli(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 50);
});

// ---------------------------------------------------------------------------
// fetch() — active filter + one bad entity must not kill the page
// ---------------------------------------------------------------------------

test('fetchRemotli: emits only active rows and survives a malformed entity in one row', async () => {
  const fetchImpl = async () => jsonResponse({
    jobs: [
      { jobs: { title: 'Good', slug: 'good', status: 'active' }, companies: {} },
      { jobs: { title: 'Closed', slug: 'closed', status: 'closed' }, companies: {} }, // dropped
      { jobs: { title: 'Bad', slug: 'bad', status: 'active', description: '&#99999999;' }, companies: {} },
    ],
    pagination: { totalPages: 1 },
  });
  const jobs = await fetchRemotli(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 2); // Good + Bad; Closed filtered out, no crash
  assert.deepEqual(jobs.map((j) => j.title).sort(), ['Bad', 'Good']);
});

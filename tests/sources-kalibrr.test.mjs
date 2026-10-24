/**
 * Kalibrr source (v1.253.0 parent parity) — CI-isolated suite.
 * Covers the canonical posting-URL build (safeEncodeURIComponent'd segments,
 * placeholder company code, apply_redirect_url never used), the row
 * normalization (title/company/location/Remote/description/postedAt), the
 * envelope contract (null/{}/[]/null-jobs are empty boards; a missing `jobs`
 * key or a non-array `jobs` throws naming what arrived), the config caps, the
 * `count`-driven pagination with the short-page fallback, the max_pages cap
 * tagging `kalibrrTruncated`, the first-page/later-page failure split, and
 * the `text` keyword param. No network — pure parses plus a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseKalibrrPage,
  normalizeKalibrrJob,
  resolvePageSize,
  resolveMaxPages,
  assertKalibrrUrl,
  fetchKalibrr,
  DEFAULT_API,
  SITE_ORIGIN,
  TRUSTED_HOST,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_CAP,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
} from '../server/lib/sources/kalibrr.mjs';
import { kalibrrAdapter } from '../server/lib/portals/adapters/kalibrr.mjs';

const row = (i, extra = {}) => ({
  id: String(1000 + i),
  slug: `role-${i}`,
  name: `Role ${i}`,
  company: { name: `Employer ${i}`, code: `employer${i}` },
  google_location: { address_components: { city: 'Jakarta', region: 'Jakarta', country: 'Indonesia' } },
  ...extra,
});
const envelope = (rows, count) => ({ count: count ?? rows.length, jobs: rows });

test('kalibrr: normalizeKalibrrJob — canonical URL, employer attribution, location, dates', () => {
  const j = normalizeKalibrrJob(row(1, {
    description: '<p>Build things</p>',
    qualifications: '<ul><li>Go</li></ul>',
    is_work_from_home: true,
    activation_date: '2026-09-23T11:55:37.266927+00:00',
  }), 'Kalibrr');
  assert.equal(j.title, 'Role 1');
  assert.equal(j.url, `${SITE_ORIGIN}/c/employer1/jobs/1001/role-1`);
  assert.equal(j.company, 'Employer 1', 'company.name wins over the fallback');
  assert.equal(j.location, 'Jakarta, Indonesia, Remote', 'duplicate region folds into the city');
  assert.equal(j.description, 'Build things Go');
  assert.equal(j.postedAt, Date.parse('2026-09-23T11:55:37.266927+00:00'));
});

test('kalibrr: normalizeKalibrrJob — company_name → entry fallback; created_at when no activation_date', () => {
  const j = normalizeKalibrrJob({
    id: '7', slug: 'x', name: 'X',
    company: {},
    company_name: 'Fallback Employer',
    created_at: '2026-01-02T03:04:05Z',
  }, 'Kalibrr');
  assert.equal(j.company, 'Fallback Employer');
  assert.equal(j.postedAt, Date.parse('2026-01-02T03:04:05Z'));
  const entry = normalizeKalibrrJob({ id: '8', slug: 'y', name: 'Y', company: {} }, 'Entry Co');
  assert.equal(entry.company, 'Entry Co');
});

test('kalibrr: normalizeKalibrrJob — rows without a title or an id are dropped', () => {
  assert.equal(normalizeKalibrrJob({ ...row(1), name: '  ' }), null);
  assert.equal(normalizeKalibrrJob({ ...row(1), id: '' }), null);
  assert.equal(normalizeKalibrrJob(null), null);
  assert.equal(normalizeKalibrrJob('garbage'), null);
});

test('kalibrr: normalizeKalibrrJob — a lone surrogate in a segment drops the row, not the page', () => {
  assert.equal(normalizeKalibrrJob(row(1, { slug: '\uD800lone' })), null, 'bad slug → no URL → dropped');
  assert.equal(normalizeKalibrrJob(row(1, { company: { name: 'E', code: '\uDC00bad' } })), null);
  const ok = normalizeKalibrrJob(row(2, { slug: 'a/b?c#d' }));
  assert.equal(ok.url, `${SITE_ORIGIN}/c/employer2/jobs/1002/a%2Fb%3Fc%23d`, 'the segment cannot escape its slot');
});

test('kalibrr: normalizeKalibrrJob — missing slug shortens the path; missing code uses the placeholder', () => {
  const noSlug = normalizeKalibrrJob({ ...row(3), slug: undefined });
  assert.equal(noSlug.url, `${SITE_ORIGIN}/c/employer3/jobs/1003`);
  const noCode = normalizeKalibrrJob({ ...row(4), company: { name: 'E' } });
  assert.equal(noCode.url, `${SITE_ORIGIN}/c/-/jobs/1004/role-4`);
});

test('kalibrr: apply_redirect_url is never the URL (opaque shortener)', () => {
  const j = normalizeKalibrrJob(row(5, { apply_redirect_url: 'https://bit.ly/xyz' }));
  assert.ok(!j.url.includes('bit.ly'));
  assert.equal(j.url, `${SITE_ORIGIN}/c/employer5/jobs/1005/role-5`);
});

test('kalibrr: parseKalibrrPage — empty bodies are empty boards, shape changes throw', () => {
  for (const empty of [null, undefined, {}, [], { jobs: null }, { jobs: [] }]) {
    const parsed = parseKalibrrPage(empty, { offset: 0 });
    assert.deepEqual(parsed.jobs, [], `${JSON.stringify(empty)} is an empty board`);
    assert.equal(parsed.rowsLength, empty && empty.jobs && empty.jobs.length ? empty.jobs.length : 0);
  }
  assert.throws(
    () => parseKalibrrPage({ count: 5, results: [] }, { offset: 300 }),
    /offset 300 .*got keys: \[count, results\]/);
  assert.throws(
    () => parseKalibrrPage([row(1)], { offset: 0 }),
    /got an array of 1/);
  assert.throws(
    () => parseKalibrrPage('login page', { offset: 0 }),
    /got string/);
});

test('kalibrr: parseKalibrrPage — count is captured as the total when finite and non-negative', () => {
  assert.equal(parseKalibrrPage(envelope([row(1)], 4211), {}).total, 4211);
  assert.equal(parseKalibrrPage({ jobs: [row(1)] }, {}).total, null, 'no count → null (short-page fallback governs)');
  assert.equal(parseKalibrrPage({ count: -3, jobs: [row(1)] }, {}).total, null);
  assert.equal(parseKalibrrPage({ count: 'x', jobs: [] }, {}).total, null);
});

test('kalibrr: assertKalibrrUrl — HTTPS on www.kalibrr.com only', () => {
  assert.equal(assertKalibrrUrl(DEFAULT_API), DEFAULT_API);
  assert.throws(() => assertKalibrrUrl('http://www.kalibrr.com/kjs/job_board/search'), /must use HTTPS/);
  assert.throws(() => assertKalibrrUrl('https://evil.example/kjs'), /untrusted hostname/);
  assert.throws(() => assertKalibrrUrl('not a url'), /invalid URL/);
});

test('kalibrr: resolvePageSize / resolveMaxPages — positive integers, capped', () => {
  assert.equal(resolvePageSize({}), DEFAULT_PAGE_SIZE);
  assert.equal(resolvePageSize({ pageSize: 50 }), 50);
  assert.equal(resolvePageSize({ pageSize: 9999 }), PAGE_SIZE_CAP);
  assert.equal(resolvePageSize({ pageSize: '50' }), 50, 'a numeric string coerces (the parent resolveInt reads Number(value))');
  assert.equal(resolvePageSize({ pageSize: 'fifty' }), DEFAULT_PAGE_SIZE, 'a non-numeric is ignored');
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 5000 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: 0 }), DEFAULT_MAX_PAGES);
});

const jsonResponse = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });

test('kalibrr: fetchKalibrr — walks until offset >= count; text param rides every page', async () => {
  const pages = [
    envelope(Array.from({ length: 100 }, (_, i) => row(i)), 150),
    envelope(Array.from({ length: 50 }, (_, i) => row(100 + i)), 150),
  ];
  const calls = [];
  const fetchImpl = async (url) => { calls.push(String(url)); return jsonResponse(pages[calls.length - 1]); };
  const jobs = await fetchKalibrr(DEFAULT_API, {
    fetchImpl,
    company: { name: 'Kalibrr', provider: 'kalibrr', searchKeywords: 'engineer' },
    delayMs: 0,
  });
  assert.equal(calls.length, 2, 'count=150 → two 100-row pages');
  assert.ok(calls[0].includes('limit=100&offset=0&text=engineer'));
  assert.ok(calls[1].includes('offset=100'));
  assert.equal(jobs.length, 150);
  assert.equal(jobs.kalibrrTruncated, undefined, 'a complete walk is not truncated');
});

test('kalibrr: fetchKalibrr — a short page ends the sweep when count is absent', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    // No `count` in the envelope — the short-page fallback governs. Page 2 is
    // short AND carries fresh ids (dedup must not hide the shortfall).
    return jsonResponse({ jobs: Array.from({ length: calls === 1 ? 100 : 3 }, (_, i) => row(calls === 1 ? i : 200 + i)) });
  };
  const jobs = await fetchKalibrr(DEFAULT_API, { fetchImpl, company: { name: 'Kalibrr' }, delayMs: 0 });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 103);
});

test('kalibrr: fetchKalibrr — rows dedupe by URL across pages', async () => {
  const dup = row(1);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    // Page 1 full (so the walk continues), page 2 repeats one URL.
    return jsonResponse({
      jobs: calls === 1 ? [...Array.from({ length: 98 }, (_, i) => row(10 + i)), dup, row(2)] : [dup, row(3)],
    });
  };
  const jobs = await fetchKalibrr(DEFAULT_API, { fetchImpl, company: { name: 'K' }, delayMs: 0 });
  assert.equal(jobs.length, 101, 'the repeated URL is folded, the new one kept');
  assert.ok(jobs.every((j, idx, a) => a.findIndex((x) => x.url === j.url) === idx));
});

test('kalibrr: fetchKalibrr — exhausting max_pages tags the array kalibrrTruncated', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    // Every page full AND fresh — the walk only stops on the cap.
    return jsonResponse(envelope(Array.from({ length: 100 }, (_, i) => row(calls * 100 + i)), 1000));
  };
  const jobs = await fetchKalibrr(DEFAULT_API, {
    fetchImpl, company: { name: 'Kalibrr', max_pages: 2 }, delayMs: 0,
  });
  assert.equal(jobs.length, 200);
  assert.equal(jobs.kalibrrTruncated, true, 'the cap stopped the sweep — the board is partial');
});

test('kalibrr: fetchKalibrr — the first page failing means there is no board', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) }; };
  await assert.rejects(
    () => fetchKalibrr(DEFAULT_API, { fetchImpl, company: { name: 'Kalibrr' }, delayMs: 0 }),
    /HTTP 404/);
  assert.equal(calls, 1, 'a permanent 4xx is not retried');
});

test('kalibrr: fetchKalibrr — a later page failing keeps the collected jobs (no truncation flag)', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return jsonResponse(envelope(Array.from({ length: 100 }, (_, i) => row(i))));
    return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) };
  };
  const jobs = await fetchKalibrr(DEFAULT_API, {
    fetchImpl, company: { name: 'Kalibrr' }, delayMs: 0, retries: 0,
  });
  assert.equal(jobs.length, 100, 'page-1 jobs kept');
  assert.equal(jobs.kalibrrTruncated, undefined, 'an error stop is not a cap truncation');
});

test('kalibrr: fetchKalibrr — normalized rows carry the web-ui shape', async () => {
  const fetchImpl = async () => jsonResponse(envelope([row(1, {
    name: 'Remote Platform Engineer',
    is_work_from_home: true,
    activation_date: '2026-10-01T00:00:00Z',
    description: '<p>Desc</p>',
  })]));
  const [job] = await fetchKalibrr(DEFAULT_API, { fetchImpl, company: { name: 'Kalibrr', provider: 'kalibrr' }, delayMs: 0 });
  assert.equal(job.id, 'kalibrr-employer1/jobs/1001/role-1');
  assert.equal(job.source, 'kalibrr');
  assert.equal(job.company, 'Employer 1');
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
  assert.equal(job.date, '2026-10-01T00:00:00.000Z');
  assert.equal(job.snippet, 'Desc');
  assert.equal(job.salary, '', 'month/day figures stay unused — never read as annual');
});

test('kalibrr: fetchKalibrr — an off-host endpoint rejects before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchKalibrr('https://evil.example/kjs', { fetchImpl, company: { name: 'Kalibrr' } }),
    /untrusted hostname/);
});

test('kalibrr adapter: provider-selected only; api override validated, else null', () => {
  assert.equal(kalibrrAdapter.matches({ provider: 'kalibrr' }), true);
  assert.equal(kalibrrAdapter.matches({ provider: 'greenhouse' }), false);
  assert.equal(kalibrrAdapter.matches({ careers_url: 'https://www.kalibrr.com/c/foo/jobs' }), false,
    'an aggregator is never host-auto-detected');
  assert.equal(kalibrrAdapter.buildEndpoint({ provider: 'kalibrr' }), DEFAULT_API);
  assert.equal(
    kalibrrAdapter.buildEndpoint({ provider: 'kalibrr', api: 'https://www.kalibrr.com/kjs/job_board/search' }),
    DEFAULT_API);
  assert.equal(kalibrrAdapter.buildEndpoint({ provider: 'kalibrr', api: 'https://evil.example/kjs' }), null);
  assert.equal(kalibrrAdapter.id, 'kalibrr');
  assert.equal(TRUSTED_HOST, 'www.kalibrr.com');
});

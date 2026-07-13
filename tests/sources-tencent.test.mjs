/**
 * Tencent source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops parity (#230).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTencent,
  parseTencentResponse,
  parseCnDate,
  assertTencentUrl,
  DEFAULT_API,
} from '../server/lib/sources/tencent.mjs';
import { tencentAdapter } from '../server/lib/portals/adapters/tencent.mjs';

// ---------------------------------------------------------------------------
// Fake response helpers
// ---------------------------------------------------------------------------

function makePost(overrides = {}) {
  return {
    PostId: '1001',
    RecruitPostName: '大模型推理工程师',
    PostURL: 'https://careers.tencent.com/jobdesc.html?postId=1001',
    CountryName: '中国',
    LocationName: '深圳',
    BGName: 'TEG',
    CategoryName: '技术',
    RequireWorkYearsName: '3年',
    Responsibility: '负责大模型推理加速。',
    LastUpdateTime: '2026年06月23日',
    ...overrides,
  };
}

function makePage(posts, count) {
  return { Data: { Posts: posts, Count: count ?? posts.length } };
}

function fakeFetch(bodies) {
  let call = 0;
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const body = bodies[Math.min(call, bodies.length - 1)];
    call++;
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// parseCnDate
// ---------------------------------------------------------------------------

test('parseCnDate: parses the Chinese date form, NaN-safe', () => {
  assert.equal(parseCnDate('2026年06月23日'), Date.UTC(2026, 5, 23));
  assert.equal(parseCnDate('junk'), undefined);
  assert.equal(parseCnDate(''), undefined);
  assert.equal(parseCnDate(null), undefined);
});

// ---------------------------------------------------------------------------
// parseTencentResponse
// ---------------------------------------------------------------------------

test('parseTencentResponse: normalizes a post into the web-ui job shape', () => {
  const { jobs, total } = parseTencentResponse(makePage([makePost()], 4321), '腾讯');
  assert.equal(total, 4321);
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'tencent-1001');
  assert.equal(j.title, '大模型推理工程师');
  assert.equal(j.company, '腾讯');
  assert.equal(j.url, 'https://careers.tencent.com/jobdesc.html?postId=1001');
  assert.equal(j.location, '中国-深圳');
  assert.equal(j.source, 'tencent');
  assert.equal(j.date, new Date(Date.UTC(2026, 5, 23)).toISOString());
  assert.match(j.snippet, /BG: TEG/);
  assert.match(j.snippet, /经验: 3年/);
});

test('parseTencentResponse: builds the URL from PostId when PostURL is absent', () => {
  const { jobs } = parseTencentResponse(makePage([makePost({ PostURL: '' })]), '腾讯');
  assert.equal(jobs[0].url, 'https://careers.tencent.com/jobdesc.html?postId=1001');
});

test('parseTencentResponse: drops posts without title or any URL; tolerates malformed payloads', () => {
  const page = makePage([
    makePost({ RecruitPostName: '' }),
    makePost({ PostURL: '', PostId: null }),
    makePost(),
  ]);
  assert.equal(parseTencentResponse(page, 'x').jobs.length, 1);
  assert.deepEqual(parseTencentResponse(null, 'x'), { jobs: [], total: 0 });
  assert.deepEqual(parseTencentResponse({ Data: {} }, 'x'), { jobs: [], total: 0 });
});

// ---------------------------------------------------------------------------
// assertTencentUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertTencentUrl: accepts the pinned host, rejects others', () => {
  assert.equal(assertTencentUrl(DEFAULT_API), DEFAULT_API);
  assert.throws(() => assertTencentUrl('https://evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertTencentUrl('http://careers.tencent.com/api'), /HTTPS/);
  assert.throws(() => assertTencentUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// fetchTencent — pagination, keyword config, mid-run failure
// ---------------------------------------------------------------------------

test('fetchTencent: GETs the Query API with keyword + pageIndex params', async () => {
  const fetchImpl = fakeFetch([makePage([makePost()], 1)]);
  const jobs = await fetchTencent(DEFAULT_API, {
    fetchImpl,
    company: { name: '腾讯', keywords: ['AI'] },
  });
  assert.equal(jobs.length, 1);
  assert.equal(fetchImpl.calls.length, 1);
  const u = new URL(fetchImpl.calls[0].url);
  assert.equal(u.hostname, 'careers.tencent.com');
  assert.equal(u.searchParams.get('keyword'), 'AI');
  assert.equal(u.searchParams.get('pageIndex'), '1');
  assert.equal(u.searchParams.get('pageSize'), '100');
});

test('fetchTencent: paginates while pages are full, dedupes by URL across keywords', async () => {
  const page1 = makePage(
    Array.from({ length: 100 }, (_, i) => makePost({ PostId: `p-${i}`, PostURL: '' })),
    150,
  );
  // Page 2 half-repeats page 1's ids (p-0 … p-24) — the repeats must dedupe.
  const page2 = makePage(
    Array.from({ length: 50 }, (_, i) =>
      makePost({ PostId: i < 25 ? `p-${i}` : `n-${i}`, PostURL: '' })),
    150,
  );
  const fetchImpl = fakeFetch([page1, page2]);
  const jobs = await fetchTencent(DEFAULT_API, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 125); // 100 + 25 new, 25 duplicates dropped
});

test('fetchTencent: first-request failure throws; mid-run blip keeps collected jobs', async () => {
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchTencent(DEFAULT_API, { fetchImpl: failing }), /HTTP 503/);

  const fullPage = makePage(
    Array.from({ length: 100 }, (_, i) => makePost({ PostId: `q-${i}`, PostURL: '' })),
    250,
  );
  let call = 0;
  const blippy = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => fullPage };
    return { ok: false, status: 429 };
  };
  const jobs = await fetchTencent(DEFAULT_API, { fetchImpl: blippy });
  assert.equal(jobs.length, 100);
});

test('fetchTencent: honors max_pages from the company entry', async () => {
  const fullPage = makePage(
    Array.from({ length: 100 }, (_, i) => makePost({ PostId: `m-${i}`, PostURL: '' })),
    1000,
  );
  const fetchImpl = fakeFetch([fullPage]);
  await fetchTencent(DEFAULT_API, { fetchImpl, company: { max_pages: 2 } });
  assert.equal(fetchImpl.calls.length, 2);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('tencentAdapter: matches provider or careers.tencent.com host, endpoint pinned', () => {
  assert.equal(tencentAdapter.id, 'tencent');
  assert.ok(tencentAdapter.matches({ provider: 'tencent' }));
  assert.ok(tencentAdapter.matches({ careers_url: 'https://careers.tencent.com/search.html' }));
  assert.ok(!tencentAdapter.matches({ careers_url: 'https://zhaopin.meituan.com/web/social' }));
  assert.ok(!tencentAdapter.matches({ careers_url: 'https://evil.com/careers.tencent.com' }));
  assert.equal(tencentAdapter.buildEndpoint({ provider: 'tencent' }), DEFAULT_API);
});

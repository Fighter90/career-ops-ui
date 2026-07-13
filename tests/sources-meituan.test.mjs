/**
 * Meituan source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops parity (#1818).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchMeituan,
  parseMeituanResponse,
  assertMeituanUrl,
  DEFAULT_API,
} from '../server/lib/sources/meituan.mjs';
import { meituanAdapter } from '../server/lib/portals/adapters/meituan.mjs';

// ---------------------------------------------------------------------------
// Fake response helpers
// ---------------------------------------------------------------------------

function makePost(overrides = {}) {
  return {
    jobUnionId: 'u-101',
    name: '大模型算法工程师',
    cityList: [{ name: '北京市' }, { name: '上海市' }],
    department: [{ name: '基础研发平台' }],
    jobFamily: '技术',
    workYear: '3-5年',
    jobDuty: '负责大模型训练与优化。',
    jobRequirement: '熟悉 PyTorch。',
    refreshTime: 1751328000000,
    ...overrides,
  };
}

function makePage(list, totalCount) {
  return { data: { list, page: { totalCount: totalCount ?? list.length } } };
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
// parseMeituanResponse
// ---------------------------------------------------------------------------

test('parseMeituanResponse: normalizes a post into the web-ui job shape', () => {
  const { jobs, total } = parseMeituanResponse(makePage([makePost()], 1234), '美团');
  assert.equal(total, 1234);
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'meituan-u-101');
  assert.equal(j.title, '大模型算法工程师');
  assert.equal(j.company, '美团');
  assert.equal(j.url, 'https://zhaopin.meituan.com/web/position/detail?jobUnionId=u-101');
  assert.equal(j.location, '北京市/上海市');
  assert.equal(j.source, 'meituan');
  assert.equal(j.date, new Date(1751328000000).toISOString());
  assert.match(j.snippet, /部门: 基础研发平台/);
  assert.match(j.snippet, /经验: 3-5年/);
});

test('parseMeituanResponse: drops posts without title or jobUnionId', () => {
  const page = makePage([
    makePost({ name: '' }),
    makePost({ jobUnionId: null }),
    makePost({ jobUnionId: 'ok-1' }),
  ]);
  const { jobs } = parseMeituanResponse(page, '美团');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'meituan-ok-1');
});

test('parseMeituanResponse: tolerates a malformed payload', () => {
  assert.deepEqual(parseMeituanResponse(null, 'x'), { jobs: [], total: 0 });
  assert.deepEqual(parseMeituanResponse({ data: {} }, 'x'), { jobs: [], total: 0 });
});

test('parseMeituanResponse: caps the snippet length', () => {
  const page = makePage([makePost({ jobDuty: 'A'.repeat(5000) })]);
  const { jobs } = parseMeituanResponse(page, '美团');
  assert.ok(jobs[0].snippet.length <= 500);
});

// ---------------------------------------------------------------------------
// assertMeituanUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertMeituanUrl: accepts the pinned host, rejects others', () => {
  assert.equal(assertMeituanUrl(DEFAULT_API), DEFAULT_API);
  assert.throws(() => assertMeituanUrl('https://evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertMeituanUrl('http://zhaopin.meituan.com/api'), /HTTPS/);
  assert.throws(() => assertMeituanUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// fetchMeituan — pagination, dedup, keyword config, mid-run failure
// ---------------------------------------------------------------------------

test('fetchMeituan: single page, POSTs the nested pagination body', async () => {
  const fetchImpl = fakeFetch([makePage([makePost()], 1)]);
  const jobs = await fetchMeituan(DEFAULT_API, { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(fetchImpl.calls.length, 1);
  const body = JSON.parse(fetchImpl.calls[0].opts.body);
  assert.deepEqual(body.page, { pageNo: 1, pageSize: 100 });
  assert.equal(body.jobShareType, '1');
});

test('fetchMeituan: queries each configured keyword and dedupes by URL', async () => {
  const shared = makePost({ jobUnionId: 'dup-1' });
  const fetchImpl = fakeFetch([makePage([shared], 1)]);
  const jobs = await fetchMeituan(DEFAULT_API, {
    fetchImpl,
    company: { name: '美团', keywords: ['AI', '大模型'] },
  });
  assert.equal(fetchImpl.calls.length, 2); // one query per keyword
  assert.equal(JSON.parse(fetchImpl.calls[0].opts.body).keywords, 'AI');
  assert.equal(JSON.parse(fetchImpl.calls[1].opts.body).keywords, '大模型');
  assert.equal(jobs.length, 1); // deduped
});

test('fetchMeituan: first-request failure throws; mid-run blip keeps collected jobs', async () => {
  // First request fails outright → throw.
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchMeituan(DEFAULT_API, { fetchImpl: failing }), /HTTP 503/);

  // Page 1 succeeds (full page of 100 → pagination continues), page 2 blips →
  // the collected jobs survive.
  const fullPage = makePage(
    Array.from({ length: 100 }, (_, i) => makePost({ jobUnionId: `u-${i}` })),
    250,
  );
  let call = 0;
  const blippy = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => fullPage };
    return { ok: false, status: 429 };
  };
  const jobs = await fetchMeituan(DEFAULT_API, { fetchImpl: blippy });
  assert.equal(jobs.length, 100);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('meituanAdapter: matches provider or zhaopin.meituan.com host, endpoint pinned', () => {
  assert.equal(meituanAdapter.id, 'meituan');
  assert.ok(meituanAdapter.matches({ provider: 'meituan' }));
  assert.ok(meituanAdapter.matches({ careers_url: 'https://zhaopin.meituan.com/web/social' }));
  assert.ok(!meituanAdapter.matches({ careers_url: 'https://careers.tencent.com/search.html' }));
  assert.ok(!meituanAdapter.matches({ careers_url: 'https://evil.com/zhaopin.meituan.com' }));
  assert.equal(meituanAdapter.buildEndpoint({ provider: 'meituan' }), DEFAULT_API);
});

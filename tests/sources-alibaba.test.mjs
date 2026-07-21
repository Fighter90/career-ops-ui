/**
 * Alibaba source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops parity (providers/alibaba.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAlibaba,
  parseAlibabaResponse,
  assertAlibabaUrl,
  DEFAULT_API,
} from '../server/lib/sources/alibaba.mjs';
import { alibabaAdapter } from '../server/lib/portals/adapters/alibaba.mjs';

// ---------------------------------------------------------------------------
// Fake response helpers
// ---------------------------------------------------------------------------

function makePost(overrides = {}) {
  return {
    id: 100009135010,
    name: '大模型后训练工程师',
    workLocations: ['杭州', '北京'],
    categories: ['技术类-开发'],
    experience: { from: 3, to: 5 },
    description: '负责大模型后训练服务。',
    requirement: '熟练掌握 Python。',
    publishTime: 1783501139000,
    modifyTime: 1783600000000,
    ...overrides,
  };
}

function makePage(datas, totalCount) {
  return { success: true, content: { totalCount: totalCount ?? datas.length, datas } };
}

/** fetchImpl(url, opts) → {ok:true, json}; `handler(call, n)` returns the body. */
function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const call = { url, opts, key: body.key, pageIndex: body.pageIndex, headers: opts.headers };
    calls.push(call);
    return { ok: true, json: async () => handler(call, calls.length) };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// parseAlibabaResponse
// ---------------------------------------------------------------------------

test('parseAlibabaResponse: normalizes a post into the web-ui job shape', () => {
  const { jobs, total } = parseAlibabaResponse(makePage([makePost()], 42), '阿里巴巴');
  assert.equal(total, 42);
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'alibaba-100009135010');
  assert.equal(j.title, '大模型后训练工程师');
  assert.equal(j.company, '阿里巴巴');
  assert.equal(j.url, 'https://talent.alibaba.com/off-campus/position-detail?positionId=100009135010');
  assert.equal(j.location, '杭州/北京');
  assert.equal(j.workplaceType, 'Onsite');
  assert.equal(j.isRemote, false);
  assert.equal(j.source, 'alibaba');
  assert.equal(j.date, new Date(1783501139000).toISOString()); // prefers publishTime
  assert.match(j.snippet, /类别: 技术类-开发/);
  assert.match(j.snippet, /经验: 3-5年/);
  assert.match(j.snippet, /负责大模型后训练服务。/);
});

test('parseAlibabaResponse: drops posts without title or id', () => {
  const page = makePage([
    makePost({ name: '' }),
    makePost({ id: null }),
    makePost({ id: 555, name: 'ok' }),
  ]);
  const { jobs } = parseAlibabaResponse(page, '阿里巴巴');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'alibaba-555');
});

test('parseAlibabaResponse: falls back to modifyTime and formats open-ended experience', () => {
  const post = {
    id: 100018660002,
    name: '大模型算法专家',
    workLocations: ['杭州'],
    experience: { from: 10, to: null },
    modifyTime: 1784197983000,
  };
  const { jobs } = parseAlibabaResponse(makePage([post]), '阿里巴巴');
  assert.equal(jobs[0].date, new Date(1784197983000).toISOString());
  assert.match(jobs[0].snippet, /经验: 10年以上/);
});

test('parseAlibabaResponse: tolerates a malformed payload', () => {
  assert.deepEqual(parseAlibabaResponse(null, 'x'), { jobs: [], total: 0 });
  assert.deepEqual(
    parseAlibabaResponse({ success: true, content: { totalCount: 0, datas: null } }, 'x'),
    { jobs: [], total: 0 },
  );
});

test('parseAlibabaResponse: caps the snippet length', () => {
  const { jobs } = parseAlibabaResponse(makePage([makePost({ description: 'A'.repeat(9000) })]), '阿里巴巴');
  assert.ok(jobs[0].snippet.length <= 500);
});

// ---------------------------------------------------------------------------
// assertAlibabaUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertAlibabaUrl: accepts the pinned host, rejects others', () => {
  assert.equal(assertAlibabaUrl(DEFAULT_API), DEFAULT_API);
  assert.throws(() => assertAlibabaUrl('https://evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertAlibabaUrl('http://talent.alibaba.com/position/search'), /HTTPS/);
  assert.throws(() => assertAlibabaUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// fetchAlibaba — pagination, CSRF pairing, dedup, config, failure modes
// ---------------------------------------------------------------------------

test('fetchAlibaba: paginates until totalCount is exhausted and pairs the CSRF token', async () => {
  const fetchImpl = fakeFetch(({ pageIndex }) =>
    makePage(
      pageIndex === 1
        ? Array.from({ length: 100 }, (_, i) => makePost({ id: 1000 + i, name: `A${i}` }))
        : Array.from({ length: 50 }, (_, i) => makePost({ id: 2000 + i, name: `B${i}` })),
      150,
    ));
  const jobs = await fetchAlibaba(DEFAULT_API, { fetchImpl, company: { keywords: ['AI'] } });
  assert.equal(jobs.length, 150); // 100 + 50, distinct ids
  assert.equal(fetchImpl.calls.length, 2);

  // Double-submit-cookie: XSRF-TOKEN cookie must match the x-xsrf-token header.
  const h = fetchImpl.calls[0].headers;
  const cookieToken = /^XSRF-TOKEN=(.+)$/.exec(h.cookie || '')?.[1];
  assert.ok(cookieToken);
  assert.equal(h['x-xsrf-token'], cookieToken);
});

test('fetchAlibaba: queries each configured keyword and dedupes by URL', async () => {
  const fetchImpl = fakeFetch(() => makePage([makePost({ id: 42, name: '重复岗位' })], 1));
  const jobs = await fetchAlibaba(DEFAULT_API, { fetchImpl, company: { keywords: ['AI', '大模型'] } });
  assert.equal(fetchImpl.calls.length, 2); // one query per keyword
  assert.equal(fetchImpl.calls[0].key, 'AI');
  assert.equal(fetchImpl.calls[1].key, '大模型');
  assert.equal(jobs.length, 1); // deduped
});

test('fetchAlibaba: honors company.max_pages and defaults to a whole-board (empty keyword) query', async () => {
  const fetchImpl = fakeFetch(() =>
    makePage(Array.from({ length: 100 }, (_, i) => makePost({ id: 5000 + i, name: `E${i}` })), 500));
  const jobs = await fetchAlibaba(DEFAULT_API, { fetchImpl, company: { max_pages: 1 } });
  assert.equal(fetchImpl.calls.length, 1); // capped despite totalCount=500
  assert.equal(fetchImpl.calls[0].key, ''); // default keyword = whole board
  assert.equal(jobs.length, 100);
});

test('fetchAlibaba: first-request failure throws; mid-run blip keeps collected jobs', async () => {
  // First request fails outright → throw (dead board reads as failure).
  await assert.rejects(
    () => fetchAlibaba(DEFAULT_API, {
      fetchImpl: async () => ({ ok: false, status: 500 }),
      company: { keywords: ['AI'] },
    }),
    /HTTP 500/,
  );

  // "AI" succeeds, "大模型" throws mid-run → survivors kept.
  const blippy = async (_url, opts) => {
    const key = JSON.parse(opts.body).key;
    if (key === '大模型') throw new Error('boom 503');
    return { ok: true, json: async () => makePage([makePost({ id: 7, name: '幸存岗位' })], 1) };
  };
  const jobs = await fetchAlibaba(DEFAULT_API, { fetchImpl: blippy, company: { keywords: ['AI', '大模型'] } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, '幸存岗位');
});

test('fetchAlibaba: treats an in-band success:false as a blip once collected, but throws on the first', async () => {
  // "AI" ok, "大模型" answers success:false → survivors kept.
  const softBlip = async (_url, opts) => {
    const key = JSON.parse(opts.body).key;
    if (key === '大模型') return { ok: true, json: async () => ({ success: false, errorMsg: 'rate limited' }) };
    return { ok: true, json: async () => makePage([makePost({ id: 8, name: '幸存岗位2' })], 1) };
  };
  const jobs = await fetchAlibaba(DEFAULT_API, { fetchImpl: softBlip, company: { keywords: ['AI', '大模型'] } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, '幸存岗位2');

  // A very first response of success:false is a dead board, not an empty one.
  await assert.rejects(
    () => fetchAlibaba(DEFAULT_API, {
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: false, errorCode: 'SYS_ERROR' }) }),
      company: { keywords: ['AI'] },
    }),
    /API error/,
  );
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('alibabaAdapter: matches provider or talent.alibaba.com host, endpoint pinned', () => {
  assert.equal(alibabaAdapter.id, 'alibaba');
  assert.equal(alibabaAdapter.label, 'Alibaba');
  assert.ok(alibabaAdapter.matches({ provider: 'alibaba' }));
  assert.ok(alibabaAdapter.matches({ careers_url: 'https://talent.alibaba.com/off-campus/position-list' }));
  assert.ok(!alibabaAdapter.matches({ careers_url: 'https://careers.tencent.com/search.html' }));
  assert.ok(!alibabaAdapter.matches({ careers_url: 'https://evil.com/talent.alibaba.com' }));
  assert.equal(alibabaAdapter.buildEndpoint({ provider: 'alibaba' }), DEFAULT_API);
});

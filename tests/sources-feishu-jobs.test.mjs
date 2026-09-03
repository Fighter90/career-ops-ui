/**
 * Feishu Jobs source — ported from parent career-ops v1.31.0.
 *
 * Two things decide this source's design and are pinned here:
 *   - only two host shapes are accepted, and the suffix test carries a leading
 *     dot, so `jobs.feishu.cn.evil.test` cannot pass as a tenant;
 *   - the two shapes use DIFFERENT job-page paths, so a single URL template
 *     would silently produce dead links for one of them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, resolveFeishuOrigin, buildFeishuUrl, parseFeishuJobsResponse, fetchFeishuJobs,
} from '../server/lib/sources/feishu-jobs.mjs';
import { feishuJobsAdapter } from '../server/lib/portals/adapters/feishu-jobs.mjs';

const envelope = (posts, count) => ({ code: 0, data: { count: count ?? posts.length, job_post_list: posts } });
const jsonFetch = (body) => async () => ({
  ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => body,
});

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'feishu-jobs', label: 'Feishu Jobs', region: 'en' });
});

test('only the two real host shapes resolve', () => {
  assert.equal(resolveFeishuOrigin('https://jobs.bytedance.com/x'), 'https://jobs.bytedance.com');
  assert.equal(resolveFeishuOrigin('https://acme.jobs.feishu.cn/'), 'https://acme.jobs.feishu.cn');
  // The leading dot is what stops a lookalike registering as a tenant.
  assert.equal(resolveFeishuOrigin('https://jobs.feishu.cn.evil.test/'), null);
  assert.equal(resolveFeishuOrigin('https://notjobs.bytedance.com/'), null);
  assert.equal(resolveFeishuOrigin('http://jobs.bytedance.com/'), null, 'HTTPS only');
  assert.equal(resolveFeishuOrigin(42), null);
});

test('an unusable careers_url fails loudly at endpoint time', () => {
  assert.throws(() => buildFeishuUrl({ careers_url: 'https://evil.test' }), /careers_url must use HTTPS/);
  assert.equal(buildFeishuUrl({ careers_url: 'https://acme.jobs.feishu.cn' }),
    'https://acme.jobs.feishu.cn/api/v1/search/job/posts');
});

test('the job-page path differs per host shape', () => {
  const post = { id: '77', title: '后端工程师', city_list: [{ name: '北京' }] };
  const [own] = parseFeishuJobsResponse(envelope([post]), 'ByteDance', 'https://jobs.bytedance.com').jobs;
  const [tenant] = parseFeishuJobsResponse(envelope([post]), 'Acme', 'https://acme.jobs.feishu.cn').jobs;
  assert.equal(own.url, 'https://jobs.bytedance.com/experienced/position/77/detail');
  assert.equal(tenant.url, 'https://acme.jobs.feishu.cn/index/position/77/detail');
});

test('category and recruit type compose the description; cities join', () => {
  const { jobs } = parseFeishuJobsResponse(envelope([{
    id: 1, title: 'PM', city_list: [{ name: '北京' }, { name: '上海' }],
    job_category: { name: '产品' }, recruit_type: { name: '社招' },
  }]), 'ByteDance', 'https://jobs.bytedance.com');
  assert.equal(jobs[0].location, '北京/上海');
  assert.equal(jobs[0].description, '类别: 产品 · 类型: 社招');
  assert.equal(jobs[0].source, 'feishu-jobs');
});

test('total is reported alongside the rows so paging can stop early', () => {
  const { jobs, total } = parseFeishuJobsResponse(envelope([{ id: 1, title: 'A' }], 250), 'X', 'https://jobs.bytedance.com');
  assert.equal(jobs.length, 1);
  assert.equal(total, 250, 'the caller stops once its pages cover this, not on an empty page');
});

test('rows without a title or an id are skipped', () => {
  const { jobs } = parseFeishuJobsResponse(
    envelope([{ id: 1 }, { title: 'no id' }, { id: 2, title: 'Keeper' }]), 'X', 'https://jobs.bytedance.com');
  assert.deepEqual(jobs.map((j) => j.title), ['Keeper']);
});

test('a malformed payload yields no rows rather than throwing', () => {
  // Unlike garena, an absent list here is indistinguishable from a genuinely
  // empty keyword search, so it is not an error — the caller's own `code !== 0`
  // check is what catches a broken endpoint.
  assert.deepEqual(parseFeishuJobsResponse({ data: {} }, 'X', 'https://jobs.bytedance.com'), { jobs: [], total: 0 });
});

test('fetchFeishuJobs sends the macOS UA and refuses redirects', async () => {
  let seen = null;
  const fake = async (url, opts) => {
    seen = opts;
    return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => envelope([{ id: 5, title: 'Dev' }]) };
  };
  const rows = await fetchFeishuJobs('https://jobs.bytedance.com/api/v1/search/job/posts',
    { fetchImpl: fake, company: { name: 'ByteDance', careers_url: 'https://jobs.bytedance.com' } });
  assert.equal(rows.length, 1);
  assert.match(seen.headers['user-agent'], /Macintosh/, 'the WAF 403s the Windows UA');
  assert.equal(seen.redirect, 'error');
});

test('a non-zero API code on the first page throws', async () => {
  const fake = jsonFetch({ code: 1001, data: {} });
  await assert.rejects(
    fetchFeishuJobs('https://jobs.bytedance.com/api/v1/search/job/posts',
      { fetchImpl: fake, company: { careers_url: 'https://jobs.bytedance.com' } }),
    /code=1001/,
  );
});

test('adapter matches the provider and both host shapes', () => {
  assert.equal(feishuJobsAdapter.matches({ provider: 'feishu-jobs' }), true);
  assert.equal(feishuJobsAdapter.matches({ careers_url: 'https://acme.jobs.feishu.cn' }), true);
  assert.equal(feishuJobsAdapter.matches({ careers_url: 'https://jobs.feishu.cn.evil.test' }), false);
});

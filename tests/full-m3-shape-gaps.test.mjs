/**
 * FULL-M3 (shape gaps) — getro / mycareersfuture / meituan / mokahr / glints
 * read a malformed 200 as an empty board, so a dead API looked like
 * «healthy, 0 jobs» in scan results and portal health. Contract (Phase 2,
 * server/lib/sources/_shape.mjs): page 1 THROWS, later pages keep the
 * partials already collected, and a legitimately empty board stays empty.
 *
 * CI-isolated: injected fetchImpl, no network, no fixtures outside this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchGetro } from '../server/lib/sources/getro.mjs';
import { fetchMyCareersFuture, API_URL as MCF_API } from '../server/lib/sources/mycareersfuture.mjs';
import { fetchMeituan, DEFAULT_API as MEITUAN_API } from '../server/lib/sources/meituan.mjs';
import { fetchMokaHr } from '../server/lib/sources/mokahr.mjs';
import { fetchGlints, DEFAULT_API as GLINTS_API } from '../server/lib/sources/glints.mjs';

// Response-like helpers: fetchJson expects `res.ok` + `res.json()`.
const ok = (payload) => async () => ({ ok: true, status: 200, json: async () => payload });
/** A fake fetchImpl handing out `ok(...)` responses in order, repeating the last one. */
const scripted = (responses) => {
  let call = 0;
  return async () => {
    const make = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return make();
  };
};

// ── getro ──────────────────────────────────────────────────────────────────

test('getro: a wrong-shape 200 THROWS (never a silent empty board)', async () => {
  for (const bad of [{}, { error: 'x' }, { results: null }, { results: {} }, { results: { jobs: 'nope' } }]) {
    await assert.rejects(
      () => fetchGetro(null, {
        fetchImpl: ok(bad),
        company: { name: 'b2v', getro_collection: 4283 },
      }),
      /Getro results\.jobs/,
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
});

test('getro: a legitimately empty page-1 array is still an empty board', async () => {
  const jobs = await fetchGetro(null, {
    fetchImpl: ok({ results: { count: 0, jobs: [] } }),
    company: { name: 'b2v', getro_collection: 4283 },
  });
  assert.deepEqual(jobs, []);
});

test('getro: a later page going wrong-shape keeps the partials (page-1-only throw)', async () => {
  const fetchImpl = scripted([
    ok({ results: { count: 40, jobs: [{ title: 'R', url: 'https://jobs.b2venture.vc/1' }] } }),
    ok({ results: null }),
  ]);
  const jobs = await fetchGetro(null, {
    fetchImpl,
    company: { name: 'b2v', getro_collection: 4283, getro_max_age_days: 0 },
  });
  assert.equal(jobs.length, 1, 'the page-1 rows survive a wrong-shape page 2');
});

// ── mycareersfuture ────────────────────────────────────────────────────────

test('mycareersfuture: a wrong-shape 200 THROWS (all keywords failing = outage)', async () => {
  for (const bad of [{}, { error: 'x' }, { results: null }, { results: 'nope' }]) {
    await assert.rejects(
      () => fetchMyCareersFuture(MCF_API, {
        fetchImpl: ok(bad),
        profileKeywords: ['software engineer'],
      }),
      /MyCareersFuture results/,
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
});

test('mycareersfuture: a legitimately empty results array is still an empty search', async () => {
  const jobs = await fetchMyCareersFuture(MCF_API, {
    fetchImpl: ok({ results: [] }),
    profileKeywords: ['software engineer'],
  });
  assert.deepEqual(jobs, []);
});

test('mycareersfuture: a later page going wrong-shape keeps the partials', async () => {
  const hit = (i) => ({
    title: `Role ${i}`,
    metadata: { jobPostId: `id-${i}`, jobDetailsUrl: `https://www.mycareersfuture.gov.sg/job/${i}` },
    hiringCompany: { name: 'Acme' },
  });
  // size is configured to 2, so a 2-row page is FULL and page 1 is fetched.
  const fetchImpl = scripted([
    ok({ results: [hit(1), hit(2)] }),
    ok({ total: 999 }),
  ]);
  const jobs = await fetchMyCareersFuture(MCF_API, {
    fetchImpl,
    company: { name: 'MCF', mycareersfuture: { keywords: ['software engineer'], size: 2 }, max_pages: 3 },
  });
  assert.equal(jobs.length, 2, 'the page-1 rows survive a wrong-shape page 2');
});

// ── meituan ────────────────────────────────────────────────────────────────

test('meituan: a wrong-shape 200 THROWS on the first response (dead API ≠ empty keyword)', async () => {
  for (const bad of [{}, { error: 'x' }, { data: { page: { totalCount: 5 } } }]) {
    await assert.rejects(
      () => fetchMeituan(MEITUAN_API, { fetchImpl: ok(bad) }),
      /Meituan data\.list/,
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
});

test('meituan: a first page with a present-but-empty data.list is not a shape failure', async () => {
  // The board answers "no matches yet" then recovers on the retry — the retry
  // path (sporadic empty pages) must stay intact.
  const post = (i) => ({ name: `Role ${i}`, jobUnionId: `u-${i}`, cityList: [{ name: '北京市' }] });
  const fetchImpl = scripted([
    ok({ data: { list: [], page: { totalCount: 1 } } }),
    ok({ data: { list: [post(1)], page: { totalCount: 1 } } }),
  ]);
  const jobs = await fetchMeituan(MEITUAN_API, { fetchImpl });
  assert.equal(jobs.length, 1);
});

// ── mokahr ─────────────────────────────────────────────────────────────────

test('mokahr: a plaintext 200 without a data.jobs array THROWS (dead API ≠ empty tenant)', async () => {
  for (const bad of [{ data: {} }, { data: { nope: 1 } }, { data: { jobs: 'nope' } }]) {
    await assert.rejects(
      () => fetchMokaHr('', {
        fetchImpl: ok(bad),
        company: { name: 'Acme', careers_url: 'https://app.mokahr.com/social-recruitment/acme/12345' },
      }),
      /MokaHR data\.jobs/,
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
});

test('mokahr: shapes that already threw keep throwing (no double-wrap drift)', async () => {
  // The `{ data, necromancer }` envelope guard fires before the array guard.
  await assert.rejects(
    () => fetchMokaHr('', {
      fetchImpl: ok({}),
      company: { name: 'Acme', careers_url: 'https://app.mokahr.com/social-recruitment/acme/12345' },
    }),
    /missing data\/necromancer/,
  );
});

test('mokahr: a legitimately empty data.jobs array is still an empty tenant', async () => {
  const jobs = await fetchMokaHr('', {
    fetchImpl: ok({ data: { jobs: [] } }),
    company: { name: 'Acme', careers_url: 'https://app.mokahr.com/social-recruitment/acme/12345' },
  });
  assert.deepEqual(jobs, []);
});

// ── glints ─────────────────────────────────────────────────────────────────

test('glints: opportunities present without a data array THROWS on page 1', async () => {
  for (const bad of [{ data: { opportunities: {} } }, { data: { opportunities: { totalCount: 5 } } }]) {
    await assert.rejects(
      () => fetchGlints(GLINTS_API, { fetchImpl: ok(bad) }),
      /Glints opportunities\.data/,
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
});

test('glints: a missing opportunities container already throws (existing guard intact)', async () => {
  await assert.rejects(
    () => fetchGlints(GLINTS_API, { fetchImpl: ok({}) }),
    /unexpected API response/,
  );
  await assert.rejects(
    () => fetchGlints(GLINTS_API, { fetchImpl: ok({ errors: [{ message: 'bad query' }] }) }),
    /unexpected API response/,
  );
});

test('glints: a legitimately empty data array is still an empty board', async () => {
  const jobs = await fetchGlints(GLINTS_API, {
    fetchImpl: ok({ data: { opportunities: { data: [], totalCount: 0 } } }),
  });
  assert.deepEqual(jobs, []);
});

test('glints: a later page going wrong-shape keeps the partials', async () => {
  const item = (i) => ({ id: i, title: `Role ${i}`, url: `https://glints.com/j/${i}` });
  const fetchImpl = scripted([
    ok({ data: { opportunities: { data: [item(1)], totalCount: 500 } } }),
    ok({ data: { opportunities: { totalCount: 500 } } }),
  ]);
  const jobs = await fetchGlints(GLINTS_API, {
    fetchImpl,
    company: { name: 'Glints', glints: { pageSize: 1, maxPages: 3 } },
  });
  assert.equal(jobs.length, 1, 'the page-1 rows survive a wrong-shape page 2');
});

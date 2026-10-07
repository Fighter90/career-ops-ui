/**
 * Workday source — CI-isolated tests for the v1.242.0 Phase-2 items:
 *   - the documented CXS envelope ({ jobPostings }) is REQUIRED: a 200 with a
 *     null or jobs-less body throws a labelled error (was: raw TypeError /
 *     silent []);
 *   - pagination: offset loop past the first 100 postings, stop on a short RAW
 *     page, bounded by a page cap, later-page failure keeps partials;
 *   - a real 404/410 throws (status intact) so the scanner's 404 quarantine is
 *     reachable — the old graceful [] made dead boards read as empty;
 *   - `date` is YYYY-MM-DD-or-empty (relative prose is not fabricable).
 *
 * Fake fetchImpl, no network. The CAPTCHA/4xx fallback semantics themselves are
 * covered by tests/workday-fallback.test.mjs (untouched).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWorkday,
  MAX_PAGES,
  MAX_DETAIL_REQUESTS,
} from '../server/lib/sources/workday.mjs';

const API = 'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/jobs';

/** A list-endpoint row. */
const row = (i, locationsText = 'Austin, TX') => ({
  title: `Role ${i}`,
  externalPath: `/job/x/R${i}`,
  locationsText,
  bulletFields: ['x', `REQ-${i}`],
  postedOn: 'Posted 3 Days Ago',
});

/** POST-transport serving one body per offset, in request order. */
function pagedTransport(pages, details = {}) {
  const posts = [];
  const detailUrls = [];
  const impl = async (url, init = {}) => {
    if ((init.method || 'GET').toUpperCase() === 'POST') {
      const offset = JSON.parse(init.body).offset;
      posts.push(offset);
      // The last page repeats when the array is exhausted (mirrors the
      // thehub fakeFetch idiom) — lets the always-full-board cap test run.
      const page = pages[Math.min(posts.length, pages.length) - 1];
      if (page && page.__status) {
        return { ok: false, status: page.__status, json: async () => ({}) };
      }
      if (page && page.__jsonThrows) {
        return { ok: true, status: 200, json: async () => { throw new Error('Unexpected token <'); } };
      }
      if (page && page.__body !== undefined) {
        return { ok: true, status: 200, json: async () => page.__body };
      }
      return { ok: true, status: 200, json: async () => ({ jobPostings: page || [] }) };
    }
    detailUrls.push(url);
    const path = new URL(url).pathname.replace(/^\/wday\/cxs\/[^/]+\/[^/]+/, '');
    const doc = details[path];
    if (!doc) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => doc };
  };
  return { impl, posts, detailUrls };
}

// ── envelope required / null guard ──────────────────────────────────────────

test('a 200 with a null body throws a labelled error (was: raw TypeError)', async () => {
  const { impl } = pagedTransport([{ __body: null }]);
  await assert.rejects(
    () => fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false }),
    (err) => {
      assert.match(err.message, /Workday/);
      assert.match(err.message, /null/);
      return true;
    },
  );
});

test('a 200 without jobPostings throws on page 1 even when strict is false', async () => {
  for (const body of [{ total: 3, jobPostings: null }, {}, { error: 'captcha' }]) {
    const { impl } = pagedTransport([{ __body: body }]);
    await assert.rejects(
      () => fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false }),
      (err) => {
        assert.match(err.message, /Workday/);
        assert.match(err.message, /jobPostings/);
        return true;
      },
      `expected a throw for body ${JSON.stringify(body)}`,
    );
  }
});

test('a valid envelope still parses (guard is shape-only, not presence-forcing)', async () => {
  const { impl } = pagedTransport([[row(1)]]);
  const jobs = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Role 1');
});

// ── pagination ──────────────────────────────────────────────────────────────

test('pagination walks offsets and stops on a short RAW page', async () => {
  const { impl, posts } = pagedTransport([
    Array.from({ length: 100 }, (_, i) => row(i)),
    Array.from({ length: 100 }, (_, i) => row(100 + i)),
    Array.from({ length: 40 }, (_, i) => row(200 + i)),
  ]);
  const jobs = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  assert.deepEqual(posts, [0, 100, 200], 'POSTs offset 0, 100, 200');
  assert.equal(jobs.length, 240);
  assert.equal(jobs.at(-1).title, 'Role 239');
});

test('pagination stops at the page cap when every page comes back full', async () => {
  const { impl, posts } = pagedTransport([
    Array.from({ length: 100 }, (_, i) => row(i)),
  ]);
  const jobs = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  assert.equal(posts.length, MAX_PAGES);
  assert.equal(jobs.length, MAX_PAGES * 100);
});

test('a later-page HTTP failure keeps the collected pages and logs', async () => {
  const { impl, posts } = pagedTransport([
    Array.from({ length: 100 }, (_, i) => row(i)),
    { __status: 503 },
  ]);
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let jobs;
  try {
    jobs = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  } finally {
    console.error = orig;
  }
  assert.equal(jobs.length, 100, 'page 1 survives a page-2 outage');
  assert.match(errs.join(' '), /workday/);
});

test('a later-page malformed body keeps the collected pages', async () => {
  const { impl } = pagedTransport([
    Array.from({ length: 100 }, (_, i) => row(i)),
    { __body: { broken: true } },
  ]);
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let jobs;
  try {
    jobs = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  } finally {
    console.error = orig;
  }
  assert.equal(jobs.length, 100);
  assert.match(errs.join(' '), /workday/);
});

test('detail-request spend carries across pages (board-wide cap)', async () => {
  const placeholders = (from, to) => Array.from({ length: to - from }, (_, i) => row(from + i, '9 Locations'));
  const details = {};
  for (let i = 0; i < MAX_DETAIL_REQUESTS + 50; i++) details[`/job/x/R${i}`] = { jobPostingInfo: { location: `City ${i}` } };
  const { impl, detailUrls } = pagedTransport(
    [placeholders(0, 150), placeholders(150, MAX_DETAIL_REQUESTS + 50)],
    details,
  );
  const jobs = await fetchWorkday(API, { fetchImpl: impl });
  assert.equal(detailUrls.length, MAX_DETAIL_REQUESTS, 'the cap bounds the whole board, not one page');
  const lastResolved = jobs[MAX_DETAIL_REQUESTS - 1].location;
  assert.match(lastResolved, /^City /);
  assert.equal(jobs.at(-1).location, '9 Locations', 'past the cap the placeholder stays visible');
});

// ── 404/410 → throw (quarantine reachable) ──────────────────────────────────

test('a 404 throws with its status (default mode) so the scanner can quarantine', async () => {
  const { impl, posts } = pagedTransport([{ __status: 404 }]);
  await assert.rejects(
    () => fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false }),
    (err) => {
      assert.equal(err.status, 404);
      return true;
    },
  );
  assert.deepEqual(posts, [0]);
});

test('a 410 throws with its status (default mode)', async () => {
  const { impl } = pagedTransport([{ __status: 410 }]);
  await assert.rejects(
    () => fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false }),
    (err) => err.status === 410,
  );
});

// ── date contract ───────────────────────────────────────────────────────────

test('relative prose postedOn emits date:"" (an absolute date comes from the detail doc)', async () => {
  const { impl } = pagedTransport([[row(1)]]);
  const jobs = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  assert.equal(jobs[0].date, '');
});

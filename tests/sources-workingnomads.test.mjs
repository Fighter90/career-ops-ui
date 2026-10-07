/**
 * Working Nomads source + adapter — CI-isolated tests (v1.242.0 Phase 2).
 *
 * Covers the sources-8 backlog items:
 *   - [M] SSRF: the feed URL is pinned to https://www.workingnomads.com in BOTH
 *     the source and the adapter (the raw fetchImpl path bypasses the shared
 *     fetchJson DNS guard, so the host assert is the only barrier).
 *   - job URLs are https:-only.
 *   - dates normalize to YYYY-MM-DD UTC.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWorkingNomads,
  assertWorkingNomadsUrl,
  FEED_URL,
} from '../server/lib/sources/workingnomads.mjs';
import { workingNomadsAdapter } from '../server/lib/portals/adapters/workingnomads.mjs';

const okJson = (data, capture) => async (url, opts) => {
  if (capture) { capture.url = url; capture.opts = opts; }
  return { ok: true, json: async () => data };
};

const FEED_ROW = {
  title: 'MLOps Engineer',
  company_name: 'Nomad Inc',
  url: 'https://www.workingnomads.com/j/1',
  location: 'Remote (Global)',
  pub_date: '2026-06-16',
};

// ── assertWorkingNomadsUrl (source-side host pin) ───────────────────────────

test('assertWorkingNomadsUrl accepts the canonical https feed', () => {
  assert.equal(assertWorkingNomadsUrl(FEED_URL), FEED_URL);
});

test('assertWorkingNomadsUrl rejects SSRF targets, other hosts, http and junk', () => {
  assert.throws(() => assertWorkingNomadsUrl('http://169.254.169.254/latest/meta-data'), /must use HTTPS/);
  assert.throws(() => assertWorkingNomadsUrl('http://www.workingnomads.com/api/exposed_jobs/'), /must use HTTPS/);
  assert.throws(() => assertWorkingNomadsUrl('https://evil.com/api/exposed_jobs/'), /untrusted hostname/);
  assert.throws(() => assertWorkingNomadsUrl('https://www.workingnomads.com.evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertWorkingNomadsUrl('https://workingnomads.com/api'), /untrusted hostname/);
  assert.throws(() => assertWorkingNomadsUrl('not a url'), /invalid URL/);
});

test('fetchWorkingNomads refuses an off-host feed before any fetch (SSRF)', async () => {
  let called = false;
  await assert.rejects(
    () => fetchWorkingNomads('http://169.254.169.254/latest/meta-data', {
      fetchImpl: async () => { called = true; return { ok: true, json: async () => [] }; },
    }),
    /must use HTTPS/,
  );
  assert.equal(called, false, 'the fetch must never go out to the pinned host');
});

test('fetchWorkingNomads still normalizes the canonical feed', async () => {
  const capture = {};
  const jobs = await fetchWorkingNomads(undefined, { fetchImpl: okJson([FEED_ROW], capture) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'MLOps Engineer');
  assert.equal(jobs[0].source, 'workingnomads');
  assert.equal(capture.url, FEED_URL);
  assert.equal(capture.opts.redirect, 'error');
});

test('fetchWorkingNomads throws on a 200 with a non-array body (Phase-2 shape rule)', async () => {
  await assert.rejects(
    () => fetchWorkingNomads(undefined, { fetchImpl: okJson({ error: 'challenge' }) }),
    /expected a JSON array/,
  );
});

// ── job URL + date normalization ────────────────────────────────────────────

test('fetchWorkingNomads drops http: job URLs (https:-only contract)', async () => {
  const jobs = await fetchWorkingNomads(undefined, {
    fetchImpl: okJson([
      FEED_ROW,
      { title: 'Insecure', company_name: 'X', url: 'http://www.workingnomads.com/j/2' },
      { title: 'Junk URL', company_name: 'X', url: 'javascript:alert(1)' },
    ]),
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'MLOps Engineer');
});

test('fetchWorkingNomads normalizes pub_date to YYYY-MM-DD UTC', async () => {
  const jobs = await fetchWorkingNomads(undefined, {
    fetchImpl: okJson([
      { ...FEED_ROW, url: 'https://www.workingnomads.com/j/a', pub_date: '2026-06-16' },
      { ...FEED_ROW, url: 'https://www.workingnomads.com/j/b', pub_date: '2026-06-16T23:30:00Z' },
      { ...FEED_ROW, url: 'https://www.workingnomads.com/j/c', pub_date: 'garbage' },
      { ...FEED_ROW, url: 'https://www.workingnomads.com/j/d', pub_date: undefined },
    ]),
  });
  assert.deepEqual(jobs.map((j) => j.date), ['2026-06-16', '2026-06-16', '', '']);
});

// ── adapter contract (the paired host pin) ──────────────────────────────────

test('adapter: matches only provider=workingnomads and pins the canonical feed', () => {
  assert.equal(workingNomadsAdapter.matches({ provider: 'workingnomads' }), true);
  assert.equal(workingNomadsAdapter.matches({ careers_url: 'https://www.workingnomads.com' }), false);
  assert.equal(workingNomadsAdapter.buildEndpoint({ provider: 'workingnomads' }), FEED_URL);
});

test('adapter: buildEndpoint honors an on-host https override, never an off-host one', () => {
  assert.equal(
    workingNomadsAdapter.buildEndpoint({ workingnomads: 'https://www.workingnomads.com/api/exposed_jobs/' }),
    'https://www.workingnomads.com/api/exposed_jobs/',
  );
  // An SSRF override must never survive buildEndpoint — it falls back to the
  // pinned canonical feed instead of being handed to fetch.
  assert.equal(workingNomadsAdapter.buildEndpoint({ api: 'http://169.254.169.254/latest/meta-data' }), FEED_URL);
  assert.equal(workingNomadsAdapter.buildEndpoint({ api: 'https://evil.com/api' }), FEED_URL);
  assert.equal(workingNomadsAdapter.fetch, fetchWorkingNomads);
});

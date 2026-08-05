/**
 * Workable source tests — v1.25.0 parity (parent commit 5ab8425, "use the
 * public widget API so large accounts are scanned").
 *
 * The source now hits the public, no-auth account *widget* API
 *   GET https://apply.workable.com/api/v1/widget/accounts/<slug>?details=true
 * which returns the account's FULL posting list in one request, instead of the
 * old offset/limit-capped v3 endpoint that silently missed jobs on large
 * accounts. The adapter still hands us the v3 URL, so the source derives the
 * <slug> and rebuilds the host-pinned widget URL.
 *
 * All tests inject a fake `fetchImpl` — CI-isolated, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWorkable,
  parseWorkableWidget,
  resolveWorkableSlug,
  meta,
} from '../server/lib/sources/workable.mjs';

// The v3 endpoint the adapter builds (locked by adapter-registry.test.mjs).
const ADAPTER_V3_URL = 'https://apply.workable.com/api/v3/accounts/optimile/jobs?details=true';
const EXPECTED_WIDGET_URL = 'https://apply.workable.com/api/v1/widget/accounts/optimile?details=true';

const okJson = (data, capture) => async (url, options) => {
  if (capture) { capture.url = url; capture.options = options; }
  return { ok: true, json: async () => data };
};

const WIDGET_PAYLOAD = {
  name: 'Optimile',
  jobs: [
    {
      title: 'Senior AI PM',
      shortcode: 'ABC123',
      shortlink: 'https://apply.workable.com/j/ABC123',
      url: 'https://apply.workable.com/j/ABC123',
      city: 'Ghent',
      country: 'Belgium',
      published_on: '2026-04-01',
      description: '<p>Own the roadmap. Visa sponsorship available.</p>',
    },
    {
      title: 'Tech Lead',
      shortcode: 'DEF456',
      shortlink: 'https://apply.workable.com/j/DEF456',
      telecommuting: true,
      published_on: '2026-03-25',
    },
    // dropped: off-domain permalink (SSRF hygiene)
    { title: 'Evil Role', shortlink: 'https://evil.example/j/X', url: 'https://evil.example/j/X' },
    // dropped: no title
    { title: '   ', shortlink: 'https://apply.workable.com/j/NOPE' },
    // dropped: duplicate of the first job's URL
    { title: 'Senior AI PM (dupe)', shortlink: 'https://apply.workable.com/j/ABC123' },
  ],
};

// ── meta is untouched ────────────────────────────────────────────────
test('workable: meta value/label unchanged', () => {
  assert.equal(meta.value, 'workable');
  assert.equal(meta.label, 'Workable');
  assert.equal(meta.region, 'en');
});

// ── endpoint switch: v3 in → widget out, host-pinned + redirect:error ──
test('workable: fetch derives the slug and calls the widget API (not v3)', async () => {
  const cap = {};
  await fetchWorkable(ADAPTER_V3_URL, { fetchImpl: okJson(WIDGET_PAYLOAD, cap) });
  assert.equal(cap.url, EXPECTED_WIDGET_URL, 'should rewrite the v3 URL to the widget endpoint');
  const u = new URL(cap.url);
  assert.equal(u.protocol, 'https:', 'widget fetch must be HTTPS');
  assert.equal(u.hostname, 'apply.workable.com', 'widget host must be pinned');
  assert.equal(cap.options?.redirect, 'error', 'must refuse server-side redirects (SSRF guard)');
});

// ── parsing / normalization ───────────────────────────────────────────
test('workable: keeps only valid, on-domain, titled, deduped jobs', async () => {
  const jobs = await fetchWorkable(ADAPTER_V3_URL, { fetchImpl: okJson(WIDGET_PAYLOAD) });
  assert.equal(jobs.length, 2, `expected 2 jobs, got ${jobs.length}: ${JSON.stringify(jobs.map((j) => j.title))}`);
  assert.deepEqual(jobs.map((j) => j.title), ['Senior AI PM', 'Tech Lead']);
});

test('workable: formats location (city, country) and Remote for telecommuting', async () => {
  const jobs = await fetchWorkable(ADAPTER_V3_URL, { fetchImpl: okJson(WIDGET_PAYLOAD) });
  assert.equal(jobs[0].location, 'Ghent, Belgium');
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[0].workplaceType, 'Onsite');
  assert.equal(jobs[1].location, 'Remote');
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
});

test('workable: maps shortcode → id, permalink → url, published_on → date', async () => {
  const jobs = await fetchWorkable(ADAPTER_V3_URL, { fetchImpl: okJson(WIDGET_PAYLOAD) });
  assert.equal(jobs[0].id, 'wk-ABC123');
  assert.equal(jobs[0].url, 'https://apply.workable.com/j/ABC123');
  assert.equal(jobs[0].date, '2026-04-01');
  assert.equal(jobs[0].source, 'workable');
  assert.equal(jobs[0].company, ''); // backfilled downstream from the tracked entry
});

test('workable: detects relocation intent from the description', async () => {
  const jobs = await fetchWorkable(ADAPTER_V3_URL, { fetchImpl: okJson(WIDGET_PAYLOAD) });
  assert.equal(jobs[0].relocates, true);  // "Visa sponsorship available"
  assert.equal(jobs[1].relocates, false);
});

test('workable: state is folded into the location when present', () => {
  const jobs = parseWorkableWidget({
    jobs: [{
      title: 'Eng', shortcode: 'S1', shortlink: 'https://apply.workable.com/j/S1',
      city: 'Austin', state: 'TX', country: 'USA',
    }],
  });
  assert.equal(jobs[0].location, 'Austin, TX, USA');
});

// ── large account: the whole point of the widget switch ────────────────
test('workable: a large account is scanned fully (no cap, single request)', async () => {
  const big = { name: 'Huge', jobs: [] };
  for (let i = 0; i < 259; i++) {
    big.jobs.push({
      title: `Role ${i}`,
      shortcode: `SC${i}`,
      shortlink: `https://apply.workable.com/j/SC${i}`,
      city: 'Remote',
    });
  }
  let calls = 0;
  const jobs = await fetchWorkable(ADAPTER_V3_URL, {
    fetchImpl: async () => { calls++; return { ok: true, json: async () => big }; },
  });
  assert.equal(jobs.length, 259, 'every posting must survive — no offset/limit cap');
  assert.equal(calls, 1, 'widget API returns the full list in a single request (no pagination loop)');
});

// ── parseWorkableWidget robustness ─────────────────────────────────────
test('workable: parseWorkableWidget tolerates null / jobs-less payloads', () => {
  assert.deepEqual(parseWorkableWidget(null), []);
  assert.deepEqual(parseWorkableWidget({}), []);
  assert.deepEqual(parseWorkableWidget({ jobs: 'nope' }), []);
});

// ── slug resolution across URL shapes ──────────────────────────────────
test('workable: resolveWorkableSlug handles every workable.com URL shape', () => {
  assert.equal(resolveWorkableSlug(ADAPTER_V3_URL), 'optimile');
  assert.equal(resolveWorkableSlug(EXPECTED_WIDGET_URL), 'optimile');
  assert.equal(resolveWorkableSlug('https://apply.workable.com/api/v3/accounts/foo-corp/jobs?details=true'), 'foo-corp');
  assert.equal(resolveWorkableSlug('https://foocorp.workable.com/careers'), 'foocorp');
  assert.equal(resolveWorkableSlug('https://apply.workable.com/optimile'), 'optimile');
});

test('workable: resolveWorkableSlug rejects off-domain / malformed / traversal', () => {
  assert.equal(resolveWorkableSlug('https://evil.example/api/v3/accounts/foo/jobs'), null);
  assert.equal(resolveWorkableSlug('not a url'), null);
  assert.equal(resolveWorkableSlug(''), null);
  assert.equal(resolveWorkableSlug('https://apply.workable.com/api/v3/accounts/..%2f..%2fetc/jobs'), null);
});

// ── dead-board contract: a total fetch failure THROWS, not [] ──────────
test('workable: non-ok HTTP throws with the status attached (dead board)', async () => {
  await assert.rejects(
    () => fetchWorkable(ADAPTER_V3_URL, {
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    }),
    (err) => {
      assert.match(err.message, /HTTP 503/);
      assert.equal(err.status, 503);
      return true;
    },
  );
});

test('workable: an unresolvable slug throws before any fetch', async () => {
  let called = false;
  await assert.rejects(
    () => fetchWorkable('https://evil.example/careers', {
      fetchImpl: async () => { called = true; return { ok: true, json: async () => ({}) }; },
    }),
    /cannot derive account slug/,
  );
  assert.equal(called, false, 'fetch must not run for a non-workable URL');
});

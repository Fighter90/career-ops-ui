/**
 * Tests for the board-wide remote-aggregator sources ported from parent
 * career-ops v1.12.0: RemoteOK, Remotive, Working Nomads.
 *
 * CI-isolated: HTTP is never hit; a fake fetchImpl is injected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRemoteOk } from '../server/lib/sources/remoteok.mjs';
import { fetchRemotive } from '../server/lib/sources/remotive.mjs';
import { fetchWorkingNomads } from '../server/lib/sources/workingnomads.mjs';
import { remoteokAdapter } from '../server/lib/portals/adapters/remoteok.mjs';
import { remotiveAdapter } from '../server/lib/portals/adapters/remotive.mjs';
import { workingNomadsAdapter } from '../server/lib/portals/adapters/workingnomads.mjs';
import { resolveAdapter, ALL_ADAPTERS } from '../server/lib/portals/registry.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });

// ───────────────────────────── RemoteOK ─────────────────────────────
const REMOTEOK_FEED = [
  { legal: 'Posts on this api …' }, // index 0 metadata — must be skipped
  { id: 101, position: 'ML Engineer', company: 'Acme', url: 'https://remoteok.com/l/101', location: 'Worldwide', date: '2026-06-18' },
  { id: 102, position: '  Data Scientist  ', company: '  BetaCo ', url: 'https://remoteok.com/l/102' },
  { position: 'No URL job' }, // invalid — no url
  { position: 'Bad url', url: 'ftp://nope' }, // invalid — non-http
];

test('fetchRemoteOk: skips metadata + invalid rows, normalizes the rest', async () => {
  const jobs = await fetchRemoteOk(undefined, { fetchImpl: okJson(REMOTEOK_FEED) });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'ML Engineer');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].url, 'https://remoteok.com/l/101');
  assert.equal(jobs[0].source, 'remoteok');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[1].title, 'Data Scientist'); // trimmed
});

test('fetchRemoteOk: ids are unique and prefixed', async () => {
  const jobs = await fetchRemoteOk(undefined, { fetchImpl: okJson(REMOTEOK_FEED) });
  for (const j of jobs) assert.match(j.id, /^remoteok-/);
  assert.equal(new Set(jobs.map((j) => j.id)).size, jobs.length);
});

test('fetchRemoteOk: throws on non-array payload', async () => {
  await assert.rejects(() => fetchRemoteOk(undefined, { fetchImpl: okJson({ nope: 1 }) }), /expected a JSON array/);
});

test('fetchRemoteOk: throws with .status on HTTP error', async () => {
  const fake = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchRemoteOk(undefined, { fetchImpl: fake }), (e) => e.status === 503);
});

// ───────────────────────────── Remotive ─────────────────────────────
const REMOTIVE_FEED = {
  jobs: [
    { id: 5, title: 'AI Engineer', company_name: 'Gamma', url: 'https://remotive.com/j/5', candidate_required_location: 'EU', publication_date: '2026-06-17' },
    { id: 6, title: 'Skip me', url: 'not-a-url' }, // invalid
  ],
};

test('fetchRemotive: parses { jobs: [...] }, drops invalid rows', async () => {
  const jobs = await fetchRemotive(undefined, { fetchImpl: okJson(REMOTIVE_FEED) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'AI Engineer');
  assert.equal(jobs[0].company, 'Gamma');
  assert.equal(jobs[0].location, 'EU');
  assert.equal(jobs[0].source, 'remotive');
});

test('fetchRemotive: throws when shape is not { jobs: [...] }', async () => {
  await assert.rejects(() => fetchRemotive(undefined, { fetchImpl: okJson([]) }), /expected \{ jobs/);
});

// ─────────────────────────── Working Nomads ─────────────────────────
const WN_FEED = [
  { title: 'MLOps Engineer', company_name: 'Nomad Inc', url: 'https://www.workingnomads.com/j/1', location: 'Remote (Global)', pub_date: '2026-06-16' },
  { title: '', url: 'https://x/2' }, // invalid — empty title
];

test('fetchWorkingNomads: normalizes array feed, drops empty-title rows', async () => {
  const jobs = await fetchWorkingNomads(undefined, { fetchImpl: okJson(WN_FEED) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'MLOps Engineer');
  assert.equal(jobs[0].company, 'Nomad Inc');
  assert.equal(jobs[0].source, 'workingnomads');
  assert.match(jobs[0].id, /^workingnomads-/);
});

// ─────────────────────────── adapter contracts ──────────────────────
test('adapters: match only on explicit provider field, never careers_url', () => {
  for (const [adapter, slug] of [
    [remoteokAdapter, 'remoteok'],
    [remotiveAdapter, 'remotive'],
    [workingNomadsAdapter, 'workingnomads'],
  ]) {
    assert.equal(adapter.matches({ provider: slug }), true);
    assert.equal(adapter.matches({ careers_url: 'https://job-boards.greenhouse.io/x' }), false);
    assert.equal(adapter.matches({}), false);
    assert.ok(/^https?:\/\//.test(adapter.buildEndpoint({ provider: slug })));
  }
});

test('adapters: api override wins over default feed url', () => {
  assert.equal(
    remoteokAdapter.buildEndpoint({ provider: 'remoteok', remoteok: 'https://mirror/api' }),
    'https://mirror/api',
  );
});

test('registry: resolveAdapter routes provider entries to the new adapters', () => {
  assert.equal(resolveAdapter({ provider: 'remoteok' }).adapter.id, 'remoteok');
  assert.equal(resolveAdapter({ provider: 'remotive' }).adapter.id, 'remotive');
  assert.equal(resolveAdapter({ provider: 'workingnomads' }).adapter.id, 'workingnomads');
});

test('registry: new adapters are registered exactly once', () => {
  for (const id of ['remoteok', 'remotive', 'workingnomads']) {
    assert.equal(ALL_ADAPTERS.filter((a) => a.id === id).length, 1, `${id} registered once`);
  }
});

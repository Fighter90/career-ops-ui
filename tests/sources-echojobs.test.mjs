/**
 * EchoJobs source — hybrid-vs-remote distinguishability (#2258).
 *
 * EchoJobs is a third-party aggregate feed. Its `normalizeEchojobsJob` used to
 * collapse a placeless remote OR hybrid posting to "Remote", which made hybrid
 * roles indistinguishable from remote ones: a `location_filter.block:["Hybrid"]`
 * rule became unmatchable and hybrid roles slipped through a remote-only filter.
 *
 * Ported from the parent career-ops fix (`providers/echojobs.mjs` #2258),
 * adapted to the web-ui rich job shape (`location` + `isRemote` + `workplaceType`):
 *   - a hybrid role with a city keeps the city and gains " · Hybrid"
 *   - a placeless hybrid role becomes a bare "Hybrid"
 *   - a placeless remote role stays "Remote"
 *   - a placeless on_site role keeps "" (only remote/hybrid are placeless-tolerant)
 *   - `remote_type` is matched case/whitespace-insensitively
 *   - the "Hybrid" marker is never doubled when the board already spells it out
 *
 * Pure normalize function → no network, CI-isolated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEchojobsJob } from '../server/lib/sources/echojobs.mjs';

const base = (over = {}) => ({ title: 'X', url: 'https://jobs.lever.co/x/1', ...over });

test('echojobs #2258: a hybrid role that lists a city keeps the city and gains the marker', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/4', locations: ['Berlin'], remote_type: 'hybrid' }));
  assert.equal(n.location, 'Berlin · Hybrid'); // block:["Hybrid"] is no longer half-working
  assert.equal(n.isRemote, true);
  assert.equal(n.workplaceType, 'Hybrid');
});

test('echojobs #2258: a placeless hybrid role becomes a bare "Hybrid", not "Remote"', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/2', remote_type: 'hybrid' }));
  assert.equal(n.location, 'Hybrid'); // never collapsed into "Remote"
  assert.equal(n.isRemote, true);
  assert.equal(n.workplaceType, 'Hybrid');
});

test('echojobs #2258: a placeless remote role still falls back to "Remote"', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/1', locations: [], remote_type: 'remote' }));
  assert.equal(n.location, 'Remote');
  assert.equal(n.isRemote, true);
  assert.equal(n.workplaceType, 'Remote');
});

test('echojobs #2258: a placeless on_site role gets no location fallback at all', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/3', remote_type: 'on_site' }));
  assert.equal(n.location, ''); // no false Remote/Hybrid — "" passes the filter (don't penalize missing data)
  assert.equal(n.isRemote, false);
  assert.equal(n.workplaceType, '');
});

test('echojobs #2258: the Hybrid marker is never doubled when the board already spells it out', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/5', locations: ['Berlin (Hybrid)'], remote_type: 'hybrid' }));
  assert.equal(n.location, 'Berlin (Hybrid)');
});

test('echojobs #2258: a placed remote role is left untouched (only hybrid gets a marker)', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/6', locations: ['Berlin'], remote_type: 'remote' }));
  assert.equal(n.location, 'Berlin');
  assert.equal(n.workplaceType, 'Remote');
});

test('echojobs #2258: remote_type is matched case/whitespace-insensitively', () => {
  const n = normalizeEchojobsJob(base({ url: 'https://jobs.lever.co/x/7', locations: ['Berlin'], remote_type: ' Hybrid ' }));
  assert.equal(n.location, 'Berlin · Hybrid'); // casing/whitespace must not smuggle an unmarked hybrid through
  assert.equal(n.workplaceType, 'Hybrid');
});

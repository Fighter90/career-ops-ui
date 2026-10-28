/**
 * Lever source — location folding. Lever puts a SINGLE primary city in
 * `categories.location` and the full set on multi-location postings in
 * `categories.allLocations`; reading only the primary silently hid every other
 * eligible location from location_filter (a req open in Barcelona AND Montevideo
 * looked Barcelona-only). fetchLever now merges them, deduped.
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLever, assertLeverUrl } from '../server/lib/sources/lever.mjs';
import { buildLocationFilter } from '../server/lib/location-filter.mjs';

const fake = (jobs) => async () => ({ ok: true, status: 200, json: async () => jobs });

test('lever: folds allLocations into location, deduped, primary first', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '1', text: 'Backend Engineer',
      categories: { location: 'Barcelona', allLocations: ['Barcelona', 'Montevideo'] },
      hostedUrl: 'https://jobs.lever.co/acme/1',
    }]),
  });
  assert.equal(job.location, 'Barcelona · Montevideo'); // both, deduped, primary first
});

test('lever: allLocations only (no primary) still surfaces every location', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '2', text: 'SRE',
      categories: { allLocations: ['Berlin', 'Remote - EU'] },
      hostedUrl: 'https://jobs.lever.co/acme/2',
    }]),
  });
  assert.equal(job.location, 'Berlin · Remote - EU');
  assert.equal(job.isRemote, true); // remote detection reads the merged location
});

test('lever: primary only (no allLocations) is unchanged', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '3', text: 'PM',
      categories: { location: 'London' },
      hostedUrl: 'https://jobs.lever.co/acme/3',
    }]),
  });
  assert.equal(job.location, 'London');
});

// ---------------------------------------------------------------------------
// workplaceType = remote (upstream #6138)
// ---------------------------------------------------------------------------

// workplaceType is a TOP-LEVEL posting flag (remote | hybrid | onsite), not a
// location. categories.location is the city only, so a remote London posting
// looked onsite to a location filter that allows "Remote". Hybrid stays
// city-only: the office is still the place. A location that already says
// remote (word-bounded — "Remotely in Europe" does not count) is not doubled.
test('lever: Remote is appended when workplaceType is remote and no place already says it', async () => {
  const fake = (jobs) => async () => ({ ok: true, status: 200, json: async () => jobs });
  const rows = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([
      { id: 'r1', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r1', categories: { location: 'Oslo' }, workplaceType: 'remote' },
      { id: 'r2', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r2', categories: { location: 'Oslo' }, workplaceType: 'hybrid' },
      { id: 'r3', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r3', categories: { location: 'Remote — Europe' }, workplaceType: 'remote' },
      { id: 'r4', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r4', categories: { location: 'Bend, OR', allLocations: ['Bend, OR', 'Oslo'] }, workplaceType: 'Remote' },
      { id: 'r5', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r5', categories: { location: 'Oslo' }, workplaceType: 'onsite' },
      { id: 'r6', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r6', categories: { location: 'Oslo' }, workplaceType: '  remote  ' },
      { id: 'r7', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r7', categories: {}, workplaceType: 'remote' },
      { id: 'r8', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r8', categories: { location: 'Remotely in Europe' }, workplaceType: 'remote' },
    ]),
  });
  const locs = rows.map((r) => r.location);
  assert.deepEqual(locs, [
    'Oslo · Remote',
    'Oslo',                        // hybrid — the office is still the place
    'Remote — Europe',             // already says remote — not doubled
    'Bend, OR · Oslo · Remote',    // padded flag matched case-insensitively
    'Oslo',                        // onsite
    'Oslo · Remote',               // padded flag
    'Remote',                      // no place at all
    'Remotely in Europe · Remote', // word boundary: "Remotely" is not "remote"
  ]);
  assert.equal(rows[0].isRemote, true);
  assert.equal(rows[0].workplaceType, 'Remote');
  assert.equal(rows[1].isRemote, false);
});

// The point of the fix: ask the real consumer, not a reimplementation of it.
test('lever: the appended Remote survives a location filter that allows it and drops the city-only cell', () => {
  const allowRemote = buildLocationFilter({ allow: ['remote'] });
  assert.equal(allowRemote('London'), false, 'precondition: the city-only cell was dropped');
  assert.equal(allowRemote('London · Remote'), true, 'the marked cell passes');
});

// ---------------------------------------------------------------------------

test('assertLeverUrl: accepts the pinned API hosts over HTTPS', () => {
  assert.equal(assertLeverUrl('https://api.lever.co/v0/postings/acme'), 'https://api.lever.co/v0/postings/acme');
  assert.equal(assertLeverUrl('https://api.eu.lever.co/v0/postings/acme'), 'https://api.eu.lever.co/v0/postings/acme');
});

test('assertLeverUrl: rejects lookalikes, plain HTTP and junk', () => {
  // clever.com contains 'lever.co' — the old substring claim was the SSRF hole.
  assert.throws(() => assertLeverUrl('https://clever.com/v0/postings/x'), /untrusted hostname/);
  assert.throws(() => assertLeverUrl('https://api.lever.co.evil.com/v0/postings/x'), /untrusted hostname/);
  assert.throws(() => assertLeverUrl('https://evil.com/?q=api.lever.co'), /untrusted hostname/);
  assert.throws(() => assertLeverUrl('http://api.lever.co/v0/postings/x'), /must use HTTPS/);
  assert.throws(() => assertLeverUrl('not a url'), /invalid URL/);
});

test('fetchLever: refuses an off-host api before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => [] }; };
  await assert.rejects(
    () => fetchLever('https://evil.com/v0/postings/acme', { fetchImpl }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

test('fetchLever: sends redirect:error (a 302 can never be followed off-host)', async () => {
  let seen = null;
  const fetchImpl = async (url, opts) => {
    seen = opts;
    return { ok: true, json: async () => [] };
  };
  await fetchLever('https://api.lever.co/v0/postings/acme', { fetchImpl });
  assert.equal(seen.redirect, 'error');
  assert.equal(seen.headers['User-Agent'], 'career-ops-web-ui/1.0');
});

test('fetchLever: wrong-shape 200 throws (Phase 2), never reads as an empty board', async () => {
  await assert.rejects(
    () => fetchLever('https://api.lever.co/v0/postings/acme', {
      fetchImpl: async () => ({ ok: true, json: async () => ({ error: 'not postings' }) }),
    }),
    /Lever postings: expected an array/,
  );
});

test('lever: categories.commitment never leaks into workplaceType', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '4', text: 'Full-stack Engineer',
      categories: { commitment: 'Full-time', location: 'Warsaw', team: 'Platform' },
      hostedUrl: 'https://jobs.lever.co/acme/4',
    }]),
  });
  assert.equal(job.workplaceType, 'Onsite'); // was 'Full-time'
  assert.equal(job.isRemote, false);
  assert.equal(job.snippet, 'Platform'); // team still feeds snippet
});

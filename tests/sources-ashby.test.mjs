/**
 * Ashby source tests — focus on the v1.75.0 (parent #1073) secondaryLocations
 * postal-address folding so EU-eligible roles surface for the location_filter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAshby } from '../server/lib/sources/ashby.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });

test('ashby: folds secondary region labels + postal locality/country, deduped', async () => {
  const data = {
    jobs: [{
      id: 'a1',
      title: 'ML Engineer',
      jobUrl: 'https://jobs.ashbyhq.com/foo/a1',
      location: 'Canada',
      secondaryLocations: [
        { location: 'Europe' },
        { address: { postalAddress: { addressLocality: 'Berlin', addressCountry: 'Germany' } } },
        { location: 'Europe' }, // duplicate label — should be deduped
      ],
    }],
  };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, 'Canada · Europe · Berlin · Germany');
});

test('ashby: primary-only location still works', async () => {
  const data = { jobs: [{ id: 'b1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/b1', location: 'Remote (US)' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Remote (US)');
});

test('ashby: missing location + secondaries yields empty string, not a crash', async () => {
  const data = { jobs: [{ id: 'c1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/c1' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, '');
});

test('ashby: workplaceType Remote appends "Remote" to the city location', async () => {
  const data = { jobs: [{ id: 'r1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r1', location: 'San Francisco', workplaceType: 'Remote' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'San Francisco · Remote');
  assert.equal(jobs[0].isRemote, true);
});

test('ashby: workplaceType wins over isRemote — Hybrid+isRemote is NOT labeled remote', async () => {
  const data = { jobs: [{ id: 'r2', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r2', location: 'Berlin', workplaceType: 'Hybrid', isRemote: true }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Berlin'); // no "Remote" appended
  assert.equal(jobs[0].isRemote, false);
});

test('ashby: isRemote true with no workplaceType falls back to remote', async () => {
  const data = { jobs: [{ id: 'r3', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r3', location: 'Tokyo', isRemote: true }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Tokyo · Remote');
  assert.equal(jobs[0].isRemote, true);
});

test('ashby: no duplicate "Remote" when the location already carries it', async () => {
  const data = { jobs: [{ id: 'r4', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r4', location: 'Remote (US)', workplaceType: 'Remote' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Remote (US)');
});

test('ashby: description comes from descriptionPlain (empty when absent)', async () => {
  const data = { jobs: [
    { id: 'd1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/d1', descriptionPlain: 'Build backend services in Go.' },
    { id: 'd2', title: 'Y', jobUrl: 'https://jobs.ashbyhq.com/foo/d2' },
  ] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].description, 'Build backend services in Go.');
  assert.equal(jobs[1].description, '');
});

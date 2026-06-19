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

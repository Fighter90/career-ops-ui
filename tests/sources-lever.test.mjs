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
import { fetchLever } from '../server/lib/sources/lever.mjs';

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

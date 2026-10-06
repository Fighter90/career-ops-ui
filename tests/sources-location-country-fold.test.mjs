/**
 * Parent parity (v1.239.0) — country folded into location for Ashby (primary
 * address), Breezy and Recruitee, so location_filter can match on the country.
 * Pure parsers; no network, no parent project.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let fetchAshby; let parseBreezyResponse; let parseRecruiteeResponse;
before(async () => {
  ({ fetchAshby } = await import('../server/lib/sources/ashby.mjs'));
  ({ parseBreezyResponse } = await import('../server/lib/sources/breezy.mjs'));
  ({ parseRecruiteeResponse } = await import('../server/lib/sources/recruitee.mjs'));
});

const ashby = async (job) => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ jobs: [{ id: 'x', title: 'T', jobUrl: 'https://jobs.ashbyhq.com/a/x', ...job }] }) });
  return (await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/a', { fetchImpl }))[0].location;
};

test('ashby: primary address country is folded in when location is a subdivision', async () => {
  const loc = await ashby({
    location: 'England',
    address: { postalAddress: { addressLocality: 'London', addressCountry: 'United Kingdom' } },
    secondaryLocations: [{ address: { postalAddress: { addressCountry: 'United States' } } }],
    workplaceType: 'Remote',
  });
  assert.equal(loc, 'England · London · United Kingdom · United States · Remote');
});

test('ashby: primary country not repeated when location already names it', async () => {
  const loc = await ashby({
    location: 'London, United Kingdom',
    address: { postalAddress: { addressCountry: 'United Kingdom' } },
  });
  assert.equal(loc, 'London, United Kingdom');
});

test('breezy: country.name appended to a location.name that lacks it', () => {
  const jobs = parseBreezyResponse([{
    name: 'Staff Engineer',
    url: 'https://acme.breezy.hr/p/c0de-staff',
    location: { name: 'Seattle, WA', city: 'Seattle', state: 'WA', country: { name: 'United States' }, is_remote: true },
  }], 'Acme');
  assert.equal(jobs[0].location, 'Seattle, WA, United States, Remote');
});

test('breezy: country already in name (whole word) is not repeated', () => {
  const jobs = parseBreezyResponse([{
    name: 'Eng',
    url: 'https://acme.breezy.hr/p/aa-eng',
    location: { name: 'Niger, Sokoto, NG', country: { name: 'NG' } },
  }], 'Acme');
  assert.equal(jobs[0].location, 'Niger, Sokoto, NG');
});

test('recruitee: flat location gets the country appended unless already named', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: 'A', url: 'https://acme.recruitee.com/o/a', location: 'London, England', country: 'United Kingdom' },
    { title: 'B', url: 'https://acme.recruitee.com/o/b', location: 'Berlin, Germany', country: 'Germany' },
  ] }, 'Acme');
  assert.equal(jobs[0].location, 'London, England, United Kingdom');
  assert.equal(jobs[1].location, 'Berlin, Germany');
});

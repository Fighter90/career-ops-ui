/**
 * Tests for the per-tenant ATS sources ported from parent career-ops v1.13.0:
 * BambooHR, Breezy HR, Comeet, Personio, plus the long-standing parent providers
 * Recruitee and SolidJobs (added to web-ui in v1.76.0 for full source parity).
 *
 * CI-isolated: HTTP is never hit; a fake fetchImpl is injected and `opts.company`
 * is passed explicitly the same way en-scanner does. Each block covers parse +
 * fetch + adapter detection + the SSRF host guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchBambooHR, parseBambooHRResponse, assertBambooHRUrl } from '../server/lib/sources/bamboohr.mjs';
import { fetchBreezy, parseBreezyResponse, assertBreezyUrl } from '../server/lib/sources/breezy.mjs';
import { fetchComeet, parseComeetResponse, assertComeetUrl, isComeetApiUrl, redactToken } from '../server/lib/sources/comeet.mjs';
import { fetchPersonio, parsePersonioXml, assertPersonioUrl } from '../server/lib/sources/personio.mjs';
import { fetchRecruitee, parseRecruiteeResponse, assertRecruiteeUrl } from '../server/lib/sources/recruitee.mjs';
import { fetchSolidJobs, parseSolidJobsResponse, assertSolidJobsUrl, isSolidJobsUrl } from '../server/lib/sources/solidjobs.mjs';

import { bamboohrAdapter } from '../server/lib/portals/adapters/bamboohr.mjs';
import { breezyAdapter } from '../server/lib/portals/adapters/breezy.mjs';
import { comeetAdapter } from '../server/lib/portals/adapters/comeet.mjs';
import { personioAdapter } from '../server/lib/portals/adapters/personio.mjs';
import { recruiteeAdapter } from '../server/lib/portals/adapters/recruitee.mjs';
import { solidjobsAdapter } from '../server/lib/portals/adapters/solidjobs.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });
const okText = (text) => async () => ({ ok: true, text: async () => text });

// ─────────────────────────────── BambooHR ───────────────────────────────
test('bamboohr: parse drops rows without an id and builds the careers url', () => {
  const jobs = parseBambooHRResponse({
    result: [
      { id: 42, jobOpeningName: 'ML Engineer', location: { city: 'Berlin', state: 'BE' }, isRemote: 1 },
      { id: '', jobOpeningName: 'No id' },          // dropped
      { id: 7, jobOpeningName: '' },                 // dropped (no title)
    ],
  }, 'Acme', 'https://acme.bamboohr.com');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acme.bamboohr.com/careers/42');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].source, 'bamboohr');
  assert.match(jobs[0].location, /Berlin/);
});

test('bamboohr: fetch normalizes + adapter detects host', async () => {
  const jobs = await fetchBambooHR('https://acme.bamboohr.com/careers/list', {
    fetchImpl: okJson({ result: [{ id: 1, jobOpeningName: 'SWE' }] }),
    company: { name: 'Acme' },
  });
  assert.equal(jobs[0].company, 'Acme');
  assert.ok(bamboohrAdapter.matches({ careers_url: 'https://acme.bamboohr.com/x' }));
  assert.equal(bamboohrAdapter.buildEndpoint({ careers_url: 'https://acme.bamboohr.com' }), 'https://acme.bamboohr.com/careers/list');
  assert.equal(bamboohrAdapter.matches({ careers_url: 'https://acme.example.com' }), false);
});

test('bamboohr: SSRF guard rejects an off-domain host', () => {
  assert.throws(() => assertBambooHRUrl('https://evil.com/careers/list'), /untrusted hostname/);
});

// ──────────────────────────────── Breezy ────────────────────────────────
test('breezy: parse keeps https rows, drops malformed urls, parses date', () => {
  const jobs = parseBreezyResponse([
    { name: 'Backend Dev', url: 'https://foo.breezy.hr/p/abc', location: { name: 'Remote' }, published_date: '2026-06-01T00:00:00Z' },
    { name: 'Bad', url: 'ftp://nope' },   // dropped (non-https)
    { name: 'NoUrl' },                    // dropped
  ], 'Foo');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].isRemote, true);
  assert.match(jobs[0].date, /2026-06-01/);
  assert.equal(jobs[0].source, 'breezy');
});

test('breezy: fetch + adapter detection + SSRF guard', async () => {
  const jobs = await fetchBreezy('https://foo.breezy.hr/json', {
    fetchImpl: okJson([{ name: 'X', url: 'https://foo.breezy.hr/p/1' }]),
    company: { name: 'Foo' },
  });
  assert.equal(jobs[0].company, 'Foo');
  assert.equal(breezyAdapter.buildEndpoint({ careers_url: 'https://foo.breezy.hr' }), 'https://foo.breezy.hr/json');
  assert.throws(() => assertBreezyUrl('https://evil.com/json'), /untrusted hostname/);
});

// ──────────────────────────────── Comeet ────────────────────────────────
test('comeet: isComeetApiUrl + token redaction', () => {
  assert.ok(isComeetApiUrl('https://www.comeet.co/careers-api/2.0/company/AB/positions?token=secret'));
  assert.equal(isComeetApiUrl('https://www.comeet.co/jobs/AB'), false);
  assert.match(redactToken('https://www.comeet.co/careers-api/x?token=secret'), /token=REDACTED/);
});

test('comeet: parse prefers url_active_page, drops rows without url', () => {
  const jobs = parseComeetResponse([
    { name: 'Data Eng', location: { name: 'Tel Aviv', is_remote: true }, url_active_page: 'https://acme.com/jobs/1', time_updated: '2026-05-01' },
    { name: 'NoUrl', location: { name: 'X' } }, // dropped
  ], 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acme.com/jobs/1');
  assert.equal(jobs[0].isRemote, true);
  assert.match(jobs[0].date, /2026-05-01/);
});

test('comeet: fetch + adapter detection + SSRF guard rejects wrong host/path', async () => {
  const url = 'https://www.comeet.co/careers-api/2.0/company/AB/positions?token=t';
  const jobs = await fetchComeet(url, { fetchImpl: okJson([{ name: 'Y', url_active_page: 'https://acme.com/1' }]), company: { name: 'Acme' } });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(comeetAdapter.buildEndpoint({ api: url }), url);
  assert.throws(() => assertComeetUrl('https://www.comeet.co/jobs/AB'), /untrusted or malformed/);
});

// ─────────────────────────────── Personio ───────────────────────────────
test('personio: parse XML feed, build url from numeric id, join offices', () => {
  const xml = `<workzag-jobs>
    <position><id>123</id><name>ML Engineer</name><office>Berlin</office>
      <additionalOffices><office>Munich</office></additionalOffices><createdAt>2026-04-02T00:00:00Z</createdAt></position>
    <position><id>x9</id><name>BadId</name><office>NoUrl</office></position>
  </workzag-jobs>`;
  const jobs = parsePersonioXml(xml, 'Acme', 'acme.jobs.personio.de');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acme.jobs.personio.de/job/123');
  assert.match(jobs[0].location, /Berlin, Munich/);
  assert.match(jobs[0].date, /2026-04-02/);
});

test('personio: fetch (text) + adapter detection + SSRF guard', async () => {
  const xml = '<workzag-jobs><position><id>1</id><name>SWE</name><office>Remote</office></position></workzag-jobs>';
  const jobs = await fetchPersonio('https://acme.jobs.personio.de/xml', { fetchImpl: okText(xml), company: { name: 'Acme' } });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(personioAdapter.buildEndpoint({ careers_url: 'https://acme.jobs.personio.com' }), 'https://acme.jobs.personio.com/xml');
  assert.throws(() => assertPersonioUrl('https://evil.com/xml'), /untrusted hostname/);
});

// ─────────────────────────────── Recruitee ──────────────────────────────
test('recruitee: parse offers, custom-domain url allowed, remote flag', () => {
  const jobs = parseRecruiteeResponse({
    offers: [
      { title: 'Frontend', careers_url: 'https://careers.acme.com/1', city: 'Lisbon', country: 'PT', remote: true },
      { title: 'Bad', url: 'http://nope' }, // dropped (non-https)
    ],
  }, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://careers.acme.com/1');
  assert.equal(jobs[0].isRemote, true);
});

test('recruitee: fetch + adapter detection + SSRF guard', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: okJson({ offers: [{ title: 'X', url: 'https://acme.recruitee.com/o/1' }] }),
    company: { name: 'Acme' },
  });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(recruiteeAdapter.buildEndpoint({ careers_url: 'https://acme.recruitee.com' }), 'https://acme.recruitee.com/api/offers/');
  assert.throws(() => assertRecruiteeUrl('https://evil.com/api/offers/'), /untrusted hostname/);
});

// ─────────────────────────────── SolidJobs ──────────────────────────────
test('solidjobs: isSolidJobsUrl + parse throws on bad shape', () => {
  assert.ok(isSolidJobsUrl('https://solid.jobs/public-api/offers/it'));
  assert.equal(isSolidJobsUrl('https://solid.jobs/other'), false);
  assert.throws(() => parseSolidJobsResponse({ nope: 1 }, 'X'), /unexpected API response/);
});

test('solidjobs: parse joins locations, fetch + adapter + SSRF guard', async () => {
  const parsed = parseSolidJobsResponse({ jobs: [{ title: 'Dev', url: 'https://solid.jobs/o/1', locations: ['Remote', 'EU'] }] }, 'Co');
  assert.equal(parsed[0].location, 'Remote, EU');
  assert.equal(parsed[0].isRemote, true);
  const jobs = await fetchSolidJobs('https://solid.jobs/public-api/offers/engineering', {
    fetchImpl: okJson({ jobs: [{ title: 'Y', url: 'https://solid.jobs/o/2', company: 'Acme' }] }),
    company: { name: 'Fallback' },
  });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(solidjobsAdapter.buildEndpoint({ careers_url: 'https://solid.jobs/public-api/offers/it' }), 'https://solid.jobs/public-api/offers/it');
  assert.throws(() => assertSolidJobsUrl('https://evil.com/public-api/offers/it'), /untrusted or malformed/);
});

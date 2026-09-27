/**
 * Recruitee source — #3175: the list payload embeds each offer's HTML body for
 * free, stripped to plain text as `description` so the content_filter can match.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecruiteeResponse } from '../server/lib/sources/recruitee.mjs';

test('recruitee: description is stripped from the offer HTML body', () => {
  const json = { offers: [{
    title: 'Backend Engineer',
    careers_url: 'https://careers.acme.com/o/backend-engineer',
    city: 'Berlin',
    country: 'Germany',
    description: '<p>Work with <b>Go</b> &amp; Postgres.</p>',
  }] };
  const jobs = parseRecruiteeResponse(json, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, 'Work with Go & Postgres.');
});

test('recruitee: no body → empty description, not a crash', () => {
  const json = { offers: [{ title: 'X', url: 'https://acme.recruitee.com/o/x' }] };
  const jobs = parseRecruiteeResponse(json, 'Acme');
  assert.equal(jobs[0].description, '');
});

// v1.223.0 — close the coverage gap: the v1.214.2 quoted-angle fix (a `>` inside a
// tag attribute must not leak its tail into the text) had no test THROUGH the
// recruitee path, only in html-to-text itself. This exercises it end-to-end.
test('recruitee: a quoted ">" inside a tag attribute does not leak into the description (v1.214.2 path)', () => {
  const json = { offers: [{
    title: 'Engineer',
    careers_url: 'https://careers.acme.com/o/engineer',
    description: '<p>Pay <a title="salary > 100k" href="/x">details</a> here &amp; now.</p>',
  }] };
  const jobs = parseRecruiteeResponse(json, 'Acme');
  assert.equal(jobs[0].description, 'Pay details here & now.');
});

// ── Parent parity (#4190, #4414): demo filter, multi-location, drop rules ──
const loc = (offers) => parseRecruiteeResponse({ offers }, 'X').map((j) => j.location);

test('recruitee: drops Recruitee\'s own "(Sample)" postings, case-insensitively (#4190)', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: 'Senior Marketer (Sample)', careers_url: 'https://exampleco.recruitee.com/o/sample' },
    { title: 'senior marketer (sample)', careers_url: 'https://exampleco.recruitee.com/o/lowercase' },
    { title: 'Real Backend Engineer', careers_url: 'https://exampleco.recruitee.com/o/real' },
  ] }, 'ExampleCo');
  assert.deepEqual(jobs.map((j) => j.title), ['Real Backend Engineer']);
});

test('recruitee: bare word "sample" without the parenthesised tag survives', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: 'Sample Preparation Technician', careers_url: 'https://acme.recruitee.com/o/1' },
  ] }, 'Acme');
  assert.equal(jobs.length, 1);
});

test('recruitee: a sample-only tenant parses to zero jobs', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: 'Senior Marketer (Sample)', careers_url: 'https://deadtenant.recruitee.com/o/sample' },
  ] }, 'Dead Tenant');
  assert.equal(jobs.length, 0);
});

test('recruitee: locations[] with 2+ places beats the flat location field (#4414)', () => {
  assert.deepEqual(loc([
    {
      title: 'QA', careers_url: 'https://acmecorp.recruitee.com/o/qa',
      location: 'Zürich, Zürich, Switzerland',
      locations: [
        { name: 'Zürich, Switzerland', city: 'Zürich', country: 'Switzerland' },
        { name: 'remote in Germany', city: 'remote', country: 'Germany' },
      ],
    },
    { title: 'Single', careers_url: 'https://acmecorp.recruitee.com/o/single', location: 'Remote, EMEA', locations: [{ name: 'Remote, EMEA' }] },
    { title: 'Unusable', careers_url: 'https://acmecorp.recruitee.com/o/unusable', location: 'Berlin, Germany', locations: [{ city: 'Berlin' }, { name: 42 }] },
  ]), ['Zürich, Switzerland · remote in Germany', 'Remote, EMEA', 'Berlin, Germany']);
});

test('recruitee: joined location dedupes names; all-duplicate names fall back to the flat field', () => {
  assert.deepEqual(loc([
    { title: 'Dup', careers_url: 'https://x.recruitee.com/o/dup', locations: [{ name: 'Berlin, Germany' }, { name: 'Berlin, Germany' }, { name: 'Remote' }] },
    { title: 'Dup2', careers_url: 'https://x.recruitee.com/o/dup2', location: 'Berlin, Germany (HQ office)', locations: [{ name: 'Berlin, Germany' }, { name: 'Berlin, Germany' }] },
  ]), ['Berlin, Germany · Remote', 'Berlin, Germany (HQ office)']);
});

test('recruitee: country/city appended to a name only when not already a whole word of it', () => {
  assert.deepEqual(loc([
    { title: 'A', careers_url: 'https://x.recruitee.com/o/a', locations: [{ name: 'Berlin', country: 'Germany' }, { name: 'Paris', country: 'France' }] },
    { title: 'B', careers_url: 'https://x.recruitee.com/o/b', locations: [{ name: 'Zürich, Switzerland', country: 'Switzerland' }, { name: 'remote in Germany', country: 'Germany' }] },
    { title: 'C', careers_url: 'https://x.recruitee.com/o/c', locations: [{ name: 'Building A', city: 'Berlin', country: 'Germany' }, { name: 'Building B', city: 'Paris', country: 'France' }] },
    { title: 'D', careers_url: 'https://x.recruitee.com/o/d', locations: [{ name: 'Berlin Office', city: 'Berlin', country: 'Germany' }, { name: 'Paris HQ', city: 'Paris', country: 'France' }] },
    { title: 'E', careers_url: 'https://x.recruitee.com/o/e', locations: [{ name: 'Parisian HQ', city: 'Paris', country: 'France' }, { name: 'Örebro Office', city: 'Örebro', country: 'Sweden' }] },
  ]), [
    'Berlin, Germany · Paris, France',
    'Zürich, Switzerland · remote in Germany',
    'Building A, Berlin, Germany · Building B, Paris, France',
    'Berlin Office, Germany · Paris HQ, France',
    'Parisian HQ, Paris, France · Örebro Office, Sweden',
  ]);
});

test('recruitee: top-level remote flag appended once to a joined location', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: 'A', careers_url: 'https://x.recruitee.com/o/a', remote: true, locations: [{ name: 'Berlin, Germany' }, { name: 'Paris, France' }] },
    { title: 'B', careers_url: 'https://x.recruitee.com/o/b', remote: true, locations: [{ name: 'Zürich, Switzerland' }, { name: 'remote in Germany' }] },
    { title: 'C', careers_url: 'https://x.recruitee.com/o/c', remote: false, locations: [{ name: 'Berlin, Germany' }, { name: 'Paris, France' }] },
  ] }, 'X');
  assert.deepEqual(jobs.map((j) => j.location), [
    'Berlin, Germany · Paris, France · Remote',
    'Zürich, Switzerland · remote in Germany',
    'Berlin, Germany · Paris, France',
  ]);
  assert.deepEqual(jobs.map((j) => j.isRemote), [true, true, false]);
});

test('recruitee: drops offers with no usable title (missing, blank, whitespace, non-string); trims the rest', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: '  Real Offer  ', careers_url: 'https://c.recruitee.com/o/real' },
    { careers_url: 'https://c.recruitee.com/o/no-title' },
    { title: '', careers_url: 'https://c.recruitee.com/o/blank' },
    { title: '   ', careers_url: 'https://c.recruitee.com/o/ws' },
    { title: 42, careers_url: 'https://c.recruitee.com/o/num' },
  ] }, 'C');
  assert.deepEqual(jobs.map((j) => j.title), ['Real Offer']);
});

test('recruitee: null/primitive offer entries are skipped without crashing the batch', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    null,
    { title: 'Valid Before', careers_url: 'https://x.recruitee.com/o/before' },
    undefined, 'not an object', 42,
    { title: 'Valid After', careers_url: 'https://x.recruitee.com/o/after' },
  ] }, 'X');
  assert.deepEqual(jobs.map((j) => j.title), ['Valid Before', 'Valid After']);
});

test('recruitee: careers_url and url validated independently; dropped only when both fail', () => {
  const jobs = parseRecruiteeResponse({ offers: [
    { title: 'A', careers_url: 'http://x.recruitee.com/o/insecure', url: 'https://x.recruitee.com/o/fallback' },
    { title: 'B', careers_url: 'not a url', url: 'https://x.recruitee.com/o/fallback-2' },
    { title: 'C', careers_url: 'http://x.recruitee.com/o/insecure-2', url: 'not a url either' },
    { title: 'D', careers_url: 'https://careers.hostaway.com/o/senior-backend' },
  ] }, 'X');
  assert.deepEqual(jobs.map((j) => j.url), [
    'https://x.recruitee.com/o/fallback',
    'https://x.recruitee.com/o/fallback-2',
    'https://careers.hostaway.com/o/senior-backend',
  ]);
});

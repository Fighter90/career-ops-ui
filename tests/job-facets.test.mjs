/**
 * job-facets.js — zero-token job facet derivations (ported from parent inbox.ts).
 * Loaded in a synthetic window (same pattern as cv-diagnostics.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/job-facets.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const JF = w.JobFacets;

test('seniorityFromTitle buckets titles senior→junior', () => {
  assert.equal(JF.seniorityFromTitle('Staff Engineer'), 'staff');
  assert.equal(JF.seniorityFromTitle('Senior PM'), 'senior');
  assert.equal(JF.seniorityFromTitle('Intern'), 'intern');
  assert.equal(JF.seniorityFromTitle('Engineering Manager'), 'lead');
  assert.equal(JF.seniorityFromTitle('Junior Developer'), 'junior');
});

test('seniorityFromTitle: an explicit modifier wins over a management word (precedence)', () => {
  // A senior/staff modifier must not be swallowed by "manager"/"lead" (the
  // v1.129.1 precedence fix). A bare management title stays 'lead'.
  assert.equal(JF.seniorityFromTitle('Senior Engineering Manager'), 'senior');
  assert.equal(JF.seniorityFromTitle('Staff Manager'), 'staff');
  assert.equal(JF.seniorityFromTitle('Junior Manager'), 'junior');
  assert.equal(JF.seniorityFromTitle('Engineering Manager'), 'lead');  // no modifier
  assert.equal(JF.seniorityFromTitle('Senior Staff Engineer'), 'staff'); // staff outranks senior
  assert.equal(JF.seniorityFromTitle('Principal Engineer'), 'staff');
});

test('seniorityFromTitle: generic IC role → mid, no keyword at all → null (parent default)', () => {
  // A plain IC role with no ladder word sits in the broad middle.
  assert.equal(JF.seniorityFromTitle('Software Engineer'), 'mid');
  // A title with none of the recognised words → null (untagged), mirroring parent.
  assert.equal(JF.seniorityFromTitle('Chef de Cuisine'), null);
});

test('seniorityFromTitle is null/empty-safe', () => {
  assert.equal(JF.seniorityFromTitle(''), null);
  assert.equal(JF.seniorityFromTitle(null), null);
  assert.equal(JF.seniorityFromTitle(undefined), null);
});

test('sourceFromUrl derives the source from the host', () => {
  assert.equal(JF.sourceFromUrl('https://boards.greenhouse.io/acme/jobs/123'), 'greenhouse');
  assert.equal(JF.sourceFromUrl('https://jobs.lever.co/acme/abc-def'), 'lever');
  assert.equal(JF.sourceFromUrl('https://acme.ashbyhq.com/roles/x'), 'ashby');
  assert.equal(JF.sourceFromUrl('https://acme.wd1.myworkdayjobs.com/careers'), 'workday');
});

test('sourceFromUrl anchors on the dot boundary — "notgreenhouse.com" is NOT greenhouse', () => {
  assert.equal(JF.sourceFromUrl('https://notgreenhouse.com/jobs/1'), null);
  assert.equal(JF.sourceFromUrl('https://greenhouse.io.evil.com/jobs/1'), null);
});

test('sourceFromUrl falls back to null on unknown host / bad input', () => {
  assert.equal(JF.sourceFromUrl('https://careers.some-company.com/job/1'), null);
  assert.equal(JF.sourceFromUrl('not a url'), null);
  assert.equal(JF.sourceFromUrl(''), null);
  assert.equal(JF.sourceFromUrl(null), null);
});

test('daysSince returns whole days since an ISO date', () => {
  // 10 days after 2026-01-01T00:00:00Z.
  const now = Date.parse('2026-01-11T00:00:00Z');
  assert.equal(JF.daysSince('2026-01-01', now), 10);
  // Same day → 0.
  assert.equal(JF.daysSince('2026-01-11', now), 0);
});

test('daysSince is null-safe on invalid/empty input (parent default)', () => {
  assert.equal(JF.daysSince('', Date.now()), null);
  assert.equal(JF.daysSince(null, Date.now()), null);
  assert.equal(JF.daysSince('2026-13-99', Date.now()), null); // parseable shape, invalid date
  assert.equal(JF.daysSince('not-a-date', Date.now()), null);
});

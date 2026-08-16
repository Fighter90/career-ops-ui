/**
 * v1.33.0 (WS4) — `buildLocationFilter` location semantics (#570).
 *
 * Locks the exact semantics so a future refactor can't drift from the
 * the `portals.yml::location_filter` behaviour. web-ui's
 * en-scanner / ru-scanner run in-process (don't shell out to the
 * parent's scan.mjs), so this shared module IS the contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocationFilter } from '../server/lib/location-filter.mjs';

test('no location_filter → everything passes', () => {
  const f = buildLocationFilter(null);
  assert.equal(f('Bengaluru, India'), true);
  assert.equal(f(''), true);
  assert.equal(f('Remote'), true);
  assert.equal(buildLocationFilter(undefined)('anywhere'), true);
});

test('empty/missing location → pass (don\'t penalize missing data)', () => {
  const f = buildLocationFilter({ allow: ['United States'], block: ['India'] });
  assert.equal(f(''), true);
  assert.equal(f(null), true);
  assert.equal(f(undefined), true);
});

test('block match → reject (takes precedence over allow)', () => {
  const f = buildLocationFilter({ allow: ['Remote'], block: ['India'] });
  // "Remote, India" matches BOTH — block wins.
  assert.equal(f('Remote, India'), false);
  assert.equal(f('Bengaluru, India'), false);
});

test('allow empty (after block cleared) → pass', () => {
  const f = buildLocationFilter({ block: ['India'] });
  assert.equal(f('London, UK'), true);   // not blocked, allow empty → pass
  assert.equal(f('Mumbai, India'), false); // blocked
});

test('allow non-empty → must match at least one keyword', () => {
  const f = buildLocationFilter({ allow: ['Remote', 'United States', 'Atlanta'] });
  assert.equal(f('Remote'), true);
  assert.equal(f('Atlanta, GA'), true);
  assert.equal(f('San Francisco, United States'), true);
  assert.equal(f('Berlin, Germany'), false); // no allow keyword
});

test('case-insensitive substring matching', () => {
  const f = buildLocationFilter({ allow: ['united states'], block: ['INDIA'] });
  assert.equal(f('UNITED STATES'), true);
  assert.equal(f('remote — india'), false);
});

test('malformed location_filter (non-object / non-array fields) → safe pass-all', () => {
  assert.equal(buildLocationFilter('nonsense')('x'), true);
  assert.equal(buildLocationFilter({ allow: 'notarray' })('x'), true);
  assert.equal(buildLocationFilter({ block: 42 })('x'), true);
});

test('exact parity worked-example from parent portals.example.yml', () => {
  // The commented example shipped in parent templates/portals.example.yml.
  const f = buildLocationFilter({
    allow: ['Remote', 'United States', 'USA', 'Atlanta', 'New York'],
    block: ['India', 'Bengaluru', 'United Kingdom', 'London', 'Germany'],
  });
  assert.equal(f('Remote (USA)'), true);
  assert.equal(f('New York, NY'), true);
  assert.equal(f('London, United Kingdom'), false);
  assert.equal(f('Bengaluru'), false);
  assert.equal(f('Toronto, Canada'), false); // not blocked, but not in allow
  assert.equal(f(''), true);                  // missing → pass
});

/**
 * Tests for buildContentFilter (v1.75.0 — parent v1.12.0 #974 parity).
 * Mirrors the semantics of buildLocationFilter, but on a posting's
 * description/snippet text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentFilter } from '../server/lib/location-filter.mjs';

test('no filter config → pass-all', () => {
  const ok = buildContentFilter(null);
  assert.equal(ok('anything'), true);
  assert.equal(ok(''), true);
});

test('missing/empty description always passes (no penalty for missing data)', () => {
  const ok = buildContentFilter({ positive: ['python'] });
  assert.equal(ok(''), true);
  assert.equal(ok(undefined), true);
  assert.equal(ok('   '), true);
});

test('negative match rejects', () => {
  const ok = buildContentFilter({ negative: ['clearance'] });
  assert.equal(ok('Requires security clearance'), false);
  assert.equal(ok('Remote Python role'), true);
});

test('positive non-empty requires at least one match', () => {
  const ok = buildContentFilter({ positive: ['python', 'machine learning'] });
  assert.equal(ok('We use Python daily'), true);
  assert.equal(ok('Java and C++ shop'), false);
});

test('negative takes precedence over positive', () => {
  const ok = buildContentFilter({ positive: ['python'], negative: ['on-site only'] });
  assert.equal(ok('Python role, on-site only'), false);
});

test('case-insensitive substring match', () => {
  const ok = buildContentFilter({ positive: ['MACHINE Learning'] });
  assert.equal(ok('hands-on machine learning experience'), true);
});

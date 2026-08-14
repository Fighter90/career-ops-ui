/**
 * server/lib/classify-tier.mjs — seniority-tier classifier + skip_tiers filter.
 * The scanner uses it so a portals.yml `skip_tiers:` list actually drops
 * listings (before this it was silently ignored). CI-isolated (pure).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTier, buildTierFilter } from '../server/lib/classify-tier.mjs';

test('classifyTier: obvious level words map to their tier', () => {
  assert.equal(classifyTier('Senior Backend Engineer'), 'senior');
  assert.equal(classifyTier('Staff Software Engineer'), 'senior');
  assert.equal(classifyTier('Director of Engineering'), 'senior');
  assert.equal(classifyTier('Mid-level Go Developer'), 'mid');
  assert.equal(classifyTier('Junior Data Analyst'), 'entry');
  assert.equal(classifyTier('Software Engineering Intern'), 'intern');
});

test('classifyTier: unrecognised / plain titles fall back to mid', () => {
  assert.equal(classifyTier('Software Engineer'), 'mid');
  assert.equal(classifyTier(''), 'mid');
  assert.equal(classifyTier(null), 'mid');
  assert.equal(classifyTier(42), 'mid');
});

test('classifyTier: LEFTMOST marker wins (position, not rank)', () => {
  // "Summer Intern, Director of Product" is an internship, not a directorship —
  // the senior word names the person the intern sits beside.
  assert.equal(classifyTier('Summer Intern, Director of Product'), 'intern');
  // A senior word that genuinely leads still wins.
  assert.equal(classifyTier('Senior Intern Coordinator'), 'senior');
});

test('classifyTier: guard (a) — "Associate <senior noun>" is senior, not entry', () => {
  assert.equal(classifyTier('Associate Director'), 'senior');
  assert.equal(classifyTier('Associate Creative Director'), 'senior');
  // bare "Associate" (no senior noun after) stays entry
  assert.equal(classifyTier('Associate Engineer'), 'entry');
});

test('classifyTier: guard (b) — "<intern> Program <senior noun>" runs the programme (senior)', () => {
  assert.equal(classifyTier('Intern Program Director'), 'senior');
  assert.equal(classifyTier('Graduate Scheme Lead'), 'senior');
  // "Graduate Engineer" (no program/scheme) is not intern via the compound matcher
  assert.notEqual(classifyTier('Graduate Engineer'), 'intern');
});

test('buildTierFilter: drops titles whose tier is in skip_tiers (case-insensitive)', () => {
  const keep = buildTierFilter(['intern', 'ENTRY']);
  assert.equal(keep('Senior Backend Engineer'), true);
  assert.equal(keep('Software Engineer'), true); // mid, not skipped
  assert.equal(keep('Junior Data Analyst'), false); // entry → dropped
  assert.equal(keep('Engineering Intern'), false); // intern → dropped
});

test('buildTierFilter: an empty / missing / non-array list is a pass-all no-op', () => {
  for (const v of [[], null, undefined, 'senior', 42]) {
    const keep = buildTierFilter(v);
    assert.equal(keep('Junior Analyst'), true, `skip_tiers=${JSON.stringify(v)} must keep everything`);
    assert.equal(keep('Senior Engineer'), true);
  }
});

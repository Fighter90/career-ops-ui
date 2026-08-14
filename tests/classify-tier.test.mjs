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
  // Leftmost is the LOWER rank → position beats the higher word that trails:
  // "Summer Intern, Director of Product" is an internship, not a directorship.
  assert.equal(classifyTier('Summer Intern, Director of Product'), 'intern');
  // Leftmost is the HIGHER rank → same rule, other direction: the director who
  // heads the junior-analyst team is senior, not junior.
  assert.equal(classifyTier('Director, Junior Analyst Team'), 'senior');
});

test('classifyTier: roman-numeral levels are script-agnostic (non-Latin titles)', () => {
  // Before the fix the numeral matchers required an ASCII word before the token,
  // so a non-Latin title with a level numeral silently fell back to 'mid'. These
  // would have been wrong (mid) before; the level after any-script role word now
  // classifies honestly.
  assert.equal(classifyTier('Инженер III'), 'senior'); // ru
  assert.equal(classifyTier('エンジニア I'), 'entry'); // ja
  assert.equal(classifyTier('Ingénieur IV'), 'senior'); // fr
  assert.equal(classifyTier('Ingeniero V'), 'senior'); // es
  // ASCII regression + a hyphen separator both still work.
  assert.equal(classifyTier('Engineer II'), 'mid');
  assert.equal(classifyTier('Grade-IV Specialist'), 'senior');
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

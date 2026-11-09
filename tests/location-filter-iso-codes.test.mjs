/**
 * CAR-256 (parent-sync #6616) — ISO country codes in `location_filter` lists
 * match CASE-SENSITIVELY against the original-case location.
 *
 * An entry written as two uppercase letters ("IN", "DE") is an ISO country
 * code. Lowercased like every other keyword it would substring-match the
 * plain word "in" in "Anywhere in the World" (#6605), so it is matched as a
 * whole word against the ORIGINAL case instead. Lowercase and mixed-case
 * entries keep the case-insensitive substring behavior. Each entry is judged
 * on its own spelling: ['IN', 'in'] compiles one case-sensitive code and one
 * case-insensitive word.
 *
 * Mirrors upstream tests/location-filter-iso-code-case.test.mjs (#6616),
 * adapted to web-ui's substring idiom for non-ISO entries (the parent's
 * whole-word location compiler stays a documented no-port — assertions avoid
 * locations whose words contain "in" as a substring). `strict: true` is what
 * turns off the #6553 worldwide-label pass, so the worldwide-label assertions
 * use it, exactly like the upstream suite.
 *
 * Pure module test — no CAREER_OPS_ROOT, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocationFilter } from '../server/lib/location-filter.mjs';

test('strict allow IN does not match the word "in" in a worldwide label (#6605)', () => {
  const accepts = buildLocationFilter({ allow: ['IN'], strict: true });
  assert.equal(accepts('Anywhere in the World'), false,
    '"IN" lowercased used to substring-match "in" — it must not');
  assert.equal(accepts('Remote in Europe'), false);
});

test('allow IN still matches India as a standalone code', () => {
  const accepts = buildLocationFilter({ allow: ['IN'], strict: true });
  assert.equal(accepts('Bengaluru, Karnataka, IN'), true);
  assert.equal(accepts('IN'), true);
});

test('uppercase ISO code is case-sensitive: lowercase spellings of the location do not match', () => {
  const accepts = buildLocationFilter({ allow: ['IN'], strict: true });
  assert.equal(accepts('mumbai, in'), false, 'lowercase "in" is not the ISO code');
  assert.equal(accepts('Mumbai, In'), false, 'mixed case is not the ISO code');
});

test('block IN does not reject the word "in" either', () => {
  const accepts = buildLocationFilter({ block: ['IN'] });
  assert.equal(accepts('Anywhere in the World'), true);
  assert.equal(accepts('Pune, IN'), false);
});

test('block DE is whole-word: it never matches inside "Delaware"', () => {
  const accepts = buildLocationFilter({ block: ['DE'] });
  assert.equal(accepts('Berlin, DE'), false, 'blocked as a whole word');
  assert.equal(accepts('Wilmington, Delaware'), true, '"DE" never matches inside "Delaware"');
});

test('lowercase and mixed-case entries keep the case-insensitive substring match', () => {
  for (const entry of ['in', 'In']) {
    const accepts = buildLocationFilter({ allow: [entry], strict: true });
    assert.equal(accepts('Pune, IN'), true);
    assert.equal(accepts('Anywhere in the World'), true);
  }
  const city = buildLocationFilter({ allow: ['Munich'], strict: true });
  assert.equal(city('MUNICH, DE'), true);
});

test('combined ["IN", "in"] list keeps each entry its own case rule', () => {
  const allow = buildLocationFilter({ allow: ['IN', 'in'], strict: true });
  assert.equal(allow('Remote in Europe'), true, 'the lowercase "in" entry still matches');
  assert.equal(allow('Pune, IN'), true, 'the ISO "IN" entry matches its code');
  assert.equal(allow('Munich, Germany'), false, 'neither matches an unrelated location');
  const block = buildLocationFilter({ block: ['IN', 'in'] });
  assert.equal(block('Remote in Europe'), false);
  assert.equal(block('Pune, IN'), false);
  assert.equal(block('Munich, Germany'), true);
});

test('all four tiers honor the ISO-code spelling (allow / block / always_allow / block_hard)', () => {
  const alwaysBeatsBlock = buildLocationFilter({ always_allow: ['US'], block: ['Austin'] });
  assert.equal(alwaysBeatsBlock('Austin, US'), true, 'always_allow "US" rescues a blocked city');
  assert.equal(alwaysBeatsBlock('Austin, TX'), false, 'the block still applies without the code');
  const hardBlock = buildLocationFilter({ block_hard: ['DE'], allow: ['Berlin'] });
  assert.equal(hardBlock('Berlin, DE'), false, 'block_hard ISO code rejects');
  assert.equal(hardBlock('Berlin, Germany'), true, 'without the code the city passes');
});

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

// ── Parent parity, career-ops @ 98e62de4 (#3276): opt-in `strict` ──
// web-ui's filter takes the location only (no URL hint, no block_hard tier),
// so the parent's cases are ported against that signature.
test('location_filter.strict fails closed on empty locations without changing the default', () => {
  const lenient = buildLocationFilter({ allow: ['puerto rico', 'san juan'] });
  const strict = buildLocationFilter({ allow: ['puerto rico', 'san juan'], strict: true });
  assert.equal(lenient(''), true, 'default: empty-location posting still passes');
  assert.equal(strict(''), false, 'strict: empty-location posting is rejected');
  assert.equal(strict(undefined), false);
  assert.equal(strict(null), false);
  assert.equal(strict('San Juan, PR'), true, 'strict preserves matching locations');
  assert.equal(strict('Boston, MA'), false, 'strict still rejects real out-of-region locations');
});

test('strict:true with no restricting tier is inert; block-only strict fails closed', () => {
  const strictNoTiers = buildLocationFilter({ strict: true });
  const strictBlockOnly = buildLocationFilter({ block: ['india'], strict: true });
  assert.equal(strictNoTiers(''), true);
  assert.equal(strictNoTiers('Anywhere'), true);
  assert.equal(strictBlockOnly(''), false, 'block-only strict cannot confirm an empty location is safe');
  assert.equal(strictBlockOnly('Berlin, Germany'), true);
});

test('strict must be literally true — a truthy string does not opt in', () => {
  assert.equal(buildLocationFilter({ allow: ['remote'], strict: 'yes' })(''), true);
});

// ── v1.248.1 (CAR-60) — the parent's always_allow / block_hard tiers ────────
// Parent semantics (scan.mjs #652/#4549): block_hard match → reject (the only
// tier always_allow cannot override); always_allow match → pass (takes
// precedence over block); block match → reject; allow empty → pass; allow
// non-empty → ≥ 1 keyword.

test('location_filter: always_allow beats block (the workable merged-cell case)', () => {
  const f = buildLocationFilter({
    block: ['romania', 'poland', 'croatia'],
    always_allow: ['united kingdom'],
  });
  assert.equal(f('London, United Kingdom · Romania · Poland · Croatia'), true,
    'the home region (UK) is an option — the blocked countries in the same cell do not sink it');
  assert.equal(f('Warsaw, Poland'), false, 'a pure blocked location still rejects');
});

test('location_filter: block_hard beats always_allow', () => {
  const f = buildLocationFilter({
    block_hard: ['russia'],
    always_allow: ['remote'],
    allow: ['remote'],
  });
  assert.equal(f('Remote (Russia)'), false, 'block_hard is the one tier always_allow cannot override');
  assert.equal(f('Remote (Berlin)'), true, 'always_allow passes everything else');
});

test('location_filter: empty always_allow is inert', () => {
  const f = buildLocationFilter({ block: ['india'], always_allow: [] });
  assert.equal(f('Berlin'), true);
  assert.equal(f('India'), false, 'block still works when always_allow is absent/empty');
});

test('location_filter: strict counts block_hard as a restricting tier', () => {
  const f = buildLocationFilter({ block_hard: ['russia'], always_allow: ['remote'], strict: true });
  assert.equal(f(''), false, 'a restricting tier is configured → an empty location rejects under strict');
  assert.equal(f('Remote'), true);
});

test('location_filter: always_allow alone (no block) passes everything', () => {
  const f = buildLocationFilter({ always_allow: ['united kingdom'] });
  assert.equal(f('Tokyo, Japan'), true, 'no block tier → nothing to override');
});

// ── #6413 / parent #6553 — worldwide labels in country-only filters ─────────
// A `location_filter` written entirely in country terms ("United States", "DE",
// "U.K.") used to reject every posting whose location is exactly "Worldwide" /
// "Anywhere in the World" / "Remote (worldwide)" — a KNOWN worldwide-eligible
// role misread as missing location data. Parent fix: when BOTH allow-lists
// contain only exact country names/aliases/ISO tokens and the config is not
// strict, the exact worldwide labels pass — but block/block_hard still win and
// qualified labels ("Worldwide except Canada") never do.

import { isCountryKeyword } from '../server/lib/sources/_country.mjs';

const WORLDWIDE_LABELS = ['Worldwide', 'Anywhere in the World', 'Remote (worldwide)'];
const COUNTRY_ONLY_FILTER = {
  always_allow: ['United States', 'USA'],
  allow: ['United States', 'USA'],
};

test('worldwide: country-only lists accept the exact label case-insensitively (non-strict)', () => {
  for (const label of WORLDWIDE_LABELS) {
    for (const strict of [undefined, false]) {
      const accepts = buildLocationFilter({ ...COUNTRY_ONLY_FILTER, strict });
      assert.equal(accepts(label), true, `${label} strict=${strict}`);
      assert.equal(accepts(`  ${label.toUpperCase()}  `), true, `${label} padded strict=${strict}`);
    }
  }
});

test('worldwide: explicit block and block_hard still win over the label', () => {
  for (const label of WORLDWIDE_LABELS) {
    for (const tier of ['block', 'block_hard']) {
      const f = buildLocationFilter({ ...COUNTRY_ONLY_FILTER, [tier]: [label] });
      assert.equal(f(label), false, `${tier} rejects ${label}`);
    }
  }
});

test('worldwide: admission recognizes shared country names, aliases and ISO codes', () => {
  for (const country of ['Bangladesh', 'Canada', 'United Kingdom', 'U.K.', 'United States of America', 'DE', 'DEU', 'IN', 'Puerto Rico', 'PRI', 'Kosovo', 'XK']) {
    const accepts = buildLocationFilter({ allow: [country] });
    assert.equal(accepts('Worldwide'), true, country);
  }
});

test('worldwide: labels do not broaden city-only or mixed city/country allow-lists', () => {
  for (const config of [
    { allow: ['New York'] },
    { allow: ['United States', 'New York'] },
    { always_allow: ['United States'], allow: ['United States', 'New York'] },
    { always_allow: ['New York'], allow: ['United States'] },
  ]) {
    const accepts = buildLocationFilter(config);
    for (const label of WORLDWIDE_LABELS) {
      assert.equal(accepts(label), false, `${JSON.stringify(config)} vs ${label}`);
    }
  }
  for (const allow of [['Europe'], ['EU'], ['United States or Canada']]) {
    assert.equal(buildLocationFilter({ allow })('Worldwide'), false, JSON.stringify(allow));
  }
});

test('worldwide: QO allow-list does not admit Worldwide (pseudo-regions are not countries)', () => {
  const accepts = buildLocationFilter({ allow: ['QO'] });
  assert.equal(accepts('Worldwide'), false);
  assert.equal(accepts('QO'), true, 'explicit region keyword still matches');
});

test('worldwide: country keywords exclude CLDR subdivisions, aggregates and pseudo-regions', () => {
  for (const [code, name] of [
    ['AC', 'Ascension Island'], ['CP', 'Clipperton Island'], ['CQ', 'Sark'],
    ['DG', 'Diego Garcia'], ['EA', 'Ceuta & Melilla'], ['IC', 'Canary Islands'],
    ['TA', 'Tristan da Cunha'], ['QO', 'Outlying Oceania'],
    ['XA', 'Pseudo-Accents'], ['XB', 'Pseudo-Bidi'],
    ['EU', 'European Union'], ['EZ', 'Eurozone'], ['UN', 'United Nations'],
    ['ZZ', 'Unknown Region'],
  ]) {
    assert.equal(isCountryKeyword(code), false, code);
    assert.equal(isCountryKeyword(name), false, name);
  }
});

test('worldwide: unrecognized or qualified labels do not acquire worldwide eligibility', () => {
  const accepts = buildLocationFilter(COUNTRY_ONLY_FILTER);
  for (const location of [
    'Remote', 'Unknown', 'Anywhere', 'Global', 'Canada',
    'Not worldwide', 'Worldwide except Canada', 'Worldwide (US only)',
    'Worldwide, Europe', 'Remote (worldwide) - US only',
    'Anywhere  in the World', 'Worldwide - extra',
  ]) {
    assert.equal(accepts(location), false, location);
  }
});

test('worldwide: unknown locations and strict mode keep their existing behavior', () => {
  for (const strict of [false, true]) {
    const accepts = buildLocationFilter({ ...COUNTRY_ONLY_FILTER, strict });
    for (const location of ['', '  ', undefined, null, 42, {}]) {
      assert.equal(accepts(location), !strict, `strict=${strict} location=${String(location)}`);
    }
  }
  const strict = buildLocationFilter({ ...COUNTRY_ONLY_FILTER, strict: true });
  for (const label of WORLDWIDE_LABELS) assert.equal(strict(label), false, label);
  assert.equal(strict('United States'), true, 'strict still admits matching countries');
  assert.equal(buildLocationFilter({ strict: true, allow: ['Worldwide'] })('Worldwide'), true,
    'an explicit Worldwide allow entry still works');
  assert.equal(buildLocationFilter({ strict: true })('Worldwide'), true, 'strict alone stays inert');
});

test('worldwide: block substring inside the label rejects it (Remote (worldwide) vs block remote)', () => {
  const f = buildLocationFilter({ ...COUNTRY_ONLY_FILTER, block: ['remote'] });
  assert.equal(f('Remote (worldwide)'), false, 'web-ui matches block by substring, unchanged');
});

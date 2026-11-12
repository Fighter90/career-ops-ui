/**
 * The shared country half of `server/lib/sources/_country.mjs` — the part
 * web-ui actually mirrors from the parent's `providers/_country.mjs`:
 * `countryName` / `countryNameFromIso` (ISO code → English name) and the
 * exact `isCountryKeyword` classifier (#6553/#6413) that guards the
 * country-only worldwide-label fallback in location-filter.mjs.
 *
 * The parent's prose matcher (`countries()`) and workplace-policy gate
 * (`buildWorkplacePolicy()`) — including its USPS state-code work — are a
 * documented web-ui no-port (see the note in sources/_country.mjs and
 * location-filter.mjs): nothing here covers them because web-ui carries
 * neither function.
 *
 * Names come from Intl.DisplayNames (CLDR via Node's ICU), so tests pin only
 * the stable spellings (Germany / United States / United Kingdom / Kosovo)
 * and never the version-sensitive ones (Czechia, Türkiye).
 *
 * Pure lookups: no network, no filesystem, no parent project.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let countryName;
let countryNameFromIso;
let isCountryKeyword;

before(async () => {
  ({ countryName, countryNameFromIso, isCountryKeyword }
    = await import('../server/lib/sources/_country.mjs'));
});

test('countryName: a two-letter ISO code resolves, anything else is empty', () => {
  assert.equal(countryName('DE'), 'Germany');
  assert.equal(countryName('de'), 'Germany', 'case-insensitive');
  assert.equal(countryName('US'), 'United States');
  assert.equal(countryName('GB'), 'United Kingdom');
  assert.equal(countryName('QZ'), '', 'an unknown code comes back as its own echo — filtered by the guard');
  // CLDR resolves the user-assigned ZZ to its aggregate name; the exact-name
  // classifier (isCountryKeyword) is the layer that excludes aggregates —
  // see the COUNTRY_NAMES builder's `Unknown Region` filter.
  assert.equal(countryName('ZZ'), 'Unknown Region');
  assert.equal(countryName('DEU'), '', 'alpha-3 is not a two-letter code');
  assert.equal(countryName('D'), '');
  assert.equal(countryName(null), '');
  assert.equal(countryName(42), '');
});

test('countryNameFromIso: alpha-3 and alpha-2 both resolve', () => {
  assert.equal(countryNameFromIso('DEU'), 'Germany');
  assert.equal(countryNameFromIso('deu'), 'Germany', 'alpha-3 is case-insensitive');
  assert.equal(countryNameFromIso('USA'), 'United States');
  assert.equal(countryNameFromIso('GBR'), 'United Kingdom');
  assert.equal(countryNameFromIso('DE'), 'Germany', 'alpha-2 passes through');
  assert.equal(countryNameFromIso('XYZ'), '', 'an unassigned alpha-3 is empty');
  assert.equal(countryNameFromIso('D'), '');
  assert.equal(countryNameFromIso(undefined), '');
});

test('isCountryKeyword: exact country names, aliases and ISO codes', () => {
  assert.equal(isCountryKeyword('Germany'), true);
  assert.equal(isCountryKeyword('germany'), true, 'case-folded');
  assert.equal(isCountryKeyword('DE'), true);
  assert.equal(isCountryKeyword('DEU'), true);
  assert.equal(isCountryKeyword('United States'), true);
  assert.equal(isCountryKeyword('USA'), true);
  assert.equal(isCountryKeyword('United States of America'), true, 'an alias resolves');
  assert.equal(isCountryKeyword('U.K.'), true);
  assert.equal(isCountryKeyword('uk'), true);
  assert.equal(isCountryKeyword('England'), true);
  assert.equal(isCountryKeyword('espana'), true, 'the accent-less alias resolves');
  assert.equal(isCountryKeyword('Kosovo'), true, 'XK is in the classifier vocabulary');
});

test('isCountryKeyword: cities, regions and near-misses are not countries', () => {
  assert.equal(isCountryKeyword('London'), false);
  assert.equal(isCountryKeyword('Bavaria'), false);
  assert.equal(isCountryKeyword('European Union'), false, 'aggregates are excluded from the vocabulary');
  assert.equal(isCountryKeyword('german'), false, 'exact names only — no substring match');
  assert.equal(isCountryKeyword('Remotely anywhere'), false);
  assert.equal(isCountryKeyword(''), false);
  assert.equal(isCountryKeyword(null), false);
  assert.equal(isCountryKeyword(42), false);
});

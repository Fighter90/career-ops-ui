// HTML-entity decoder — attribute mode (CAR-263, upstream #5943/#5941 entity rounds).
//
// The default decodeEntities keeps its exact contract (strict `&…;` references,
// XML 1.0 §2.2 emittable set, case-sensitive letter names) and gains the four
// URL/whitespace names the upstream title decoder carries (`&colon;` `&sol;`
// `&Tab;` `&NewLine;`). The NEW attribute mode ({ bareNumeric: true }) reads the
// full WHATWG table (html-entity-table.mjs) the way an HTML parser reads an
// attribute value: legacy names decode with no semicolon unless an alphanumeric
// or `=` follows, the C1 numeric range maps to windows-1252, and NUL / a
// surrogate / an out-of-range reference become U+FFFD. `text: true` relaxes the
// legacy guard further (the tokenizer's data state).
//
// Ported from the parent's tests/providers/_html-entities.test.mjs additions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities } from '../server/lib/html-entities.mjs';
import { ENTITIES, LEGACY_NAMES } from '../server/lib/html-entity-table.mjs';

// ── the default mode is unchanged for its existing callers ──────────

test('default mode: rejected references keep their exact source text', () => {
  assert.equal(decodeEntities('&#0;&#xD800;&#x110000;&#xFFFF;'), '&#0;&#xD800;&#x110000;&#xFFFF;');
  assert.equal(decodeEntities('&#1;x'), '&#1;x', 'a C0 control reference stays as written');
  assert.equal(decodeEntities('https&#58//x'), 'https&#58//x', 'no semicolon → no decode');
});

test('default mode: the XML five + nbsp fall back case-insensitively, letters stay case-sensitive', () => {
  assert.equal(decodeEntities('R&AMP;D &Amp;'), 'R&D &');
  assert.equal(decodeEntities('&Eacute;quipe'), 'Équipe');
});

// ── the default mode gains the URL/whitespace names (дополнить) ─────

test('default mode decodes &colon; and &sol; (URL punctuation)', () => {
  assert.equal(decodeEntities('https&colon;&sol;&sol;x'), 'https://x');
});

test('default mode decodes &Tab; and &NewLine;', () => {
  assert.equal(decodeEntities('a&Tab;b&NewLine;c'), 'a\tb\nc');
});

// ── attribute mode: bare numeric references ─────────────────────────

test('attribute mode decodes a decimal/hex reference without a semicolon', () => {
  assert.equal(decodeEntities('https&#58//x', { bareNumeric: true }), 'https://x');
  assert.equal(decodeEntities('a&#x3a//x', { bareNumeric: true }), 'a://x');
});

test('attribute mode still decodes semicolon-terminated references', () => {
  assert.equal(decodeEntities('&#106;s &amp;', { bareNumeric: true }), 'js &');
});

// ── attribute mode: legacy names without a semicolon ────────────────

test('attribute mode decodes a legacy name before other punctuation', () => {
  assert.equal(decodeEntities('&amp#58', { bareNumeric: true }), '&#58');
});

test('attribute mode leaves a legacy name alone before an alphanumeric or =', () => {
  assert.equal(decodeEntities('&ampx &amp=1', { bareNumeric: true }), '&ampx &amp=1');
});

test('attribute mode leaves a semicolon-free name outside the legacy set alone', () => {
  assert.equal(decodeEntities('&colon&sol', { bareNumeric: true }), '&colon&sol');
  assert.equal(decodeEntities('&bsol&lpar', { bareNumeric: true }), '&bsol&lpar');
});

test('attribute mode takes the longest legacy prefix: &notin; is not &not', () => {
  assert.equal(decodeEntities('&notin; &not;', { bareNumeric: true }), '\u2209 \u00ac');
});

test('attribute mode leaves a semicolon-terminated name alone when only a legacy prefix of it is in the table', () => {
  assert.equal(decodeEntities('&notit; &ampy;', { bareNumeric: true }), '&notit; &ampy;');
});

test('attribute mode decodes a legacy name at the end of the value', () => {
  assert.equal(decodeEntities('a&amp', { bareNumeric: true }), 'a&');
});

test('attribute mode decodes a legacy name before a space', () => {
  assert.equal(decodeEntities('&copy 2024 &eacute.', { bareNumeric: true }), '\u00a9 2024 \u00e9.');
});

test('attribute mode is case-sensitive: &Bsol; and &BSOL; are not in the table', () => {
  assert.equal(decodeEntities('&Bsol;&BSOL;', { bareNumeric: true }), '&Bsol;&BSOL;');
});

test('attribute mode keeps &nbsp; as U+00A0 (the full table, not the title table)', () => {
  assert.equal(decodeEntities('&nbsp;', { bareNumeric: true }), '\u00a0');
});

// ── attribute mode: the full WHATWG table ───────────────────────────

test('attribute mode decodes table names the default table has never carried', () => {
  assert.equal(decodeEntities('&bsol;&bsol;example.com/a.png', { bareNumeric: true }), '\\\\example.com/a.png');
  assert.equal(decodeEntities('/&bsol;example.com/a.png', { bareNumeric: true }), '/\\example.com/a.png');
  assert.equal(decodeEntities('&sol;&bsol;example.com/a.png', { bareNumeric: true }), '/\\example.com/a.png');
  assert.equal(decodeEntities('url&lpar;https://x/a.png&rpar;', { bareNumeric: true }), 'url(https://x/a.png)');
  assert.equal(decodeEntities('&frac12;&sup2;&NotEqualTilde;', { bareNumeric: true }), '\u00bd\u00b2\u2242\u0338');
});

test('the default mode still leaves &bsol;/&lpar; as written (its table is the title decoder’s)', () => {
  assert.equal(decodeEntities('&bsol;&lpar;'), '&bsol;&lpar;');
});

test('the table holds the WHATWG table exactly', () => {
  assert.equal(Object.keys(ENTITIES).length, 2125, 'the spec’s 2125 semicolon names');
  assert.equal(LEGACY_NAMES.size, 106, 'the 106 legacy names');
  assert.equal([...LEGACY_NAMES].filter((n) => !Object.hasOwn(ENTITIES, n)).length, 0,
    'every legacy name is in the table');
});

test('every table name decodes to its characters in attribute mode', () => {
  let wrong = [];
  for (const [name, chars] of Object.entries(ENTITIES)) {
    if (decodeEntities(`&${name};`, { bareNumeric: true }) !== chars) wrong.push(name);
  }
  assert.deepEqual(wrong, []);
});

test('every legacy name decodes with no semicolon before a space', () => {
  let wrong = [];
  for (const name of LEGACY_NAMES) {
    if (decodeEntities(`&${name} `, { bareNumeric: true }) !== `${ENTITIES[name]} `) wrong.push(name);
  }
  assert.deepEqual(wrong, []);
});

// ── attribute mode: windows-1252 and the replacement character ──────

test('attribute mode maps the C1 numeric range to windows-1252', () => {
  assert.equal(decodeEntities('&#128;&#x9F;&#129;', { bareNumeric: true }), '\u20ac\u0178\u0081');
  assert.equal(decodeEntities('&#150;', { bareNumeric: true }), '\u2013');
});

test('attribute mode decodes a C0 control reference, as a browser does', () => {
  assert.equal(decodeEntities('&#1;x', { bareNumeric: true }), '\u0001x');
});

test('attribute mode turns NUL, a surrogate and an out-of-range reference into U+FFFD', () => {
  assert.equal(decodeEntities('&#0;&#xD800;&#x110000;', { bareNumeric: true }), '\ufffd\ufffd\ufffd');
  assert.equal(decodeEntities('&#99999999;', { bareNumeric: true }), '\ufffd');
});

// ── Object.prototype names never decode ─────────────────────────────

test('prototype names stay as written in BOTH modes', () => {
  const s = '&toString;&constructor;&valueOf;&hasOwnProperty;&__proto__;';
  assert.equal(decodeEntities(s), s);
  assert.equal(decodeEntities(s, { bareNumeric: true }), s);
});

// ── text mode: the tokenizer’s data state ───────────────────────────

test('text mode decodes a semicolon-free legacy name whatever follows it', () => {
  assert.equal(decodeEntities('&quothttps', { bareNumeric: true, text: true }), '"https');
});

test('attribute mode keeps that same input as written', () => {
  assert.equal(decodeEntities('&quothttps', { bareNumeric: true }), '&quothttps');
});

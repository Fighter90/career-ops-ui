// Shared HTML-entity decoder.
//
// Regression for the crash class the parent fixed (#2150): the bare
// `Number.isFinite(code) ? String.fromCodePoint(code) : m` guard in
// oraclecloud/gem/dassault let `String.fromCodePoint` throw a RangeError on a
// numeric entity above 0x10FFFF (e.g. `&#99999999;`), aborting the whole parse
// for one malformed/adversarial entity. The shared module restricts numeric
// refs to the XML 1.0 §2.2 Char set so fromCodePoint can never throw, and
// matches hex vs decimal separately so `&#1a2;` no longer mis-parses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodeEntities } from '../server/lib/html-entities.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'server', 'lib', 'sources');

test('does not throw on a numeric entity above 0x10FFFF (the #2150 crash payload)', () => {
  // The whole point: no RangeError. Out-of-range refs pass through untouched.
  assert.doesNotThrow(() => decodeEntities('Job &#99999999; Title'));
  assert.equal(decodeEntities('&#99999999;'), '&#99999999;');
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;'); // one past the max
});

test('decodes valid decimal and hex numeric entities', () => {
  assert.equal(decodeEntities('caf&#233;'), 'café');
  assert.equal(decodeEntities('M&#252;nchen'), 'München');
  assert.equal(decodeEntities('M&#xfc;nchen'), 'München');
  assert.equal(decodeEntities('M&#xFC;nchen'), 'München'); // uppercase hex prefix
  assert.equal(decodeEntities('&#128512;'), '\u{1F600}'); // astral plane is fine
});

test('decodes the named entities', () => {
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.equal(decodeEntities('&lt;tag&gt;'), '<tag>');
  assert.equal(decodeEntities('say &quot;hi&quot;'), 'say "hi"');
  assert.equal(decodeEntities('it&apos;s'), "it's");
  // nbsp decodes to a regular space (0x20) — parent convention; callers normalize whitespace.
  assert.equal(decodeEntities('a&nbsp;b'), 'a' + String.fromCharCode(32) + 'b');
});

test('decodes Latin-1 letter entities, CASE-SENSITIVELY', () => {
  assert.equal(decodeEntities('D&eacute;veloppeur'), 'Développeur');
  assert.equal(decodeEntities('Fran&ccedil;ais'), 'Français');
  assert.equal(decodeEntities('&szlig; &ntilde; &oslash;'), 'ß ñ ø');
  // Uppercase name → uppercase letter, not the lowercase one (a blanket
  // lowercased lookup would make every uppercase entry unreachable).
  assert.equal(decodeEntities('&Eacute;quipe'), 'Équipe');
  assert.equal(decodeEntities('&eacute; vs &Eacute;'), 'é vs É');
  // Only the XML five + nbsp fall back case-insensitively.
  assert.equal(decodeEntities('R&AMP;D'), 'R&D');
  // A letter name in a case that is not a real entity passes through.
  assert.equal(decodeEntities('&EACUTE;'), '&EACUTE;');
});

test('decodes the punctuation entities European boards emit around titles', () => {
  assert.equal(decodeEntities('Dev &ndash; Remote'), 'Dev – Remote');
  assert.equal(decodeEntities('&laquo;Role&raquo; &hellip; &euro;'), '«Role» … €');
  assert.equal(decodeEntities('it&rsquo;s a &deg; day'), 'it’s a ° day');
});

test('a named lookup never resolves to an inherited Object.prototype member', () => {
  // `Object.hasOwn` (not `NAMED_ENTITIES[body]`) — a plain-object lookup would
  // return the Object constructor for `&constructor;`, coerced into the title.
  assert.equal(decodeEntities('&constructor;'), '&constructor;');
  assert.equal(decodeEntities('&toString;'), '&toString;');
  assert.equal(decodeEntities('&hasOwnProperty;'), '&hasOwnProperty;');
});

test('a decimal entity never absorbs trailing hex letters (&#1a2; passes through)', () => {
  // Split hex/decimal alternatives: `&#1a2;` fails to match rather than
  // parsing as codepoint 1 and dropping "a2".
  assert.equal(decodeEntities('&#1a2;'), '&#1a2;');
});

test('rejects code points that are legal to construct but not to emit (XML 1.0 §2.2)', () => {
  assert.equal(decodeEntities('&#0;'), '&#0;'); // NUL
  assert.equal(decodeEntities('&#8;'), '&#8;'); // C0 backspace
  assert.equal(decodeEntities('&#xD800;'), '&#xD800;'); // lone surrogate
  assert.equal(decodeEntities('&#xFFFE;'), '&#xFFFE;'); // noncharacter
  // Tab/LF/CR are legal per §2.2 and kept.
  assert.equal(decodeEntities('a&#9;b'), 'a\tb');
});

test('unknown/unsupported entities pass through untouched', () => {
  assert.equal(decodeEntities('&frac12;'), '&frac12;');
  assert.equal(decodeEntities('50&percnt; off'), '50&percnt; off');
  assert.equal(decodeEntities('plain text'), 'plain text');
});

test('the three formerly crash-prone sources now import the shared decoder (no bare guard)', () => {
  const bare = /Number\.isFinite\(code\)\s*\?\s*String\.fromCodePoint\(code\)/;
  for (const name of ['oraclecloud', 'gem', 'dassault']) {
    const src = readFileSync(join(SRC, `${name}.mjs`), 'utf8');
    assert.match(src, /from ['"]\.\.\/html-entities\.mjs['"]/, `${name}.mjs must import the shared decoder`);
    assert.doesNotMatch(src, bare, `${name}.mjs must not keep the bare fromCodePoint guard`);
  }
});

/**
 * Tests for scan-write sanitizers (v1.75.0 — parent v1.12.0 #1098 parity).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScanScalar, normalizeScanUrl, sanitizeTsvField } from '../server/lib/scan-sanitize.mjs';

test('normalizeScanScalar: collapses control + whitespace, trims', () => {
  assert.equal(normalizeScanScalar('  Foo\tBar\nBaz  '), 'Foo Bar Baz');
  assert.equal(normalizeScanScalar('a\r\n\tb'), 'a b');
  assert.equal(normalizeScanScalar(null), '');
});

test('normalizeScanScalar: also collapses \\v \\f and U+2028/U+2029 (v1.75.1)', () => {
  // Vertical tab, form feed, and the Unicode line/paragraph separators are
  // line breaks some viewers honor \u2014 they must not survive into a TSV cell.
  assert.equal(normalizeScanScalar('a\vb\fc'), 'a b c');
  assert.equal(normalizeScanScalar('a\u2028b\u2029c'), 'a b c');
  assert.doesNotMatch(normalizeScanScalar('x\v\f\u2028\u2029y'), /[\r\n\t\v\f\u2028\u2029]/);
})

test('normalizeScanUrl: takes the first token, drops smuggled fields', () => {
  assert.equal(normalizeScanUrl('https://x/job\tEVIL\textra'), 'https://x/job');
  assert.equal(normalizeScanUrl('  https://x/job  '), 'https://x/job');
  assert.equal(normalizeScanUrl('https://x/job\nrow2'), 'https://x/job');
});

test('sanitizeTsvField: a newline in a field cannot inject a new TSV row', () => {
  // A malicious company name trying to add a fake row + columns.
  const evil = 'ACME\nhttps://evil/2\t2026-01-01\tfake';
  const cell = sanitizeTsvField(evil);
  assert.doesNotMatch(cell, /[\r\n\t]/);
  assert.equal(cell, 'ACME https://evil/2 2026-01-01 fake');
});

test('sanitizeTsvField: formula-injection prefixes are neutralized', () => {
  for (const lead of ['=', '+', '-', '@']) {
    assert.equal(sanitizeTsvField(`${lead}cmd|0`), `'${lead}cmd|0`);
  }
  assert.equal(sanitizeTsvField('Normal Title'), 'Normal Title');
});

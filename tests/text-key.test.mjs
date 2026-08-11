/**
 * Unicode-aware text key (parent career-ops normalizeTextKey, #2569 family).
 * Pure logic; CI-isolated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTextKey } from '../server/lib/text-key.mjs';

test('normalizeTextKey: folds width/punctuation/spacing to a spaceless key', () => {
  assert.equal(normalizeTextKey('Acme, Inc.'), 'acmeinc');
  assert.equal(normalizeTextKey('Acme Inc'), 'acmeinc');
  assert.equal(normalizeTextKey('  ACME—Inc.  '), 'acmeinc');
  // full-width folds to ASCII via NFKC
  assert.equal(normalizeTextKey('ＡＣＭＥ'), 'acme');
});

test('normalizeTextKey: keeps letters of any script (no ASCII erasure)', () => {
  assert.equal(normalizeTextKey('Тинькофф'), 'тинькофф');
  assert.equal(normalizeTextKey('Nestlé'), 'nestlé');
  assert.equal(normalizeTextKey('サイボウズ'), 'サイボウズ');
  // distinct non-Latin employers never collapse to the same key
  assert.notEqual(normalizeTextKey('Тинькофф'), normalizeTextKey('Яндекс'));
});

test('normalizeTextKey: separator makes a tokenizable key', () => {
  assert.equal(normalizeTextKey('Acme, Inc.', ' '), 'acme inc');
  assert.equal(normalizeTextKey('Senior / Staff  Engineer', ' '), 'senior staff engineer');
});

test('normalizeTextKey: null/undefined/empty key to "" (never "null"/"undefined")', () => {
  assert.equal(normalizeTextKey(null), '');
  assert.equal(normalizeTextKey(undefined), '');
  assert.equal(normalizeTextKey(''), '');
  assert.equal(normalizeTextKey('!!!'), ''); // all-punctuation → empty
  // the two nullish inputs must not become equal non-empty keys
  assert.equal(normalizeTextKey(null), normalizeTextKey(undefined)); // both ''
});

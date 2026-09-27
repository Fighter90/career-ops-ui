/**
 * ru-scanner title negatives fold diacritics on both sides, like the EN title
 * filter (parent parity, career-ops @ aa453bd8, #4458).
 *
 * CI-isolated: CAREER_OPS_ROOT → empty mktemp dir, module imported inside
 * before(); pure function under test, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let root; let passesNegative; let compileKeyword; let compileKeywordList; let foldAccents;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'ru-fold-'));
  process.env.CAREER_OPS_ROOT = root;
  ({ passesNegative } = await import('../server/lib/ru-scanner.mjs'));
  ({ compileKeyword, compileKeywordList, foldAccents } = await import('../server/lib/location-filter.mjs'));
});
after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(root, { recursive: true, force: true });
});

const negatives = (list) => compileKeywordList(list, (kw) => compileKeyword(foldAccents(kw)));

test('an accented negative vetoes an unaccented title, and vice versa', () => {
  assert.equal(passesNegative('ANALISTA BIOQUIMICO', negatives(['bioquímic'])), false);
  assert.equal(passesNegative('Analista Bioquímico', negatives(['bioquimic'])), false);
});

test('Cyrillic negatives still veto, including й/ё spelled either way', () => {
  assert.equal(passesNegative('Младший разработчик', negatives(['младший'])), false);
  assert.equal(passesNegative('Go-разработчик (удалёнка)', negatives(['удалёнка'])), false);
  assert.equal(passesNegative('Senior Go разработчик', negatives(['младший'])), true);
});

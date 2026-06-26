/**
 * Title-filter robustness (v1.76.0 — parent career-ops v1.13.0 parity #1102/#1187).
 *
 *  - Short all-letter acronyms match on word boundaries (no "COO" in "Coordinator").
 *  - Multi-word / non-letter keywords keep permissive substring matching.
 *  - Malformed config (null / numeric / empty entries) never crashes the build.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileKeyword, compileKeywordList, buildTitleFilter } from '../server/lib/location-filter.mjs';

test('compileKeyword: 2-3 letter acronyms match on word boundaries', () => {
  const coo = compileKeyword('coo');
  assert.equal(coo('chief operating officer (coo)'), true);
  assert.equal(coo('coordinator'), false, '"coo" must NOT match "coordinator"');
  const sdr = compileKeyword('sdr');
  assert.equal(sdr('sdr - sales'), true);
  assert.equal(sdr('sdram engineer'), false);
});

test('compileKeyword: multi-word and non-letter keywords stay substring', () => {
  assert.equal(compileKeyword('.net')('senior .net developer'), true);
  assert.equal(compileKeyword('machine learning')('lead machine learning eng'), true);
  assert.equal(compileKeyword('l&d')('head of l&d'), true);
});

test('buildTitleFilter: positive must match, negative excludes', () => {
  const ok = buildTitleFilter({ positive: ['engineer'], negative: ['intern'] });
  assert.equal(ok('Software Engineer'), true);
  assert.equal(ok('Engineer Intern'), false);
  assert.equal(ok('Designer'), false, 'no positive match → drop');
});

test('buildTitleFilter: empty positive list → everything passes (minus negatives)', () => {
  const ok = buildTitleFilter({ negative: ['manager'] });
  assert.equal(ok('Anything'), true);
  assert.equal(ok('Product Manager'), false);
});

test('buildTitleFilter: malformed config does not throw', () => {
  assert.doesNotThrow(() => buildTitleFilter({ positive: [null, 42, '', 'dev'], negative: undefined }));
  const ok = buildTitleFilter({ positive: [null, 42, '', 'dev'] });
  assert.equal(ok('Backend Dev'), true);
  assert.equal(ok('Backend Designer'), false);
});

test('buildTitleFilter: null/undefined input → pass-all', () => {
  assert.equal(buildTitleFilter(null)('whatever'), true);
  assert.equal(buildTitleFilter(undefined)('whatever'), true);
});

test('compileKeywordList: drops junk, keeps usable matchers', () => {
  const matchers = compileKeywordList([null, 7, '', 'php', 'COO']);
  assert.equal(matchers.length, 2);
  // 'COO' lowercased → 'coo' acronym, word-boundary.
  assert.equal(matchers.some((m) => m('coordinator')), false);
  assert.equal(matchers.some((m) => m('php developer')), true);
});

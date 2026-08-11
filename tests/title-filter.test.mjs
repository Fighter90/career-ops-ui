/**
 * Title-filter robustness (v1.76.0 — parent career-ops v1.13.0 parity #1102/#1187).
 *
 *  - Short all-letter acronyms match on word boundaries (no "COO" in "Coordinator").
 *  - Multi-word / non-letter keywords keep permissive substring matching.
 *  - Malformed config (null / numeric / empty entries) never crashes the build.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileKeyword, compileKeywordList, compilePositiveKeyword, buildTitleFilter } from '../server/lib/location-filter.mjs';

test('compilePositiveKeyword #2552: " + " AND-group requires every term, any order', () => {
  const m = compilePositiveKeyword('staff + platform');
  assert.equal(m('staff platform engineer'), true);
  assert.equal(m('platform staff engineer'), true); // order-independent
  assert.equal(m('staff engineer'), false);         // missing "platform"
  assert.equal(m('platform engineer'), false);       // missing "staff"
  // a plain entry (no " + ") stays a single matcher; "c++" is NOT split
  assert.equal(compilePositiveKeyword('c++')('senior c++ dev'), true);
  assert.equal(compilePositiveKeyword('golang')('golang backend'), true);
});

test('buildTitleFilter #2552: positive AND-group gates the whole title', () => {
  const keep = buildTitleFilter({ positive: ['python + ml', 'rust'] });
  assert.equal(keep('Senior Python ML Engineer'), true);   // AND-group satisfied
  assert.equal(keep('Rust Engineer'), true);               // plain OR term
  assert.equal(keep('Python Engineer'), false);            // "ml" missing → group fails, no other positive
});

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

test('compileKeywordList: trims BEFORE the length check (v1.79.0 / parent #1261)', () => {
  // A whitespace-only keyword must be dropped, not compiled into a near-universal
  // substring matcher; surrounding whitespace is trimmed off real keywords.
  const matchers = compileKeywordList(['   ', '  php  ', '\t\n']);
  assert.equal(matchers.length, 1, 'only "php" survives; the blank entries are dropped');
  assert.equal(matchers[0]('senior php developer'), true);
  assert.equal(matchers[0]('senior developer'), false);
});

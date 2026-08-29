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

// ── word: / stem: prefixes (v1.227.3) ────────────────────────────────
//
// `title_filter` defaults to case-insensitive SUBSTRING matching, so a bare
// negative `intern` also rejects "International Product Manager" and "Internal
// Tools". The parent made precision opt-in per entry (`word:` / `stem:`) rather
// than flip that default, which would break every configured install.
//
// web-ui implemented neither, so a `word:`-prefixed entry was matched as the
// literal text "word:intern" — which appears in no job title. The filter line
// became a silent no-op: the same portals.yml filtered correctly through the
// CLI and not at all here. Found against a live config that had just adopted
// `word:intern` specifically to stop "International Product Manager" being
// dropped; the prefix worked in the CLI while web-ui quietly kept every intern
// posting.

test('word: matches a whole word, not a substring', () => {
  const keep = buildTitleFilter({ positive: [], negative: ['word:intern'] });
  // Rejected — "intern" is its own word.
  for (const t of ['Intern', 'Software Intern', 'intern', 'Operations Intern (f/m/d)']) {
    assert.equal(keep(t), false, `${t} should be dropped by word:intern`);
  }
  // Kept — "intern" only appears inside a longer word. This is the whole point.
  for (const t of ['International Product Manager', 'Internal Tools Engineer', 'Internship Coordinator'.replace('Internship', 'Internally')]) {
    assert.equal(keep(t), true, `${t} should survive word:intern`);
  }
});

test('word: boundaries are Unicode-aware, not ASCII \\b', () => {
  const keep = buildTitleFilter({ positive: [], negative: ['word:lead'] });
  // A Cyrillic or accented neighbour is a word character, so these are NOT
  // boundaries — \b would have treated them as such and matched mid-word.
  assert.equal(keep('Lead Engineer'), false);
  assert.equal(keep('Team Lead'), false);
  assert.equal(keep('Leadership Program'), true, 'leadership must survive word:lead');
});

test('stem: anchors the start of a word and lets it continue', () => {
  const keep = buildTitleFilter({ positive: [], negative: ['stem:agent'] });
  assert.equal(keep('Agentforce Developer'), false, 'agentforce starts with agent');
  assert.equal(keep('Agent Manager'), false);
  assert.equal(keep('Reagents Chemist'), true, 'reagents does not START with agent');
});

test('a bare prefix is a typo and matches nothing (never everything)', () => {
  // As a negative, an empty pattern would match every title and veto the whole
  // scan from one stray colon. Dropping the single entry is the safe half.
  for (const bad of ['word:', 'stem:', 'word:   ']) {
    const keep = buildTitleFilter({ positive: [], negative: [bad] });
    assert.equal(keep('Anything At All'), true, `${JSON.stringify(bad)} must not veto everything`);
  }
  // As a positive it contributes no match, so nothing passes on its own.
  assert.equal(buildTitleFilter({ positive: ['word:'], negative: [] })('Product Manager'), false);
});

test('prefixes work on the positive side too', () => {
  const keep = buildTitleFilter({ positive: ['word:pm'], negative: [] });
  assert.equal(keep('PM, Growth'), true);
  assert.equal(keep('PMO Analyst'), false, 'pmo must not satisfy word:pm');
});

test('unprefixed keywords keep their existing matching rules', () => {
  // 2-3 letter acronyms stay boundary-anchored...
  const acr = buildTitleFilter({ positive: [], negative: ['coo'] });
  assert.equal(acr('COO'), false);
  assert.equal(acr('Coordinator'), true);
  // ...and everything else stays permissive substring.
  const sub = buildTitleFilter({ positive: [], negative: ['.net'] });
  assert.equal(sub('.NET Developer'), false);
  const plain = buildTitleFilter({ positive: [], negative: ['intern'] });
  assert.equal(plain('International Product Manager'), false,
    'a BARE intern still matches as a substring — that is the default word: exists to opt out of');
});

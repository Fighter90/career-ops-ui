/**
 * Tests for buildContentFilter (v1.75.0 — parent v1.12.0 #974 parity).
 * Mirrors the semantics of buildLocationFilter, but on a posting's
 * description/snippet text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentFilter } from '../server/lib/location-filter.mjs';

test('no filter config → pass-all', () => {
  const ok = buildContentFilter(null);
  assert.equal(ok('anything'), true);
  assert.equal(ok(''), true);
});

test('missing/empty description always passes (no penalty for missing data)', () => {
  const ok = buildContentFilter({ positive: ['python'] });
  assert.equal(ok(''), true);
  assert.equal(ok(undefined), true);
  assert.equal(ok('   '), true);
});

test('negative match rejects', () => {
  const ok = buildContentFilter({ negative: ['clearance'] });
  assert.equal(ok('Requires security clearance'), false);
  assert.equal(ok('Remote Python role'), true);
});

test('positive non-empty requires at least one match', () => {
  const ok = buildContentFilter({ positive: ['python', 'machine learning'] });
  assert.equal(ok('We use Python daily'), true);
  assert.equal(ok('Java and C++ shop'), false);
});

test('negative takes precedence over positive', () => {
  const ok = buildContentFilter({ positive: ['python'], negative: ['on-site only'] });
  assert.equal(ok('Python role, on-site only'), false);
});

test('case-insensitive substring match', () => {
  const ok = buildContentFilter({ positive: ['MACHINE Learning'] });
  assert.equal(ok('hands-on machine learning experience'), true);
});

// ── word: / stem: prefixes in content_filter (v1.227.4) ──────────────
//
// v1.227.3 taught the TITLE filter the parent's `word:` / `stem:` prefixes but
// left `content_filter` on its own raw `lower.includes(k)`, so a prefixed entry
// there was still matched as the literal text "word:java" — the same silent
// no-op, one filter over. Caught in AI review of that PR, which noticed the
// code did not cover what its own comment claimed.
//
// `content_filter` reads the job DESCRIPTION and its default has always been a
// plain substring, which is why a bare negative `java` rejects every posting
// that merely mentions "JavaScript". The prefix opts one entry out of that.

test('word: in content_filter matches a whole word', () => {
  const keep = buildContentFilter({ positive: [], negative: ['word:java'] });
  assert.equal(keep('We use Java on the backend'), false);
  assert.equal(keep('Built with JavaScript and React'), true,
    'JavaScript must survive word:java — the entire point of the prefix');
  assert.equal(keep('No languages named here'), true);
});

test('stem: in content_filter anchors the start of a word', () => {
  const keep = buildContentFilter({ positive: [], negative: ['stem:agent'] });
  assert.equal(keep('our agentic pipeline'), false);
  assert.equal(keep('reagents are stored on site'), true);
});

test('content_filter does NOT auto-anchor short keywords', () => {
  // The title filter anchors 2-3 letter acronyms because "COO" inside
  // "Coordinator" is always wrong. In a paragraph of prose a short run is
  // routinely intended ("aws", "gcp", "sql", "go"), so the substring default
  // stands here — this is a deliberate difference from compileKeyword.
  const keep = buildContentFilter({ positive: [], negative: ['go'] });
  assert.equal(keep('a good fit'), false, 'short keywords stay substring in prose');
  assert.equal(keep('we use Go'), false);
});

test('unprefixed content_filter entries are byte-for-byte unchanged', () => {
  const keep = buildContentFilter({ positive: [], negative: ['java'] });
  assert.equal(keep('Built with JavaScript'), false,
    'a BARE java still matches inside JavaScript — the default word: opts out of');
  const pos = buildContentFilter({ positive: ['python'], negative: [] });
  assert.equal(pos('We write Python daily'), true);
  assert.equal(pos('We write Ruby daily'), false);
});

test('a bare prefix in content_filter matches nothing, never everything', () => {
  const keep = buildContentFilter({ positive: [], negative: ['word:'] });
  assert.equal(keep('any description at all'), true,
    'an empty negative pattern would reject every posting');
});

test('content_filter still passes a blank description untouched', () => {
  // Providers that ship no description must never be filtered out by content.
  const keep = buildContentFilter({ positive: ['word:python'], negative: [] });
  assert.equal(keep(''), true);
  assert.equal(keep('   '), true);
  assert.equal(keep(undefined), true);
});

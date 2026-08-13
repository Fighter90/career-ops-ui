/**
 * FIX-8 (v1.166.0) — the scoring-rubric vocabulary must mirror the canonical
 * docs (career-ops.org/docs): "five scoring dimensions plus a holistic global
 * score", NOT "six-dimension". These canaries lock the English source surfaces
 * so a future edit can't reintroduce the drift. (CHANGELOG history and its site
 * mirrors are intentionally out of scope — they record past wording.)
 *
 * CI-isolated: reads repo files only; no server/network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Strip release-note banner lines (`> **🆕 Latest release …`) — like the
// CHANGELOG, they describe PAST wording (including the term being retired) and
// are out of scope for the product-description guard below.
const read = (p) =>
  readFileSync(resolve(ROOT, p), 'utf8')
    .split('\n')
    .filter((l) => !/^>\s*\*\*🆕/.test(l))
    .join('\n');
const SIX = /six[-\s]dimension|six dimensions/i;

const EN_SURFACES = [
  'README.md',
  'docs/help/en.md',
  'docs/career-ops-canonical.md',
  'site/src/i18n/en.json',
];

test('FIX-8: no English surface says "six-dimension" (mirrors the docs\' 5 + holistic)', () => {
  for (const f of EN_SURFACES) {
    assert.doesNotMatch(read(f), SIX, `${f} must not use the "six-dimension" phrasing`);
  }
});

test('FIX-8: the site methodology names five dimensions plus a global score', () => {
  const en = JSON.parse(read('site/src/i18n/en.json'));
  assert.match(en['method.dimsTitle'], /five dimensions/i, 'dimsTitle mirrors the docs');
  assert.match(
    en['method.lead'],
    /five dimensions plus a holistic global score/i,
    'method.lead uses the docs\' phrasing',
  );
});

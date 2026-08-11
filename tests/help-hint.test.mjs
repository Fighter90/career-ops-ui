/**
 * HelpHint source-static guards (v1.139.0).
 *
 * The `?` help affordance is a client lib exercised for real behaviour by the
 * Playwright suite; these node:test canaries lock the invariants that keep it
 * CSP-safe, wired, and localized so a refactor can't silently break them:
 *   - the primitive exists with icon/title/close and closes on Escape;
 *   - it renders the body through UI.md() (the escape-first XSS boundary) and
 *     binds handlers via addEventListener (no inline on* — CSP);
 *   - #/stats attaches a hint to every one of its 5 tabs;
 *   - the 8 AI/analytics views build their H1 via HelpHint.title();
 *   - every hint key referenced in code exists in the EN dictionary (the full
 *     ×17 parity is enforced separately by i18n-coverage.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('help-hint.js exposes the primitive and is CSP-safe', () => {
  const src = read('public/js/lib/help-hint.js');
  assert.match(src, /window\.HelpHint\s*=\s*\{[^}]*\bicon\b/, 'exports HelpHint.icon');
  assert.match(src, /\btitle\b/, 'exports HelpHint.title');
  assert.match(src, /\bclose\b/, 'exports HelpHint.close');
  // renders the localized body through the escape-first boundary
  assert.match(src, /UI\.md\(/, 'body rendered via UI.md()');
  // handlers via addEventListener, never inline on*=
  assert.match(src, /addEventListener\(/, 'uses addEventListener');
  assert.doesNotMatch(src, /\son\w+\s*=\s*["\x27]/, 'no inline on*= handler attributes');
  // Escape closes the popover; accessible button semantics
  assert.match(src, /['"]Escape['"]/, 'Escape closes the popover');
  assert.match(src, /aria-expanded/, 'toggles aria-expanded');
  assert.match(src, /role['"]?\s*:\s*['"]tooltip['"]/, 'popover is role=tooltip');
});

test('#/stats attaches a `?` hint to every one of the 5 tabs', () => {
  const src = read('public/js/views/stats.js');
  const hintKeys = [...src.matchAll(/hint:\s*'(stats\.hint\.[a-z]+)'/g)].map((m) => m[1]);
  assert.equal(hintKeys.length, 5, `expected 5 tab hint keys, got ${hintKeys.length}: ${hintKeys}`);
  for (const k of ['stats.hint.market', 'stats.hint.pipeline', 'stats.hint.trend', 'stats.hint.patterns', 'stats.hint.lifetime']) {
    assert.ok(hintKeys.includes(k), `missing tab hint ${k}`);
  }
  assert.match(src, /HelpHint\.icon\(/, 'stats renders the hint via HelpHint.icon');
});

test('the 8 AI/analytics views build their H1 via HelpHint.title()', () => {
  const views = {
    'career-plan': 'help.hint.careerPlan',
    orientation: 'help.hint.orientation',
    'two-pager': 'help.hint.twoPager',
    networking: 'help.hint.networking',
    'mock-interview': 'help.hint.mock',
    memory: 'help.hint.memory',
    funded: 'help.hint.funded',
    'interview-digest': 'help.hint.digest',
  };
  for (const [view, key] of Object.entries(views)) {
    const src = read(`public/js/views/${view}.js`);
    assert.match(src, new RegExp(`HelpHint\\.title\\(.*'${key.replace(/\./g, '\\.')}'`), `${view}.js must wire ${key} via HelpHint.title`);
  }
});

test('every hint key referenced in code is present in the EN dictionary', () => {
  const en = read('public/js/lib/locales/i18n-dict.en.js');
  const keys = [
    'help.hint.aria',
    'help.hint.careerPlan', 'help.hint.orientation', 'help.hint.twoPager', 'help.hint.networking',
    'help.hint.mock', 'help.hint.memory', 'help.hint.funded', 'help.hint.digest',
    'stats.hint.market', 'stats.hint.pipeline', 'stats.hint.trend', 'stats.hint.patterns', 'stats.hint.lifetime',
  ];
  for (const k of keys) {
    assert.match(en, new RegExp(`'${k.replace(/\./g, '\\.')}':\\s*"`), `EN dict missing ${k}`);
  }
});

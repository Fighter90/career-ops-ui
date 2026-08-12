/**
 * FIX-3 (v1.161.0) — a report whose score can't be parsed (even after the
 * v1.159.0 locale-aware parser) must render a legible MUTED chip on
 * `#/reports`, not empty space, so the user can tell "unparsed" from "failed".
 *
 * reports.js is browser-only (uses `c()`, `Router`, `UI`) → asserted
 * statically, the same approach as document-title-per-route/help-hint tests.
 * The ×17 i18n coverage of the new keys is enforced by i18n-coverage.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'reports.js'), 'utf8');

test('FIX-3: the score cell renders a muted chip when scoreNum is null', () => {
  // A ternary on rep.scoreNum, not a bare `&& pill` that renders nothing.
  assert.match(
    SRC,
    /rep\.scoreNum\s*!=\s*null\s*\n?\s*\?[\s\S]*?:\s*c\(/,
    'the score cell must branch to a chip on the null side, not render nothing',
  );
  // The null branch uses the neutral score-muted token (no new colour).
  assert.match(SRC, /score-pill score-muted/, 'muted chip reuses .score-muted');
  // Localized text + hint, not a hardcoded English literal in the DOM.
  assert.match(SRC, /t\(\s*'rep\.scoreUnparsed'/, 'chip label is localized');
  assert.match(SRC, /t\(\s*'rep\.scoreUnparsedHint'/, 'chip hint is localized');
});

test('FIX-3: the card stays a keyboard-operable link into the report', () => {
  // The chip is not separately focusable (would nest inside role=link); the
  // CARD is the navigation affordance — must remain role=link + Enter/Space.
  assert.match(SRC, /role:\s*'link'/, 'card is role=link');
  assert.match(SRC, /Router\.go\('\/reports\/'\s*\+\s*rep\.slug\)/, 'card opens the report');
});

test('FIX-3: rep.scoreUnparsed(+Hint) exist in all 17 locales', () => {
  const D = loadAssembledDict();
  for (const key of ['rep.scoreUnparsed', 'rep.scoreUnparsedHint']) {
    assert.ok(D[key], `${key} exists`);
    for (const lang of I18N_LANGS) {
      assert.ok(D[key][lang] && D[key][lang].trim(), `${key} present for ${lang}`);
    }
  }
});

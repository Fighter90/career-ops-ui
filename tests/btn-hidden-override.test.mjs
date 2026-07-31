/**
 * SPA-H1 — `.btn[hidden]` must actually hide the button.
 *
 * `.btn` sets `display: inline-flex` at the author level, which beats the
 * UA stylesheet's `[hidden] { display: none }` regardless of specificity
 * (CLAUDE.md hard-won lesson #1). The #/scan Stop button is toggled via
 * `stopBtn.hidden = !running` (scan.js setScanRunning) and rendered
 * permanently visible before this fix. Source guards in the style of
 * tests/design-polish-v1115.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CSS = loadAppCss();
const SCAN = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'scan.js'), 'utf8');

test('app.css carries a .btn[hidden] { display: none } override', () => {
  assert.match(CSS, /\.btn\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
});

test('the scan Stop button still relies on the hidden attribute (the override stays load-bearing)', () => {
  // If Stop ever moves to a class-toggle instead, this test (and the
  // override's original motivation) should be revisited together.
  assert.match(SCAN, /stopBtn\.hidden\s*=/);
  assert.match(SCAN, /className:\s*'btn btn-ghost scan-stop-btn'/);
});

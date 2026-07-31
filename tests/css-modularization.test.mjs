/**
 * v1.131.2 — app.css was split into three ordered stylesheets to satisfy the
 * < 800-LOC file-size contract (no bundler). This canary locks the split:
 *   - the three files exist and are each within the hard limit,
 *   - index.html loads them in the exact cascade order,
 *   - together they still carry a rule from every original concern (no content
 *     was dropped in the cut).
 * CI-isolated: pure source-static reads, no server, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CSS_FILES, loadAppCss } from './helpers/css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HARD_LIMIT = 800; // docs/sdd/CONVENTIONS.md file-size contract

test('the three app stylesheets exist and are each within the 800-LOC hard limit', () => {
  assert.deepEqual(APP_CSS_FILES, ['app.css', 'components.css', 'overlays.css']);
  for (const f of APP_CSS_FILES) {
    const lines = readFileSync(resolve(ROOT, 'public', 'css', f), 'utf8').split('\n').length;
    assert.ok(lines <= HARD_LIMIT, `public/css/${f} is ${lines} lines — over the ${HARD_LIMIT}-LOC hard limit; split it`);
  }
});

test('index.html links all three stylesheets in cascade order', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  const idx = APP_CSS_FILES.map((f) => html.indexOf(`/css/${f}`));
  for (const [i, pos] of idx.entries()) {
    assert.ok(pos > -1, `index.html must <link> /css/${APP_CSS_FILES[i]}`);
  }
  assert.ok(idx[0] < idx[1] && idx[1] < idx[2], 'stylesheets must load app.css → components.css → overlays.css (cascade order)');
});

test('the concatenation still carries a rule from every original concern', () => {
  const css = loadAppCss();
  // one representative selector per major section that spans all three files
  for (const sel of [
    '.visually-hidden',      // a11y (app.css)
    ':root',                 // tokens (app.css)
    '.sidebar',              // chrome (app.css)
    '.btn-primary',          // buttons (app.css)
    '.card',                 // cards (components.css)
    '.tracker-tabs',         // tracker CRM tabs (components.css)
    '.tbl',                  // tables (components.css)
    '.toast',                // toast (overlays.css)
    '.modal',                // modal (overlays.css)
    '.usage-hud',            // usage HUD widget (overlays.css)
    '[dir="rtl"]',           // RTL mirror (overlays.css)
  ]) {
    assert.ok(css.includes(sel), `merged CSS lost the "${sel}" rule in the split`);
  }
});

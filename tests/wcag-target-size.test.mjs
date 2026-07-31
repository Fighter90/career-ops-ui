/**
 * v1.26.1 (WCAG-2.5.5) — `.btn:not(.btn-sm)` must render ≥ 44 × 44 px.
 *
 * Static CSS canary that asserts the `.btn` rule in app.css carries the
 * `min-height: 44px` declaration. v1.26.0 was missing this declaration
 * (a stale comment at line 427-430 claimed it was there, but the rule
 * itself was bare) — live measurement on every public route showed
 * header buttons rendering at 39-41 px, violating WCAG 2.5.5.
 *
 * Browser-level proof lives in `tests/playwright-smoke.mjs` /
 * `playwright-full-cycle.mjs` (those measure `getBoundingClientRect`
 * across every route). This unit canary gives a fast, no-browser
 * regression net: a future patch can't remove the floor again without
 * tripping the test.
 *
 * Why static-CSS over browser-only: pure parse, runs in < 50 ms,
 * doesn't need a stand. The browser test covers DOM-level proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_CSS = resolve(__dirname, '..', 'public', 'css', 'app.css');

function readBlock(src, selector) {
  // Find the FIRST `<selector> {` block (block-start is line with the
  // selector + open brace, block-end is the line that closes it). We
  // pick the bare-selector form (e.g. `.btn {`), not derivatives like
  // `.btn:active {`.
  const lines = src.split('\n');
  const opener = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`);
  const start = lines.findIndex((l) => opener.test(l.trim()));
  if (start === -1) return null;
  // Find the matching close brace (single-level — the rules don't nest).
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim().startsWith('}')) {
      return lines.slice(start, i + 1).join('\n');
    }
  }
  return null;
}

test('.btn rule carries min-height: 44px (WCAG 2.5.5 floor)', () => {
  const src = loadAppCss();
  const block = readBlock(src, '.btn');
  assert.ok(block, '.btn rule not found in app.css');
  assert.match(block, /min-height:\s*44px/i,
    `.btn block is missing min-height: 44px — WCAG 2.5.5 regression. Block:\n${block}`);
});

test('.btn rule carries flex-shrink: 0 (anti-squash under parent flex)', () => {
  // Without `flex-shrink: 0`, a parent `display: flex` with `align-items:
  // center` + a too-tight implicit/explicit height can squash the
  // button below its min-height. The v1.26.1 fix adds this anti-squash
  // guard so the row grows to fit the button instead.
  const src = loadAppCss();
  const block = readBlock(src, '.btn');
  assert.match(block, /flex-shrink:\s*0/,
    '.btn block missing flex-shrink: 0 — header rows can squash buttons under flex layout');
});

test('.btn-sm keeps the relaxed 32 px floor (small-control exception)', () => {
  // The spaced-target exception (WCAG 2.5.5 + 2.5.8) allows < 44 px
  // when the control has ≥ 8 px clearance. v1.20.0 added a `.btn-sm`
  // class for dense table-row controls (Edit / Delete) with
  // min-height: 32 px. The v1.26.1 fix on `.btn` must NOT regress this
  // — small buttons keep their floor.
  const src = loadAppCss();
  const block = readBlock(src, '.btn-sm');
  assert.ok(block, '.btn-sm rule not found');
  assert.match(block, /min-height:\s*32px/,
    '.btn-sm regressed — small-control floor changed');
});

test('.btn-sm has its own min-height (does NOT inherit .btn 44 px)', () => {
  // Because CSS source order matters: `.btn-sm` is defined AFTER `.btn`,
  // and `min-height: 32px` overrides the cascaded 44 px from `.btn`.
  // Verify this stays true even with the v1.26.1 update.
  const src = loadAppCss();
  // Find the source-order position of each rule.
  const btnIdx = src.indexOf('\n.btn {');
  const smIdx = src.indexOf('\n.btn-sm');
  assert.ok(btnIdx !== -1 && smIdx !== -1, 'both rules must be present');
  assert.ok(smIdx > btnIdx,
    '.btn-sm must come AFTER .btn in source order so the 32 px override applies');
});

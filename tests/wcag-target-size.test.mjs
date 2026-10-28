/**
 * v3 phase 3 (density) — `.btn` block size rides the cv3 control token.
 *
 * Static CSS canary. v1.26.1 pinned a literal `min-height: 44px` (WCAG 2.5.5);
 * the Lovable density decision (v3 phase 3) retires that floor: `.btn` now
 * carries `min-height: var(--cv3-control-h)` — 30px in tokens-v3.css, above
 * the WCAG 2.5.8 AA minimum (24×24 CSS px), with `.btn-hero` and the topbar
 * controls keeping their own (larger) sizing. This canary pins the TOKEN
 * contract so the density can never silently regress to a magic number, and
 * cross-checks the sheet value so "30px" stays pinned somewhere static.
 *
 * Browser-level layout guards live in `tests/playwright-smoke.mjs`
 * (overflow + topbar overlap) and `tests/playwright-mobile-390.mjs`. This
 * unit canary is the fast, no-browser regression net.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppCss } from './helpers/css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

test('.btn block size rides the cv3 control token (30px, ≥ the WCAG 2.5.8 floor)', () => {
  const src = loadAppCss();
  const block = readBlock(src, '.btn');
  assert.ok(block, '.btn rule not found in app.css');
  assert.match(block, /min-height:\s*var\(--cv3-control-h\)/i,
    `.btn block must carry min-height: var(--cv3-control-h) — density regression. Block:\n${block}`);
  assert.doesNotMatch(block, /min-height:\s*44px/i, 'the retired 44px literal must not return');
  // the token's sheet value is pinned somewhere static: 30px ≥ the 24px AA floor
  const tokens = readFileSync(resolve(ROOT, 'public', 'css', 'tokens-v3.css'), 'utf8');
  const m = tokens.match(/--cv3-control-h:\s*(\d+)px/);
  assert.ok(m, 'tokens-v3.css must declare --cv3-control-h');
  assert.ok(Number(m[1]) >= 24, `--cv3-control-h must stay ≥ 24px (WCAG 2.5.8), got ${m[1]}px`);
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

test('.btn-sm follows the same control token (small-control exception, source order intact)', () => {
  // v1.20.0 added `.btn-sm` for dense table-row controls (Edit / Delete); with
  // the density token both sizes resolve to the same 30px floor — `.btn-sm`
  // differs by padding/font, and the explicit declaration keeps that contract
  // even if `.btn` changes again.
  const src = loadAppCss();
  const block = readBlock(src, '.btn-sm');
  assert.ok(block, '.btn-sm rule not found');
  assert.match(block, /min-height:\s*var\(--cv3-control-h\)/,
    '.btn-sm regressed — must carry the control token');
});

test('.btn-sm has its own min-height (declared AFTER .btn in source order)', () => {
  // Because CSS source order matters: `.btn-sm` is defined AFTER `.btn`,
  // and its explicit `min-height` declaration overrides the cascaded one.
  // Verify this stays true even with the density update.
  const src = loadAppCss();
  // Find the source-order position of each rule.
  const btnIdx = src.indexOf('\n.btn {');
  const smIdx = src.indexOf('\n.btn-sm');
  assert.ok(btnIdx !== -1 && smIdx !== -1, 'both rules must be present');
  assert.ok(smIdx > btnIdx,
    '.btn-sm must come AFTER .btn in source order so its override applies');
});

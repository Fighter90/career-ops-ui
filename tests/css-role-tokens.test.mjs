/**
 * Source-static guard for the v1.137.0 dark-mode ALIAS-TOKEN system (v1.138.0).
 *
 * v1.137.0 added colour-role aliases so code that referenced undefined tokens
 * (`--fg`, `--danger`, `--panel`, …) now resolves to a theme-aware real token.
 * Each alias carries a ROLE:
 *
 *   • TEXT-role  (--fg/--ink/--muted/--ok/--go/--err/--error/--danger/--warn)
 *     → map onto *foreground* tokens tuned for contrast ON a surface. Using one
 *       as a `background`/`background-color` inverts the pairing → the AA-tuned
 *       text colour becomes a fill, and whatever paints on it is unverified.
 *   • SURFACE-role (--card/--panel/--panel-2/--surface-elev1/--line/--border)
 *     → map onto *surface* tokens. Using one as a `color:` paints text with a
 *       panel/hairline colour → low-contrast, unverified.
 *
 * The "0 WCAG-AA failures across 29 views" claim behind v1.137.0 rests on every
 * alias staying in its role. This canary makes that machine-checkable across all
 * hand-written CSS **and** the inline `style` objects in the SPA views, so a
 * future `background: var(--danger)` (or `color: var(--panel)`) fails CI instead
 * of silently regressing contrast. (Border/outline/box-shadow uses are allowed —
 * an accent border from a text token, or a hairline `background: var(--line)`
 * divider from a surface token, are both intentional and contrast-safe.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CSS_DIR = resolve(ROOT, 'public', 'css');
const JS_DIR = resolve(ROOT, 'public', 'js');

const TEXT_ROLE = ['fg', 'ink', 'muted', 'ok', 'go', 'err', 'error', 'danger', 'warn'];
const SURFACE_ROLE = ['card', 'panel', 'panel-2', 'surface-elev1', 'line', 'border'];

/** Recursively collect files under dir matching one of the extensions. */
function walk(dir, exts, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, ent.name);
    if (ent.isDirectory()) walk(full, exts, acc);
    else if (exts.some((e) => ent.name.endsWith(e))) acc.push(full);
  }
  return acc;
}

/** Strip /* … *\/ comments so the doctrine comment in app.css isn't a hit. */
const stripBlockComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// One scan set: every .css file + every SPA .js (inline style objects live in
// public/js/**; api.js's UI.el serializes them into real CSS at runtime).
const FILES = [
  ...walk(CSS_DIR, ['.css']),
  ...walk(JS_DIR, ['.js']),
];

/**
 * Property regex covering BOTH CSS (`background-color: var(--x)`) and JS inline
 * style objects (`backgroundColor: 'var(--x)'`, `background: 'var(--x)'`).
 * `prop` may be a `|`-alternation of property spellings.
 */
function violations(src, prop, tokens) {
  const clean = stripBlockComments(src);
  const found = [];
  for (const tok of tokens) {
    // CSS + JS-string forms: <prop> : [quote] var(--tok)
    const re = new RegExp(`\\b(?:${prop})\\s*:\\s*['"\`]?\\s*var\\(--${tok.replace(/[-]/g, '\\-')}\\)`, 'g');
    if (re.test(clean)) found.push(tok);
  }
  return found;
}

test('TEXT-role alias tokens are never used as a background fill', () => {
  const offenders = [];
  for (const f of FILES) {
    const bad = violations(readFileSync(f, 'utf8'), 'background|background-color|backgroundColor', TEXT_ROLE);
    if (bad.length) offenders.push(`${relative(ROOT, f)} → background: var(--${bad.join('), var(--')})`);
  }
  assert.deepEqual(offenders, [], `text-role tokens used as background (contrast inversion):\n  ${offenders.join('\n  ')}`);
});

test('SURFACE-role alias tokens are never used as a text colour', () => {
  const offenders = [];
  for (const f of FILES) {
    const bad = violations(readFileSync(f, 'utf8'), 'color', SURFACE_ROLE);
    if (bad.length) offenders.push(`${relative(ROOT, f)} → color: var(--${bad.join('), var(--')})`);
  }
  assert.deepEqual(offenders, [], `surface-role tokens used as text colour (contrast inversion):\n  ${offenders.join('\n  ')}`);
});

test('every alias token referenced in code actually resolves to a declared token', () => {
  // Guard against the OTHER failure mode: an alias used somewhere but never
  // declared in app.css → falls back to `initial` (readable only by luck).
  const appCss = readFileSync(resolve(CSS_DIR, 'app.css'), 'utf8');
  const declared = new Set([...appCss.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  for (const tok of [...TEXT_ROLE, ...SURFACE_ROLE]) {
    // Only assert declaration for aliases actually referenced somewhere.
    const referenced = FILES.some((f) => new RegExp(`var\\(--${tok.replace(/[-]/g, '\\-')}\\)`).test(stripBlockComments(readFileSync(f, 'utf8'))));
    if (referenced) assert.ok(declared.has(tok), `alias --${tok} is referenced but never declared in app.css`);
  }
});

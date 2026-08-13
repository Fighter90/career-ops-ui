/**
 * D-4 (v1.171.0) — the design system gained a type scale (`--font-size-*`,
 * base = Inter 15px) and z-index layer tokens (`--z-*`). Every z-index literal
 * is migrated to a named layer (values preserved, so stacking is byte-identical);
 * the core font sizes the components already used are named for incremental
 * adoption. These canaries lock the scale in and forbid new bare z-index magic
 * numbers from creeping back.
 *
 * CSS-static (same approach as dark-theme-tokens / elevation-token).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['app.css', 'components.css', 'overlays.css'].map((f) =>
  readFileSync(resolve(ROOT, 'public', 'css', f), 'utf8'));
const ALL = FILES.join('\n');
const APP = FILES[0];

test('D-4: the --font-size-* ramp and --z-* layers are defined on :root', () => {
  for (const t of ['xs', 'sm', 'md', 'base', 'lg', 'xl', '2xl']) {
    assert.match(APP, new RegExp(`--font-size-${t.replace('2xl', '2xl')}:\\s*\\d`), `--font-size-${t} defined`);
  }
  for (const t of ['topbar', 'sidebar', 'hud', 'banner', 'modal', 'popover', 'toast', 'fab', 'drawer', 'skiplink']) {
    assert.match(APP, new RegExp(`--z-${t}:\\s*\\d`), `--z-${t} defined`);
  }
});

test('D-4: no bare z-index magic numbers remain — every stacking context uses a --z-* token', () => {
  for (const css of FILES) {
    // Strip comments so the prose reference to a retired `z-index: 5` doesn't count.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bare = [...code.matchAll(/z-index:\s*(-?\d+)/g)];
    assert.equal(bare.length, 0, `bare z-index literal(s) found: ${bare.map((m) => m[0]).join(', ')}`);
    // …and they DO use the tokens (calc-derived neighbours allowed).
  }
  assert.match(ALL, /z-index:\s*var\(--z-skiplink\)/, 'skip-link uses the token');
  assert.match(ALL, /z-index:\s*calc\(var\(--z-sidebar\) - 1\)/, 'backdrop derives from --z-sidebar');
});

test('D-4: the base font size uses the ramp token (adoption, not a dead token)', () => {
  assert.match(ALL, /font-size:\s*var\(--font-size-base\)/, 'body/base migrated to --font-size-base');
});

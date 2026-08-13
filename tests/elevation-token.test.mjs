/**
 * FIX-9 / D-3 (v1.167.0) — the raised-surface tokens (`--panel-2`,
 * `--surface-elev1`) used to resolve to `--slate`, the same value as the
 * hairline tokens (`--line`, `--border`) — so an elevated panel/chip inside a
 * bordered card had no separation. A dedicated `--elev` token now carries a
 * distinct value in both themes; the hairline stays on `--slate`.
 *
 * CSS-static assertion (same approach as dark-theme-tokens/help-hint tests).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(resolve(ROOT, 'public', 'css', 'app.css'), 'utf8');

test('D-3: --elev (raised surface) is a distinct value from --slate (hairline)', () => {
  // Light :root block.
  const light = CSS.match(/:root\s*\{[\s\S]*?\n\}/)[0];
  const elevL = light.match(/--elev:\s*(#[0-9a-fA-F]{3,6})/)[1].toLowerCase();
  const slateL = light.match(/--slate:\s*(#[0-9a-fA-F]{3,6})/)[1].toLowerCase();
  assert.notEqual(elevL, slateL, 'light --elev must differ from the --slate hairline');

  // Dark blocks: every dark --slate: #2a2f3a is paired with a distinct --elev.
  const darkElev = [...CSS.matchAll(/--slate:\s*#2a2f3a;\s*\n\s*--elev:\s*(#[0-9a-fA-F]{3,6})/g)];
  assert.ok(darkElev.length >= 2, 'both dark blocks define --elev next to --slate');
  for (const m of darkElev) {
    assert.notEqual(m[1].toLowerCase(), '#2a2f3a', 'dark --elev must differ from dark --slate');
  }
});

test('D-3: the elevation aliases resolve to --elev, hairlines stay on --slate', () => {
  assert.match(CSS, /--panel-2:\s*var\(--elev\)/, '--panel-2 → --elev');
  assert.match(CSS, /--surface-elev1:\s*var\(--elev\)/, '--surface-elev1 → --elev');
  assert.match(CSS, /--line:\s*var\(--slate\)/, '--line stays on --slate');
  assert.match(CSS, /--border:\s*var\(--slate\)/, '--border stays on --slate');
});

/**
 * v1.137.0 — dark-mode contrast regression guard.
 *
 * Several views reference CSS custom properties (`--fg`, `--panel`, `--panel-2`,
 * `--surface-elev1`, `--line`) that were never declared in the palette. Undefined,
 * `var(--fg, #111)` / `var(--panel-2, #eef1f6)` silently fell back to hardcoded
 * LIGHT/BLACK literals — fine in light mode, but white-on-white (#/pipeline
 * overview) / black-on-black (#/stats active tab) in dark mode. They're now
 * aliased to the real theme-aware tokens on `:root`. This canary keeps them
 * defined AND aliased (not re-hardcoded to a literal), so the bug can't recur.
 * CI-isolated: pure source-static read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppCss } from './helpers/css.mjs';

const ALIAS = {
  '--fg': '--hof',
  '--panel': '--paper',
  '--panel-2': '--slate',
  '--surface-elev1': '--slate',
  '--line': '--slate',
  // semantic text/surface aliases (v1.137.0)
  '--ok': '--kazan-text',
  '--go': '--kazan-text',
  '--err': '--rausch-text',
  '--error': '--rausch-text',
  '--danger': '--rausch-text',
  '--warn': '--darjeeling-text',
  '--muted': '--foggy',
  '--ink': '--hof',
  '--card': '--paper',
  '--border': '--slate',
};

test('previously-undefined alias tokens are declared and mapped to theme-aware tokens', () => {
  const css = loadAppCss();
  for (const [alias, target] of Object.entries(ALIAS)) {
    const re = new RegExp(`\\${alias}\\s*:\\s*var\\(\\${target}\\)`);
    assert.ok(re.test(css), `${alias} must be declared as var(${target}) so it follows the theme (dark-mode contrast guard)`);
  }
});

test('the alias targets themselves are theme-aware (redeclared under dark)', () => {
  const css = loadAppCss();
  // --hof / --paper / --slate must each be redeclared in a dark block, otherwise
  // the aliases above would resolve to a single (light) value in both themes.
  for (const target of ['--hof', '--paper', '--slate']) {
    const decls = css.match(new RegExp(`\\${target}\\s*:`, 'g')) || [];
    assert.ok(decls.length >= 2, `${target} must be declared in both light and dark blocks (found ${decls.length})`);
  }
});

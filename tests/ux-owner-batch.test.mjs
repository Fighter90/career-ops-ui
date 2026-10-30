/**
 * Owner UX batch — regression pins for the 2026-10-30 owner-reported fixes.
 *
 * 1. The #/scan pagebar "Compact" density toggle is REMOVED (owner decision):
 *    the density model itself stays (scan-results ROW_H / getDensity plumbing
 *    is driven directly by car115-scan-v2) — only the button, its localStorage
 *    read-back and its three i18n keys go.
 * 2. The dashboard hero stacks vertically (column flex, gap) so the greeting
 *    no longer sits on one line with the action buttons.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScanSrc } from './helpers/scan-src.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('ux-owner: #/scan pagebar has no Compact density toggle (owner decision)', () => {
  const src = loadScanSrc();
  assert.ok(!src.includes('v2-scan-density'), 'density button class must be gone from the scan view');
  assert.ok(!src.includes('scan:density'), 'density localStorage read-back must be gone');
  assert.ok(!src.includes('scan.v2.density'), 'density i18n key reference must be gone');
  // The density MODEL stays: scan-results still resolves the row height.
  assert.ok(src.includes('getDensity'), 'density plumbing (getDensity) must survive for car115');
});

test('ux-owner: density i18n keys removed from every locale', () => {
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const loc of locales) {
    const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${loc}.js`), 'utf8');
    for (const key of ["'scan.v2.compact'", "'scan.v2.comfortable'", "'scan.v2.density'"]) {
      assert.ok(!src.includes(key), `${key} must be gone from i18n-dict.${loc}.js`);
    }
  }
});

test('ux-owner: dashboard hero stacks vertically (column flex + gap)', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'dashboard.js'), 'utf8');
  const m = src.match(/v2-dash-hero-inner[\s\S]{0,600}?style:\s*\{([^}]*)\}/);
  assert.ok(m, 'v2-dash-hero-inner style block found');
  const style = m[1];
  assert.ok(style.includes("flexDirection: 'column'"), 'hero inner must be a column flex container');
  assert.ok(style.includes('gap:'), 'hero inner must space children via gap');
  assert.ok(style.includes("alignItems: 'flex-start'"), 'hero children align to the start edge');
});

test('ux-owner: help TOC rows carry a permanent gutter; toc-current only flips color', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'help.js'), 'utf8');
  assert.ok(src.includes("borderInlineStart: '3px solid transparent'"),
    'every TOC row must reserve the gutter with a transparent inline border');
  assert.ok(src.includes("paddingInlineStart: '8px'") && src.includes("marginInlineStart: '-11px'"),
    'every TOC row must carry the gutter geometry inline');
  assert.ok(src.includes("flex: '0 0 1.6ch'"), 'section number must sit in its own end-aligned span column');
  const css = readFileSync(resolve(ROOT, 'public', 'css', 'overlays.css'), 'utf8');
  const cur = css.match(/\.help-toc a\.toc-current \{([^}]*)\}/);
  assert.ok(cur, 'toc-current rule found');
  assert.ok(!cur[1].includes('padding-inline-start') && !cur[1].includes('margin-inline-start'),
    'toc-current must NOT shift geometry (padding/margin live inline on every row now)');
  assert.ok(cur[1].includes('border-inline-start-color'), 'toc-current flips the bar color only');
});

test('ux-owner: mobile drawer — in-sidebar close button, scroll reset, HUD-gated bottom lift', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  const aside = html.match(/<aside class="sidebar" id="sidebar">[\s\S]*?<\/aside>/);
  assert.ok(aside, 'sidebar aside found');
  assert.ok(aside[0].includes('id="sidebar-close"'), 'close button lives INSIDE the sidebar');
  assert.ok(aside[0].includes('data-i18n-aria-label="nav.closeMenu"'), 'close button aria-label is i18n-keyed');

  const appJs = readFileSync(resolve(ROOT, 'public', 'js', 'app.js'), 'utf8');
  assert.ok(appJs.includes("getElementById('sidebar-close')"), 'app.js must wire the sidebar close button');
  const openFn = appJs.match(/function openSidebar\(\)[\s\S]{0,400}?\n  \}/);
  assert.ok(openFn && /scrollTop = 0/.test(openFn[0]), 'openSidebar must reset the sidebar scroll to the top');

  const appCss = readFileSync(resolve(ROOT, 'public', 'css', 'app.css'), 'utf8');
  assert.ok(/\.sidebar-close\s*\{[^}]*display:\s*none/.test(appCss), '.sidebar-close hidden on desktop');
  assert.ok(/@media \(max-width: 900px\) \{[\s\S]*?\.sidebar-close\s*\{/.test(appCss),
    '.sidebar-close shown inside the ≤900px block');

  const overlays = readFileSync(resolve(ROOT, 'public', 'css', 'overlays.css'), 'utf8');
  assert.ok(!/\n\.sidebar \{[^\n]*bottom: max\(0px/.test(overlays),
    'the sidebar bottom lift must be gated to .sidebar.has-hud');
  assert.ok(!/\n\.sidebar::after \{/.test(overlays),
    '.sidebar::after must be gated to .sidebar.has-hud::after');
  const hud = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'usage-hud.js'), 'utf8');
  assert.ok(hud.includes("classList.toggle('has-hud'"), 'usage-hud must toggle the has-hud class');
});

test('ux-owner: nav.closeMenu exists in every locale', () => {
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const loc of locales) {
    const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${loc}.js`), 'utf8');
    assert.ok(src.includes("'nav.closeMenu':"), `nav.closeMenu missing in i18n-dict.${loc}.js`);
  }
});

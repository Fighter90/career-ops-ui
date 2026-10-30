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
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');
const loadAppCss = () => ['app.css', 'components.css', 'overlays.css', 'map.css', 'tokens-v3.css', 'motion.css']
  .map((f) => readFileSync(resolve(ROOT, 'public', 'css', f), 'utf8')).join('\n');

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
  assert.ok(src.includes("borderInlineStart: '3px solid var(--_toc-rail, transparent)'"),
    'every TOC row reserves the gutter inline and references --_toc-rail (the .toc-current class lifts it)');
  assert.ok(src.includes("paddingInlineStart: '8px'") && src.includes("marginInlineStart: '-11px'"),
    'every TOC row must carry the gutter geometry inline');
  assert.ok(src.includes("flex: '0 0 1.6ch'"), 'section number must sit in its own end-aligned span column');
  const css = readFileSync(resolve(ROOT, 'public', 'css', 'overlays.css'), 'utf8');
  const cur = css.match(/\.help-toc a\.toc-current \{([^}]*)\}/);
  assert.ok(cur, 'toc-current rule found');
  assert.ok(!cur[1].includes('padding-inline-start') && !cur[1].includes('margin-inline-start'),
    'toc-current must NOT shift geometry (padding/margin live inline on every row now)');
  assert.ok(cur[1].includes('--_toc-rail:'), 'toc-current lifts the rail via the --_toc-rail var (inline geometry stays untouched)');
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

test('ux-owner: the six owner-flagged controls carry accessible names', () => {
  const read = (...p) => readFileSync(resolve(ROOT, 'public', 'js', ...p), 'utf8');
  const scan = read('views', 'scan.js');
  assert.match(scan, /id: 'scan-filter-text', placeholder: t\('scan\.filterText'\), 'aria-label': t\('scan\.filterText'\)/,
    '#scan-filter-text needs an aria-label');
  const tracker = read('views', 'tracker.js');
  assert.match(tracker, /className: 'select', style: \{ maxWidth: '180px' \}, 'aria-label': t\('track\.anyScore'\)/,
    'the tracker score select needs an aria-label');
  assert.match(tracker, /maxLength: 500, placeholder: t\('track\.outcome\.notePh[^']*', '[^']*'\), 'aria-label': t\('track\.outcome\.notePh/,
    'the outcome-modal note input needs an aria-label');
  const plan = read('views', 'career-plan.js');
  assert.match(plan, /rows: '22', 'data-i18n-placeholder': 'plan\.editorPh', 'aria-label': t\('plan\.editorLabel'/,
    'the career-plan editor needs an aria-label');
  const auto = read('lib', 'auto-pipeline.js');
  const urlIn = auto.match(/const urlInput = c\('input', \{[\s\S]{0,300}?\}\);/);
  assert.ok(urlIn && /'aria-label': t\('auto\.urlLabel'/.test(urlIn[0]), 'the auto-pipeline URL input needs an aria-label');
  const bug = read('lib', 'bug-report.js');
  const ta = bug.match(/var ta = c\('textarea', \{[\s\S]{0,300}?\}\);/);
  assert.ok(ta && /'aria-label': t\('bug\.ph'/.test(ta[0]), 'the bug-report textarea needs an aria-label');
});

test('ux-owner: plan.editorLabel exists in every locale', () => {
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const loc of locales) {
    const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${loc}.js`), 'utf8');
    assert.ok(src.includes("'plan.editorLabel':"), `plan.editorLabel missing in i18n-dict.${loc}.js`);
  }
});

test('ux-owner: evaluate refuses to spend an LLM call on the URL prefill template', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'evaluate.js'), 'utf8');
  const run = src.match(/async function run\(\) \{[\s\S]{0,2000}?\n  \}/);
  assert.ok(run, 'run() found');
  assert.match(run[0], /includes\('\[paste JD text here\]'\)/,
    'run() must detect the prefill template before the API call');
  assert.match(run[0], /eval\.pasteJd/, 'a specific toast key names the problem');
  assert.match(run[0], /jdInput\.focus\(\)/, 'focus returns to the JD field');
  // order guard: the template check must sit BEFORE the API.post
  const guard = run[0].indexOf("includes('[paste JD text here]')");
  const post = run[0].indexOf("API.post('/api/evaluate'");
  assert.ok(guard > -1 && post > -1 && guard < post, 'the guard runs before the LLM POST');
});

test('ux-owner: eval.pasteJd exists in every locale', () => {
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const loc of locales) {
    const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${loc}.js`), 'utf8');
    assert.ok(src.includes("'eval.pasteJd':"), `eval.pasteJd missing in i18n-dict.${loc}.js`);
  }
});

test('ux-owner: auto-pipeline URL Enter ignores IME composition', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'auto.js'), 'utf8');
  const h = src.match(/urlInput\.addEventListener\('keydown'[\s\S]{0,300}?\}\);/);
  assert.ok(h, 'the URL input keydown handler found');
  assert.match(h[0], /e\.isComposing \|\| e\.keyCode === 229/,
    'IME composition Enter must not start the paid run (CAR-21 contract, same as docs-assistant)');
});

test('UX sweep follow-up: toc-current lifts the rail through the inline var reference (not the losing border-color)', () => {
  const help = read('public', 'js', 'views', 'help.js');
  assert.match(help, /borderInlineStart: '3px solid var\(--_toc-rail, transparent\)'/,
    'the inline gutter must reference --_toc-rail so the .toc-current class can light it');
  const css = loadAppCss();
  assert.match(css, /\.help-toc a\.toc-current\s*\{[^}]*--_toc-rail:\s*var\(--rausch/,
    '.toc-current lifts --_toc-rail to the accent');
});

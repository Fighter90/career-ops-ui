/**
 * CAR-141 — copy-to-clipboard feedback guards (cvstart.org).
 *
 * The finding: «копирование без обратной связи» — clicking a copy button on
 * cvstart.org gave no feedback. The mechanism exists in the markup (icon
 * swap + aria-live region) but the handler early-returned when the async
 * Clipboard API rejects (headless browsers, permission-denied, insecure
 * contexts) — in exactly those environments the click was silent. These
 * guards pin the whole feedback contract so a future edit cannot quietly
 * regress it:
 *
 *   1. MARKUP — every [data-copy] button carries the feedback wiring:
 *      the .copy-btn class, both swap icons (i-copy / i-check), the
 *      localized data-copied-label and an aria-label.
 *   2. LIVE REGION — the shared #copy-live aria-live="polite" region
 *      ships on every page (it lives in Base.astro).
 *   3. CSS — the .copied class actually swaps the icons.
 *   4. I18N — a11y.copy + a11y.copied exist (non-empty) in ALL 19 site
 *      locale dictionaries.
 *   5. HANDLER — site.js must be failure-proof: a Clipboard API rejection
 *      falls back to the hidden-textarea + execCommand path, feedback is
 *      shared by both paths (one announce function), and the revert timer
 *      is reset per button instead of stacking.
 *
 * CI-isolated: reads repo source files only; no server / network / browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'site');

const SITE_LOCALES = [
  'en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW',
  'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi',
];

const COMPONENTS = ['InstallTabs.astro', 'OpenSource.astro'];

/** Every <button …> block across the copy-bearing components. */
function copyButtons() {
  const out = [];
  for (const name of COMPONENTS) {
    const src = readFileSync(resolve(SITE, 'src', 'components', name), 'utf8');
    for (const m of src.matchAll(/<button[\s\S]*?<\/button>/g)) {
      if (m[0].includes('data-copy=')) out.push({ file: name, tag: m[0] });
    }
  }
  return out;
}

test('every [data-copy] button carries the full feedback wiring', () => {
  const buttons = copyButtons();
  // 2 SOURCE literals: InstallTabs renders its button once inside a
  // TABS.map() (×3 per instance) and OpenSource has one — InstallTabs is
  // used ×2 on the landing (Hero + FinalCta), so 7 buttons per built page,
  // pinned by the dist check below.
  assert.equal(buttons.length, 2, 'expected 2 [data-copy] button literals in site components');
  for (const { file, tag } of buttons) {
    assert.match(tag, /copy-btn/, `${file}: copy button must carry the .copy-btn feedback class`);
    assert.match(tag, /data-copied-label=\{t\(locale, 'a11y\.copied'\)\}/,
      `${file}: copy button must announce success via the localized a11y.copied label`);
    assert.match(tag, /aria-label=\{t\(locale, 'a11y\.copy'\)\}/,
      `${file}: copy button needs its accessible name`);
    assert.match(tag, /class="[^"]*i-copy/, `${file}: resting copy icon missing`);
    assert.match(tag, /class="[^"]*i-check/, `${file}: copied ✓ feedback icon missing`);
  }
});

test('the shared aria-live region ships on every page (Base layout)', () => {
  const base = readFileSync(resolve(SITE, 'src', 'layouts', 'Base.astro'), 'utf8');
  assert.match(base, /id="copy-live"/, 'Base.astro must ship the #copy-live region');
  const region = base.match(/<div id="copy-live"[^>]*>/)?.[0] ?? '';
  assert.match(region, /aria-live="polite"/, '#copy-live must be aria-live="polite"');
  assert.match(region, /class="[^"]*sr-only/, '#copy-live must be visually hidden');
});

test('the .copied class actually swaps the icons (global.css)', () => {
  const css = readFileSync(resolve(SITE, 'src', 'styles', 'global.css'), 'utf8');
  assert.match(css, /\.copy-btn \.i-check\s*\{[^}]*display:\s*none/, 'check icon hidden at rest');
  assert.match(css, /\.copy-btn\.copied \.i-check\s*\{[^}]*display:\s*block/, 'check icon shown when copied');
  assert.match(css, /\.copy-btn\.copied \.i-copy\s*\{[^}]*display:\s*none/, 'copy icon hidden when copied');
});

test('a11y.copy + a11y.copied exist and are non-empty in all 19 site locales', () => {
  for (const code of SITE_LOCALES) {
    const dict = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${code}.json`), 'utf8'));
    for (const k of ['a11y.copy', 'a11y.copied']) {
      assert.equal(typeof dict[k], 'string', `${code}.json missing ${k}`);
      assert.ok(dict[k].trim().length > 0, `${code}.json empty ${k}`);
    }
  }
});

test('site.js copy handler is failure-proof (fallback + shared feedback, no stacked timers)', () => {
  const js = readFileSync(resolve(SITE, 'src', 'scripts', 'site.js'), 'utf8');
  const start = js.indexOf('copy buttons');
  assert.notEqual(start, -1, 'site.js lost the copy-buttons section');
  const section = js.slice(start, js.indexOf('/* ---', start + 10));

  // The async Clipboard API is refused in headless browsers / permission-
  // denied contexts; without a fallback the click is SILENT there (the
  // original CAR-141 finding). Both paths must exist.
  assert.match(section, /navigator\.clipboard[\s\S]*writeText/, 'must try the async Clipboard API first');
  assert.match(section, /execCommand\('copy'\)/,
    'a Clipboard API rejection must fall back to textarea + execCommand — an early return leaves the click silent');
  assert.doesNotMatch(section, /catch\s*\{\s*return;\s*\}/,
    'a bare catch-return swallows the failure with no feedback (CAR-141)');

  // One shared announce path so the icon swap + live region stay in sync.
  assert.match(section, /classList\.add\('copied'\)/, 'feedback must add the .copied class');
  assert.match(section, /live\.textContent\s*=/, 'feedback must fill the aria-live region');
  assert.match(section, /dataset\.copiedLabel/, 'the localized label must reach the live region');
  assert.match(section, /1500/, 'the copied state must revert after ~1.5s');

  // Rapid re-clicks must not stack revert timers (first one clears the
  // state early). A per-button timer reset is the cheap guard.
  assert.match(section, /clearTimeout/, 're-clicks must reset the revert timer, not stack them');
});

test('the built page expands the wiring to all copy buttons (when dist exists)', () => {
  const index = resolve(SITE, 'dist', 'index.html');
  if (!existsSync(index)) return; // dist is a build artifact — checked after `cd site && npm run build`
  const html = readFileSync(index, 'utf8');
  // InstallTabs renders ×2 on the landing (Hero + FinalCta) × 3 tabs, plus
  // the git-clone button in OpenSource — 7 buttons on the built EN page.
  const buttons = html.match(/<button[^>]*data-copy=[^>]*>/g) ?? [];
  assert.equal(buttons.length, 7, 'the built landing must render 7 copy buttons');
  for (const tag of buttons) {
    assert.match(tag, /data-copied-label=/, 'built copy button lost its localized copied label');
    assert.match(tag, /aria-label=/, 'built copy button lost its accessible name');
  }
  assert.match(html, /id="copy-live"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="copy-live"/,
    'the built page must ship the aria-live region');
});

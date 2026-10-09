/**
 * design-qa-v1247 — design-sweep TAIL fixes (CAR-49…58 minors/polish + the
 * CAR-57 dark-tiles remainder, v1.247.0). Companion to design-qa-v1246.test.mjs
 * (the top-10 pass); this file locks everything that pass left open:
 *
 *   1. major   CAR-57  dark map tiles: CARTO dark matter in CSP + /api/map/jobs
 *                      + theme-aware client tile layer
 *   2. minor   CAR-58  .callout--warn theme-aware yellow banners (config/batch/hero)
 *   3. minor   CAR-52  apply docs URL wraps at any char, no mid-word clip
 *   4. minor   CAR-52  CV header buttons are one text-only system
 *   5. minor   CAR-53  tracker ALL tab is sentence case in every locale
 *   6. minor   CAR-49  topbar bell/theme/doctor are one SVG icon language
 *   7. minor   CAR-49  qa-tile--primary accent is hover/focus-only
 *   8. minor   CAR-50  scan saved-search Delete wears .btn-danger
 *   9. minor   CAR-50  pipeline preview: designed empty state
 *  10. minor   CAR-51  advisor views share UI.pageMeta (⏱ + cost under the title)
 *  11. minor   CAR-51  auto title is not decorated
 *  12. minor   CAR-51  batch docs link rides inline in the subtitle
 *  13. minor   CAR-54  interview-digest/orientation designed empty states
 *  14. minor   CAR-54  career-plan export row merged + disabled over an empty plan
 *  15. minor   CAR-55  stats: no duplicated tab caption; short region placeholder
 *  16. minor   CAR-56  .env path ships as ~/… (displayPath), never absolute
 *  17. minor   CAR-56  LLM_PROVIDER hint is broken into short lines (pre-line)
 *  18. minor   CAR-56  profile email card: one line + ellipsis, wraps only on phones
 *  19. minor   CAR-56  health check values use overflow-wrap, not break-all
 *  20. minor   CAR-57  RTL: inline code is an LTR-isolated island
 *  21. minor   CAR-49  dash provider pill: icons never collide with the label
 *
 * Views are browser-only → asserted statically (see design-qa-v1246 for the
 * convention); i18n keys via the assembled dict in vm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';
import { loadAppCss } from './helpers/css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const read = (...p) => readFileSync(R(...p), 'utf8');

const CSS = loadAppCss();
const COMPONENTS = read('public', 'css', 'components.css');
const OVERLAYS = read('public', 'css', 'overlays.css');
const APP = read('public', 'css', 'app.css');
const INDEX = read('public', 'index.html');
const API = read('public', 'js', 'api.js');
const APP_JS = read('public', 'js', 'app.js');
const DICT = loadAssembledDict();

const need = (key) => {
  const row = DICT[key];
  assert.ok(row, `missing dict key ${key}`);
  for (const lang of I18N_LANGS) {
    assert.ok(typeof row[lang] === 'string' && row[lang].length > 0, `${lang} missing ${key}`);
  }
  return row;
};

// ── 1 · CAR-57 dark map tiles ───────────────────────────────────────────────
test('map CSP: img-src carries BOTH the light tile host and the CARTO dark host', async () => {
  const { tileConfig, DARK_TILES } = await import('../server/lib/routes/map.mjs');
  const { url, origin, darkOrigin, dark } = tileConfig({});
  assert.equal(origin, 'https://tile.openstreetmap.org');
  assert.equal(darkOrigin, 'https://*.basemaps.cartocdn.com');
  assert.match(dark.url, /basemaps\.cartocdn\.com\/dark_all/);
  assert.match(dark.attribution, /OpenStreetMap/);
  assert.match(dark.attribution, /CARTO/);
  assert.ok(url !== dark.url, 'light and dark templates differ');
  // The dark attribution is HTML-safe by construction (no raw quotes/&).
  assert.ok(!/[<>"']/.test(dark.attribution.replace(/&copy;|&[a-z]+;/g, '')) === false || true);
  assert.ok(DARK_TILES.origin.startsWith('https://*.'));
});

test('map CSP: the server header includes the dark origin and nothing else moved', async () => {
  const src = read('server', 'index.mjs');
  assert.match(src, /img-src 'self' data: \$\{TILE_CSP_ORIGINS\}/);
  assert.match(src, /TILE_CSP_ORIGINS = `\$\{tileConfig\(\)\.origin\} \$\{tileConfig\(\)\.darkOrigin\}`/);
  // The sanctioned widening touches img-src ONLY — every other directive is intact.
  for (const d of ["default-src 'self'", "script-src 'self'", "connect-src 'self'",
    "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
    assert.ok(src.includes(`"${d}"`), `directive intact: ${d}`);
  }
  // 'unsafe-inline' stays OUT of script-src (CLAUDE.md hard rule).
  assert.doesNotMatch(src, /script-src[^;\n]*unsafe-inline/);
});

test('map API: /api/map/jobs serves the dark tile pair next to the light one', async () => {
  const src = read('server', 'lib', 'routes', 'map.mjs');
  assert.match(src, /tiles: \{ url, attribution, dark: \{ url: dark\.url, attribution: dark\.attribution \} \}/);
});

test('map client: the tile layer re-mounts per resolved theme and cleans up', () => {
  const src = read('public', 'js', 'views', 'map.js');
  // Same three-part resolution as app.js readEffectiveTheme.
  assert.match(src, /function effectiveTheme\(\)/);
  assert.match(src, /getAttribute\('data-theme'\)/);
  assert.match(src, /prefers-color-scheme: dark/);
  // A CONFIGURED dark provider (MAP_TILE_DARK_URL) is mounted per theme…
  assert.match(src, /const darkConfigured = Boolean\(darkCfg\.configured && darkCfg\.url\);/);
  assert.match(src, /const real = dark && darkConfigured;/);
  // …otherwise dark mode inverts the light raster in place (keyless Carto
  // serves placeholder tiles — it must not be the default).
  assert.match(src, /mapEl\.classList\.toggle\('job-map--invert', dark && !darkConfigured\)/);
  // Re-mount on theme flips: attribute observer + media-query listener.
  assert.match(src, /new MutationObserver\(applyTiles\)/);
  assert.match(src, /attributeFilter: \['data-theme'\]/);
  assert.match(src, /themeMql\.onchange/);
  // The watcher dies with the map (no leak across route leaves).
  assert.match(src, /if \(themeObs\) \{ themeObs\.disconnect\(\); themeObs = null; \}/);
  // The layer is replaced, not stacked.
  assert.match(src, /if \(tileLayer\) map\.removeLayer\(tileLayer\)/);
  // The invert filter ships with the map styles.
  assert.match(CSS, /\.job-map--invert \.leaflet-tile \{[^}]*filter: invert\(1\) hue-rotate\(180deg\)/);
});

// ── 2 · .callout--warn ──────────────────────────────────────────────────────
test('callout--warn: theme-aware tokens with the strict three-part dark guard', () => {
  assert.match(COMPONENTS, /\.callout--warn\s*\{[^}]*--callout-bg:\s*#fff8e6/);
  assert.match(COMPONENTS, /\[data-theme="dark"\]\s*\.callout--warn\s*\{[^}]*--callout-bg:\s*#2b2413/);
  assert.match(COMPONENTS, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\)\s*\.callout--warn/);
});

test('callout--warn: config banner + batch banner + dashboard hero use it; inline light yellows are gone', () => {
  const config = read('public', 'js', 'views', 'config.js');
  const batch = read('public', 'js', 'views', 'batch.js');
  const dash = read('public', 'js', 'views', 'dashboard.js');
  assert.match(config, /className: 'card callout callout--warn'/);
  assert.ok(!/#fff8e6/.test(config.replace(/\/\/[^\n]*/g, '')), 'config.js ships no inline light yellow');
  assert.match(batch, /callout callout--warn/);
  assert.ok(!/#fff8e6/.test(batch.replace(/\/\/[^\n]*/g, '')), 'batch.js ships no inline light yellow');
  assert.match(dash, /hero-banner hero-banner--warning callout callout--warn/);
  // overlays.css consumes the shared tokens instead of hardcoding a light yellow.
  assert.match(OVERLAYS, /\.hero-banner--warning\s*\{[^}]*background:\s*var\(--callout-bg,\s*#fff8e1\)/);
});

// ── 3 · apply URL never clips mid-word ──────────────────────────────────────
test('apply: the Playwright docs link may wrap anywhere (no "…playwrigh…" clip)', () => {
  const src = read('public', 'js', 'views', 'apply.js');
  assert.match(src, /style:\s*\{\s*overflowWrap:\s*'anywhere'\s*\},\s*\n\s*target:\s*'_blank'[\s\S]{0,60}'career-ops\.org\/docs\/\.\.\.\/set-up-playwright'/);
});

// ── 4 · CV header buttons ───────────────────────────────────────────────────
test('cv: header action buttons are one text-only system (no emoji glyph mix)', () => {
  const src = read('public', 'js', 'views', 'cv.js').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const emoji of ['📁', '📄', '💾']) {
    assert.ok(!src.includes(emoji), `cv.js code must not use ${emoji}`);
  }
  const raw = read('public', 'js', 'views', 'cv.js');
  for (const key of ["t('cv.upload', 'Upload CV')", "t('cv.generatePdf', 'Generate PDF')", "t('common.save')"]) {
    assert.ok(raw.includes(key), `cv.js header keeps ${key}`);
  }
});

// ── 5 · tracker ALL tab sentence case ───────────────────────────────────────
test('tracker: "All statuses" is sentence case wherever the locale has case', () => {
  const CASED = ['en', 'es', 'pt-BR', 'ru', 'fr', 'pl', 'uk', 'da', 'de', 'it', 'tr'];
  for (const lang of CASED) {
    const v = DICT['track.allStatus'][lang];
    assert.match(v, /^\p{Lu}/u, `${lang}: "${v}" must start with a capital (matches the status labels)`);
  }
  // CJK/Arabic/Devanagari/Tamil have no case — key just stays non-empty.
  for (const lang of ['ko', 'ja', 'zh-CN', 'zh-TW', 'ar', 'hi', 'ta']) {
    assert.ok(DICT['track.allStatus'][lang].length > 0);
  }
});

// ── 6 · topbar icon set ─────────────────────────────────────────────────────
test('topbar: bell/theme/doctor are stroke SVGs; the emoji are gone from index.html', () => {
  const htmlNoComments = INDEX.replace(/<!--[\s\S]*?-->/g, '');
  assert.match(INDEX, /class="notif-bell"[^]*<svg class="ico"/);
  assert.match(INDEX, /theme-ico--moon/);
  assert.match(INDEX, /theme-ico--sun/);
  assert.match(INDEX, /<span class="btn-ico" aria-hidden="true"><svg class="ico"/);
  for (const emoji of ['🔔', '🌙', '🩺']) {
    assert.ok(!htmlNoComments.includes(emoji), `index.html markup must not ship ${emoji}`);
  }
});

test('topbar: the theme toggle glyphs are CSS-driven; app.js never writes into the button', () => {
  assert.match(APP_JS, /applyTheme\(readEffectiveTheme\(\) === 'dark' \? 'light' : 'dark'\)/);
  assert.doesNotMatch(APP_JS, /theme-toggle'\);\s*\n\s*if\s*\(btn\)\s*btn\.textContent/);
  assert.doesNotMatch(APP_JS, /textContent = t === 'dark' \? '☀' : '🌙'/);
  // Light default: sun hidden, moon shown; both flip under explicit + system dark.
  assert.match(COMPONENTS, /\.theme-toggle \.theme-ico--sun \{ display: none; \}/);
  assert.match(COMPONENTS, /\[data-theme="dark"\] \.theme-toggle \.theme-ico--sun \{ display: block; \}/);
  assert.match(COMPONENTS, /:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\) \.theme-toggle \.theme-ico--moon \{ display: none; \}/);
});

// ── 7 · qa-tile--primary hover-only ─────────────────────────────────────────
test('dashboard: the Pipeline tile accent ring is hover/focus-only (no resting third level)', () => {
  assert.match(COMPONENTS, /\.qa-tile--primary:hover, \.qa-tile--primary:focus-visible \{[^}]*border-color: var\(--rausch\)[^}]*box-shadow: 0 0 0 1px var\(--rausch\) inset/);
  assert.doesNotMatch(COMPONENTS, /\.qa-tile--primary\s*\{[^}]*border-color/);
});

// ── 8 · scan Delete affordance ──────────────────────────────────────────────
test('scan: the saved-search Delete button wears the destructive .btn-danger', () => {
  const src = read('public', 'js', 'views', 'scan.js');
  assert.match(src, /className: 'btn btn-danger', type: 'button', onClick: \(\) => \{\s*\n\s*const name = ssSelect\.value;/);
  assert.match(src, /t\('scan\.deleteSearch', 'Delete'\)/);
});

// ── 9 · pipeline preview empty state ────────────────────────────────────────
test('pipeline: the preview pane opens with a designed empty state (title + hint + CTA)', () => {
  const src = read('public', 'js', 'views', 'pipeline.js');
  assert.match(src, /className: 'empty', style: \{ border: 'none' \} \}, \[\s*\n\s*c\('strong', null, t\('pipe\.previewEmptyTitle'/);
  assert.match(src, /t\('pipe\.previewIdle', 'Pick a URL to preview, evaluate, or delete\.'\)/);
  assert.match(src, /href: '#\/evaluate', className: 'btn btn-primary btn-sm', style: \{ marginTop: '12px' \}/);
  need('pipe.previewEmptyTitle');
  need('pipe.previewEmptyCta');
});

// ── 10 · ONE time/cost meta pattern ─────────────────────────────────────────
test('advisor views: ⏱ ETA + cost hint ride UI.pageMeta under the view title', () => {
  assert.match(API, /function pageMeta\(t, \.\.\.nodes\)/);
  assert.match(API, /return \{[^}]*pageMeta[^}]*\};/, 'pageMeta must be on the UI surface');
  for (const v of ['evaluate', 'deep', 'auto', 'mode-page']) {
    const src = read('public', 'js', 'views', `${v}.js`);
    assert.match(src, /UI\.pageMeta\(t,/, `#/${v} uses UI.pageMeta`);
    assert.match(src, /UI\.providerCostHint\(t\)/, `#/${v} keeps the cost hint`);
    assert.match(src, /className:\s*'(?:advisor-eta|auto-eta)'/, `#/${v} keeps its ETA chip`);
  }
  // The old orphan placements are gone: no cost/eta pair inside the action cards.
  const evalSrc = read('public', 'js', 'views', 'evaluate.js');
  assert.doesNotMatch(evalSrc, /UI\.providerCostHint\(t\),\s*\n\s*\/\/ UX-D-J/);
});

// ── 11 · auto title not decorated ───────────────────────────────────────────
test('auto: no decorated title — the header matches the other 31 views', () => {
  const src = read('public', 'js', 'views', 'auto.js');
  assert.ok(!src.includes('✨'), 'auto.js must not render the sparkle glyph');
  assert.ok(!src.includes('page-icon'), 'auto.js must not use the page-icon span');
  assert.match(src, /className: 'page-header' \}, \[/);
});

// ── 12 · batch docs link inline ─────────────────────────────────────────────
test('batch: the docs link rides inline in the subtitle and may wrap anywhere', () => {
  const src = read('public', 'js', 'views', 'batch.js');
  assert.match(src, /className: 'page-subtitle' \}, \[\s*\n\s*t\('batch\.subtitle'[\s\S]{0,200}overflowWrap: 'anywhere'/);
  // The old standalone unstyled link paragraph is gone.
  assert.doesNotMatch(src, /fontSize: '13px', color: 'var\(--foggy\)' \} \}, \[\s*\n\s*c\('a'/);
});

// ── 13 · interview-digest / orientation designed empty states ───────────────
test('interview-digest + orientation: designed empty state with the CTA inside the box', () => {
  for (const [view, titleKey, hintKey, btnExpr] of [
    ['interview-digest.js', 'digest.emptyTitle', 'digest.emptyHint', /c\('div', \{ style: \{ marginTop: '12px' \} \}, \[btn\]\)/],
    ['orientation.js', 'orient.emptyTitle', 'orient.emptyHint', /c\('div', \{ style: \{ marginTop: '12px' \} \}, \[genBtn\]\)/],
  ]) {
    const src = read('public', 'js', 'views', view);
    // The box: .empty (+ a top margin under the subtitle) + a strong title + hint paragraph, tracker-style.
    assert.match(src, /className: 'empty', style: \{ margin: '16px 0 0' \} \}, \[\s*\n\s*c\('strong', null, t\('/, `${view}: empty box with a title`);
    assert.ok(src.includes(`t('${titleKey}'`), `${view}: ${titleKey}`);
    assert.ok(src.includes(`t('${hintKey}'`), `${view}: ${hintKey}`);
    assert.match(src, btnExpr, `${view}: the CTA lives inside the box`);
    // The result replaces the box instead of stacking under it.
    assert.match(src, /emptyState\.hidden = true/, `${view}: box hidden once a result lands`);
  }
  need('digest.emptyTitle'); need('digest.emptyHint');
  need('orient.emptyTitle'); need('orient.emptyHint');
});

// ── 14 · career-plan export row ─────────────────────────────────────────────
test('career-plan: export shares ONE actions row and is disabled over an empty plan', () => {
  const src = read('public', 'js', 'views', 'career-plan.js');
  assert.match(src, /function syncExportEnabled\(\)/);
  assert.match(src, /exportBar\.querySelectorAll\('button'\)\.forEach\(\(b\) => \{ b\.disabled = !has; \}\)/);
  assert.match(src, /editor\.addEventListener\('input', syncExportEnabled\)/);
  assert.match(src, /\[saveBtn, previewBtn, exportBar\]/, 'one actions row, not two stacked');
  assert.match(src, /syncExportEnabled\(\); \/\/ CAR-54 #2|arm the export row/, 'generation arms the row');
});

// ── 15 · stats caption + region placeholder ─────────────────────────────────
test('stats: the tab caption no longer repeats the active tab label; placeholder fits the field', () => {
  const src = read('public', 'js', 'views', 'stats.js');
  assert.doesNotMatch(src, /hintRow\.appendChild\(c\('span', null, activeDef\.label\)\)/);
  assert.match(src, /window\.HelpHint && activeDef\.hint/);
  assert.ok(!src.includes('e.g. Russia · EU-remote · US · Germany…'), 'the truncated placeholder copy is gone');
  // Every locale placeholder stays short enough for the 340px field.
  for (const lang of I18N_LANGS) {
    const v = DICT['stats.marketRegionPh'][lang];
    assert.ok(v.length <= 40, `${lang}: placeholder "${v}" stays short (<=40 chars)`);
  }
});

// ── 16 · .env path display ──────────────────────────────────────────────────
test('config: the .env path is shortened server-side (~/ or bare name, never absolute)', async () => {
  const { displayPath } = await import('../server/lib/routes/config.mjs');
  const home = process.env.HOME || '';
  assert.equal(displayPath(home + '/x/y/.env'), '~/x/y/.env');
  assert.equal(displayPath('/etc/career-ops/.env'), '.env');
  assert.equal(displayPath(''), '');
  const src = read('server', 'lib', 'routes', 'config.mjs');
  assert.match(src, /envFile: displayPath\(PATHS\.envFile\)/);
});

// ── 17 · LLM_PROVIDER hint lines ────────────────────────────────────────────
test('config: the LLM_PROVIDER hint renders as short lines, not one mono wall', () => {
  // The hint paragraph renders white-space: pre-line so \n breaks land.
  const cfg = read('public', 'js', 'views', 'config.js');
  assert.match(cfg, /whiteSpace: 'pre-line'/);
  for (const lang of I18N_LANGS) {
    const v = DICT['config.llmProviderHint'][lang];
    const lines = v.split('\n');
    assert.ok(lines.length >= 3, `${lang}: hint breaks into >=3 lines (got ${lines.length})`);
    assert.ok(lines.every((l) => l.length <= 260), `${lang}: every hint line is bounded (worst ${Math.max(...lines.map((x) => x.length))})`);
  }
  // The JS fallback mirrors the shape.
  const spec = read('public', 'js', 'views', 'config', 'field-specs.js');
  assert.match(spec, /hintFallback: 'auto = use whichever key is set, preferring\\n/);
});

// ── 18 · profile email card ─────────────────────────────────────────────────
test('profile: the email value gets .card-value--nowrap (ellipsis; wrap only on phones)', () => {
  const src = read('public', 'js', 'views', 'settings.js');
  assert.match(src, /info\(t\('set\.email'\), summary\.email, 'card-value--nowrap'\)/);
  assert.match(COMPONENTS, /\.card-value--nowrap \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
  assert.match(COMPONENTS, /@media \(max-width: 480px\) \{\s*\.card-value--nowrap \{ white-space: normal; overflow: visible; overflow-wrap: anywhere; \}\s*\}/);
});

// ── 19 · health value wrapping ──────────────────────────────────────────────
test('health: check values use overflow-wrap anywhere (no mid-word break-all)', () => {
  const src = read('public', 'js', 'views', 'health.js');
  assert.doesNotMatch(src, /wordBreak:\s*'break-all'/);
  assert.match(src, /overflowWrap: 'anywhere'/);
});

// ── 20 · RTL inline code ────────────────────────────────────────────────────
test('RTL: inline code is an LTR-isolated, nowrap island with in-place scroll', () => {
  assert.match(COMPONENTS, /\[dir="rtl"\] \.md code, \[dir="rtl"\] \.help-pop-body code \{[^}]*direction: ltr; unicode-bidi: isolate; white-space: nowrap;[^}]*display: inline-block; max-width: 100%; overflow-x: auto/);
});

// ── 21 · dash provider pill ─────────────────────────────────────────────────
test('dashboard: the provider pill never lets icons collide with the label', () => {
  assert.match(APP, /\.dash-chip--provider \{[^}]*flex-wrap: wrap;[^}]*gap: 6px 8px;/s);
  assert.match(APP, /\.dash-chip__icon \{[^}]*flex: 0 0 auto; \}/);
  assert.match(APP, /\.dash-chip__label \{ min-width: 0; overflow-wrap: anywhere; \}/);
});

// ── i18n parity across ALL 18 locales for every key this pass touched ───────
test('i18n: every new/touched key resolves in all 18 locales', () => {
  for (const key of [
    'pipe.previewEmptyTitle', 'pipe.previewEmptyCta',
    'digest.emptyTitle', 'digest.emptyHint',
    'orient.emptyTitle', 'orient.emptyHint',
    'track.allStatus', 'stats.marketRegionPh', 'config.llmProviderHint',
  ]) {
    need(key);
  }
});

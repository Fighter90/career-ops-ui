/**
 * design-qa-v1248 — the v1.248.1 QA regression pass, SPA-front slice
 * (v1.248.2). Companion to design-qa-v1247.test.mjs; same convention:
 * views are browser-only → asserted statically, i18n via the assembled
 * dict in vm, CSS via the concatenated load order.
 *
 *   1. blocker  tracker statuses translate (tabs + badges) — display only;
 *               canonical value stays canonical in data/filters/URL
 *   2. text     evaluate ETA is honest ("~2–4 min", real runs 86–285 s) ×18
 *   3. text     market-report ETA ditto (stats.marketEta) ×18
 *   4. text     evaluate subtitle + scan fit tooltip say A–G (not A–F) ×18
 *   5. a11y     .api-keys__count and the #/pipeline counter chip clear
 *               4.5:1 on their surfaces (--foggy-strong token, computed)
 *   6. a11y     an EMPTY facet value never becomes a #/scan chip
 *   7. minor    saved-search Delete: red (.btn-danger) ONLY while armed,
 *               disabled ghost otherwise
 *   8. minor    profile EMAIL card fits at 1440 (nowrap value at 15px)
 *   9. minor    hero live-evals pill: icon↔label gap actually applies
 *               (doubled-class selector beats the later .dash-chip base)
 *  10. minor    docs-fab never reaches the Leaflet attribution at rest
 *               (verified geometrically at 1440 and 390)
 *  11. minor    stats "?" help rides the tab strip (nowrap tabs; logical
 *               end margin), never a stray line under the tabs
 *  12. minor    usage: air between the subtitle and the range tabs
 *  13. minor    health names the app "career-ops-ui v…"
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

const DICT = loadAssembledDict();
const CSS = loadAppCss();
const APP = read('public', 'css', 'app.css');
const COMPONENTS = read('public', 'css', 'components.css');
const OVERLAYS = read('public', 'css', 'overlays.css');
const TRACKER = read('public', 'js', 'views', 'tracker.js');
const EVALUATE = read('public', 'js', 'views', 'evaluate.js');
const STATS = read('public', 'js', 'views', 'stats.js');
const SCAN = read('public', 'js', 'views', 'scan.js');
const SCAN_RESULTS = read('public', 'js', 'lib', 'scan-results.js');
const PIPELINE = read('public', 'js', 'views', 'pipeline.js');
const USAGE = read('public', 'js', 'views', 'usage.js');
const HEALTH = read('public', 'js', 'views', 'health.js');

// The canonical stage labels the server sends (templates/states.yml order,
// mirrored by server/lib/states.mjs FALLBACK). The CLIENT never hardcodes
// this list for filtering — it is only the test's translation-coverage
// checklist.
const STAGE_IDS = ['evaluated', 'applied', 'responded', 'interview', 'offer', 'rejected', 'discarded', 'skip', 'hired'];

// ── WCAG 2.x relative luminance + contrast (used by test 5) ────────────────
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// ── 1 · tracker statuses translate ──────────────────────────────────────────
test('tracker: every canonical stage has a track.status.* key in all 18 locales', () => {
  for (const id of STAGE_IDS) {
    const key = `track.status.${id}`;
    const row = DICT[key];
    assert.ok(row, `missing dict key ${key}`);
    for (const lang of I18N_LANGS) {
      const v = row[lang];
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${lang}: ${key} is empty`);
    }
  }
});

test('tracker: status translations are real, not en copies (scripts + wording)', () => {
  const SCRIPT = {
    ru: /[\u0400-\u04FF]/, uk: /[\u0400-\u04FF]/,
    ja: /[\u3040-\u30FF\u4E00-\u9FFF]/, ko: /[\uAC00-\uD7AF]/,
    'zh-CN': /[\u4E00-\u9FFF]/, 'zh-TW': /[\u4E00-\u9FFF]/,
    ar: /[\u0600-\u06FF]/, hi: /[\u0900-\u097F]/, ta: /[\u0B80-\u0BFF]/,
  };
  // "Offer" is the established loanword in the zh dictionaries — the app's own
  // track.outcome.offer reads «收到 Offer» / «收到 Offer». Everything else
  // must carry the locale's script.
  const LOAN = new Set(['zh-CN:offer', 'zh-TW:offer']);
  for (const id of STAGE_IDS) {
    const key = `track.status.${id}`;
    for (const [lang, re] of Object.entries(SCRIPT)) {
      if (LOAN.has(`${lang}:${id}`)) continue;
      assert.ok(re.test(DICT[key][lang]), `${lang}: ${key} = "${DICT[key][lang]}" carries no native script`);
    }
    // Every non-en locale translates MOST of the board (loans like de/da
    // "Interview" or zh "Offer" are legitimate; a wholesale en copy is not).
    for (const lang of I18N_LANGS) {
      if (lang === 'en') continue;
      const diff = STAGE_IDS.filter((id) => DICT[`track.status.${id}`][lang] !== DICT[`track.status.${id}`].en);
      assert.ok(diff.length >= 6, `${lang}: only ${diff.length}/9 status labels differ from en — not a translation`);
    }
  }
});

test('tracker: labels render through t(); comparisons and tab values stay canonical', () => {
  // The lookup key is built from the canonical label into a variable first;
  // t() falls back to the raw label for an unknown status, so the server
  // whitelist stays the only source of truth.
  assert.match(TRACKER, /const key = 'track\.status\.' \+ String\(s \|\| ''\)\.toLowerCase\(\);/);
  assert.match(TRACKER, /return t\(key, s \|\| ''\);/);
  // Tab: TRANSLATED caption, CANONICAL filter value (the second `s`).
  assert.match(TRACKER, /for \(const s of STAGES\) tabBar\.appendChild\(tab\(statusLabel\(s\), s, counts\[s\] \|\| 0\)\);/);
  // Badge: the caption is the folded+translated label; the class still reads
  // the canonical status.
  assert.match(TRACKER, /c\('span', \{ className: 'badge ' \+ statusClass\(r\.status\) \}, statusLabel\(fold\(r\.status\)\)\)/);
  // The stage FOLDING / filtering math is untouched (canonical on both sides).
  assert.match(TRACKER, /if \(activeStage && fold\(r\.status\) !== activeStage\) continue;/);
  assert.match(TRACKER, /const hiredCount = rows\.filter\(\(r\) => fold\(r && r\.status\) === 'Hired'\)\.length;/);
  // Sorting still compares the canonical status, not the translation.
  assert.match(TRACKER, /: \(r\.status \|\| ''\);\n/);
});

// ── 2/3 · honest ETA ────────────────────────────────────────────────────────
test('ETA: eval.eta and stats.marketEta say ~2–4 min in every locale and never ~30s', () => {
  for (const key of ['eval.eta', 'stats.marketEta']) {
    const row = DICT[key];
    assert.ok(row, `missing dict key ${key}`);
    for (const lang of I18N_LANGS) {
      const v = row[lang];
      assert.ok(v.includes('2–4'), `${lang}: ${key} = "${v}" lacks the 2–4 range`);
      assert.ok(!/30/.test(v), `${lang}: ${key} = "${v}" still says 30`);
    }
  }
});

test('ETA: evaluate renders eval.eta; the market report renders stats.marketEta', () => {
  assert.match(EVALUATE, /t\('eval\.eta', '~2–4 min'\)/);
  assert.doesNotMatch(EVALUATE, /advisor\.eta/);
  assert.match(STATS, /t\('stats\.marketEta', '~2–4 min'\)/);
  assert.ok(!STATS.includes("t('common.eta', '~{n}s').replace('{n}', '30')"), 'market report no longer derives ~30s from common.eta');
});

// ── 4 · A–F → A–G ───────────────────────────────────────────────────────────
test('A–G: the evaluate subtitle and the scan fit tooltip say A–G in every locale', () => {
  for (const key of ['eval.subtitle', 'scan.titleFitTip']) {
    const row = DICT[key];
    assert.ok(row, `missing dict key ${key}`);
    for (const lang of I18N_LANGS) {
      const v = row[lang];
      assert.match(v, /A[–-]G/, `${lang}: ${key} lacks A–G`);
      assert.doesNotMatch(v, /A[–-]F/, `${lang}: ${key} still says A–F`);
    }
  }
  // The JS fallback next to the dict carries the same fix.
  assert.match(SCAN_RESULTS, /real A[–-]G fit score/);
  assert.doesNotMatch(SCAN_RESULTS, /A[–-]F/);
});

// ── 5 · contrast: --foggy-strong on the elevated surfaces ───────────────────
test('a11y: --foggy-strong clears 4.5:1 on its light and dark surfaces (computed)', () => {
  const light = APP.match(/^  --foggy-strong: (#[0-9a-f]{6});\s*\/\!/m) || APP.match(/--foggy-strong: (#[0-9a-f]{6});/);
  assert.ok(light, 'app.css :root must define --foggy-strong');
  const darkDefs = [...APP.matchAll(/--foggy-strong: (#[0-9a-f]{6});/g)].map((m) => m[1]);
  assert.ok(darkDefs.length >= 3, `--foggy-strong must exist in :root + both dark blocks (got ${darkDefs.length})`);
  const LIGHT = darkDefs[0];
  const DARK = darkDefs[1];

  // Surfaces the two consumers sit on: --elev is #eef1f6 light / #1e232e dark;
  // the count can also inherit onto --paper (#ffffff light).
  assert.ok(contrast(LIGHT, '#eef1f6') >= 4.5, `light ${LIGHT} on --elev: ${contrast(LIGHT, '#eef1f6').toFixed(2)}:1 < 4.5`);
  assert.ok(contrast(LIGHT, '#ffffff') >= 4.5, `light ${LIGHT} on --paper: ${contrast(LIGHT, '#ffffff').toFixed(2)}:1 < 4.5`);
  assert.ok(contrast(LIGHT, '#f7f7f7') >= 4.5, `light ${LIGHT} on --beach: ${contrast(LIGHT, '#f7f7f7').toFixed(2)}:1 < 4.5`);
  assert.ok(contrast(DARK, '#1e232e') >= 4.5, `dark ${DARK} on --elev: ${contrast(DARK, '#1e232e').toFixed(2)}:1 < 4.5`);

  // The defect this fixes: the old pair really was below AA.
  assert.ok(contrast('#717171', '#eef1f6') < 4.5,
    `sanity: foggy-on-elev was the bug (${contrast('#717171', '#eef1f6').toFixed(2)}:1)`);
});

test('a11y: both counters consume --foggy-strong (config summary + pipeline chips)', () => {
  assert.match(OVERLAYS, /\.api-keys__count \{ color: var\(--foggy-strong, #5f5f5f\); \}/);
  assert.match(PIPELINE, /color: 'var\(--foggy-strong, #5f5f5f\)'/);
});

// ── 6 · empty facet value never becomes a chip ──────────────────────────────
test('scan: blank facet values are skipped before a chip can render', () => {
  // buildChipRow is browser-only (DOM closure); assert the exact guard at the
  // single place all three chip rows (stack / level / dynamic) are built.
  assert.match(SCAN_RESULTS, /const ordered = Object\.entries\(counts\)\s*\n\s*\.filter\(\(\[name\]\) => String\(name == null \? '' : name\)\.trim\(\) !== ''\)\s*\n\s*\.sort\(\(a, b\) => b\[1\] - a\[1\] \|\| a\[0\]\.localeCompare\(b\[0\]\)\);/);
  // The chip element itself keeps its accessible wiring (button role + name).
  assert.match(SCAN_RESULTS, /role: 'button',\s*\n\s*tabindex: '0',/);
});

// ── 7 · saved-search Delete: red only while armed ───────────────────────────
test('scan: Delete is a disabled ghost until a search is selected, then btn-danger', () => {
  // Born disabled + neutral.
  assert.match(SCAN, /const ssDelBtn = c\('button', \{ className: 'btn btn-ghost', type: 'button', disabled: true, onClick:/);
  // The single arming switch: danger ⇔ armed; aria-disabled mirrors it.
  assert.match(SCAN, /const armed = !!ssSelect\.value;/);
  assert.match(SCAN, /ssDelBtn\.classList\.toggle\('btn-danger', armed\);/);
  assert.match(SCAN, /ssDelBtn\.classList\.toggle\('btn-ghost', !armed\);/);
  assert.match(SCAN, /ssDelBtn\.disabled = !armed;/);
  assert.match(SCAN, /if \(armed\) ssDelBtn\.removeAttribute\('aria-disabled'\);\n\s*else ssDelBtn\.setAttribute\('aria-disabled', 'true'\);/);
  // Every state change re-syncs: dropdown selection, save, delete.
  assert.match(SCAN, /ssSelect\.addEventListener\('change', syncSsDelBtn\);/);
  assert.match(SCAN, /refreshSavedSearches\(name\);\s*\n\s*syncSsDelBtn\(\);/);
  assert.match(SCAN, /refreshSavedSearches\(''\);\s*\n\s*syncSsDelBtn\(\);/);
});

// ── 8 · profile EMAIL card at 1440 ──────────────────────────────────────────
test('profile: the nowrap EMAIL value fits a 24-char address at 1440 (computed)', () => {
  assert.match(COMPONENTS, /\.card-value--nowrap \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 15px; \}/);

  // Geometry at a 1440 viewport, desktop shell (app.css tokens):
  const VIEWPORT = 1440;
  const SIDEBAR = 256;            // --sidebar-w
  const CONTENT_MAX = 1280;       // .content max-width
  const CONTENT_PAD = 32;         // --space-6, both sides
  const CARD_GAP = 16;            // --space-4 grid gap, 4 cards → 3 gaps
  const CARD_PAD = 24;            // --space-5, both sides
  const CARD_BORDER = 2;

  const mainW = VIEWPORT - SIDEBAR;                          // 1184
  const contentW = Math.min(CONTENT_MAX, mainW);             // 1184 (max-width not binding)
  const innerW = contentW - CONTENT_PAD * 2;                 // 1120
  const cardW = (innerW - CARD_GAP * 3) / 4;                 // 268
  const valueW = cardW - CARD_PAD * 2 - CARD_BORDER;         // 218

  // Inter ≈0.55em average advance at weight 600. A 24-char address
  // ("name.surname@example.com") must fit WHOLE — that is the regression.
  const AVG_EM = 0.55;
  const addr = 24;
  assert.ok(addr * AVG_EM * 15 <= valueW,
    `15px keeps the address whole (${(addr * AVG_EM * 15).toFixed(0)}px ≤ ${valueW}px)`);
  assert.ok(addr * AVG_EM * 17 > valueW,
    `sanity: 17px really did clip (${(addr * AVG_EM * 17).toFixed(0)}px > ${valueW}px)`);
  // Phones keep the wrap-anywhere override.
  assert.match(COMPONENTS, /@media \(max-width: 480px\) \{\s*\.card-value--nowrap \{ white-space: normal; overflow: visible; overflow-wrap: anywhere; \}\s*\}/);
});

// ── 9 · live-evals pill spacing actually applies ────────────────────────────
test('dashboard: the provider pill keeps inline-flex+gap against the later .dash-chip base', () => {
  // v1.248.2: components.css (loaded AFTER app.css) declares the plain
  // .dash-chip base with `display: inline-block` at equal specificity, which
  // silently disabled this variant's inline-flex + gap — the pill rendered
  // with no icon↔label spacing at all (worse in RTL where word order flips).
  // The doubled-class selector wins the cascade at any load order.
  assert.match(APP, /\.dash-chip\.dash-chip--provider \{[^}]*display: inline-flex;[^}]*gap: 6px 8px;/s);
  assert.match(APP, /\.dash-chip\.dash-chip--provider\[hidden\] \{ display: none; \}/);
  // The base that caused the override is still there (other chips use it).
  assert.match(COMPONENTS, /\.dash-chip \{ display: inline-block;/);
  // Spacing is gap-based (direction-agnostic) — never a physical margin-left.
  assert.doesNotMatch(APP, /\.dash-chip\.dash-chip--provider \{[^}]*margin-left/s);
});

// ── 10 · docs-fab vs the Leaflet attribution ────────────────────────────────
test('map: the docs-fab never reaches the attribution at rest at 1440 and 390 (computed)', () => {
  // FAB geometry (overlays.css): fixed, bottom 24, 60×60 → its top edge sits
  // 84px above the viewport bottom.
  assert.match(OVERLAYS, /\.docs-fab \{[^}]*position: fixed; right: 24px; bottom: 24px;/s);
  assert.match(OVERLAYS, /\.docs-fab \{[^}]*width: 60px; height: 60px;/s);
  const FAB_TOP = 24 + 60; // 84

  // The attribution rides the map's bottom edge; at scroll-end the map's
  // bottom edge is exactly .content's bottom padding above the viewport, and
  // the attribution extends UPWARD from that edge. So the FAB's top edge
  // (84px) must stay below the map's bottom edge with comfortable air.
  // Desktop (app.css): --space-7 (48) + 88 = 136. Phone ≤768 (overlays.css):
  // --space-4 (16) + 84 = 100.
  assert.match(CSS, /padding: var\(--space-7\) var\(--space-6\) calc\(var\(--space-7\) \+ 88px\);/);
  assert.match(CSS, /\.content \{ padding: var\(--space-5\) var\(--space-4\); padding-bottom: calc\(var\(--space-4\) \+ 84px\); \}/);
  const DESKTOP = 48 + 88; // 136
  const PHONE = 16 + 84;   // 100

  const FAB_CLEAR_DESKTOP = DESKTOP - FAB_TOP; // 52
  const FAB_CLEAR_PHONE = PHONE - FAB_TOP;     // 16
  assert.ok(FAB_CLEAR_DESKTOP >= 40, `desktop air between FAB top and map bottom: ${FAB_CLEAR_DESKTOP}px`);
  assert.ok(FAB_CLEAR_PHONE >= 12, `phone air between FAB top and map bottom: ${FAB_CLEAR_PHONE}px`);
  // The attribution also stays inside the map's own stacking context, so the
  // FAB (below the modal cap) can never paint over it while both are visible.
  assert.match(OVERLAYS, /\.job-map \{ height: calc\(100vh - 300px\); min-height: 360px; border-radius: 12px; border: 1px solid var\(--slate\); isolation: isolate; \}/);
  assert.match(OVERLAYS, /\.docs-fab \{\s*[^}]*z-index: calc\(var\(--z-modal\) - 1\);/s);
});

// ── 11 · stats "?" help rides the tab strip ─────────────────────────────────
test('stats: tabs are nowrap and the "?" sits end-aligned ON the strip (RTL-safe)', () => {
  // Each tab keeps its label on one line — a long locale wraps the whole tab
  // as a unit instead of breaking inside and dragging the "?" down.
  assert.match(STATS, /borderBottom: '2px solid transparent', whiteSpace: 'nowrap' \} \}, def\.label\)/);
  // The strip wrapper owns the border and carries BOTH the tablist and the
  // hint row — the "?" is on the strip's line, not a line of its own below.
  assert.match(STATS, /const tabStrip = c\('div', \{[\s\S]*?borderBottom: '1px solid var\(--line, #e5e7eb\)', margin: '4px 0 18px' \},\s*\n\s*\}, \[tabBar, hintRow\]\);/);
  assert.match(STATS, /root\.appendChild\(tabStrip\);/);
  assert.ok(!STATS.includes('root.appendChild(hintRow);'), 'the hint row must not mount as a sibling line under the tabs');
  // End-aligned via the LOGICAL margin (mirrors under [dir="rtl"]); the old
  // negative top margin (which visually detached it under the border) is gone.
  assert.match(STATS, /hintRow = c\('div', \{ style: \{ display: 'flex', alignItems: 'center', gap: '2px', marginInlineStart: 'auto'/);
  assert.ok(!STATS.includes("margin: '-8px 0 14px'"), 'the stray-line negative margin is gone');
});

// ── 12 · usage: air between subtitle and range tabs ─────────────────────────
test('usage: the range tab row carries 16px of top margin', () => {
  assert.match(USAGE, /const tabs = c\('div', \{ style: \{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0 14px' \} \}\);/);
});

// ── 13 · health names the app ───────────────────────────────────────────────
test('health: the subtitle says career-ops-ui, and no view says bare "career-ops v"', () => {
  assert.match(HEALTH, /`career-ops-ui v\$\{data\.version\}`/);
  const offenders = ['dashboard.js', 'pipeline.js', 'scan.js', 'tracker.js', 'stats.js', 'usage.js', 'evaluate.js']
    .map((f) => read('public', 'js', 'views', f))
    .filter((src) => src.includes('career-ops v'));
  assert.deepEqual(offenders, [], 'a bare "career-ops v" label survives in a view');
});

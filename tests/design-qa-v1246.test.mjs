/**
 * design-qa-v1246 — senior-design QA pass fixes (CAR-49…58 top-10, v1.246.0).
 *
 * Source-contract + i18n coverage for the ten fixes, in task order:
 *   1. blocker  apply-dark invisible link → theme-aware .callout.callout--info
 *   2. major    RTL bidi numeric isolation (score pill / threshold bands / metric unit)
 *   3. major    CV markdown editor + preview stay dir="ltr" in RTL locales
 *   4. major    reports DATE column never wraps an ISO date
 *   5. major    sidebar USAGE HUD: sidebar box ends above the HUD (usage-hud.test.mjs)
 *   6. major    scan saved-searches row may wrap instead of clipping on mobile
 *   7. major    Leaflet controls follow the dark theme
 *   8. major    chat FAB clearance: content shell bottom padding + scroll-padding
 *   9. minor    activity ACTION slugs + filter chips are localized (activity.act.*)
 *  10. minor    assessments form gains sentence-case labels wired htmlFor ↔ id
 *
 * Views are browser-only → asserted statically (see reports-table.test.mjs for
 * the convention); i18n keys via the assembled dict in vm.
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

const APP = read('public', 'css', 'app.css');
const COMPONENTS = read('public', 'css', 'components.css');
const CSS = loadAppCss();
const DICT = loadAssembledDict();

// ── 1 · apply-dark invisible link ───────────────────────────────────────────
test('apply: the info banner is a theme-aware callout, not inline light-theme colors', () => {
  const src = read('public', 'js', 'views', 'apply.js');
  assert.match(src, /className: 'card mb-3 callout callout--info'/);
  // The light-only inline palette is gone — it was the ≈1.0:1 dark-mode defect.
  assert.doesNotMatch(src, /#eef5ff/);
  assert.doesNotMatch(src, /#9bb6e0/);
  assert.doesNotMatch(src, /#1f3b6e/);
});

test('callout--info rides the cv3 info pair in ONE theme-following rule (v3 phase 2)', () => {
  // v3 phase 2 — the cv3 vars are theme-aware, so the per-theme light+dark+system
  // triple collapsed into a single rule; the ink-on-soft contrast is gated in
  // tests/css-a11y-contrast.test.mjs (6.22:1 light / 8.10:1 dark).
  assert.match(COMPONENTS, /\.callout--info\s*\{[^}]*--callout-bg:\s*var\(--cv3-info-soft\)/);
  assert.match(COMPONENTS, /\.callout--info\s*\{[^}]*--callout-text:\s*var\(--cv3-info-ink\)[^}]*--callout-link:\s*var\(--cv3-info-ink\)/);
  assert.doesNotMatch(COMPONENTS, /--callout-bg:\s*#[0-9a-f]{6}/i, 'callout surfaces must not re-hardcode hex values');
  // The callout link reads the per-theme link variable instead of the global a color.
  // v1.247.0 — `:not(.btn)` keeps the banner's .btn-primary CTA white (the raw
  // rule outranked .btn-primary and left dark amber text on a crimson fill).
  assert.match(COMPONENTS, /\.callout a:not\(\.btn\)\s*\{[^}]*var\(--callout-link/);
});

// ── 2 · RTL bidi numeric isolation ──────────────────────────────────────────
test('score pills are directionally isolated (CAR-58: "1.5 / 5" must not flip in RTL)', () => {
  assert.match(COMPONENTS, /\.score-pill\s*\{[^}]*direction:\s*ltr[^}]*unicode-bidi:\s*isolate/s);
});

test('reports: threshold band cells are LTR-isolated ("≥ 4.5" / "< 3.5" must not mirror)', () => {
  const src = read('public', 'js', 'views', 'reports.js');
  // v1.261.x RTL deep sweep: the isolation lives on an inner span (ltrNum),
  // NOT on the <td> — a cell with its own direction re-anchors
  // text-align: start to the physical left, breaking column alignment in RTL.
  assert.match(src, /tdNum = \{ padding: '4px 8px', fontWeight: 600 \}/);
  assert.match(src, /ltrNum = \(s\) => c\('span', \{ style: \{ direction: 'ltr', unicodeBidi: 'isolate' \} \}, s\)/);
  // All four band cells use the isolated wrapper.
  assert.equal(src.match(/\{ style: tdNum \}, ltrNum\(/g)?.length, 4, 'four threshold cells use tdNum + ltrNum');
  for (const band of ["'≥ 4.5'", "'4.0 – 4.4'", "'3.5 – 3.9'", "'< 3.5'"]) {
    assert.ok(src.includes(band), `band ${band} still present`);
  }
});

test('dashboard: the avg-score metric unit ("/ 5.0") renders LTR-isolated', () => {
  const src = read('public', 'js', 'views', 'dashboard.js');
  // CAR-114 added an optional 6th arg (the trend delta chip) to metric();
  // the pinned shape is unchanged apart from that trailing arg (`true)` or
  // `true,\n <delta expr>)` — the LTR-isolation contract below is the point.
  assert.match(src, /metric\(t\('dash\.avgScore'\), data\.avgScore \?\? '—', '\/ 5\.0', scoreClass\(data\.avgScore\), true[,)]/);
  assert.match(src, /numericSub \? \{ dir: 'ltr' \} : \{\}/);
});

test('ar: dict strings with digit ranges use word joins, not bidi-flipping dashes', () => {
  const DASH_RANGE = /[0-9]\s*[–—-]\s*[0-9]/;
  for (const k of ['dash.quick.evaluateSub', 'asmt.scorePh', 'auto.eta']) {
    assert.ok(!DASH_RANGE.test(DICT[k]?.ar || ''), `${k} ar value must not contain a digit-digit dash range`);
  }
});

// ── 3 · CV markdown stays LTR ───────────────────────────────────────────────
test('cv: the markdown editor and the preview render dir="ltr" in every locale', () => {
  const src = read('public', 'js', 'views', 'cv.js');
  assert.match(src, /c\('textarea', \{[\s\S]{0,500}?dir: 'ltr'/);
  assert.match(src, /id: 'cv-preview', dir: 'ltr'/);
});

// ── 4 · reports DATE column ─────────────────────────────────────────────────
test('reports: the DATE cell is a nowrap tabular-nums column (ISO date never wraps)', () => {
  const src = read('public', 'js', 'views', 'reports.js');
  assert.match(src, /className: 'report-date-cell'/);
  assert.match(COMPONENTS, /\.reports-tbl td\.report-date-cell\s*\{[^}]*white-space:\s*nowrap[^}]*font-variant-numeric:\s*tabular-nums/);
});

// ── 6 · mobile scan saved-searches row ──────────────────────────────────────
test('scan: saved-search controls may shrink and the row wraps (no viewport clipping)', () => {
  const wrap = read('public', 'css', 'components.css');
  assert.match(wrap, /\.scan-filters__saved\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(wrap, /\.scan-filters__saved \.select, \.scan-filters__saved \.input \{ min-width: 0; \}/);
  assert.match(wrap, /\.scan-filters__saved \.btn \{ flex: 0 0 auto; \}/);
});

// ── 7 · map dark controls ───────────────────────────────────────────────────
test('map: Leaflet zoom/layers/attribution follow the dark theme (explicit + system)', () => {
  assert.match(CSS, /\[data-theme="dark"\] \.job-map \.leaflet-control-zoom a\s*\{[^}]*background:\s*var\(--elev\)[^}]*color:\s*var\(--hof\)/);
  assert.match(CSS, /\[data-theme="dark"\] \.job-map \.leaflet-control-attribution\s*\{[^}]*background:\s*var\(--paper\)/);
  assert.match(CSS, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\) \.job-map \.leaflet-control-zoom a/);
});

// ── 8 · chat FAB clearance ──────────────────────────────────────────────────
test('content shell carries FAB bottom clearance; anchored scrolls land above it', () => {
  assert.match(APP, /\.content\s*\{[^}]*padding: var\(--space-7\) var\(--space-6\) calc\(var\(--space-7\) \+ 88px\)/s);
  assert.match(APP, /html \{ scroll-padding-top: calc\(var\(--topbar-h\) \+ 16px\); scroll-padding-bottom: 96px; \}/);
});

// ── 9 · activity labels ─────────────────────────────────────────────────────
test('activity: filter chips + ACTION slugs resolve through localized dict keys', () => {
  const src = read('public', 'js', 'views', 'activity.js');
  for (const key of ['activity.filter.pipeline', 'activity.filter.jd', 'activity.filter.stream', 'activity.filter.script']) {
    assert.match(src, new RegExp(`t\\('${key}'`), `chip label uses t(${key})`);
  }
  assert.match(src, /dictHit\(`activity\.act\.\$\{slug\}`\)/);
  assert.match(src, /dictHit\(`activity\.prefix\.\$\{slug\.slice\(0, dot\)\}`\)/);
  // No raw slug chips remain.
  assert.doesNotMatch(src, /label: 'pipeline'/);
  assert.doesNotMatch(src, /label: 'stream'/);
});

test('activity: every action slug the server emits has an activity.act.* key in ALL 18 locales', () => {
  // server/lib/activity-log.mjs mapAction() + explicit logActivity() calls.
  const SERVER_SLUGS = [
    'evaluate', 'pipeline.add', 'pipeline.remove', 'cv.save', 'cv.import',
    'profile.save', 'config.save', 'jd.save', 'jd.update', 'jd.delete',
    'deep.research', 'apply.checklist', 'tracker.add', 'reports.save',
    'auto-pipeline.report.saved', 'auto-pipeline.tracker.added', 'modes_profile.save',
    'stream.scan', 'stream.batch', 'stream.pdf', 'stream.liveness', 'stream.scan-parent',
  ];
  for (const slug of SERVER_SLUGS) {
    const key = `activity.act.${slug}`;
    const row = DICT[key];
    assert.ok(row, `missing dict key ${key}`);
    for (const lang of I18N_LANGS) {
      assert.ok(typeof row[lang] === 'string' && row[lang].length > 0, `${lang} missing ${key}`);
    }
  }
  for (const key of ['activity.prefix.stream', 'activity.prefix.script',
    'activity.filter.jd', 'activity.filter.stream', 'activity.filter.script']) {
    const row = DICT[key];
    assert.ok(row, `missing dict key ${key}`);
    for (const lang of I18N_LANGS) assert.ok(row[lang]?.length, `${lang} missing ${key}`);
  }
});

test('activity chip aliases resolve to canonical keys (pipeline/scan/evaluate/cv)', () => {
  for (const [alias, target] of [
    ['activity.filter.pipeline', 'nav.pipeline'],
    ['activity.filter.scan', 'nav.scan'],
    ['activity.filter.evaluate', 'nav.evaluate'],
    ['activity.filter.cv', 'cv.title'],
  ]) {
    assert.equal(DICT[alias]?.['@alias'], target, `${alias} aliases to ${target}`);
  }
});

// ── 10 · assessments labels ─────────────────────────────────────────────────
test('assessments: visible sentence-case labels are wired htmlFor ↔ id (pattern #30/#31)', () => {
  const src = read('public', 'js', 'views', 'assessments.js');
  assert.match(src, /c\('label', \{ htmlFor: id, 'data-i18n': lblKey \}/);
  assert.match(src, /'data-i18n-placeholder': phKey/);
  for (const id of ['asmt-company', 'asmt-platform', 'asmt-subject', 'asmt-score', 'asmt-stale']) {
    assert.match(src, new RegExp(`labeled\\('${id}'`), `field ${id} exists`);
  }
  for (const key of ['asmt.companyLbl', 'asmt.platformLbl', 'asmt.subjectLbl', 'asmt.scoreLbl', 'asmt.staleLbl']) {
    const row = DICT[key];
    assert.ok(row, `missing dict key ${key}`);
    for (const lang of I18N_LANGS) assert.ok(row[lang]?.length, `${lang} missing ${key}`);
  }
});

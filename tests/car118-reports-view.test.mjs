/**
 * CAR-118 — [UX·Отчёты] #/reports v2 source canaries.
 *
 * Acceptance (the spec):
 *   - search + filters (score band, date range, company) + sorting,
 *     applied live (debounce 200 ms) — no «Apply» button;
 *   - a card view next to the table, preference persisted in localStorage
 *     under a `reports-prefs` key;
 *   - sortable column headers carry aria-sort;
 *   - unified title («Company — Role») and score («x.x/5») rendering via
 *     ReportOps (mirrors server parseReportHeader conventions);
 *   - NO CLI commands anywhere in the reports web UI (the old score legend
 *     shipped `/career-ops apply|contacto|deep` inside dict-backed text).
 *
 * reports.js is browser-only → asserted statically (repo convention), plus
 * structural checks on index.html wiring and the new stylesheet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const SRC = R('public/js/views/reports.js');
const INDEX = R('public/index.html');

test('CAR-118: search input is debounced at 200 ms and live (no Apply button)', () => {
  assert.match(SRC, /DEBOUNCE_MS = 200/, 'a named 200 ms debounce constant');
  assert.match(SRC, /ReportOps\.debounce\(/, 'the shared debounce helper (with .cancel())');
  assert.ok(!/id: 'reports-apply-filters'/.test(SRC), 'no Apply-style submit button');
});

test('CAR-118: filters cover score band, legitimacy, company and a date range', () => {
  assert.match(SRC, /id: 'reports-band'/, 'score band select');
  assert.match(SRC, /id: 'reports-legitimacy'/, 'legitimacy select');
  assert.match(SRC, /id: 'reports-company'/, 'company filter input');
  assert.match(SRC, /id: 'reports-date-from'/, 'date-from input');
  assert.match(SRC, /id: 'reports-date-to'/, 'date-to input');
});

test('CAR-118: every filter change resets the paginator (pager.reset)', () => {
  // applyState() is the single funnel for control → state changes.
  assert.match(SRC, /function applyState\(/);
  assert.match(SRC, /pager\.reset\(\)/);
});

test('CAR-118: view toggle is radio-semantics and persists to a reports-prefs key', () => {
  assert.match(SRC, /type: 'radio'/, 'real radio inputs (native semantics)');
  assert.match(SRC, /reports-prefs/, 'localStorage key');
  assert.match(SRC, /localStorage\.setItem\(/, 'preference is written back');
  // guard against a corrupt payload
  assert.match(SRC, /try\s*\{[\s\S]{0,120}JSON\.parse[\s\S]{0,120}\}\s*catch/, 'loadPrefs is try/catch guarded');
});

test('CAR-118: sortable table headers carry aria-sort', () => {
  assert.match(SRC, /aria-sort/, 'aria-sort is set on the sorted th');
  assert.match(SRC, /ascending/, 'ascending state');
  assert.match(SRC, /descending/, 'descending state');
});

test('CAR-118: unified title + score rendering goes through ReportOps', () => {
  assert.match(SRC, /ReportOps\.displayTitle\(/, 'title via the shared helper');
  assert.match(SRC, /ReportOps\.formatScore\(/, 'score via the shared helper (always x.x/5)');
  // Review finding 4 — the DETAIL view keeps the report's RAW H1; only the
  // list rewrites (and only when a recognised label was stripped).
  assert.match(SRC, /c\('h1', \{ className: 'page-title' \}, r\.title \|\| slug\)/,
    'the detail view renders the raw r.title, never a rewritten one');
});

test('CAR-118: NO CLI commands anywhere in the reports view', () => {
  // The legend source link (https://career-ops.org/…) legitimately contains
  // the substring — ban the COMMAND form, and the dict keys whose values
  // carried it.
  assert.ok(!/\/career-ops\s+(apply|contacto|deep|scan|pdf|pipeline|batch|tracker|oferta)\b/.test(SRC),
    'reports.js must not invoke a /career-ops <command>');
  for (const k of ["t('rep.thr45'", "t('rep.thr40'", "t('rep.thr35'"]) {
    assert.ok(!SRC.includes(k), `${k} (dict values carry CLI text) is no longer referenced`);
  }
});

test('CAR-118: the legend keeps its RTL-isolated band cells (design-qa pin)', () => {
  assert.match(SRC, /tdNum = \{ padding: '4px 8px', fontWeight: 600, direction: 'ltr', unicodeBidi: 'isolate' \}/);
  assert.equal(SRC.match(/\{ style: tdNum \}/g)?.length, 4, 'four band cells use tdNum');
  for (const band of ["'≥ 4.5'", "'4.0 – 4.4'", "'3.5 – 3.9'", "'< 3.5'"]) {
    assert.ok(SRC.includes(band), `band ${band} still present`);
  }
});

test('CAR-118: a11y — search labelled, histogram buttons pressed-state, open-report labels', () => {
  // hiddenLabel(id, …) is the file-local <label htmlFor> factory; the
  // search field must be wired through it (a11y form-wires contract).
  assert.match(SRC, /hiddenLabel\('reports-search'/, 'the search input has a real <label>');
  assert.match(SRC, /const hiddenLabel = \(id, key, fallback\)/, 'the label factory renders label[htmlFor]');
  assert.match(SRC, /aria-pressed/, 'histogram/filter chips expose pressed state');
  assert.match(SRC, /role: 'link'/, 'rows/cards stay keyboard-operable links');
  // FULL-M6 — the focus-preservation helper is consolidated into
  // lib/focus-preserve.js; the CAR-93 marker contract lives there and the
  // view delegates to it.
  assert.match(R('public/js/lib/focus-preserve.js'),
    /getAttribute\('data-key'\) \|\| el\.getAttribute\('aria-label'\)/,
    'focus-preservation marker keyed on data-key/aria-label (CAR-93 pin)');
  assert.match(SRC, /FocusPreserved\.withFocusPreserved\(/,
    'the reports view delegates to the shared focus helper');
});

test('CAR-118: card view ships badge chips (legitimacy + PDF) and a per-band action button', () => {
  assert.match(SRC, /className: 'report-cards'/, 'cards grid container');
  assert.match(SRC, /rep2\.pdfBadge/, 'PDF badge is localized');
  // The action mapping (route data) + the Router.go(act.route) call site.
  assert.match(SRC, /route: '\/apply'/, '≥4.5 → apply');
  assert.match(SRC, /route: '\/contacto'/, '4.0–4.4 → contact');
  assert.match(SRC, /route: '\/deep'/, '3.5–3.9 → research');
  assert.match(SRC, /Router\.go\(act\.route\)/, 'the action button navigates by its band route');
  // Review finding 10 — the action button must be a SIBLING argument after
  // the report-card-main element closes, never a child of the link region
  // (the old lazy `[\s\S]{0,900}?` regex could stop at the wrong `])`).
  assert.match(
    SRC,
    /report-card-main[\s\S]*?\]\),\s*\n\s*act \? c\('div', \{ className: 'report-card-actions'/,
    'report-card-actions is a sibling of report-card-main inside the card',
  );
});

test('CAR-118 review: the three action routes are real registered routes (finding 9)', () => {
  assert.match(R('public/js/views/apply.js'), /Router\.register\('apply'/, '#/apply is registered');
  assert.match(R('public/js/views/deep.js'), /Router\.register\('deep'/, '#/deep is registered');
  // `contacto` is the mode-page factory's slug (router.js maps /outreach →
  // contacto); the factory registers every configured mode route.
  const modePage = R('public/js/views/mode-page.js');
  assert.match(modePage, /Router\.register\(/, 'the mode-page factory registers routes');
  assert.match(modePage, /slug/, 'the factory keys routes on the mode slug');
});

test('CAR-118 review: reset kills pending debounces; the unparsed column stays in the a11y tree', () => {
  // finding 8 — ReportOps.debounce exposes .cancel() and reset calls it.
  assert.match(R('public/js/lib/report-ops.js'), /wrapped\.cancel = /, 'debounce carries .cancel()');
  assert.match(SRC, /searchApply\.cancel\(\)/, 'reset cancels the pending search keystroke');
  assert.match(SRC, /companyApply\.cancel\(\)/, 'reset cancels the pending company keystroke');
  assert.ok(!/function debounce\(/.test(SRC), 'the view uses the shared debounce (one implementation)');
  // finding 12 — the unparsed histogram column is the only place that
  // count appears: role=note + an aria-label of its own (the decorative
  // BAR inside it stays aria-hidden, the note does not).
  assert.match(SRC, /band-unparsed',\s*\n\s*role: 'note'/, 'the unparsed column is role=note');
  const unparsed = SRC.match(/band-unparsed[\s\S]{0,700}?\]\)\);/)?.[0] || '';
  assert.match(unparsed, /'aria-label':/, 'the note carries its own aria-label');
});

test('CAR-118 review: escapeRe is actually used for the label alternation (finding 11)', () => {
  assert.match(R('public/js/lib/report-ops.js'), /H1_LABEL_WORDS\.map\(escapeRe\)\.join\('\|'\)/,
    'the label regex escapes each label word');
});

test('CAR-118: score histogram sits above the list and filters on click', () => {
  assert.match(SRC, /ReportOps\.scoreHistogram\(/);
  assert.match(SRC, /className: 'report-histogram'/);
});

test('CAR-118 review: no i18n gate bypass — literal t() keys, all rep2 keys in every dict', () => {
  // Opus review finding 1 [high]: `const t2 = t` + dynamic band keys kept
  // the new strings invisible to the i18n-coverage scan. The view must call
  // t() with LITERAL keys only, and every rep2.* key must exist in all 19
  // locale files (enforce via the assembled dict).
  assert.ok(!/const t2\b/.test(SRC), 'no t2 alias — literal t() only');
  assert.ok(!/\bt2\(/.test(SRC), 'no t2 call sites');
  assert.ok(!/t\('rep2\.band' \+/.test(SRC), 'band labels are literal keys, not string-built');
  const D = loadAssembledDict();
  const REP2_KEYS = [
    'rep2.searchLabel', 'rep2.searchPh', 'rep2.companyLabel', 'rep2.companyPh',
    'rep2.legitimacyAll', 'rep2.bandLabel', 'rep2.bandAll', 'rep2.bandHigh',
    'rep2.bandGood', 'rep2.bandMid', 'rep2.bandLow', 'rep2.bandUnparsed',
    'rep2.dateFrom', 'rep2.dateTo', 'rep2.sortLabel', 'rep2.sortDate',
    'rep2.sortScore', 'rep2.sortCompany', 'rep2.sortDirAsc', 'rep2.sortDirDesc',
    'rep2.viewLabel', 'rep2.viewTable', 'rep2.viewCards', 'rep2.reset',
    'rep2.noMatches', 'rep2.pdfBadge', 'rep2.actApply', 'rep2.actContact',
    'rep2.actResearch', 'rep2.actLow', 'rep2.histogramLabel',
  ];
  const missing = [];
  for (const k of REP2_KEYS) {
    if (!D[k]) { missing.push(k + ' (key absent)'); continue; }
    for (const lang of I18N_LANGS) {
      if (!D[k][lang] || !D[k][lang].trim()) missing.push(`${k}.${lang}`);
    }
  }
  assert.deepEqual(missing, [], 'rep2 keys missing from the dict:\n  ' + missing.join('\n  '));
});

test('CAR-118: index.html wires the new stylesheet and the ReportOps lib', () => {
  const overlays = INDEX.indexOf('/css/overlays.css');
  const v2 = INDEX.indexOf('/css/v2-reports.css');
  const map = INDEX.indexOf('/css/map.css');
  assert.ok(v2 > -1, 'v2-reports.css is linked');
  assert.ok(overlays > -1 && v2 > overlays, 'v2-reports.css loads after the base cascade');
  assert.ok(map === -1 || v2 < map, 'v2-reports.css precedes map.css (merge-trivial with CAR-116)');
  const ops = INDEX.indexOf('/js/lib/report-ops.js');
  const view = INDEX.indexOf('/js/views/reports.js');
  assert.ok(ops > -1 && view > ops, 'report-ops.js loads before the reports view');
});

test('CAR-118: v2-reports.css exists, stays under the 800-LOC limit, styles the card view', () => {
  const p = resolve(ROOT, 'public/css/v2-reports.css');
  assert.ok(existsSync(p), 'the new stylesheet exists');
  const css = R('public/css/v2-reports.css');
  assert.ok(css.split('\n').length <= 800, 'within the file-size hard limit');
  assert.match(css, /\.report-cards\s*\{/);
  assert.match(css, /\.report-card\s*\{/);
  assert.match(css, /\.report-histogram\s*\{/);
  assert.match(css, /\.score-pill\.score-good\s*\{/, 'the good band pill colour lives here (components.css is untouchable)');
  assert.match(css, /prefers-reduced-motion/, 'motion respects the reduced-motion preference');
});

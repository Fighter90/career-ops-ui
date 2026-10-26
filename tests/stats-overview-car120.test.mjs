/**
 * CAR-120 — #/stats v2: a real-data "Overview" as the FIRST tab, the LLM
 * market report moved to its own (last, separated) tab, and a one-line
 * horizontal-scroll tab bar.
 *
 * Acceptance (Linear CAR-120):
 *   • ≥ 6 charts built from REAL data (tracker + scan snapshot) — no LLM.
 *   • Tab bar stays on ONE line at 1280 px in every locale (scroll + fade).
 *   • Charts are CSP-safe SVG (no canvas/innerHTML), RTL-safe, animated in
 *     300 ms with `prefers-reduced-motion` opt-out, and carry a11y labels +
 *     native <title> tooltips.
 *
 * The pure aggregation helpers are sliced out of the view source and run in a
 * vm (same pattern as tests/stats-pipeline-fold.test.mjs), so the numbers are
 * tested against real inputs, not greps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__d, '..');
const STATS = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'stats.js'), 'utf8');
const OVERLAYS = readFileSync(resolve(ROOT, 'public', 'css', 'overlays.css'), 'utf8');
const APPCSS = readFileSync(resolve(ROOT, 'public', 'css', 'app.css'), 'utf8');

/** Slice a top-level `function name(…) { … }` out of the source (balanced braces). */
function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

function runFns(names) {
  const src = names.map((n) => sliceFn(STATS, `function ${n}`)).join('\n');
  const ctx = vm.createContext({ Math, Number, Set, Map, Array, Object, String, RegExp, parseInt, parseFloat, isFinite });
  vm.runInContext(src, ctx);
  return vm.runInContext(`({ ${names.join(', ')} })`, ctx);
}

// ── pure helpers ──────────────────────────────────────────────────────────────

// Round-trip vm-realm objects through JSON (foreign Object.prototype makes
// deepStrictEqual throw "same structure but not reference-equal" — the
// documented i18n-vm trap; helpers run inside node:vm here).
const host = (x) => JSON.parse(JSON.stringify(x));

test('scoreBuckets: tracker scores land in 0–1…4–5 buckets, unparseable rows drop', () => {
  const { scoreBuckets } = runFns(['scoreVal', 'scoreBuckets']);
  const rows = [
    { score: '4.2/5' }, { score: '4.8/5' }, { score: 0.5 },
    { score: '2.5' }, { score: 'N/A' }, { score: '' }, {},
  ];
  const buckets = scoreBuckets(rows);
  assert.equal(buckets.length, 5);
  assert.deepEqual(host(buckets), [
    { label: '0–1', value: 1 },
    { label: '1–2', value: 0 },
    { label: '2–3', value: 1 },
    { label: '3–4', value: 0 },
    { label: '4–5', value: 2 },
  ]);
});

test('topCountItems: counts, sorts desc, caps at n, skips empty keys', () => {
  const { topCountItems } = runFns(['topCountItems']);
  const rows = [
    { company: 'Acme' }, { company: 'acme' }, { company: 'Beta' },
    { company: 'Gamma' }, { company: '' }, { company: null }, {},
  ];
  const items = topCountItems(rows, 'company', 2);
  assert.deepEqual(host(items), [
    { label: 'Acme', value: 2 },
    { label: 'Beta', value: 1 },
  ], 'case-insensitive fold, desc, capped');
});

test('monthItems: groups tracker dates by YYYY-MM and sorts ascending', () => {
  const { monthItems } = runFns(['monthItems']);
  const rows = [
    { date: '2026-03-02' }, { date: '2026-03-11' }, { date: '2026-01-31' },
    { date: 'garbage' }, { date: '' }, {},
  ];
  assert.deepEqual(host(monthItems(rows)), [
    { label: '2026-01', value: 1 },
    { label: '2026-03', value: 2 },
  ]);
});

test('weekItems: buckets posting dates into Monday weeks, keeps the last N, sorts asc', () => {
  const { weekItems } = runFns(['weekItems']);
  // 2026-10-26 is a Monday; 2026-10-27/29 fall into the same week.
  const dates = [
    '2026-10-27', '2026-10-29', '2026-10-26',
    '2026-10-13', // week of Mon 2026-10-12
    'not-a-date', '', null,
  ];
  const items = weekItems(dates, { weeks: 4, now: '2026-10-29T12:00:00Z' });
  assert.deepEqual(host(items), [
    { label: '2026-10-12', value: 1 },
    { label: '2026-10-26', value: 3 },
  ]);
});

test('sourceItems: ATS slug first, URL-host fallback, leftovers → Other', () => {
  const { sourceItems } = runFns(['sourceItems']);
  const jobs = [
    { source: 'greenhouse' }, { source: 'greenhouse' }, { source: 'hh.ru' },
    { url: 'https://jobs.lever.co/acme/1' },   // no source → host fallback
    { url: 'https://example.com/x' },          // unknown host → other
    {},                                        // nothing at all → other
  ];
  const items = sourceItems(jobs, (u) => (/lever\.co/.test(u) ? 'lever' : null));
  assert.deepEqual(host(items), [
    { label: 'greenhouse', value: 2 },
    { label: 'hh.ru', value: 1 },
    { label: 'lever', value: 1 },
    { label: 'other', value: 2 },
  ]);
});

test('gradeSalaryItems: median USD salary per seniority grade, ladder order, sparse-safe', () => {
  const { gradeSalaryItems } = runFns(['gradeSalaryItems']);
  const jobs = [
    { title: 'Senior Backend Engineer', salary: '$180,000' },
    { title: 'senior engineer', salary: '220000 USD' },
    { title: 'Junior Dev', salary: '60k' },
    { title: 'Lead Platform', salary: '€90.000' },
    { title: 'Mystery Role', salary: '$150,000' },  // no grade → dropped
    { title: 'Senior No Pay' },                     // no salary → dropped
    { title: 'intern', salary: '20k' },
  ];
  const seniorityOf = (t) => (/senior/i.test(t) ? 'senior' : /junior/i.test(t) ? 'junior' : /lead/i.test(t) ? 'lead' : /intern/i.test(t) ? 'intern' : null);
  const parseSalary = (s) => {
    const m = String(s || '').replace(/[,.\s]/g, (ch) => (ch === ',' || ch === '.' || ch === ' ' ? '' : ch)).match(/(\d+)\s*(k)?/i);
    if (!m) return null;
    let n = parseInt(m[1], 10);
    if (!Number.isFinite(n)) return null;
    if (/k/i.test(String(s))) n *= 1000;
    if (/€/.test(String(s))) n = Math.round(n * 1.08);
    return { minUsd: n, maxUsd: n };
  };
  const labelFor = (g) => ({ senior: 'Senior', junior: 'Junior', lead: 'Lead', intern: 'Intern' }[g] || g);
  const items = gradeSalaryItems(jobs, { parseSalaryUsd: parseSalary, seniorityOf, labelFor });
  // Ladder order (lead, staff, senior, mid, junior, intern), zero-count grades dropped.
  assert.deepEqual(host(items.map((i) => i.label)), ['Lead', 'Senior', 'Junior', 'Intern']);
  const senior = items.find((i) => i.label === 'Senior');
  assert.equal(senior.value, Math.round((180000 + 220000) / 2), 'median of the grade’s USD midpoints');
  assert.equal(senior.n, 2);
});

test('velocityItems: funnel-relay stage hops become median-days bars (nulls dropped)', () => {
  const { velocityItems } = runFns(['velocityItems']);
  const velocity = {
    appliedToResponded: { from: 'Applied', to: 'Responded', median: 9, p75: 20, n: 12, censored: 3 },
    respondedToInterview: { from: 'Responded', to: 'Interview', median: 14, p75: 30, n: 4, censored: 1 },
    interviewToOffer: { from: 'Interview', to: 'Offer', median: null, n: 0, censored: 2 },
  };
  assert.deepEqual(host(velocityItems(velocity)), [
    { label: 'Applied → Responded', value: 9 },
    { label: 'Responded → Interview', value: 14 },
  ]);
});

// ── tab structure ─────────────────────────────────────────────────────────────

test('Overview is the FIRST tab; the LLM market report is LAST and separated', () => {
  const ids = [...STATS.matchAll(/\{ id: '([a-z]+)', label:/g)].map((m) => m[1]);
  assert.ok(ids.length >= 9, `expected ≥ 9 tabs, got ${ids.join(',')}`);
  assert.equal(ids[0], 'overview', 'the Overview tab must be first');
  assert.equal(ids[ids.length - 1], 'market', 'the LLM market report must be its own LAST tab');
  // separated from the data tabs by a divider element
  assert.match(STATS, /v2-stats-tabsep/, 'a divider separates the LLM tab from the data tabs');
  // the strip is a nowrap horizontal scroller
  assert.match(STATS, /v2-stats-scroller/, 'the tab row scrolls horizontally');
  assert.match(STATS, /v2-stats-strip/, 'the strip carries the v2 class');
});

test('renderOverview fetches REAL data endpoints and renders ≥ 6 chart sections', () => {
  const ov = sliceFn(STATS, 'async function renderOverview');
  for (const ep of ['/api/tracker', '/api/tracker/stages', '/api/scan-results', '/api/stats/funnel']) {
    assert.match(ov, new RegExp(`API\\.get\\('${ep.replace(/\//g, '\\/')}`), `overview fetches ${ep}`);
  }
  // ≥ 6 chart sections: six through the addChart() helper + the grade-salary
  // and stage-velocity sections (both carrying the entrance animation).
  const chartSections = (ov.match(/addChart\(/g) || []).length;
  assert.ok(chartSections >= 6, `expected ≥ 6 addChart sections, got ${chartSections}`);
  assert.match(ov, /v2-stats-anim/, 'overview sections animate in (300 ms)');
  // every data-bearing chart routes through barChart (CSP-safe SVG)
  assert.match(ov, /barChart\(/, 'charts render through the shared SVG barChart');
  // honest empty state when the scan snapshot is empty
  assert.match(ov, /stats\.noScan/, 'empty scan → honest empty state, no invented series');
});

// ── barChart a11y / tooltips / animation ──────────────────────────────────────

test('barChart: role=img + localized aria-label, per-bar <title> tooltip, clickable option', () => {
  const chart = sliceFn(STATS, 'function barChart');
  assert.match(chart, /setAttribute\('role', 'img'\)/);
  assert.match(chart, /setAttribute\('aria-label'/, 'the chart carries an accessible summary');
  assert.match(chart, /createElementNS\(SVGNS, 'title'\)/, 'native <title> tooltips stay');
  assert.match(chart, /onItemClick/, 'an optional click handler enables filter-drilldown');
  assert.match(chart, /svg\.style\.direction = 'ltr';/, 'RTL-safe (pinned LTR svg)');
  // click-to-filter into #/scan exists for the companies chart
  assert.match(STATS, /__scanSearchPrefill/, 'bar click hands the label to the scan search prefill');
  assert.match(STATS, /Router\.go\('\/scan'\)/);
});

test('CSS: one-line scroll strip with fade edges + 300 ms entrance animation (reduced-motion off)', () => {
  assert.match(OVERLAYS, /\.v2-stats-strip \{[^}]*flex-wrap:\s*nowrap/, 'strip never wraps');
  assert.match(OVERLAYS, /\.v2-stats-scroller \{[^}]*overflow-x:\s*auto/, 'scroller scrolls');
  assert.match(OVERLAYS, /\.v2-stats-scroller \{[^}]*mask-image:/, 'fade edges via mask');
  assert.match(OVERLAYS, /@keyframes v2-stats-rise/);
  assert.match(OVERLAYS, /\.v2-stats-anim \{[^}]*v2-stats-rise[^}]*300ms/, 'entrance animation ≈300 ms');
  assert.match(OVERLAYS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.v2-stats-anim \{[^}]*animation:\s*none/, 'reduced-motion disables the animation');
  // CSS ownership: the v2-stats block lives ONLY in overlays.css
  assert.doesNotMatch(APPCSS, /v2-stats-/, 'app.css must stay untouched (car115 owns it)');
});

// ── i18n discipline ───────────────────────────────────────────────────────────

test('new CAR-120 strings ship with EN fallbacks (dict fan-out follows separately)', () => {
  const pairs = [
    ['stats.tabOverview', 'Overview'],
    ['stats.ovVacanciesBySource', 'Vacancies by source'],
    ['stats.ovPostingsByWeek', 'Postings by week'],
    ['stats.ovSalaryByGrade', 'Median salary by grade'],
    ['stats.ovStageVelocity', 'Time between stages'],
    ['stats.ovClickHint', 'Click a bar to filter'],
  ];
  for (const [k, en] of pairs) {
    assert.match(STATS, new RegExp(`t\\('${k.replace(/\./g, '\\.')}', '${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`),
      `${k} must carry its EN fallback inline`);
  }
  // reused localized grade labels come from the existing scan facet keys
  assert.match(STATS, /scan\.sen\.\$\{g\}|'scan\.sen\.' \+ g/, 'grade axis labels reuse scan.sen.*');
});

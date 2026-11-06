/**
 * CAR-247 — the #/stats «Детали» (Details) dataset layer.
 *
 * role-stats.js gains the pure, testable core: a USD→display-currency table
 * with conversion (missing rate → USD passthrough, never a guess), the
 * tracker+scan entry builder (URL-join, no duplicates), period filtering with
 * day-granular boundaries, case-insensitive search, facet counting/filtering
 * (within-group OR, cross-group AND), and the chart aggregators. The view is
 * thin wiring over these; the Playwright suite (tests/playwright-stats-detail.mjs)
 * drives the real tab.
 *
 * Load order mirrors index.html: countries.js → skills.js → role-stats.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/skills.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/role-stats.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const RS = w.RoleStats;
// A fixed "now" (mid-day UTC) so period boundaries are deterministic.
const NOW = Date.parse('2026-11-06T15:30:00Z');

// ── 1. currency conversion ────────────────────────────────────────────────────

test('RoleStats exposes the CAR-247 detail API', () => {
  for (const fn of ['convertFromUsd', 'buildEntries', 'filterPeriod', 'searchEntries', 'facetCounts', 'facetFilter', 'salaryRangeByCountry', 'monthlyCounts', 'topCompanies']) {
    assert.equal(typeof RS[fn], 'function', `RoleStats.${fn} must exist`);
  }
  assert.ok(Array.isArray(RS.DISPLAY_CURRENCIES) && RS.DISPLAY_CURRENCIES.length === 5,
    'five display currencies');
  assert.deepEqual(RS.DISPLAY_CURRENCIES, ['USD', 'EUR', 'RUB', 'GBP', 'CNY']);
  assert.equal(RS.USD_TO_DISPLAY.USD, 1);
});

test('convertFromUsd: documented static rates (EUR 0.92 / RUB 90 / GBP 0.79 / CNY 7.2)', () => {
  assert.equal(RS.convertFromUsd(1000, 'USD'), 1000);
  assert.equal(RS.convertFromUsd(1000, 'EUR'), 920);
  assert.equal(RS.convertFromUsd(1000, 'RUB'), 90000);
  assert.equal(RS.convertFromUsd(1000, 'GBP'), 790);
  assert.equal(RS.convertFromUsd(1000, 'CNY'), 7200);
  // rounding is deterministic (Math.round)
  assert.equal(RS.convertFromUsd(1237, 'EUR'), Math.round(1237 * 0.92));
});

test('convertFromUsd: unknown / missing currency falls back to USD passthrough', () => {
  assert.equal(RS.convertFromUsd(1000, 'KZT'), 1000, 'KZT is not in the display table → USD');
  assert.equal(RS.convertFromUsd(1000, ''), 1000);
  assert.equal(RS.convertFromUsd(1000, undefined), 1000);
  assert.equal(RS.convertFromUsd(1000, 'EURX'), 1000);
});

test('convertFromUsd: null / non-finite input → null (never 0, never NaN)', () => {
  assert.equal(RS.convertFromUsd(null, 'EUR'), null);
  assert.equal(RS.convertFromUsd(undefined, 'EUR'), null);
  assert.equal(RS.convertFromUsd(NaN, 'EUR'), null);
  assert.equal(RS.convertFromUsd('nope', 'EUR'), null);
});

// ── 2. period filtering ───────────────────────────────────────────────────────

const mkEntry = (date) => ({ kind: 'tracked', company: 'X', role: 'Y', status: 'Applied', date, salaryUsd: null, country: null, source: null });

test('filterPeriod: month window covers 30 calendar days inclusive at the edge', () => {
  // now = 2026-11-06 → month window = 2026-10-08 … 2026-11-06
  const inRange = ['2026-11-06', '2026-11-05', '2026-10-08'].map(mkEntry);
  const outRange = ['2026-10-07', '2026-01-01', ''].map(mkEntry);
  const got = RS.filterPeriod([...inRange, ...outRange], 'month', NOW);
  assert.equal(got.length, inRange.length, 'exactly the entries inside the 30-day window');
});

test('filterPeriod: quarter window covers 91 calendar days inclusive at the edge', () => {
  // now = 2026-11-06 → quarter window = 2026-08-08 … 2026-11-06
  const got = RS.filterPeriod(['2026-08-08', '2026-09-15'].map(mkEntry), 'quarter', NOW);
  assert.equal(got.length, 2, 'boundary day + inside both included');
  assert.equal(RS.filterPeriod([mkEntry('2026-08-07')], 'quarter', NOW).length, 0,
    'one day past the 91-day window is out');
});

test('filterPeriod: year window covers 365 calendar days inclusive at the edge', () => {
  // now = 2026-11-06 → year window = 2025-11-07 … 2026-11-06 (365 days incl. today)
  assert.equal(RS.filterPeriod([mkEntry('2025-11-07')], 'year', NOW).length, 1);
  assert.equal(RS.filterPeriod([mkEntry('2025-11-06')], 'year', NOW).length, 0,
    'one day past the 365-day window is out');
});

test('filterPeriod: all includes everything, including undated and ancient', () => {
  const entries = [mkEntry('2019-01-01'), mkEntry(''), mkEntry('2026-11-06')];
  assert.equal(RS.filterPeriod(entries, 'all', NOW).length, 3);
  assert.equal(RS.filterPeriod(entries, undefined, NOW).length, 3, 'absent period behaves as all');
});

test('filterPeriod: undated entries are EXCLUDED from bounded windows (never guessed recent)', () => {
  assert.equal(RS.filterPeriod([mkEntry('')], 'month', NOW).length, 0);
  assert.equal(RS.filterPeriod([mkEntry('garbage')], 'year', NOW).length, 0);
});

// ── 3. search ─────────────────────────────────────────────────────────────────

test('searchEntries: case-insensitive substring over company AND role', () => {
  const entries = [
    { company: 'Acme GmbH', role: 'Backend Engineer' },
    { company: 'globex', role: 'Data Scientist' },
    { company: 'Initech', role: 'Senior BACKEND engineer' },
    { company: 'Umbrella', role: 'Designer' },
  ];
  assert.equal(RS.searchEntries(entries, 'acme').length, 1);
  assert.equal(RS.searchEntries(entries, 'GLOBEX').length, 1);
  assert.equal(RS.searchEntries(entries, 'backend').length, 2, 'matches company or role');
  assert.equal(RS.searchEntries(entries, '').length, 4, 'empty query → everything');
  assert.equal(RS.searchEntries(entries, '   ').length, 4, 'whitespace query → everything');
  assert.equal(RS.searchEntries(null, 'x').length, 0);
});

// ── 4. facets ─────────────────────────────────────────────────────────────────

const FACET_ENTRIES = [
  { company: 'A', country: { code: 'de', name: 'Germany', flag: '🇩🇪' }, status: 'Applied', source: 'greenhouse' },
  { company: 'B', country: { code: 'de', name: 'Germany', flag: '🇩🇪' }, status: 'Interview', source: 'greenhouse' },
  { company: 'C', country: { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' }, status: 'Applied', source: 'lever' },
  { company: 'D', country: null, status: 'Applied', source: null },
];

test('facetCounts: value counts per facet, descending', () => {
  const country = RS.facetCounts(FACET_ENTRIES, 'country');
  assert.deepEqual(country, [
    { value: 'Germany', count: 2 },
    { value: 'United Kingdom', count: 1 },
  ]);
  const source = RS.facetCounts(FACET_ENTRIES, 'source');
  assert.deepEqual(source, [{ value: 'greenhouse', count: 2 }, { value: 'lever', count: 1 }]);
  const status = RS.facetCounts(FACET_ENTRIES, 'status');
  assert.deepEqual(status, [{ value: 'Applied', count: 3 }, { value: 'Interview', count: 1 }]);
});

test('facetFilter: within a group chips OR, across groups AND', () => {
  // one group, one value
  assert.equal(RS.facetFilter(FACET_ENTRIES, { country: ['Germany'] }).length, 2);
  // within-group OR: Germany OR United Kingdom → 3
  assert.equal(RS.facetFilter(FACET_ENTRIES, { country: ['Germany', 'United Kingdom'] }).length, 3);
  // cross-group AND: Germany AND Applied → 1 (B is Interview, C is UK)
  assert.equal(RS.facetFilter(FACET_ENTRIES, { country: ['Germany'], status: ['Applied'] }).length, 1);
  // AND that matches nothing: UK AND Interview → 0
  assert.equal(RS.facetFilter(FACET_ENTRIES, { country: ['United Kingdom'], status: ['Interview'] }).length, 0);
  // no active facets → everything
  assert.equal(RS.facetFilter(FACET_ENTRIES, {}).length, 4);
  assert.equal(RS.facetFilter(FACET_ENTRIES, { country: [] }).length, 4);
  // an entry with NO country can never match a country chip (honest AND)
  assert.equal(RS.facetFilter(FACET_ENTRIES, { source: ['greenhouse'] }).length, 2);
});

// ── 5. buildEntries ───────────────────────────────────────────────────────────

const TRACKER_ROWS = [
  { num: 42, date: '2026-11-01', company: 'Acme', role: 'Backend Engineer', score: '4.2/5', status: 'Applied', pdf: '❌', report: '[42](reports/042-acme-2026-11-01.md)', notes: '', url: 'https://boards.greenhouse.io/acme/jobs/123' },
  { num: 43, date: '2026-10-20', company: 'globex', role: 'Data Scientist', score: '3.0/5', status: '**Interview**', pdf: '✅', report: '—', notes: '', url: '' },
];

const SCAN_JOBS = [
  // same posting as tracker row 42 (tracking query noise) → enriches, not duplicated
  { title: 'Senior Backend Engineer', company: 'Acme', location: 'Berlin, Germany', salary: '€90,000 - €110,000', date: '2026-11-05T10:00:00Z', source: 'greenhouse', url: 'https://boards.greenhouse.io/acme/jobs/123?gh_src=abc' },
  // a fresh posting → its own entry
  { title: 'Platform Engineer', company: 'Initech', location: 'London, UK', salary: '£70,000', date: '2026-11-04T09:00:00Z', source: 'lever', url: 'https://jobs.lever.co/initech/abc-def' },
  // no salary / weird location → still an entry, salary null
  { title: 'Designer', company: 'Umbrella', location: 'Remote', salary: '', date: '2026-10-01T09:00:00Z', source: 'remoteok', url: 'https://remoteok.com/remote-designer' },
];

test('buildEntries: tracker rows mapped with score, folded status, reportPath', () => {
  const fold = (s) => String(s || '').replace(/\*/g, '').trim();
  const entries = RS.buildEntries(TRACKER_ROWS, [], { fold });
  assert.equal(entries.length, 2);
  const e = entries[0];
  assert.equal(e.kind, 'tracked');
  assert.equal(e.num, 42);
  assert.equal(e.company, 'Acme');
  assert.equal(e.score, 4.2);
  assert.equal(e.status, 'Applied', 'fold applied');
  assert.equal(e.date, '2026-11-01');
  assert.equal(e.reportPath, 'reports/042-acme-2026-11-01.md');
  // markdown-bold status folded, sentinel report cell → no path
  assert.equal(entries[1].status, 'Interview');
  assert.equal(entries[1].reportPath, null);
});

test('buildEntries: postings carry parsed salary, country, source', () => {
  const entries = RS.buildEntries([], SCAN_JOBS, {});
  assert.equal(entries.length, 3);
  const berlin = entries.find((e) => e.company === 'Acme');
  assert.equal(berlin.kind, 'posting');
  assert.equal(berlin.salaryUsd.minUsd, Math.round(90000 * RS.FX_TO_USD.EUR));
  assert.equal(berlin.salaryUsd.maxUsd, Math.round(110000 * RS.FX_TO_USD.EUR));
  assert.equal(berlin.country.code, 'de');
  assert.equal(berlin.source, 'greenhouse');
  const remote = entries.find((e) => e.company === 'Umbrella');
  assert.equal(remote.salaryUsd, null);
  assert.equal(remote.country.code, 'remote');
});

test('buildEntries: a scanned posting that IS a tracked application enriches it — never a duplicate', () => {
  const fold = (s) => String(s || '').replace(/\*/g, '').trim();
  const entries = RS.buildEntries(TRACKER_ROWS, SCAN_JOBS, { fold });
  assert.equal(entries.length, 4, '2 tracked + 2 unmatched postings (the matched one folded in)');
  const acme = entries.find((e) => e.company === 'Acme');
  assert.equal(acme.kind, 'tracked', 'the matched posting enriched the tracked row');
  assert.ok(acme.salaryUsd, 'salary joined from the scan posting');
  assert.equal(acme.country.code, 'de', 'country joined from the scan posting');
  assert.equal(acme.source, 'greenhouse');
  assert.equal(acme.reportPath, 'reports/042-acme-2026-11-01.md', 'tracker fields survive');
  // URL join ignores query noise: ?gh_src=abc matched jobs/123
  assert.equal(entries.filter((e) => e.url.includes('jobs/123')).length, 1);
});

test('buildEntries: safe on empty / null inputs', () => {
  assert.deepEqual(RS.buildEntries(null, null, {}), []);
  assert.deepEqual(RS.buildEntries([], [], {}), []);
});

// ── 6. chart aggregators ──────────────────────────────────────────────────────

test('salaryRangeByCountry: min/median/max per country, top-N by count', () => {
  const entries = [
    { country: { code: 'de', name: 'Germany', flag: '🇩🇪' }, salaryUsd: { minUsd: 90000, maxUsd: 110000 } },
    { country: { code: 'de', name: 'Germany', flag: '🇩🇪' }, salaryUsd: { minUsd: 100000, maxUsd: 130000 } },
    { country: { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' }, salaryUsd: { minUsd: 70000, maxUsd: 70000 } },
    { country: { code: 'us', name: 'United States', flag: '🇺🇸' }, salaryUsd: { minUsd: 150000, maxUsd: 200000 } },
    { country: { code: 'us', name: 'United States', flag: '🇺🇸' }, salaryUsd: null }, // no salary → not counted
    { country: null, salaryUsd: { minUsd: 50000, maxUsd: 60000 } }, // no country → not counted
  ];
  const rows = RS.salaryRangeByCountry(entries, 8);
  assert.equal(rows.length, 3);
  const de = rows.find((r) => r.code === 'de');
  assert.equal(de.count, 2);
  assert.equal(de.minUsd, 90000);
  assert.equal(de.maxUsd, 130000);
  assert.equal(de.medianUsd, 107500, 'median of midpoints (100k, 115k)');
  const us = rows.find((r) => r.code === 'us');
  assert.equal(us.count, 1);
  assert.equal(rows[0].code, 'de', 'sorted by count desc → Germany (2) first');
  assert.equal(rows[1].code, 'us', 'ties broken by median desc → US (175k) over UK (70k)');
  assert.equal(rows[2].code, 'gb');
  // topN caps
  const top1 = RS.salaryRangeByCountry(entries, 1);
  assert.equal(top1.length, 1);
  assert.equal(top1[0].code, 'de');
});

test('monthlyCounts: YYYY-MM buckets ascending', () => {
  const entries = [
    { date: '2026-11-05' }, { date: '2026-11-01' }, { date: '2026-10-20' },
    { date: '2026-10-02T10:00:00Z' }, { date: '' }, { date: 'garbage' },
  ];
  assert.deepEqual(RS.monthlyCounts(entries), [
    { label: '2026-10', value: 2 },
    { label: '2026-11', value: 2 },
  ]);
});

test('topCompanies: descending counts, capped at n, case-folded merge', () => {
  const entries = [
    { company: 'Acme' }, { company: 'acme' }, { company: ' ACME ' },
    { company: 'Globex' }, { company: '' },
  ];
  const items = RS.topCompanies(entries, 10);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { label: 'Acme', value: 3 }, 'first spelling wins as the label');
  assert.deepEqual(items[1], { label: 'Globex', value: 1 });
  assert.equal(RS.topCompanies(entries, 1).length, 1);
});

// ── 7. view + shell wiring canaries ───────────────────────────────────────────

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('stats.js wires the Details tab (tab def, render, persistence keys)', () => {
  const src = read('public/js/views/stats.js');
  assert.match(src, /id: 'details'/, 'a details tab def exists');
  assert.match(src, /renderDetails/, 'a renderDetails implementation exists');
  assert.match(src, /career-ops-ui:statsCurrency/, 'currency persists');
  assert.match(src, /career-ops-ui:statsPeriod/, 'period persists');
  assert.match(src, /RoleStats\.convertFromUsd/, 'salary figures go through the shared converter');
  assert.match(src, /RoleStats\.buildEntries/, 'entries come from the shared builder');
  assert.match(src, /RoleStats\.facetFilter/, 'chips filter through the shared facet engine');
  assert.ok(src.includes("'#/reports"), 'drill-down navigates to reports');
});

test('stats-detail.css exists and is registered in index.html (link after v2-dash.css)', () => {
  const css = read('public/css/stats-detail.css');
  assert.match(css, /\.v2-statsd-/, 'the sheet owns the statsd namespace');
  const html = read('public/index.html');
  const linkPos = html.indexOf('/css/stats-detail.css');
  assert.ok(linkPos > 0, 'stats-detail.css link present');
  const dashPos = html.indexOf('/css/v2-dash.css');
  assert.ok(linkPos > dashPos, 'loads after the v2 sheets (cascade override wins)');
});

test('every statsd.* / stats.hint.details key exists in all 19 locales with a non-empty value', () => {
  const dict = JSON.parse(JSON.stringify(loadAssembledDict()));
  const keys = Object.keys(dict).filter((k) => k.startsWith('statsd.') || k === 'stats.hint.details');
  assert.ok(keys.length >= 27, `expected ≥27 CAR-247 keys, found ${keys.length}`);
  for (const key of keys) {
    for (const lang of I18N_LANGS) {
      assert.ok(dict[key][lang] && String(dict[key][lang]).trim(),
        `${key} missing/empty in ${lang}`);
    }
  }
});

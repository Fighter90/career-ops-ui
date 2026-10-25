/**
 * CAR-118 — pure helpers for the #/reports v2 list (search / filters /
 * sorting / unified title+score format), extracted into a client lib so
 * node can unit-test them without a browser.
 *
 * report-ops.js is a classic script exposing window.ReportOps — loaded in a
 * synthetic window, the same pattern as tracker-stages.test.mjs /
 * job-facets.test.mjs.
 *
 * normalizeTitle MIRRORS the server convention (do not reinvent):
 *   - server/lib/routes/auto-pipeline.mjs v1.248.7 — H1 follows the parent
 *     oferta convention `# Evaluation: {Company} — {Role}`; a localized
 *     prose label is stripped first, then `Company — Role` after a label /
 *     `Role — Company` without one.
 *   - server/lib/parsers.mjs parseReportHeader shapes the canonical data the
 *     client receives (title/score/scoreNum/date/legitimacy/pdf).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/report-ops.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const RO = w.ReportOps;

// ── normalizeTitle — the v1.248.7 server convention, mirrored ──────────────

test('normalizeTitle: labelled `Evaluation: Company — Role` → company left, role right', () => {
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme — Senior Backend Engineer'),
    { company: 'Acme', role: 'Senior Backend Engineer' });
});

test('normalizeTitle: a localized label is stripped the same way the server does', () => {
  assert.deepEqual(RO.normalizeTitle('Оценка вакансии: Яндекс — Инженер'),
    { company: 'Яндекс', role: 'Инженер' });
  assert.deepEqual(RO.normalizeTitle('Оценка: Сбербанк — Аналитик'),
    { company: 'Сбербанк', role: 'Аналитик' });
});

test('normalizeTitle: without a label `Role — Company` → role left, company right', () => {
  assert.deepEqual(RO.normalizeTitle('Senior Java Developer — Acme'),
    { company: 'Acme', role: 'Senior Java Developer' });
});

test('normalizeTitle: en/em/hyphen dashes all split', () => {
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme – Lead'), { company: 'Acme', role: 'Lead' });
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme - Lead'), { company: 'Acme', role: 'Lead' });
});

test('normalizeTitle: no dash → the whole body is the role, company unknown', () => {
  // 'Deep Brief' is NOT one of the server's H1 label words — a faithful
  // mirror keeps the whole body as the role (deep briefs have no fixed
  // H1 convention server-side).
  assert.deepEqual(RO.normalizeTitle('Deep Brief: Stripe'), { company: '', role: 'Deep Brief: Stripe' });
  assert.deepEqual(RO.normalizeTitle('Just a heading'), { company: '', role: 'Just a heading' });
});

test('normalizeTitle: empty/garbage input never throws', () => {
  assert.deepEqual(RO.normalizeTitle(''), { company: '', role: '' });
  assert.deepEqual(RO.normalizeTitle(null), { company: '', role: '' });
});

// ── displayTitle — the unified «Company — Role» format ─────────────────────

test('displayTitle renders «Company — Role» from a labelled header', () => {
  assert.equal(RO.displayTitle({ title: 'Evaluation: Acme — Senior BE' }), 'Acme — Senior BE');
});

test('displayTitle renders «Company — Role» from a label-less header', () => {
  assert.equal(RO.displayTitle({ title: 'Senior Java Developer — Acme' }), 'Acme — Senior Java Developer');
});

test('displayTitle falls back to the raw title, then the slug', () => {
  assert.equal(RO.displayTitle({ title: 'Weird title no dash', slug: 'weird' }), 'Weird title no dash');
  assert.equal(RO.displayTitle({ slug: 'acme-role' }), 'acme-role');
  assert.equal(RO.displayTitle({}), '');
});

// ── formatScore — score is ALWAYS «x.x/5» ──────────────────────────────────

test('formatScore: every parsed score renders with the /5 suffix', () => {
  assert.equal(RO.formatScore(4.25), '4.3/5');
  assert.equal(RO.formatScore(4), '4.0/5');
  assert.equal(RO.formatScore(1.5), '1.5/5');
  assert.equal(RO.formatScore(3.85), '3.9/5');
});

test('formatScore: null/unparsed → null (the view renders the muted chip)', () => {
  assert.equal(RO.formatScore(null), null);
  assert.equal(RO.formatScore(undefined), null);
});

// ── bandOf — the 4 bands behind the filter, histogram and card actions ─────

test('bandOf buckets scores into high/good/mid/low and null for unparsed', () => {
  assert.equal(RO.bandOf(4.5), 'high');
  assert.equal(RO.bandOf(4.9), 'high');
  assert.equal(RO.bandOf(4.2), 'good');
  assert.equal(RO.bandOf(4.0), 'good');
  assert.equal(RO.bandOf(3.9), 'mid');
  assert.equal(RO.bandOf(3.5), 'mid');
  assert.equal(RO.bandOf(3.49), 'low');
  assert.equal(RO.bandOf(1.5), 'low');
  assert.equal(RO.bandOf(null), null);
});

// ── applyFilters — search + band + legitimacy + company + date range ───────

const REPS = [
  { slug: 'a', title: 'Evaluation: Acme — Senior Backend Engineer', scoreNum: 4.7, legitimacy: 'High', date: '2026-10-01' },
  { slug: 'b', title: 'Оценка: Яндекс — Инженер', scoreNum: 3.6, legitimacy: 'Medium', date: '2026-09-15' },
  { slug: 'c', title: 'Deep Brief: Stripe', scoreNum: 4.1, legitimacy: 'High', date: '2026-08-20' },
  { slug: 'd', title: 'Senior Java Developer — Acme', scoreNum: null, legitimacy: '', date: '2026-07-02' },
  { slug: 'e', title: 'Evaluation: Globex — PM', scoreNum: 2.0, legitimacy: 'Low', date: '2026-10-20' },
];

test('applyFilters: q matches company/role/title as a case-insensitive substring', () => {
  assert.deepEqual(RO.applyFilters(REPS, { q: 'acme' }).map((r) => r.slug), ['a', 'd']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'яндекс' }).map((r) => r.slug), ['b']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'STRIPE' }).map((r) => r.slug), ['c']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'engineer' }).map((r) => r.slug), ['a']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'developer' }).map((r) => r.slug), ['d']);
});

test('applyFilters: q also matches the slug', () => {
  assert.deepEqual(RO.applyFilters(REPS, { q: 'globex' }).map((r) => r.slug), ['e']);
});
test('applyFilters: band keeps only that band (unparsed rows drop out)', () => {
  assert.deepEqual(RO.applyFilters(REPS, { band: 'high' }).map((r) => r.slug), ['a']);
  assert.deepEqual(RO.applyFilters(REPS, { band: 'mid' }).map((r) => r.slug), ['b']);
  assert.deepEqual(RO.applyFilters(REPS, { band: 'low' }).map((r) => r.slug), ['e']);
  assert.deepEqual(RO.applyFilters(REPS, { band: 'good' }).map((r) => r.slug), ['c']);
});

test('applyFilters: legitimacy and company filter exactly (case-insensitive)', () => {
  assert.deepEqual(RO.applyFilters(REPS, { legitimacy: 'High' }).map((r) => r.slug), ['a', 'c']);
  assert.deepEqual(RO.applyFilters(REPS, { company: 'acme' }).map((r) => r.slug), ['a', 'd']);
});

test('applyFilters: date range is inclusive on both ends', () => {
  assert.deepEqual(RO.applyFilters(REPS, { dateFrom: '2026-09-01' }).map((r) => r.slug), ['a', 'b', 'e']);
  assert.deepEqual(RO.applyFilters(REPS, { dateTo: '2026-09-15' }).map((r) => r.slug), ['b', 'c', 'd']);
  assert.deepEqual(RO.applyFilters(REPS, { dateFrom: '2026-09-15', dateTo: '2026-10-01' }).map((r) => r.slug), ['a', 'b']);
});

test('applyFilters: filters compose (AND) and no filters is a no-op', () => {
  assert.equal(RO.applyFilters(REPS, {}).length, 5);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'acme', band: 'high' }).map((r) => r.slug), ['a']);
});

// ── sortReports — date / score / company, asc|desc, nulls-last ─────────────

test('sortReports: date desc is the default reading order', () => {
  assert.deepEqual(RO.sortReports(REPS, 'date', 'desc').map((r) => r.slug), ['e', 'a', 'b', 'c', 'd']);
  assert.deepEqual(RO.sortReports(REPS, 'date', 'asc').map((r) => r.slug), ['d', 'c', 'b', 'a', 'e']);
});

test('sortReports: score desc puts unparsed LAST (never first)', () => {
  const out = RO.sortReports(REPS, 'score', 'desc').map((r) => r.slug);
  assert.deepEqual(out, ['a', 'c', 'b', 'e', 'd']);
  const asc = RO.sortReports(REPS, 'score', 'asc').map((r) => r.slug);
  assert.equal(asc[asc.length - 1], 'd', 'unparsed stays last in asc too');
  assert.deepEqual(asc.slice(0, 4), ['e', 'b', 'c', 'a']);
});

test('sortReports: company sorts case-insensitively, unparsed company last in desc', () => {
  // Exact full order is locale-dependent (Cyrillic vs Latin script order
  // differs between ru and en collation) — assert the invariant properties.
  const desc = RO.sortReports(REPS, 'company', 'desc').map((r) => r.slug);
  assert.equal(desc[desc.length - 1], 'c', 'the company-less row sorts last in desc');
  const ascReps = RO.sortReports(REPS, 'company', 'asc');
  const asc = ascReps.map((r) => r.slug);
  assert.equal(asc[asc.length - 1], 'c', 'the company-less row sorts last in asc too');
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  const cos = ascReps.map((r) => RO.normalizeTitle(r.title).company).filter(Boolean);
  const sorted = [...cos].sort((x, y) => collator.compare(x, y));
  assert.deepEqual(cos, sorted, 'asc is collator-sorted');
  // Case-insensitive: 'Acme' rows sit adjacent in both directions.
  const descCos = RO.sortReports(REPS, 'company', 'desc').map((r) => RO.normalizeTitle(r.title).company).filter(Boolean);
  const adjacent = (arr) => {
    const idx = arr.map((c, i) => (c.toLowerCase() === 'acme' ? i : -1)).filter((i) => i >= 0);
    return idx.length === 2 && idx[1] === idx[0] + 1;
  };
  assert.ok(adjacent(cos) && adjacent(descCos), 'equal-fold companies are adjacent (stable case-insensitive compare)');
});

test('sortReports: never mutates the input array', () => {
  const before = REPS.map((r) => r.slug);
  RO.sortReports(REPS, 'score', 'asc');
  assert.deepEqual(REPS.map((r) => r.slug), before);
});

// ── histogram + companies — the list chrome data ───────────────────────────

test('scoreHistogram counts each band plus unparsed', () => {
  assert.deepEqual(RO.scoreHistogram(REPS), { high: 1, good: 1, mid: 1, low: 1, unparsed: 1 });
});

test('companies returns distinct parsed companies, sorted case-insensitively', () => {
  const out = RO.companies(REPS);
  // 'Deep Brief: Stripe' is not label-stripped (see normalizeTitle) → no
  // 'Stripe'; exact script order is locale-dependent, so assert the set +
  // the collator-sorted property.
  assert.equal(out.length, 3);
  assert.ok(out.includes('Acme') && out.includes('Globex') && out.includes('Яндекс'));
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  assert.deepEqual(out, [...out].sort((x, y) => collator.compare(x, y)), 'collator-sorted');
});

test('BANDS exposes the id/label fallback table the toolbar renders', () => {
  assert.deepEqual(RO.BANDS.map((b) => b.id), ['high', 'good', 'mid', 'low']);
});

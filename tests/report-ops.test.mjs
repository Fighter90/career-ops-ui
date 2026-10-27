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
// FULL-M6 — the H1 label table lives in lib/report-labels.js; report-ops
// reads it from there (index.html loads the lib before the view lib).
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/report-labels.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/report-ops.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const RO = w.ReportOps;

// ── CAR-118 review: displayTitle never rewrites a label-less title ─────────

test('displayTitle rewrites ONLY when a recognised label was stripped (finding 4)', () => {
  assert.equal(RO.displayTitle({ title: 'Evaluation: Acme — Senior BE' }), 'Acme — Senior BE');
  // A legacy hand-written label-less H1 keeps its raw form — reordering it
  // to «Role — Company» would mis-attribute it.
  assert.equal(RO.displayTitle({ title: 'Acme — Senior BE' }), 'Acme — Senior BE');
  assert.equal(RO.displayTitle({ title: 'Senior Java Developer — Acme' }), 'Senior Java Developer — Acme');
  // A labelled H1 without a dash shows the label-stripped body.
  assert.equal(RO.displayTitle({ title: 'Оценка: Яндекс' }), 'Яндекс');
});

// ── CAR-118 review: the dash split prefers em/en dashes, last-side for the
//    Role — Company form, and never falls through on a long left side ──────

test('split (finding 3): a hyphen inside a name is kept — split at the first em dash after a label', () => {
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme - Labs — Staff Eng'),
    { company: 'Acme - Labs', role: 'Staff Eng', labelled: true });
});

test('split (finding 3): unlabelled splits at the LAST em dash', () => {
  assert.deepEqual(RO.normalizeTitle('Engineer - Platform — Acme'),
    { company: 'Acme', role: 'Engineer - Platform', labelled: false });
});

test('split (finding 3): hyphen-only bodies fall back to spaced hyphens (first after a label, last without)', () => {
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme - Labs - Staff Eng'),
    { company: 'Acme - Labs', role: 'Staff Eng', labelled: true });
  assert.deepEqual(RO.normalizeTitle('A - B - C'),
    { company: 'C', role: 'A - B', labelled: false });
});

test('split (finding 3): a >120-char side no longer falls through unsplit', () => {
  const longCompany = 'X'.repeat(140);
  assert.deepEqual(RO.normalizeTitle(`Evaluation: ${longCompany} — Staff Eng`),
    { company: longCompany, role: 'Staff Eng', labelled: true });
});

// ── CAR-118 review: band and display share ONE rounding ────────────────────

test('bandOf bands the DISPLAYED value, not the raw float (finding 2)', () => {
  assert.equal(RO.formatScore(4.47), '4.5/5');
  assert.equal(RO.bandOf(4.47), 'high', 'displayed 4.5 → high');
  assert.equal(RO.formatScore(3.96), '4.0/5');
  assert.equal(RO.bandOf(3.96), 'good', 'displayed 4.0 → good (band = displayed value)');
  assert.equal(RO.bandOf(3.94), 'mid', 'displayed 3.9 → mid');
});

test('roundScore is the single shared rounding helper (finding 2)', () => {
  assert.equal(RO.roundScore(4.47), 4.5);
  assert.equal(RO.roundScore(3.96), 4.0);
  assert.equal(RO.roundScore(4.45), 4.5);
  assert.equal(RO.roundScore(null), null);
});

test('normalizeTitle exposes `labelled` for the display decision', () => {
  assert.equal(RO.normalizeTitle('Evaluation: Acme — X').labelled, true);
  assert.equal(RO.normalizeTitle('Acme — X').labelled, false);
});

// ── normalizeTitle — the v1.248.7 server convention, mirrored ──────────────

test('normalizeTitle: labelled `Evaluation: Company — Role` → company left, role right', () => {
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme — Senior Backend Engineer'),
    { company: 'Acme', role: 'Senior Backend Engineer', labelled: true });
});

test('normalizeTitle: a localized label is stripped the same way the server does', () => {
  assert.deepEqual(RO.normalizeTitle('Оценка вакансии: Яндекс — Инженер'),
    { company: 'Яндекс', role: 'Инженер', labelled: true });
  assert.deepEqual(RO.normalizeTitle('Оценка: Сбербанк — Аналитик'),
    { company: 'Сбербанк', role: 'Аналитик', labelled: true });
});

test('normalizeTitle: without a label `Role — Company` → role left, company right', () => {
  assert.deepEqual(RO.normalizeTitle('Senior Java Developer — Acme'),
    { company: 'Acme', role: 'Senior Java Developer', labelled: false });
});

test('normalizeTitle: en/em/hyphen dashes all split', () => {
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme – Lead'), { company: 'Acme', role: 'Lead', labelled: true });
  assert.deepEqual(RO.normalizeTitle('Evaluation: Acme - Lead'), { company: 'Acme', role: 'Lead', labelled: true });
});

test('normalizeTitle: no dash → the whole body is the role, company unknown', () => {
  // 'Deep Brief' is NOT one of the server's H1 label words — a faithful
  // mirror keeps the whole body as the role (deep briefs have no fixed
  // H1 convention server-side).
  assert.deepEqual(RO.normalizeTitle('Deep Brief: Stripe'), { company: '', role: 'Deep Brief: Stripe', labelled: false });
  assert.deepEqual(RO.normalizeTitle('Just a heading'), { company: '', role: 'Just a heading', labelled: false });
});

test('normalizeTitle: empty/garbage input never throws', () => {
  assert.deepEqual(RO.normalizeTitle(''), { company: '', role: '', labelled: false });
  assert.deepEqual(RO.normalizeTitle(null), { company: '', role: '', labelled: false });
});

// ── displayTitle — the unified «Company — Role» format ─────────────────────

test('displayTitle renders «Company — Role» from a labelled header', () => {
  assert.equal(RO.displayTitle({ title: 'Evaluation: Acme — Senior BE' }), 'Acme — Senior BE');
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
  // Banding runs on the DISPLAYED (rounded) value (finding 2), so a raw
  // 3.49 displays «3.5» and sits in mid — the chip colour and the count
  // always agree with the number the user reads.
  assert.equal(RO.bandOf(4.5), 'high');
  assert.equal(RO.bandOf(4.9), 'high');
  assert.equal(RO.bandOf(4.2), 'good');
  assert.equal(RO.bandOf(4.0), 'good');
  assert.equal(RO.bandOf(3.9), 'mid');
  assert.equal(RO.bandOf(3.5), 'mid');
  assert.equal(RO.bandOf(3.49), 'mid', '3.49 displays 3.5 → mid (display-consistent)');
  assert.equal(RO.bandOf(3.44), 'low', '3.44 displays 3.4 → low');
  assert.equal(RO.bandOf(1.5), 'low');
  assert.equal(RO.bandOf(null), null);
});

// ── applyFilters — search + band + legitimacy + company + date range ───────

const REPS = [
  { slug: 'a', title: 'Evaluation: Acme — Senior Backend Engineer', scoreNum: 4.7, legitimacy: 'High', date: '2026-10-01' },
  { slug: 'b', title: 'Оценка: Яндекс — Инженер', scoreNum: 3.6, legitimacy: 'Medium', date: '2026-09-15' },
  { slug: 'c', title: 'Deep Brief: Stripe', scoreNum: 4.1, legitimacy: 'High', date: '2026-08-20' },
  { slug: 'd', title: 'Senior Java Developer — Acme', scoreNum: null, legitimacy: '', date: '2026-07-02' },
  { slug: 'zz-unique', title: 'Evaluation: Globex — PM', scoreNum: 2.0, legitimacy: 'Low', date: '2026-10-20' },
  // finding 5/6: the slug carries a token absent from the title, and this
  // fixture has NO title field at all (haystack must not invent "undefined").
  { slug: 'qq-solitary', title: undefined, scoreNum: 3.0, legitimacy: 'Medium', date: '' },
];

test('applyFilters: q matches company/role/title as a case-insensitive substring', () => {
  assert.deepEqual(RO.applyFilters(REPS, { q: 'acme' }).map((r) => r.slug), ['a', 'd']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'яндекс' }).map((r) => r.slug), ['b']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'STRIPE' }).map((r) => r.slug), ['c']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'engineer' }).map((r) => r.slug), ['a']);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'developer' }).map((r) => r.slug), ['d']);
});

test('applyFilters: q matches the SLUG, proven by a token absent from the title (finding 5)', () => {
  assert.deepEqual(RO.applyFilters(REPS, { q: 'zz-unique' }).map((r) => r.slug), ['zz-unique']);
});

test('applyFilters: a missing title must not leak "undefined" into the haystack (finding 6)', () => {
  assert.deepEqual(RO.applyFilters(REPS, { q: 'undef' }).map((r) => r.slug), []);
  // the title-less row is still findable by its real fields
  assert.deepEqual(RO.applyFilters(REPS, { q: 'qq-solitary' }).map((r) => r.slug), ['qq-solitary']);
});
test('applyFilters: band keeps only that band (unparsed rows drop out)', () => {
  assert.deepEqual(RO.applyFilters(REPS, { band: 'high' }).map((r) => r.slug), ['a']);
  assert.deepEqual(RO.applyFilters(REPS, { band: 'mid' }).map((r) => r.slug), ['b']);
  assert.deepEqual(RO.applyFilters(REPS, { band: 'low' }).map((r) => r.slug), ['zz-unique', 'qq-solitary']);
  assert.deepEqual(RO.applyFilters(REPS, { band: 'good' }).map((r) => r.slug), ['c']);
});

test('applyFilters: legitimacy and company filter exactly (case-insensitive)', () => {
  assert.deepEqual(RO.applyFilters(REPS, { legitimacy: 'High' }).map((r) => r.slug), ['a', 'c']);
  assert.deepEqual(RO.applyFilters(REPS, { company: 'acme' }).map((r) => r.slug), ['a', 'd']);
});

test('applyFilters: date range is inclusive on both ends', () => {
  assert.deepEqual(RO.applyFilters(REPS, { dateFrom: '2026-09-01' }).map((r) => r.slug), ['a', 'b', 'zz-unique']);
  assert.deepEqual(RO.applyFilters(REPS, { dateTo: '2026-09-15' }).map((r) => r.slug), ['b', 'c', 'd']);
  assert.deepEqual(RO.applyFilters(REPS, { dateFrom: '2026-09-15', dateTo: '2026-10-01' }).map((r) => r.slug), ['a', 'b']);
});

test('applyFilters: an UNDATED report is excluded once either date bound is set (finding 7)', () => {
  // The old ''-string compare was asymmetric: undated passed dateTo but
  // failed dateFrom. One rule now: a bound set + no date → excluded.
  assert.deepEqual(RO.applyFilters(REPS, { dateTo: '2026-12-31' }).map((r) => r.slug), ['a', 'b', 'c', 'd', 'zz-unique']);
  assert.deepEqual(RO.applyFilters(REPS, { dateFrom: '2000-01-01' }).map((r) => r.slug), ['a', 'b', 'c', 'd', 'zz-unique']);
  assert.ok(RO.applyFilters(REPS, {}).some((r) => r.slug === 'qq-solitary'), 'no bounds → undated stays');
});

test('applyFilters: filters compose (AND) and no filters is a no-op', () => {
  assert.equal(RO.applyFilters(REPS, {}).length, 6);
  assert.deepEqual(RO.applyFilters(REPS, { q: 'acme', band: 'high' }).map((r) => r.slug), ['a']);
});

// ── sortReports — date / score / company, asc|desc, nulls-last ─────────────

test('sortReports: date desc is the default reading order (undated last both ways)', () => {
  assert.deepEqual(RO.sortReports(REPS, 'date', 'desc').map((r) => r.slug),
    ['zz-unique', 'a', 'b', 'c', 'd', 'qq-solitary']);
  assert.deepEqual(RO.sortReports(REPS, 'date', 'asc').map((r) => r.slug),
    ['d', 'c', 'b', 'a', 'zz-unique', 'qq-solitary']);
});

test('sortReports: score desc puts unparsed LAST (never first)', () => {
  const out = RO.sortReports(REPS, 'score', 'desc').map((r) => r.slug);
  assert.deepEqual(out, ['a', 'c', 'b', 'qq-solitary', 'zz-unique', 'd']);
  const asc = RO.sortReports(REPS, 'score', 'asc').map((r) => r.slug);
  assert.equal(asc[asc.length - 1], 'd', 'unparsed stays last in asc too');
  assert.deepEqual(asc.slice(0, 5), ['zz-unique', 'qq-solitary', 'b', 'c', 'a']);
});

test('sortReports: company sorts case-insensitively, company-less rows last', () => {
  // Exact full order is locale-dependent (Cyrillic vs Latin script order
  // differs between ru and en collation) — assert the invariant properties.
  // TWO rows have no parsed company ('c' and the title-less 'qq-solitary');
  // stable sort keeps them in insertion order at the tail.
  const desc = RO.sortReports(REPS, 'company', 'desc').map((r) => r.slug);
  assert.deepEqual(desc.slice(-2), ['c', 'qq-solitary'], 'company-less rows sort last in desc');
  const ascReps = RO.sortReports(REPS, 'company', 'asc');
  const asc = ascReps.map((r) => r.slug);
  assert.deepEqual(asc.slice(-2), ['c', 'qq-solitary'], 'company-less rows sort last in asc too');
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
  assert.deepEqual(RO.scoreHistogram(REPS), { high: 1, good: 1, mid: 1, low: 2, unparsed: 1 });
});

test('companies returns distinct parsed companies, sorted case-insensitively', () => {
  const out = RO.companies(REPS);
  // 'Deep Brief: Stripe' is not label-stripped (see normalizeTitle) → no
  // 'Stripe'; the title-less row contributes nothing; exact script order is
  // locale-dependent, so assert the set + the collator-sorted property.
  assert.equal(out.length, 3);
  assert.ok(out.includes('Acme') && out.includes('Globex') && out.includes('Яндекс'));
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  assert.deepEqual(out, [...out].sort((x, y) => collator.compare(x, y)), 'collator-sorted');
});

test('BANDS exposes the id/label fallback table the toolbar renders', () => {
  assert.deepEqual(RO.BANDS.map((b) => b.id), ['high', 'good', 'mid', 'low']);
});

// ── debounce with a cancel path — the reset race (finding 8) ───────────────

test('debounce: .cancel() prevents the pending trailing call (finding 8)', async () => {
  let calls = 0;
  const d = RO.debounce(() => { calls += 1; }, 25);
  d();
  d();
  d.cancel();
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(calls, 0, 'a cancelled debounce never fires');

  const d2 = RO.debounce(() => { calls += 1; }, 25);
  d2();
  d2();
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(calls, 1, 'without cancel the trailing call fires exactly once');
});

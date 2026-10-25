/**
 * CAR-116 — public/js/lib/pipeline-view.js: pure helpers behind the
 * #/pipeline v2 view (enriched cards, grouping, bulk discard + undo).
 * Loaded in a synthetic window (the tracker-stages.test.mjs pattern).
 *
 * The enrichment contract under test: the view may only join data the
 * EXISTING endpoints already return — tracker rows (/api/tracker),
 * report headers (/api/reports) and the checklist cells /api/map/jobs
 * exposes — never an invented payload shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(
  resolve(ROOT, 'public/js/lib/pipeline-view.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const PV = w.PipelineView;

// ── normKey ──────────────────────────────────────────────────────────

test('normKey: same posting reached through different URLs collapses', () => {
  const a = PV.normKey('https://hh.ru/vacancy/12345');
  const b = PV.normKey('https://www.hh.ru/vacancy/12345/');
  assert.equal(a, b, 'www. + trailing slash must fold');
  assert.equal(a, 'hh.ru/vacancy/12345');
});

test('normKey: strips tracking params but keeps content params', () => {
  const k = PV.normKey('https://jobs.example.com/x?utm_source=mail&gclid=zz&id=7');
  assert.equal(k, 'jobs.example.com/x?id=7');
  // different content params = different keys
  assert.notEqual(
    PV.normKey('https://jobs.example.com/x?id=7'),
    PV.normKey('https://jobs.example.com/x?id=8'));
});

test('normKey: different paths on one host stay distinct', () => {
  assert.notEqual(
    PV.normKey('https://career.habr.com/vacancies/1000136672'),
    PV.normKey('https://career.habr.com/vacancies/1000136673'));
});

test('normKey: non-http refs and garbage degrade stably', () => {
  assert.equal(PV.normKey(''), '');
  assert.equal(PV.normKey('local:jds/x.txt'), 'local:jds/x.txt');
  assert.equal(PV.normKey('not a url'), 'not a url');
  assert.equal(PV.normKey('HTTPS://EXAMPLE.COM/A'), 'example.com/A');
});

// ── parseScore / hostOf ──────────────────────────────────────────────

test('parseScore: "4,2/5" comma decimals, plain numbers, garbage → null', () => {
  assert.equal(PV.parseScore('4,2/5'), 4.2);
  assert.equal(PV.parseScore('3.9 / 5'), 3.9);
  assert.equal(PV.parseScore(5), 5);
  assert.equal(PV.parseScore('—'), null);
  assert.equal(PV.parseScore(null), null);
});

test('hostOf: lowercase host without www; empty when unparseable', () => {
  assert.equal(PV.hostOf('https://WWW.Career.Habr.com/vacancies/1'), 'career.habr.com');
  assert.equal(PV.hostOf('not a url'), '');
});

// ── splitReportTitle ─────────────────────────────────────────────────

test('splitReportTitle: labelled H1 reads "Company — Role" (parent convention)', () => {
  assert.deepEqual(
    PV.splitReportTitle('Evaluation: Stripe — Senior Backend Engineer'),
    { company: 'Stripe', role: 'Senior Backend Engineer' });
  assert.deepEqual(
    PV.splitReportTitle('Оценка: Яндекс — Инженер'),
    { company: 'Яндекс', role: 'Инженер' });
});

test('splitReportTitle: bare H1 reads "Role — Company"', () => {
  assert.deepEqual(
    PV.splitReportTitle('Senior Frontend Engineer - Grafana Labs'),
    { company: 'Grafana Labs', role: 'Senior Frontend Engineer' });
});

test('splitReportTitle: dashes INSIDE a name do not split the company side', () => {
  // labelled form: everything after the first dash stays the role side,
  // the company is the first part only.
  assert.deepEqual(
    PV.splitReportTitle('Evaluation: Acme — Head of Platform — EMEA'),
    { company: 'Acme', role: 'Head of Platform — EMEA' });
});

test('splitReportTitle: degenerate titles still yield something sane', () => {
  assert.deepEqual(PV.splitReportTitle(''), { company: '', role: '' });
  assert.deepEqual(PV.splitReportTitle('Evaluation: OnlyRole'),
    { company: '', role: 'OnlyRole' });
  assert.deepEqual(PV.splitReportTitle('OnlyCompany'),
    { company: 'OnlyCompany', role: '' });
});

// ── buildEnrichment + enrichEntries ──────────────────────────────────

test('buildEnrichment: tracker rows win over reports win over checklist cells', () => {
  const url = 'https://jobs.example.com/1';
  const table = PV.buildEnrichment({
    mapRows: [{ url, company: 'Guess Co', title: 'Some Role', location: 'Berlin' }],
    reports: [{ url, slug: '042-x', title: 'Evaluation: Real Co — Real Role', score: '4.2/5', scoreNum: 4.2 }],
    trackerRows: [{ url, company: 'Tracker Co', role: 'Tracker Role', score: '5/5', scoreNum: 5, status: 'Evaluated' }],
  });
  const e = PV.enrichEntries([url], table)[0];
  assert.equal(e.company, 'Tracker Co');
  assert.equal(e.role, 'Tracker Role');
  assert.equal(e.scoreNum, 5);
  assert.equal(e.tracked, true);
  assert.equal(e.status, 'Evaluated');
});

test('buildEnrichment: a report alone fills company/role/score/report', () => {
  const url = 'https://jobs.example.com/2';
  const table = PV.buildEnrichment({
    reports: [{ url, slug: '007-acme', title: 'Evaluation: Acme — Platform Engineer', scoreNum: 3.8 }],
  });
  const e = PV.enrichEntries([url], table)[0];
  assert.equal(e.company, 'Acme');
  assert.equal(e.role, 'Platform Engineer');
  assert.equal(e.scoreNum, 3.8);
  assert.equal(e.report, '007-acme');
  assert.equal(e.tracked, false, 'report-only entries are NOT marked evaluated');
});

test('buildEnrichment: checklist cells alone give the display-grade guess', () => {
  const url = 'https://career.habr.com/vacancies/1000136672';
  const table = PV.buildEnrichment({
    mapRows: [{ url, company: 'Хабр', title: 'Backend Developer', location: 'Москва' }],
  });
  const e = PV.enrichEntries([url], table)[0];
  assert.equal(e.company, 'Хабр');
  assert.equal(e.role, 'Backend Developer');
  assert.equal(e.location, 'Москва');
});

test('enrichEntries: unmatched URLs still render (host fallback, no invention)', () => {
  const [a, b] = PV.enrichEntries(
    ['https://unknown.example.com/a/1', 'https://hh.ru/vacancy/9'],
    PV.buildEnrichment({}));
  assert.equal(a.company, '');
  assert.equal(a.host, 'unknown.example.com');
  assert.equal(a.tracked, false);
  assert.equal(b.host, 'hh.ru');
});

test('enrichEntries: tracked flags work through tracking-param variants', () => {
  const table = PV.buildEnrichment({
    trackerRows: [{ url: 'https://hh.ru/vacancy/42', company: 'A', role: 'B', status: 'Applied' }],
  });
  const e = PV.enrichEntries(['https://www.hh.ru/vacancy/42?utm_source=x'], table)[0];
  assert.equal(e.tracked, true, 'the same posting with tracking params is still tracked');
});

// ── filterEntries / groupEntries ─────────────────────────────────────

function fixtureEntries() {
  return PV.enrichEntries([
    'https://career.habr.com/vacancies/1',
    'https://career.habr.com/vacancies/2',
    'https://jobs.lever.co/acme/3',
  ], PV.buildEnrichment({
    mapRows: [
      { url: 'https://career.habr.com/vacancies/1', company: 'Хабр', title: 'A' },
      { url: 'https://career.habr.com/vacancies/2', company: 'Хабр', title: 'B' },
      { url: 'https://jobs.lever.co/acme/3', company: 'Acme', title: 'C' },
    ],
    trackerRows: [{ url: 'https://career.habr.com/vacancies/2', company: 'Хабр', role: 'B', status: 'Evaluated' }],
  }));
}

test('filterEntries: query hits url/company/role; hideTracked drops evaluated', () => {
  const all = fixtureEntries();
  assert.equal(PV.filterEntries(all, 'habr', {}).length, 2);
  assert.equal(PV.filterEntries(all, 'acme', {}).length, 1);
  assert.equal(PV.filterEntries(all, '', { hideTracked: true }).length, 2);
  assert.equal(PV.filterEntries(all, '', {}).length, 3);
  assert.equal(PV.filterEntries(all, 'zzz-none', {}).length, 0);
});

test('groupEntries: biggest group first, company label, host fallback', () => {
  const groups = PV.groupEntries(fixtureEntries());
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, 'Хабр');
  assert.equal(groups[0].entries.length, 2);
  assert.equal(groups[1].label, 'Acme');
  // a URL with no company at all groups under its host
  const lonely = PV.groupEntries(PV.enrichEntries(['https://weird.example.org/x'], PV.buildEnrichment({})));
  assert.equal(lonely[0].label, 'weird.example.org');
});

test('groupEntries: hostless rows fold into the company mapped to their host', () => {
  // habr 672 is tracked (company «Хабр»), habr 673 is fresh (no company):
  // one board must not split into «Хабр» + «career.habr.com».
  const entries = PV.enrichEntries([
    'https://career.habr.com/vacancies/672',
    'https://career.habr.com/vacancies/673',
  ], PV.buildEnrichment({
    trackerRows: [{ url: 'https://career.habr.com/vacancies/672', company: 'Хабр', role: 'B' }],
  }));
  const groups = PV.groupEntries(entries);
  assert.equal(groups.length, 1, `one group, got: ${groups.map((g) => g.label)}`);
  assert.equal(groups[0].label, 'Хабр');
  assert.equal(groups[0].entries.length, 2);
  // a DIFFERENT host with no company mapping keeps its own host group
  const mixed = PV.groupEntries([...entries,
    ...PV.enrichEntries(['https://other.example.com/z'], PV.buildEnrichment({}))]);
  assert.equal(mixed.length, 2);
});

// ── createUndoQueue ──────────────────────────────────────────────────

test('createUndoQueue: LIFO, bounded, copies batches, empty pops null', () => {
  const q = PV.createUndoQueue(2);
  assert.equal(q.pop(), null);
  q.push(['a']);
  q.push(['b', 'c']);
  assert.equal(q.size, 2);
  q.push(['d']); // evicts the oldest
  assert.equal(q.size, 2);
  assert.deepEqual(q.pop(), ['d']);
  assert.deepEqual(q.pop(), ['b', 'c']);
  assert.equal(q.peek(), null);
  // push copies: later mutation of the source array must not leak in
  const src = ['x'];
  q.push(src);
  src.push('y');
  assert.deepEqual(q.pop(), ['x']);
  // empty batches are ignored
  q.push([]);
  assert.equal(q.size, 0);
});

/**
 * fit-score.js — "fit-to-what-you-want" heuristic (v1.89.0, Epic 14).
 * Loaded in a synthetic window with countries.js (same pattern as
 * role-stats.test.mjs). Conservative: no matchable signal → score:null.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/fit-score.js'), 'utf8'))(w);  // eslint-disable-line no-new-func
const FS = w.FitScore;
const C = w.Countries;

test('FitScore surface + internals', () => {
  assert.ok(FS && typeof FS.scoreJob === 'function');
  assert.equal(FS._internals.workTypeOf('Fully Remote'), 'remote');
  assert.equal(FS._internals.workTypeOf('Hybrid — 2 days'), 'hybrid');
  assert.equal(FS._internals.workTypeOf('On-site, NYC'), 'onsite');
  assert.equal(FS._internals.workTypeOf('flexible'), null);
  assert.equal(FS._internals.salaryFloor('at least $120k'), 120000);
  assert.equal(FS._internals.salaryFloor('min 100000'), 100000);
  assert.equal(FS._internals.salaryFloor('nice team'), null);
  // Sub-annual rates are NOT an annual floor — must not be promoted to a bogus 500k.
  assert.equal(FS._internals.salaryFloor('at least 500 EUR/day'), null);
  assert.equal(FS._internals.salaryFloor('min $80/hr'), null);
  assert.equal(FS._internals.salaryFloor('minimum 6000 monthly'), null);
});

test('empty / unmatchable two-pager → score null (no badge)', () => {
  assert.equal(FS.scoreJob({ title: 'X', location: 'Remote', isRemote: true }, {}).score, null);
  // only free-text semantic prefs a scan row can't confirm → still null
  const r = FS.scoreJob({ title: 'Eng', location: 'Berlin, Germany' }, { loves: ['friendly team', 'good mentorship'] });
  assert.equal(r.score, null);
});

test('work-type: loved remote matches, hated onsite violates', () => {
  const remoteJob = { title: 'Eng', location: 'Remote', workplaceType: 'Remote', isRemote: true };
  const m = FS.scoreJob(remoteJob, { loves: ['remote work'] }, C);
  assert.ok(m.score > 50);
  assert.equal(m.matched[0].label, 'remote work');

  const onsiteJob = { title: 'Eng', location: 'NYC office', workplaceType: 'Onsite', isRemote: false };
  const v = FS.scoreJob(onsiteJob, { deal_breakers: ['onsite only'] }, C);
  assert.ok(v.score < 50);
  assert.equal(v.violated[0].label, 'onsite only');
});

test('country: must-have match vs must-have-elsewhere violation', () => {
  const deJob = { title: 'Eng', location: 'Berlin, Germany' };
  const hit = FS.scoreJob(deJob, { must_haves: ['Germany'] }, C);
  assert.ok(hit.score > 50 && hit.matched.some((x) => x.label === 'Germany'));

  const frJob = { title: 'Eng', location: 'Paris, France' };
  const miss = FS.scoreJob(frJob, { must_haves: ['Germany'] }, C);
  assert.ok(miss.score < 50 && miss.violated.some((x) => x.label === 'Germany'));

  const deBreaker = FS.scoreJob(deJob, { deal_breakers: ['Germany'] }, C);
  assert.ok(deBreaker.violated.some((x) => x.label === 'Germany'));

  // Whole-word match only: a "Germany" country must NOT match the adjective
  // "German" inside a pref, nor fire a false must-have-elsewhere violation.
  const germanPref = FS.scoreJob(deJob, { loves: ['German-speaking team culture'] }, C);
  assert.ok(!germanPref.matched.some((x) => /German-speaking/.test(x.label)),
    'substring "German" must not match country Germany');
});

// ── v1.243.0 (CAR-18): OR-listed must-have countries + salary parsing ──

test('OR-listed must-have country: a job in ANY named country matches once, never violates', () => {
  const tp = { must_haves: ['Germany or Netherlands'] };
  const berlin = FS.scoreJob({ title: 'Eng', location: 'Berlin, Germany' }, tp, C);
  assert.ok(berlin.matched.some((x) => x.label === 'Germany or Netherlands'),
    'the pref counts as matched');
  assert.deepEqual(berlin.violated, [],
    'the same line must not ALSO count as a must-have-elsewhere violation');
  assert.ok(berlin.score > 50, 'a perfect fit must not be net-negative');

  const amsterdam = FS.scoreJob({ title: 'Eng', location: 'Amsterdam, Netherlands' }, tp, C);
  assert.ok(amsterdam.matched.some((x) => x.label === 'Germany or Netherlands'));
  assert.deepEqual(amsterdam.violated, []);

  // a job in NEITHER named country still violates
  const paris = FS.scoreJob({ title: 'Eng', location: 'Paris, France' }, tp, C);
  assert.ok(paris.violated.some((x) => x.label === 'Germany or Netherlands'));
});

test('jobSalaryNum: a salary range is judged by its TOP, not its bottom', () => {
  const job = { title: 'Eng', location: 'X', salary: '$100-150K' };
  const tp = { must_haves: ['at least $120k'] };
  const r = FS.scoreJob(job, tp, C);
  assert.ok(r.matched.some((x) => x.label === 'at least $120k'),
    '150k top ≥ 120k floor → matched (pre-fix jobSalaryNum read 100)');
  assert.deepEqual(r.violated, []);

  const r2 = FS.scoreJob({ title: 'Eng', salary: '$150,000 - $200,000' },
    { must_haves: ['min 160000'] }, C);
  assert.ok(r2.matched.length === 1, 'top of an explicit range (200k) clears a 160k floor');
});

test('jobSalaryNum: space-grouped thousands parse as full amounts', () => {
  const r = FS.scoreJob({ title: 'Eng', salary: '150 000 RUB net' },
    { must_haves: ['at least 140000'] }, C);
  assert.ok(r.matched.length === 1, '150 000 must parse as 150000 (pre-fix: 150)');
});

test('salaryFloor and jobSalaryNum keep comma/decimal handling (regression guard)', () => {
  assert.equal(FS._internals.salaryFloor('at least $120k'), 120000);
  assert.equal(FS._internals.salaryFloor('min 100000'), 100000);
  assert.equal(FS._internals.salaryFloor('nice team'), null);
  assert.equal(FS._internals.salaryFloor('at least 500 EUR/day'), null);
  assert.equal(FS._internals.salaryFloor('min $80/hr'), null);
  assert.equal(FS._internals.salaryFloor('minimum 6000 monthly'), null);
  // comma thousands + decimals
  const r = FS.scoreJob({ title: 'Eng', salary: '5,000 EUR/month' }, { loves: ['anything'] }, C);
  assert.equal(r.score, null, 'sub-annual 5,000/month is not promoted to an annual floor');
});

test('salary floor: meets vs below', () => {
  const above = FS.scoreJob({ title: 'X', location: 'Remote', salary: '$150k' }, { must_haves: ['at least $120k'] }, C);
  assert.ok(above.matched.some((x) => x.label === 'at least $120k'));
  const below = FS.scoreJob({ title: 'X', location: 'Remote', salary: '$90,000' }, { non_negotiables: ['min $120k'] }, C);
  assert.ok(below.violated.some((x) => x.label === 'min $120k'));
});

test('hard deal-breaker weighs more than a soft hate', () => {
  const job = { title: 'X', location: 'NYC office', workplaceType: 'Onsite', isRemote: false };
  const hard = FS.scoreJob(job, { deal_breakers: ['onsite only'] }, C).score;
  const soft = FS.scoreJob(job, { hates: ['onsite only'] }, C).score;
  assert.ok(hard < soft, 'a deal-breaker violation should score lower than a hate');
});

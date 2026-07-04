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

/**
 * tracker-stages.js — pure helpers for the #/tracker CRM stage-tab board
 * (v1.131.0, parent web/ `/pipeline` port). Loaded in a synthetic window,
 * the same pattern as job-facets.test.mjs / score-tone.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/tracker-stages.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const TS = w.TrackerStages;

// A representative alias map, shaped exactly like GET /api/tracker/stages emits.
const ALIASES = {
  evaluated: 'Evaluated', evaluada: 'Evaluated',
  applied: 'Applied', aplicado: 'Applied', enviada: 'Applied', sent: 'Applied',
  interview: 'Interview', entrevista: 'Interview',
  offer: 'Offer', oferta: 'Offer',
  rejected: 'Rejected', rechazado: 'Rejected',
  skip: 'SKIP', monitor: 'SKIP',
  hired: 'Hired', contratado: 'Hired',
};
const STAGES = ['Evaluated', 'Applied', 'Interview', 'Offer', 'Rejected', 'SKIP', 'Hired'];

test('foldStatus maps a canonical label to itself (case-insensitive)', () => {
  assert.equal(TS.foldStatus('Applied', ALIASES), 'Applied');
  assert.equal(TS.foldStatus('applied', ALIASES), 'Applied');
  assert.equal(TS.foldStatus('HIRED', ALIASES), 'Hired');
});

test('foldStatus folds an alias (and a localized alias) to its canonical label', () => {
  assert.equal(TS.foldStatus('aplicado', ALIASES), 'Applied');
  assert.equal(TS.foldStatus('entrevista', ALIASES), 'Interview');
  assert.equal(TS.foldStatus('monitor', ALIASES), 'SKIP');
});

test('foldStatus tolerates stray markdown bold + whitespace', () => {
  assert.equal(TS.foldStatus('**Applied**', ALIASES), 'Applied');
  assert.equal(TS.foldStatus('  Offer  ', ALIASES), 'Offer');
});

test('foldStatus keeps an unknown status raw (so it only counts under ALL)', () => {
  assert.equal(TS.foldStatus('Ghosted', ALIASES), 'Ghosted');
  assert.equal(TS.foldStatus('', ALIASES), '');
  assert.equal(TS.foldStatus(null, ALIASES), '');
});

test('stageCounts includes zero-count stages (the full-funnel CRM look)', () => {
  const rows = [
    { status: 'Applied' }, { status: 'aplicado' }, { status: '**Applied**' },
    { status: 'Interview' },
    { status: 'Ghosted' }, // unknown → in no stage bucket
  ];
  const counts = TS.stageCounts(rows, STAGES, ALIASES);
  assert.equal(counts.Applied, 3);
  assert.equal(counts.Interview, 1);
  assert.equal(counts.Offer, 0, 'a stage with no rows must still be present at 0');
  assert.equal(counts.Hired, 0);
  // Unknown statuses never invent a bucket.
  assert.equal(Object.prototype.hasOwnProperty.call(counts, 'Ghosted'), false);
});

test('stageCounts is robust to empty / missing inputs', () => {
  assert.deepEqual(TS.stageCounts([], STAGES, ALIASES).Applied, 0);
  assert.deepEqual(TS.stageCounts(null, STAGES, null).Applied, 0);
  assert.deepEqual(TS.stageCounts([{ status: 'Applied' }], [], {}), {});
});

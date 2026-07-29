/**
 * public/js/lib/score-tone.js — 4-tier fit-score tone (parent web/ port #3,
 * v1.128.0). Loads the browser global the same way the other pure-client-lib
 * tests do (new Function(window, src)) — CI-isolated, no DOM.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ScoreTone;

before(() => {
  const win = {};
  const src = readFileSync(resolve(ROOT, 'public/js/lib/score-tone.js'), 'utf8');
  new Function('window', src)(win);
  ScoreTone = win.ScoreTone;
});

test('scoreNum: first number from strings/numbers, NaN otherwise', () => {
  assert.equal(ScoreTone.scoreNum('4.1/5'), 4.1);
  assert.equal(ScoreTone.scoreNum('3.0'), 3.0);
  assert.equal(ScoreTone.scoreNum(4.2), 4.2);
  assert.ok(Number.isNaN(ScoreTone.scoreNum('B+')));
  assert.ok(Number.isNaN(ScoreTone.scoreNum('')));
  assert.ok(Number.isNaN(ScoreTone.scoreNum(null)));
});

test('scoreTone: four numeric tiers at 4.2 / 3.8 / 3.0', () => {
  assert.equal(ScoreTone.scoreTone(4.8), 'good');
  assert.equal(ScoreTone.scoreTone(4.2), 'good');
  assert.equal(ScoreTone.scoreTone(4.0), 'warn');
  assert.equal(ScoreTone.scoreTone(3.8), 'warn');
  assert.equal(ScoreTone.scoreTone(3.4), 'muted');
  assert.equal(ScoreTone.scoreTone(3.0), 'muted');
  assert.equal(ScoreTone.scoreTone(2.9), 'bad');
  assert.equal(ScoreTone.scoreTone('4.3/5'), 'good');
});

test('scoreTone: letter-grade fallback when unparsable', () => {
  assert.equal(ScoreTone.scoreTone('A-'), 'good');
  assert.equal(ScoreTone.scoreTone('B'), 'warn');
  assert.equal(ScoreTone.scoreTone('C+'), 'muted');
  assert.equal(ScoreTone.scoreTone('D'), 'bad');
  assert.equal(ScoreTone.scoreTone('F'), 'bad');
});

test('scoreTone: a not-yet-scored row is neutral (muted), never red', () => {
  // A pending/unevaluated row (no score) must not render red — it reads muted.
  assert.equal(ScoreTone.scoreTone(''), 'muted');
  assert.equal(ScoreTone.scoreTone('   '), 'muted');
  assert.equal(ScoreTone.scoreTone(null), 'muted');
  assert.equal(ScoreTone.scoreTone(undefined), 'muted');
  assert.equal(ScoreTone.scoreClass(''), 'score-muted');
});

test('scoreClass: maps tone → tracker CSS class (4 tiers)', () => {
  assert.equal(ScoreTone.scoreClass(4.5), 'score-high');
  assert.equal(ScoreTone.scoreClass(3.9), 'score-mid');
  assert.equal(ScoreTone.scoreClass(3.2), 'score-muted');
  assert.equal(ScoreTone.scoreClass(2.0), 'score-low');
});

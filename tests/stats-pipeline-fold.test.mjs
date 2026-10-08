/**
 * v1.243.0 (views-3) — #/stats fixes:
 *
 *   - The "My pipeline" funnel + conversion blocks compared RAW tracker
 *     statuses ('**Applied**', 'aplicado', 'Оффер') against canonical stage
 *     names, so aliased rows never landed in a canonical bucket and the
 *     conversion denominators shrank. The real fold helpers
 *     (stageCountsFolded / rowsReachedStage) are run against the REAL
 *     window.TrackerStages.foldStatus — the same alias map the #/tracker
 *     board uses.
 *   - barChart was unreadable in RTL: svg <text> inherits CSS direction and
 *     mirrored the labels/captions.
 *   - draw() detached the metric/dimension <select>s (focus fell to <body>).
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
const TRACKER_STAGES = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'tracker-stages.js'), 'utf8');

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

/** Boot the real TrackerStages helper in a vm and return a fold function. */
function makeFold(aliases) {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(TRACKER_STAGES, ctx);
  const TS = vm.runInContext('window.TrackerStages', ctx);
  assert.ok(TS && typeof TS.foldStatus === 'function', 'tracker-stages.js must load');
  return (s) => TS.foldStatus(s, aliases);
}

const HELPERS = `${sliceFn(STATS, 'function stageCountsFolded')}\n${sliceFn(STATS, 'function rowsReachedStage')}`;

function runHelpers() {
  const ctx = vm.createContext({ Set });
  vm.runInContext(HELPERS, ctx);
  return vm.runInContext('({ stageCountsFolded, rowsReachedStage })', ctx);
}

const ROWS = [
  { status: '**Applied**' },   // markdown-bold raw export
  { status: 'aplicado' },      // Spanish market alias
  { status: 'Applied' },       // canonical, already
  { status: 'oferta' },        // Spanish alias for the Offer stage
  { status: '' },              // no status → 'Evaluated' convention
];

// The alias map in the shape GET /api/tracker/stages serves: keys are the
// server's lowercased labels/ids/aliases, values the canonical labels.
const ALIASES = {
  applied: 'Applied',
  aplicado: 'Applied',
  evaluated: 'Evaluated',
  offer: 'Offer',
  oferta: 'Offer',
};

test('funnel: aliased + bolded statuses fold into canonical buckets', () => {
  const { stageCountsFolded } = runHelpers();
  const fold = makeFold(ALIASES);
  // toHost: the counts object is created in the vm realm — compare plain data.
  const toHost = (o) => Object.fromEntries(Object.entries(o));
  assert.deepEqual(toHost(stageCountsFolded(ROWS, fold)), {
    Applied: 3,
    Offer: 1,
    Evaluated: 1,
  }, "'**Applied**' + 'aplicado' must count as Applied; 'oferta' as Offer");
});

test('funnel: an identity fold preserves the old raw behaviour (no invented buckets)', () => {
  const { stageCountsFolded } = runHelpers();
  const toHost = (o) => Object.fromEntries(Object.entries(o));
  assert.deepEqual(toHost(stageCountsFolded(ROWS, (s) => (s || ''))), {
    '**Applied**': 1,
    aplicado: 1,
    Applied: 1,
    oferta: 1,
    Evaluated: 1,
  }, 'with no alias map the raw statuses still count (graceful degrade)');
});

test('conversion: the denominators grow once aliased rows fold into the stage', () => {
  const { rowsReachedStage } = runHelpers();
  const fold = makeFold(ALIASES);
  assert.equal(rowsReachedStage(ROWS, fold, ['Applied', 'Responded', 'Interview', 'Offer', 'Hired']), 4,
    'applied denominator: all Applied-family + Offer rows');
  assert.equal(rowsReachedStage(ROWS, fold, ['Offer', 'Hired']), 1);
  assert.equal(rowsReachedStage(ROWS, (s) => (s || ''), ['Offer', 'Hired']), 0,
    'without the fold the same query misses the aliased row (the defect)');
});

test('wiring: renderPipeline fetches the stages alias map and folds before counting', () => {
  assert.match(STATS, /API\.get\('\/api\/tracker\/stages'\)/,
    'the alias map comes from the same endpoint the #/tracker board uses');
  assert.match(STATS, /TS\.foldStatus\(s, aliases\)/,
    'folding goes through TrackerStages.foldStatus');
  assert.match(STATS, /const counts = stageCountsFolded\(rows, fold\);/);
  assert.match(STATS, /const advanced = \(\.\.\.statuses\) => rowsReachedStage\(rows, fold, statuses\);/);
  assert.doesNotMatch(STATS, /statuses\.includes\(\(r\.status \|\| ''\)\.trim\(\)\)/,
    'the raw-status comparison must be gone');
});

test('RTL: barChart pins LTR direction so svg <text> stays readable', () => {
  const barChart = sliceFn(STATS, 'function barChart');
  assert.match(barChart, /svg\.style\.direction = 'ltr';/,
    'CSS direction is inherited — pinning it at the svg root fixes every <text> child');
});

test('focus: draw() re-attaches the metric/dimension selects under focus preservation', () => {
  const draw = sliceFn(STATS, 'function draw() {');
  assert.match(draw, /withFocusPreserved\(charts, \(\) => \{/);
  assert.match(draw, /charts\.appendChild\(customChart\(\)\);/);
});

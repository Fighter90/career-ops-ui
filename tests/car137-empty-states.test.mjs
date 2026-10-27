/**
 * CAR-137 — [UX·Пустые состояния] Reports, Usage, Portals, Activity,
 * Dashboard — the v2empty pattern from CAR-124 (explanation + tagged,
 * decorative example + pre-wired action) applied to the five remaining
 * flat one-line empty states.
 *
 * Acceptance (the Linear ticket, part «пустые состояния по v2empty-паттерну
 * CAR-124»):
 *   • reports   — `rep.empty` one-liner → title + body + action → #/evaluate
 *   • usage     — description without an action → title + body + action → #/config
 *   • portals   — "edit the yml by hand" → title + body + action → the page's
 *                 own Discover block (scroll + focus)
 *   • activity  — one-liner → title + body + action → #/scan
 *   • dashboard — recent/pipeline tiles on common.empty/pipe.empty →
 *                 per-tile title + body + action (#/scan, #/pipeline)
 *
 * Static gate (the CAR-124 convention): every view carries its v2empty.*
 * markers, every key is translated in ALL 19 locale dicts, every call
 * keeps a non-empty EN fallback, and the replaced one-line keys are gone
 * from the dictionaries (dead-key hygiene — tests/i18n-dead-keys enforces
 * the same rule repo-wide).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

const REPORTS = read('public', 'js', 'views', 'reports.js');
const USAGE = read('public', 'js', 'views', 'usage.js');
const PORTALS = read('public', 'js', 'views', 'portals.js');
const ACTIVITY = read('public', 'js', 'views', 'activity.js');
const DASHBOARD = read('public', 'js', 'views', 'dashboard.js');

const CAR137_FILES = [
  ['reports.js', REPORTS], ['usage.js', USAGE], ['portals.js', PORTALS],
  ['activity.js', ACTIVITY], ['dashboard.js', DASHBOARD],
];

const CAR137_KEYS = [
  'v2empty.reports.emptyTitle', 'v2empty.reports.emptyBody', 'v2empty.reports.openEvaluate',
  'v2empty.usage.emptyTitle', 'v2empty.usage.emptyBody', 'v2empty.usage.openConfig',
  'v2empty.portals.emptyTitle', 'v2empty.portals.emptyBody', 'v2empty.portals.discover',
  'v2empty.activity.emptyTitle', 'v2empty.activity.emptyBody',
  'v2empty.dash.recentTitle', 'v2empty.dash.recentBody',
  'v2empty.dash.pipelineTitle', 'v2empty.dash.pipelineBody',
];

// ─── the five empty states follow the CAR-124 pattern ───

test('CAR-137 reports: empty state = title + body + example + action link to #/evaluate', () => {
  for (const key of CAR137_KEYS.slice(0, 3)) {
    assert.ok(REPORTS.includes(`'${key}'`), `reports.js references ${key}`);
  }
  assert.match(REPORTS, /href: '#\/evaluate'/, 'the action is a real link to #/evaluate');
  // the pattern's example block — tagged, decorative, aria-hidden on the CONTAINER
  assert.match(REPORTS, /className: 'v2-empty-example',\s*'aria-hidden': 'true'/,
    'the sample report row container is aria-hidden (CAR-124 f10 convention)');
  assert.match(REPORTS, /v2empty\.exampleTag/, 'the example carries the localized Example tag');
});

test('CAR-137 usage: empty state = title + body + example + action link to #/config', () => {
  for (const key of CAR137_KEYS.slice(3, 6)) {
    assert.ok(USAGE.includes(`'${key}'`), `usage.js references ${key}`);
  }
  assert.match(USAGE, /href: '#\/config'/, 'the action is a real link to #/config');
  assert.match(USAGE, /className: 'v2-empty-example',\s*'aria-hidden': 'true'/,
    'the sample usage row container is aria-hidden');
  assert.match(USAGE, /v2empty\.exampleTag/, 'the example carries the localized Example tag');
});

test('CAR-137 portals: empty state routes to the page\'s own Discover block (scroll + focus), not a dead end', () => {
  for (const key of CAR137_KEYS.slice(6, 9)) {
    assert.ok(PORTALS.includes(`'${key}'`), `portals.js references ${key}`);
  }
  // the action drives the EXISTING discover input on the same page — no
  // new network call, no duplicate discover UI
  assert.match(PORTALS, /discCard\.scrollIntoView/, 'the action scrolls to the Discover block');
  assert.match(PORTALS, /discInput\.focus\(/, 'the action focuses the discover input');
  assert.equal((PORTALS.match(/API\.post\('\/api\/portals\/discover'/g) || []).length, 1,
    'still exactly one discover endpoint call (the existing block\'s)');
});

test('CAR-137 activity: empty state = title + body + example + action link to #/scan', () => {
  for (const key of CAR137_KEYS.slice(9, 11)) {
    assert.ok(ACTIVITY.includes(`'${key}'`), `activity.js references ${key}`);
  }
  assert.match(ACTIVITY, /href: '#\/scan'/, 'the action is a real link to #/scan');
  assert.match(ACTIVITY, /className: 'v2-empty-example',\s*'aria-hidden': 'true'/,
    'the sample activity row container is aria-hidden');
});

test('CAR-137 dashboard: recent/pipeline tiles get per-tile titles, bodies and actions', () => {
  for (const key of CAR137_KEYS.slice(11)) {
    assert.ok(DASHBOARD.includes(`'${key}'`), `dashboard.js references ${key}`);
  }
  assert.match(DASHBOARD, /href: '#\/scan'/, 'the recent tile links #/scan');
  assert.match(DASHBOARD, /href: '#\/pipeline'/, 'the pipeline tile links #/pipeline');
  // the replaced one-line empties must be GONE from the tiles
  const recent = DASHBOARD.match(/function recentTable[\s\S]*?\n\}/)[0];
  const pipe = DASHBOARD.match(/function pipelineCard[\s\S]*?\n\}/)[0];
  assert.ok(!recent.includes("t('common.empty'"), 'recentTable no longer shows the generic common.empty line');
  assert.ok(!pipe.includes("t('pipe.empty'"), 'pipelineCard no longer shows the generic pipe.empty line');
});

// ─── i18n: all 19 dicts, EN fallbacks, no orphans ───

test('CAR-137: every new v2empty.* key is translated in ALL 19 locale dicts', () => {
  const DICT = loadAssembledDict();
  for (const key of CAR137_KEYS) {
    assert.ok(DICT[key], `${key} exists in the assembled dict`);
    for (const lang of I18N_LANGS) {
      const v = DICT[key] && DICT[key][lang];
      assert.ok(typeof v === 'string' && v.trim(), `${key} must be translated in ${lang}`);
    }
  }
});

test('CAR-137: every v2empty call in the five views keeps a non-empty EN fallback', () => {
  for (const [name, src] of CAR137_FILES) {
    for (const m of src.matchAll(/t\('(v2empty\.[a-zA-Z.]+)'\s*,\s*'([^']*)'/g)) {
      assert.ok(m[2].trim().length > 0, `${name}: ${m[1]} has a non-empty EN fallback`);
    }
    // a v2empty key without a fallback argument is a bug (dicts own the values)
    for (const m of src.matchAll(/t\('v2empty\.[a-zA-Z.]+'\)/g)) {
      assert.fail(`${name}: ${m[0]} is missing its EN fallback`);
    }
  }
});

test('CAR-137: the replaced one-line keys are removed from the dicts (dead-key hygiene)', () => {
  // built via join so this file never carries the bare quoted literals —
  // the repo-wide dead-key scan reads tests/ too
  const DICT = loadAssembledDict();
  for (const [head, tail] of [['rep', 'empty'], ['usage', 'empty'], ['activity', 'empty'], ['portals', 'empty']]) {
    const key = [head, tail].join('.');
    assert.ok(!DICT[key], `${key} is gone from the dictionaries — nothing references it anymore`);
  }
});

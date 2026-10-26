/**
 * CAR-119 — the 12 AI-tool views consume the shared llm-page-kit template.
 *
 * Structural gate (the project's source-static style, like car94/car130):
 *   • every view in the ticket's list references the kit;
 *   • every LIVE generation path carries the cancel guard (a cancelled run
 *     paints nothing more);
 *   • the kit script + v2-llm.css are wired in public/index.html in order
 *     (stylesheet after v2-reports.css, script before the views);
 *   • cv-studio keeps its deliberate single-column toolbox deviation while
 *     still mounting three run panels.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

const INDEX = read('public', 'index.html');

// view → what the ticket's template requires on it
const VIEWS = {
  'deep.js': ['layout', 'createRun', 'jobPicker'],
  'mode-page.js': ['layout', 'createRun', 'jobPicker'],
  'networking.js': ['layout', 'createRun', 'jobPicker', 'historyDrawer'],
  'mock-interview.js': ['layout', 'createRun', 'jobPicker', 'historyDrawer'],
  'career-plan.js': ['layout', 'createRun'],
  'orientation.js': ['layout', 'createRun'],
  'memory.js': ['layout', 'createRun'],
  'docs-assistant.js': ['layout', 'createRun'],
  'two-pager.js': ['layout', 'createRun'],
  'funded.js': ['layout', 'createRun'],
  'stats.js': ['layout', 'createRun'],
  'cv-studio.js': ['createRun'], // deliberate deviation: toolbox, no two-column split
};

const CANCEL_GUARD = /runCtrl\.cancelled \|\| runCtrl\.signal\.aborted/;

test('CAR-119: every AI-tool view consumes the shared kit', () => {
  for (const [file, parts] of Object.entries(VIEWS)) {
    const src = read('public', 'js', 'views', file);
    assert.match(src, /window\.LlmPageKit/, `${file}: uses the shared kit`);
    for (const part of parts) {
      assert.ok(src.includes(`LlmPageKit.${part}`), `${file}: uses LlmPageKit.${part}`);
    }
  }
});

test('CAR-119: every live run path carries the cancel guard (a cancelled run paints nothing)', () => {
  // One guard per createRun call site (funded discards a GET result; the
  // others discard a POST response).
  for (const [file, expected] of [
    ['deep.js', 1], ['mode-page.js', 1], ['networking.js', 1], ['mock-interview.js', 1],
    ['career-plan.js', 1], ['orientation.js', 1], ['memory.js', 1], ['docs-assistant.js', 1],
    ['two-pager.js', 1], ['funded.js', 1], ['cv-studio.js', 3], ['stats.js', 1],
  ]) {
    const src = read('public', 'js', 'views', file);
    const runs = (src.match(/LlmPageKit\.run\(/g) || []).length;
    assert.equal(runs, expected, `${file}: ${expected} kit run(s)`);
    assert.match(src, CANCEL_GUARD, `${file}: cancelled runs never paint a result`);
  }
});

test('CAR-119: index.html wires the stylesheet (after v2-reports) and the script (before the views)', () => {
  const cssAt = INDEX.indexOf('/css/v2-llm.css');
  const reportsCssAt = INDEX.indexOf('/css/v2-reports.css');
  const mapCssAt = INDEX.indexOf('/css/map.css');
  assert.ok(cssAt > -1, 'the v2-llm stylesheet link exists');
  assert.ok(cssAt > reportsCssAt, 'it loads after v2-reports.css');
  assert.ok(cssAt < mapCssAt, 'and before map.css');
  const kitAt = INDEX.indexOf('/js/lib/llm-page-kit.js');
  assert.ok(kitAt > -1, 'the kit script tag exists');
  assert.ok(kitAt > INDEX.indexOf('/js/lib/report-export.js'), 'after the other libs');
  assert.ok(kitAt < INDEX.indexOf('/js/router.js'), 'before the views register routes');
});

test('CAR-119: the history drawers keep the views\u2019 own endpoints (no invented storage)', () => {
  const net = read('public', 'js', 'views', 'networking.js');
  const mock = read('public', 'js', 'views', 'mock-interview.js');
  assert.match(net, /\/api\/networking\/plans/, 'networking drawer reads its real list endpoint');
  assert.match(net, /\/api\/networking\/plans\/\$\{encodeURIComponent/, 'networking drawer views/deletes via its real endpoints');
  assert.match(mock, /\/api\/mock-interview\/sessions/, 'mock drawer reads its real list endpoint');
  assert.match(mock, /\/api\/mock-interview\/sessions\/\$\{encodeURIComponent/, 'mock drawer views/deletes via its real endpoints');
  // Views with no save endpoint did NOT get an invented drawer.
  for (const file of ['career-plan.js', 'orientation.js', 'memory.js', 'docs-assistant.js', 'two-pager.js', 'funded.js']) {
    const src = read('public', 'js', 'views', file);
    assert.doesNotMatch(src, /LlmPageKit\.historyDrawer/, `${file}: no invented history storage`);
  }
});

test('CAR-119: the tracker autofill picker targets real form fields (company/role)', () => {
  for (const file of ['deep.js', 'mode-page.js', 'networking.js', 'mock-interview.js']) {
    const src = read('public', 'js', 'views', file);
    assert.match(src, /map: \{ company: 'company', role: 'role' \}/, `${file}: company/role autofill map`);
  }
  // The tracker fetch itself lives in the kit (jobPicker) — one transport,
  // covered by tests/car119-llm-page-kit.test.mjs.
  const kit = read('public', 'js', 'lib', 'llm-page-kit.js');
  assert.match(kit, /\/api\/tracker/, 'jobPicker is fed from the tracker');
});

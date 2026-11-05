/**
 * v1.268.1 SPA review — the #/evaluate SSE run contract.
 *
 * Two defects, one hygiene finding, all pinned source-static (browser-only
 * view — router.test.mjs / tracker-toolbar-menu.test.mjs style):
 *
 *   1. [H] no-terminal-frame hang: the Promise executor called API.postStream
 *      WITHOUT awaiting it and only settled on done/error frames. A stream
 *      that ends without either (server restart mid-run) left the executor
 *      Promise unsettled forever — the Generate button stayed disabled with
 *      no explanation. Same contract as auto-pipeline.js: capture `settled`,
 *      AWAIT postStream inside the executor, and after it completes reject
 *      with err.evaluate.noTerminal when no terminal frame arrived. BOTH the
 *      done and the error handlers must mark settled.
 *   2. [M] no AbortSignal: navigating away mid-evaluation used to keep the
 *      SSE drain (and the server-side provider spend — FULL-M5 threads the
 *      client disconnect into the provider call) running against a detached
 *      view. One module-level Router.onRouteChange registration with a
 *      single slot (abortRun), armed per run, disarmed on settle.
 *   3. [L] setStage interpolated the server-controlled `detail` through
 *      innerHTML. The stage builder must construct a text node via UI.el +
 *      replaceChildren instead — string concatenation, no HTML parsing.
 *
 * The new i18n key err.evaluate.noTerminal must exist ×19.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const EVAL = readFileSync(R('public', 'js', 'views', 'evaluate.js'), 'utf8');
const NO_TERMINAL_EN = 'The evaluation stream ended without a result — the server may have restarted mid-run.';

// ───────────── (1) terminal-frame contract ─────────────

test('postStream is awaited inside the executor and the settled flag gates the terminal frames', () => {
  assert.match(EVAL, /let settled = false;/, 'the executor must capture settled state');
  assert.match(EVAL, /await API\.postStream\(/, 'postStream must be awaited so a stream end is observable');
  // BOTH terminal handlers mark settled…
  const marks = EVAL.match(/settled = true;/g) || [];
  assert.ok(marks.length >= 2, `done + error must each mark settled (found ${marks.length})`);
  // …and the done handler resolves, the error handler rejects.
  assert.match(EVAL, /ev === 'done'\) \{ settled = true; resolve\(data\); \}/);
  assert.match(EVAL, /ev === 'error'\) \{ settled = true; reject\(new Error\(data\.message \|\| 'stream error'\)\); \}/);
});

test('after postStream resolves, a non-aborted run without a terminal frame rejects with err.evaluate.noTerminal', () => {
  const awaitIdx = EVAL.indexOf('await API.postStream');
  const noTerminalIdx = EVAL.indexOf("err.evaluate.noTerminal");
  assert.ok(awaitIdx >= 0, 'await API.postStream found');
  assert.ok(noTerminalIdx > awaitIdx,
    'the no-terminal-frame check must run AFTER postStream resolves (source order)');
  assert.match(EVAL, /if \(!settled\)/, 'settled must be checked after the stream ends');
  assert.ok(EVAL.includes(NO_TERMINAL_EN), 'the EN fallback names the failure');
  // A deliberate route-change abort is NOT an error: it must not reject.
  assert.match(EVAL, /ctrl\.signal\.aborted/, 'the aborted end must stay silent (navigation is not an error)');
});

// ───────────── (2) AbortSignal + route-change abort ─────────────

test('one AbortController per run; the signal rides API.postStream', () => {
  assert.match(EVAL, /new AbortController\(\)/, 'a controller per run');
  assert.match(EVAL, /,\s*ctrl\.signal\s*\)/, 'the signal is passed to API.postStream');
});

test('exactly ONE module-level Router.onRouteChange registration aborts the in-flight run', () => {
  const calls = EVAL.match(/Router\.onRouteChange\(/g) || [];
  assert.equal(calls.length, 1, `exactly one registration (found ${calls.length}) — no per-render hooks`);
  // module level: registered before the view's Router.register callback body,
  // so it cannot live inside the per-render factory.
  const hookIdx = EVAL.indexOf('Router.onRouteChange');
  const registerIdx = EVAL.indexOf("Router.register('evaluate'");
  assert.ok(hookIdx >= 0 && hookIdx < registerIdx, 'the abort hook must be registered at module level');
  // single-slot contract: armed on run start, nulled when the run settles.
  assert.match(EVAL, /let abortRun = null;/);
  assert.match(EVAL, /abortRun && abortRun\(\)/, 'the hook fires the armed slot');
  assert.match(EVAL, /abortRun = stop;/, 'armed on run start');
  assert.match(EVAL, /if \(abortRun === stop\) abortRun = null;/, 'disarmed when the run settles');
});

// ───────────── (3) setStage builds text nodes, not HTML ─────────────

function setStageSlice() {
  const start = EVAL.indexOf('const setStage');
  assert.ok(start >= 0, 'setStage builder found');
  const end = EVAL.indexOf('};', start);
  assert.ok(end > start, 'setStage body found');
  return EVAL.slice(start, end);
}

test('setStage never assigns innerHTML — the server detail is string-concatenated into a text node', () => {
  const STAGE = setStageSlice();
  assert.ok(!/\binnerHTML\s*[+]?=/.test(STAGE),
    'setStage must not assign innerHTML (server-controlled detail is data, never markup)');
  assert.match(STAGE, /replaceChildren/, 'the stage line is swapped via replaceChildren');
  assert.match(STAGE, /c\('div',\s*\{\s*className: 'loading'\s*\}/, 'the loading line is built with the view element helper');
  assert.match(STAGE, /' — ' \+ detail/, 'the detail interpolation is string concatenation into a text node');
});

// ───────────── (4) i18n key ×19 ─────────────

test("'err.evaluate.noTerminal' exists ×19 and is genuinely translated", () => {
  const dict = loadAssembledDict();
  for (const lang of I18N_LANGS) {
    const v = (dict['err.evaluate.noTerminal'] || {})[lang];
    assert.ok(v && String(v).trim().length > 0, `err.evaluate.noTerminal missing/empty in ${lang}`);
    if (lang !== 'en') assert.notEqual(v, NO_TERMINAL_EN, `err.evaluate.noTerminal untranslated in ${lang}`);
  }
});

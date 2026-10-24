/**
 * CAR-94 — the 11 must-fix findings of the Opus 5-5 SPA review (assist views:
 * help, two-pager, batch, deep, mode pages, auto-pipeline, interview-digest,
 * orientation, activity, docs-fab).
 *
 * Findings (docs review `/tmp/findings-spa2.txt`, items 1–11):
 *   1. help.js deepLinkTarget resolved via document.getElementById on a still
 *      DETACHED article → always null → the CAR-42 Back/Forward deep link
 *      never scrolled. Must resolve from the in-article `headings` list.
 *   2. help.js listeners leaked on every re-render (language switch,
 *      #/help?h=a → #/help?h=b) — module-level helpDetach, called at the top
 *      of every render, also clears tocScrollTimer.
 *   3. two-pager.js: after a failed load one keystroke re-enabled Save → a
 *      near-empty form could overwrite config/two-pager.yml. Saving while the
 *      load is unrecovered requires an explicit danger confirm.
 *   4. batch.js: single-flight flag + stream handle were per-render closure
 *      state (a language switch reset the flag → a second paid runner could
 *      start; the EventSource was never closed on leave).
 *   5. deep.js runLive/runManual + mode-page submit: no cross-button
 *      single-flight and no stale-token guard before writing to `out`.
 *   6. auto-pipeline: modal close did not abort the fetch (reopen → second
 *      paid run); a stream ending without done/error left the timeline on
 *      "running" forever.
 *   7. interview-digest + orientation: the catch path left the spinner and
 *      the retry button was consumed; success left no reload affordance.
 *   8. activity.js: a failed filter load kept the previous filter's rows and
 *      showed the new chip as active.
 *   9. deep.js loadArchive: a failed load rendered "No saved files yet".
 *  10. deep.js renderSavedCard onClick: awaited spinner had no try/catch →
 *      unhandled rejection, no toast.
 *  11. docs-fab send: Enter bypassed the sendBtn.disabled guard (duplicate
 *      paid requests), no IME guard, lang not threaded like the other AI
 *      endpoints.
 *
 * CI-isolated: static sources + vm-sliced pure logic. No network, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__d, '..', ...p), 'utf8');
const HELP = read('public', 'js', 'views', 'help.js');
const TWO_PAGER = read('public', 'js', 'views', 'two-pager.js');
const BATCH = read('public', 'js', 'views', 'batch.js');
const DEEP = read('public', 'js', 'views', 'deep.js');
const MODE_PAGE = read('public', 'js', 'views', 'mode-page.js');
const AUTO_PIPE = read('public', 'js', 'lib', 'auto-pipeline.js');
const DIGEST = read('public', 'js', 'views', 'interview-digest.js');
const ORIENT = read('public', 'js', 'views', 'orientation.js');
const ACTIVITY = read('public', 'js', 'views', 'activity.js');
const FAB = read('public', 'js', 'lib', 'docs-fab.js');

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

// ── 1 — the deep link resolves the section from the article's headings ──────

test('CAR-94.1 behavioural: deepLinkTarget finds the section in the detached article (headings list, not getElementById)', () => {
  const start = HELP.indexOf('const deepLinkTarget = (() => {');
  assert.ok(start >= 0, 'the deepLinkTarget block must exist');
  const endMarker = '})();';
  const end = HELP.indexOf(endMarker, start);
  const block = HELP.slice(start, end + endMarker.length);

  const mk = (hash) => {
    const headings = [{ id: 'help-h-3' }, { id: 'help-h-7' }];
    const ctx = vm.createContext({
      headings,
      location: { hash },
      // The article is NOT mounted while the view handler runs (the router
      // appends the returned root afterwards), so pre-fix getElementById
      // returned null — mirrored here; a post-fix run must never call it.
      document: {
        getElementById(id) { throw new Error('getElementById("' + id + '") must not be used on a detached article'); },
      },
      URLSearchParams, decodeURIComponent,
    });
    vm.runInContext(sliceFn(HELP, 'function helpSectionIdFromHash'), ctx);
    vm.runInContext(block, ctx);
    return vm.runInContext('deepLinkTarget', ctx);
  };

  assert.equal(mk('#/help?h=help-h-7').id, 'help-h-7',
    'the deep link must resolve to the article heading object');
  assert.equal(mk('#/help?h=missing'), null, 'an unknown id stays at the top');
  assert.equal(mk('#/help'), null, 'no query → no scroll target');
});

// ── 2 — module-level helpDetach, called at the top of every render ──────────

test('CAR-94.2: help.js detaches scroll/resize/hashchange + tocScrollTimer at the top of EVERY render', () => {
  const regIdx = HELP.indexOf("Router.register('help'");
  const declIdx = HELP.indexOf('let helpDetach');
  assert.ok(declIdx >= 0, 'a module-level helpDetach handle must exist');
  assert.ok(declIdx < regIdx, 'helpDetach must be declared at module level, outside the render closure');

  // The render detaches the previous instance FIRST — language switches and
  // Back/Forward between #/help?h=a and #/help?h=b never fire a leaving
  // hashchange, so a hashchange-only cleanup leaked one listener set per
  // re-render.
  assert.match(HELP,
    /Router\.register\('help', async \(\) => \{\s*\n\s*\/\/[^\n]*\n\s*if \(helpDetach\) \{\s*\n\s*helpDetach\(\);\s*\n\s*helpDetach = null;\s*\n\s*\}/,
    'the render must tear the previous instance down before building a new one');

  const detach = sliceFn(HELP, 'const detach = () => {');
  assert.match(detach, /removeEventListener\('scroll', onScroll\)/);
  assert.match(detach, /removeEventListener\('scroll', onSpyScroll\)/);
  assert.match(detach, /removeEventListener\('resize', onSpyScroll\)/);
  assert.match(detach, /removeEventListener\('hashchange', onHashLeave\)/);
  assert.match(detach, /clearTimeout\(tocScrollTimer\)/,
    'the UX-11 one-match autoscroll timer must be cancelled, not left to scroll a detached view');
  assert.match(detach, /removeAttribute\('data-toc-spy'\)/);
  // Leaving #/help via the URL still detaches (the hashchange guard).
  assert.match(HELP, /const onHashLeave = \(\) => \{\s*\n\s*if \(!location\.hash\.startsWith\('#\/help'\)\) detach\(\);/);
  assert.match(HELP, /helpDetach = detach;/);
  // The old conditional-only cleanup is gone.
  assert.doesNotMatch(HELP, /const cleanup = \(\) => \{/);
});

// ── 3 — two-pager: saving an unrecovered failed load requires a confirm ─────

test('CAR-94.3: two-pager Save with an unrecovered failed load requires an explicit danger confirm before the PUT', () => {
  const save = sliceFn(TWO_PAGER, "saveBtn.addEventListener('click'");
  assert.match(save, /if \(loadErr && !loadRecovered\) \{/,
    'the gate keys on the failed load AND whether a later load recovered it');
  assert.match(save, /await UI\.confirm\(/);
  assert.match(save, /danger: true/);
  assert.ok(save.indexOf('UI.confirm') < save.indexOf("API.put('/api/two-pager'"),
    'the confirm must settle before the destructive PUT');
});

test('CAR-94.3: the overwrite warning sentence is localized in all 18 locales', () => {
  const dict = loadAssembledDict();
  const langs = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta'];
  const row = dict['twoPager.overwriteWarn'];
  assert.ok(row && !row['@alias'], 'twoPager.overwriteWarn must be a real dict key');
  for (const lang of langs) {
    assert.ok(typeof row[lang] === 'string' && row[lang].length > 0,
      `${lang} is missing twoPager.overwriteWarn`);
  }
});

// ── 4 — batch: module-scope single-flight + stream closed on navigation ─────

test('CAR-94.4: batch single-flight flag and stream handle live at module scope; leaving #/batch closes the stream', () => {
  const regIdx = BATCH.indexOf("Router.register('batch'");
  const runIdx = BATCH.indexOf('let batchRunning');
  const streamIdx = BATCH.indexOf('let batchStream');
  assert.ok(runIdx >= 0 && runIdx < regIdx, 'batchRunning must be module scope (a re-render must not reset the guard)');
  assert.ok(streamIdx >= 0 && streamIdx < regIdx, 'batchStream must be module scope (it must be reachable on route leave)');

  const leave = sliceFn(BATCH, "window.addEventListener('hashchange'");
  assert.match(leave, /startsWith\('#\/batch'\)/);
  assert.match(leave, /batchStream\.close\(\)/,
    'handlers must stop mutating the detached console');
  assert.match(leave, /batchStream = null;/);
  assert.match(leave, /batchRunning = false;/,
    'a closed stream must release the single-flight flag');
});

// ── 5 — deep + mode pages: cross-button single-flight + stale token ─────────

test('CAR-94.5: deep.js runLive/runManual check one inFlight flag and carry a stale token before writing to out', () => {
  assert.match(DEEP, /let inFlight = false;/, 'one shared guard per view, not per button');
  assert.match(DEEP, /let runToken = 0;/);
  for (const fn of ['runLive', 'runManual']) {
    const body = sliceFn(DEEP, `async function ${fn}`);
    assert.match(body, /if \(inFlight\) return;/, `${fn} must refuse a concurrent run`);
    assert.match(body, /const myToken = \+\+runToken;/);
    assert.match(body, /if \(myToken !== runToken\) return;/,
      `${fn} must drop a stale resolution before touching out`);
    assert.match(body, /if \(myToken === runToken\) inFlight = false;/);
  }
  // The "Show result" re-entry in showPrompt routes through runLive, so it is
  // covered by the same guard — no separate unguarded POST may exist.
  assert.match(DEEP, /await runLive\(e\.currentTarget\)/);
});

test('CAR-94.5: mode-page submit checks the same single-flight + stale-token shape', () => {
  assert.match(MODE_PAGE, /let inFlight = false;/);
  assert.match(MODE_PAGE, /let runToken = 0;/);
  const submit = sliceFn(MODE_PAGE, 'async function submit(btn, run)');
  assert.match(submit, /if \(inFlight\) return;/);
  assert.match(submit, /const myToken = \+\+runToken;/);
  assert.match(submit, /if \(myToken !== runToken\) return;/);
  assert.match(submit, /if \(myToken === runToken\) inFlight = false;/);
});

// ── 6 — auto-pipeline: module single-flight, abort on close, silent end ─────

test('CAR-94.6: auto-pipeline single-flight + abort live at module scope, modal close aborts, silent stream end renders an error', () => {
  const iifeIdx = AUTO_PIPE.indexOf('(function () {');
  const openIdx = AUTO_PIPE.indexOf('function open(opts)');
  const runIdx = AUTO_PIPE.indexOf('let running = false;');
  const abortIdx = AUTO_PIPE.indexOf('let currentAbort = null;');
  assert.ok(runIdx > iifeIdx && runIdx < openIdx, 'the running flag must outlive one modal instance');
  assert.ok(abortIdx > iifeIdx && abortIdx < openIdx, 'the abort handle must outlive one modal instance');

  const start = sliceFn(AUTO_PIPE, 'async function start(url)');
  assert.match(start, /if \(running\) return;/, 'a second paid run must be refused while one streams');
  assert.match(start, /signal: currentAbort\.signal/, 'the fetch must carry the abort signal');
  assert.match(start, /if \(!terminal && !currentAbort\.signal\.aborted\) renderError\('network'/,
    'a stream that ends without done/error must land in a terminal error state, not run forever');

  const open = sliceFn(AUTO_PIPE, 'function open(opts)');
  assert.match(open, /if \(currentAbort\) \{\s*try \{\s*currentAbort\.abort\(\);/,
    'closing the modal must abort the in-flight run');
  assert.match(AUTO_PIPE, /renderError\('network', e\.message \|\| 'network error'\)/,
    'the aborted run itself must not paint a phantom error over a fresh modal');
});

// ── 7 — interview-digest + orientation: retry survives, reload stays ────────

for (const [name, SRC, btn] of [['interview-digest', DIGEST, 'btn'], ['orientation', ORIENT, 'genBtn']]) {
  test(`CAR-94.7: ${name} keeps the button outside the replaced box — retry restored on error, reload kept on success`, () => {
    // The button lives in its own row INSIDE the empty box; only the status
    // half is replaced per attempt, so the affordance is never consumed.
    assert.match(SRC,
      new RegExp(`const emptyState = c\\('div', \\{ className: 'empty'[\\s\\S]{0,400}?\\[status, ${btn}Row\\]\\);`),
      'emptyState = [status, <btn>Row] — the button must not live inside the replaced content');
    const handler = sliceFn(SRC, ".addEventListener('click', async () => {");
    assert.match(handler, new RegExp(`^\\s{4}${btn}\\.disabled = true;`, 'm'));
    assert.match(handler, /catch \(err\) \{[\s\S]{0,300}?showStatus\(/,
      'the catch path must restore the box content (error + the button below it), not leave the spinner');
    assert.match(handler, new RegExp(`finally \\{\\s*${btn}\\.disabled = false;`),
      'the button is re-enabled on every path');
    assert.doesNotMatch(handler, /hidden = true/,
      'neither success nor error may hide the reload affordance');
  });
}

// ── 8 — activity: a failed load shows an error state, not stale rows ────────

test('CAR-94.8: a failed activity load clears the table and shows an error state (role=alert)', () => {
  const load = sliceFn(ACTIVITY, 'async function load()');
  const catchIdx = load.indexOf('} catch (err) {');
  assert.ok(catchIdx > 0, 'load must keep its own try/catch');
  const catchBody = load.slice(catchIdx);
  assert.match(catchBody, /allEvents = \[\];/, 'the previous filter’s rows must not linger as the new filter’s data');
  assert.match(catchBody, /pager\.reset\(\);/);
  assert.match(catchBody, /render\(\);/, 'the stale rows must actually leave the DOM');
  assert.match(catchBody, /loadError\.hidden = false;/);
  // Success hides the error state again.
  const tryBody = load.slice(0, catchIdx);
  assert.match(tryBody, /loadError\.hidden = true;/);
  assert.match(ACTIVITY, /role: 'alert'/, 'the failure must be announced, not silent');
});

// ── 9 — deep: a failed archive load renders an error, not a fake empty ──────

test('CAR-94.9: deep loadArchive catch renders the error instead of "No saved files yet"', () => {
  const fn = sliceFn(DEEP, 'async function loadArchive');
  assert.doesNotMatch(fn, /renderArchive\(\[\]\)/,
    'a failure must not masquerade as an empty archive');
  assert.match(fn, /catch \(e\) \{[\s\S]{0,300}?archive\.innerHTML = '';/);
  assert.match(fn, /t\('common\.error', 'Error'\)/,
    'the error line reuses the existing common.error key');
});

// ── 10 — deep: the saved-card click toasts on failure ───────────────────────

test('CAR-94.10: renderSavedCard onClick wraps the awaited spinner in try/catch with a toast', () => {
  const card = sliceFn(DEEP, 'function renderSavedCard');
  assert.match(card, /try \{\s*\n\s*const r = await UI\.withSpinner/);
  assert.match(card, /\} catch \(err\) \{\s*\n\s*UI\.toast\(/);
});

// ── 11 — docs-fab: single-flight + IME guard + lang threaded ────────────────

test('CAR-94.11: docs-fab send refuses while in flight, guards IME Enter, and threads lang', () => {
  const send = sliceFn(FAB, 'async function send()');
  assert.match(send, /if \(sendBtn\.disabled\) return;/,
    'Enter must not bypass the in-flight guard (duplicate paid requests)');
  assert.match(send, /lang: /, 'the request carries the UI language like the other AI endpoints');
  const key = sliceFn(FAB, "input.addEventListener('keydown'");
  assert.match(key, /isComposing|keyCode === 229/,
    'IME composition Enter is text input, not a send');
});

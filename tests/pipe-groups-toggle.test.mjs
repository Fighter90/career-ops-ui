/**
 * CAR-244.3 — the pipeline view-mode segmented control actually works and
 * persists.
 *
 * The owner-visible bug: #/pipeline opened with «Группами» forced at every
 * mount and the choice never survived a navigation, so «Списком» felt dead —
 * you clicked it, left, came back, and the grouped view was back. The two
 * buttons were also constructed with STATIC aria-pressed attributes that only
 * became truthful after the mount setViewMode call ran.
 *
 * The fix: the view choice round-trips through localStorage
 * ('career-ops-ui:pipeView') — setViewMode writes it, the mount call reads it
 * back (a persisted 'flat' wins; the default stays grouped when PipelineView
 * is loaded, and a storage-blocked browser keeps today's behaviour via
 * try/catch). aria-pressed stays mutually exclusive on both buttons.
 *
 * Pins are source-static (browser-only view, same pattern as
 * evaluate-view-stream.test.mjs): the storage contract, the mount expression,
 * and the mutually-exclusive aria-pressed writes are each asserted against
 * real source shapes — every pin names the regression it would catch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const PIPE = readFileSync(R('public', 'js', 'views', 'pipeline.js'), 'utf8');

test('CAR-244.3: the view choice persists under the exact localStorage key', () => {
  assert.match(PIPE, /const PIPE_VIEW_KEY = 'career-ops-ui:pipeView'/,
    'the storage key is the contract (named constant, one definition)');
  // setViewMode WRITES the choice (guarded — blocked/private-mode storage
  // must never break the view)…
  assert.match(PIPE, /try \{ window\.localStorage\.setItem\(PIPE_VIEW_KEY, viewMode\); \} catch \{/,
    'setViewMode persists the choice, storage failures swallowed');
  // …and the mount READS it back (guarded the same way).
  assert.match(PIPE, /try \{ return window\.localStorage\.getItem\(PIPE_VIEW_KEY\); \} catch \{ return null; \}/,
    'the saved choice is read best-effort at mount');
});

test('CAR-244.3: a persisted flat choice wins at mount; grouped stays the default', () => {
  assert.match(PIPE, /setViewMode\(PV \? \(savedPipeView === 'flat' \? 'flat' : 'grouped'\) : 'flat'\)/,
    'the mount expression honours the saved view (the old forced-grouped mount is what made the toggle feel dead)');
  assert.ok(!PIPE.includes("setViewMode(PV ? 'grouped' : 'flat')"),
    'the old always-grouped mount literal is gone');
});

test('CAR-244.3: aria-pressed is mutually exclusive on BOTH buttons, written in one place', () => {
  const fn = PIPE.slice(PIPE.indexOf('function setViewMode'), PIPE.indexOf('function setViewMode') + 700);
  assert.match(fn, /btnGrouped\.setAttribute\('aria-pressed', grouped \? 'true' : 'false'\)/);
  assert.match(fn, /btnFlat\.setAttribute\('aria-pressed', grouped \? 'false' : 'true'\)/,
    'the two buttons flip together — never both true, never both false');
  assert.match(fn, /renderAll\(\)/, 'the mode change re-renders (grouped host vs list)');
});

test('CAR-244.3: the toggle buttons are wired through setViewMode (one code path)', () => {
  assert.match(PIPE, /onClick: \(\) => setViewMode\('grouped'\)/);
  assert.match(PIPE, /onClick: \(\) => setViewMode\('flat'\)/,
    'both segmented-control buttons funnel through setViewMode (persist + repaint)');
});

test('CAR-244.3: the view labels stay localized (pipe.viewGrouped / pipe.viewFlat ×19)', () => {
  const dict = loadAssembledDict();
  for (const lang of I18N_LANGS) {
    for (const k of ['pipe.viewGrouped', 'pipe.viewFlat']) {
      const v = (dict[k] || {})[lang];
      assert.ok(v && String(v).trim().length > 0, `${k} missing/empty in ${lang}`);
    }
  }
});

/**
 * CAR-117 — #/tracker v2: status kanban with drag&drop, safe bulk moves,
 * table-grid fix.
 *
 * Layers covered here:
 *   1. unit — tracker-stages.js additions: the outcome-move map (the ONLY
 *      write path is the existing per-row outcome relay, POST /api/outcome —
 *      no invented endpoints), writable-state helpers, undo queue.
 *   2. source-static — the view wiring: view toggle, kanban board a11y
 *      (role=list + labelled columns + an explicit keyboard Move control per
 *      card — drag is never the only way to change a status), DnD guarded to
 *      writable columns, destructive-move UI.confirm gate, bulk selection
 *      labels, and the table-grid fix (sticky header, nowrap date, colgroup).
 *
 * CI-isolated: file reads + a synthetic window, no network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const w = {};
new Function('window', readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const TS = w.TrackerStages;
const TRK = readFileSync(R('public/js/views/tracker.js'), 'utf8');

const STAGES = ['Evaluated', 'Applied', 'Responded', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP', 'Hired'];

// ── 1 · the move engine (unit) ──────────────────────────────────────────────

test('MOVES: exactly the parent outcome.mjs states, canonical state → outcome type', () => {
  // Mirrors the parent lib/outcome-types.mjs OUTCOME_MAP — the per-row write
  // mechanism the view already uses (POST /api/outcome). No other states may
  // appear: Evaluated/Applied/Responded/Assessment/SKIP are pipeline-managed.
  assert.deepEqual(TS.MOVES, {
    Interview: 'interview_progress',
    Offer: 'offer_received',
    Hired: 'hired',
    Rejected: 'rejected',
    Discarded: 'no_response',
  });
});

test('isWritableState / writableStates: pipeline-managed stages are not move targets', () => {
  for (const s of ['Interview', 'Offer', 'Hired', 'Rejected', 'Discarded']) {
    assert.equal(TS.isWritableState(s), true, s);
  }
  for (const s of ['Evaluated', 'Applied', 'Responded', 'Assessment', 'SKIP', 'Ghosted', '']) {
    assert.equal(TS.isWritableState(s), false, s);
  }
  // writableStates keeps the SERVER's stage order (kanban/move-select order).
  assert.deepEqual(TS.writableStates(STAGES), ['Interview', 'Offer', 'Rejected', 'Discarded', 'Hired']);
  // A renamed/unknown stage list degrades to whatever still matches.
  assert.deepEqual(TS.writableStates(['Applied', 'Done']), []);
  // No stages at all → the map's own keys (selector fallback).
  assert.equal(TS.writableStates([]).length, 5);
});

test('createUndoQueue: bounded LIFO of move batches (session memory only)', () => {
  const q = TS.createUndoQueue(2);
  assert.equal(q.size, 0);
  assert.equal(q.pop(), null);
  q.push([{ num: '001' }]);
  q.push([{ num: '002' }, { num: '003' }]);
  assert.equal(q.size, 2);
  q.push([{ num: '004' }]); // evicts the oldest batch
  assert.equal(q.size, 2);
  assert.deepEqual(q.pop(), [{ num: '004' }]);
  assert.deepEqual(q.pop(), [{ num: '002' }, { num: '003' }]);
  assert.equal(q.pop(), null);
  // pushes are copied — mutating the caller's array afterwards must not
  // change what undo would restore.
  const batch = [{ num: '009' }];
  q.push(batch);
  batch.length = 0;
  assert.equal(q.pop().length, 1);
});

// ── 2 · view wiring (source-static) ─────────────────────────────────────────

test('view toggle: Table/Kanban segmented control, aria-pressed, persisted', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  // persistence + the two labels live in the factory (lib); the view wires it
  assert.match(LIB, /career-ops-ui:tracker-view/, 'the view choice persists per user');
  assert.match(LIB, /t\('track\.viewTable', 'Table'\)/);
  assert.match(LIB, /t\('track\.viewKanban', 'Kanban'\)/);
  assert.match(LIB, /role: 'group'/);
  assert.match(LIB, /'aria-pressed', tableActive/);
  assert.match(LIB, /opts\.initial \|\| 'table'/, 'table stays the default view');
  assert.match(TRK, /TS\.createViewToggle\(\{ t, onChange/);
});

test('kanban board: role=list board, labelled columns, explicit keyboard Move per card', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  // board + cards are exposed to assistive tech as a list structure
  assert.match(LIB, /role: 'list'/);
  assert.match(LIB, /role: 'listitem'/);
  // every column carries an accessible name with its count
  assert.match(LIB, /'aria-label': colName/);
  // THE keyboard path: each card renders an explicit Move control, so drag
  // is never the only way to change a status (a11y contract).
  assert.match(LIB, /t\('track\.moveBtnAria', 'Move to another status'\)/);
  // cards are the drag sources; the write is requested through ctx.onMove
  assert.match(LIB, /draggable: 'true'/);
  assert.match(LIB, /ctx\.onMove\(/);
});

test('DnD is guarded: drop only on writable columns, never a same-stage no-op', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  // dragover must preventDefault ONLY when the stage is writable…
  assert.match(LIB, /isWritableState\(stage\)/);
  // …and a drop onto the card's own stage is refused before any write path.
  assert.match(LIB, /from === stage/);
});

test('moves write ONLY through the existing per-row outcome relay', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  // the one write endpoint in the move engine:
  assert.match(LIB, /API\.post\('\/api\/outcome'/);
  // and there is no invented bulk/tracker/status endpoint anywhere:
  assert.ok(!/\/api\/tracker\/(status|bulk|move)/.test(LIB), 'no invented tracker write endpoints');
  assert.ok(!/\/api\/tracker\/(status|bulk|move)/.test(TRK), 'no invented tracker write endpoints in the view');
});

test('destructive moves are gated by UI.confirm BEFORE the write loop', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  const apply = LIB.slice(LIB.indexOf('function openMoveDialog'));
  assert.ok(apply.length > 0, 'openMoveDialog lives in the lib');
  // The destructive branch: UI.confirm first, a Cancel re-opens the preview
  // (nothing written), and run() (the write loop) is reached only after the
  // confirm resolved true.
  assert.match(apply, /if \(destructive\) \{[\s\S]*?await UI\.confirm\([\s\S]*?if \(!ok\) \{[\s\S]*?return;[\s\S]*?\}\s*\}\s*await run\(\);/,
    'destructive targets must pass UI.confirm before applyMoves runs');
  // and the lib has no native confirm() (confirm-gate contract)
  const strippedLib = LIB.replace(/UI\.confirm\(/g, '');
  assert.ok(!/(?:^|[^.\w])confirm\(/m.test(strippedLib), 'lib uses only UI.confirm');
});

test('bulk selection: labelled checkboxes, bulk bar, no unlabelled controls', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  assert.match(LIB, /t\('track\.bulkSelectAll', 'Select all rows on this page'\)/);
  assert.match(LIB, /t\('track\.bulkSelectRow', 'Select row #\{num\}'\)/);
  assert.match(LIB, /t\('track\.bulkSelected/);
  assert.match(LIB, /t\('track\.bulkClear', 'Clear'\)/);
  // bulk moves reuse the same preview dialog (single flow, one write path)
  assert.match(TRK, /createBulkBar\(/);
  assert.match(TRK, /bulk\.checkCell\(r\)/);
  assert.match(TRK, /moveFlow\.open\(movable, target\)/);
});

test('table grid fix: sticky header, single-line dates, colgroup widths', () => {
  // the scroll wrapper bounds its height so the header can stick
  assert.match(TRK, /maxHeight: 'min\(72vh, 760px\)'/);
  // sticky th, applied to every header (background comes from the
  // stylesheet's table.tbl th rule)
  assert.match(TRK, /style\.position = 'sticky'/);
  assert.match(TRK, /style\.top = '0'/);
  // the date cell can never wrap onto two lines again («2026-/08-25»)
  assert.match(TRK, /v2-track-nowrap/);
  assert.match(TRK, /fontVariantNumeric: 'tabular-nums'/);
  // fixed column widths via colgroup
  assert.match(TRK, /colgroup/);
});

test('undo: session bar mirrors the pipeline-v2 contract (Undo + Dismiss + busy)', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  assert.match(LIB, /tracker-undo-bar/);
  assert.match(LIB, /tracker-undo-btn/);
  assert.match(LIB, /getElementById\('tracker-undo-bar'\)/, 'the shell is reused across visits (no duplicate bars)');
  assert.match(TRK, /TS\.createUndoController\(/);
  assert.match(TRK, /undoCtl\.push\(moves, target\)/);
});

test('a11y regression guard: pinned table semantics survive the rewrite', () => {
  // sortable headers / aria-sort / status translation pins from the older
  // suites must still hold (they are re-asserted there; these catch a
  // wholesale move of the table out of tracker.js).
  assert.match(TRK, /function sortableTh\(label, key\)/);
  assert.match(TRK, /sortableTh\(t\('track\.col\.date'\), 'date'\)/);
  assert.match(TRK, /function trackerStatusClass\(/);
  assert.match(TRK, /function withFocusPreserved\(/);
  assert.match(TRK, /function openOutcomeModal\(/);
});

test('CSP/DOM hygiene: the new code never bypasses the el/textContent builders', () => {
  const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');
  assert.ok(!/innerHTML/.test(LIB), 'no innerHTML in tracker-stages.js');
  // tracker.js's two legacy `.innerHTML = ''` clears predate this change and
  // stay (they are string-literal wipes, not data injection); everything else
  // — comments included — must be free of it.
  const code = TRK.replace(/tbody\.innerHTML = '';/g, '').replace(/pgWrap\.innerHTML = '';/g, '').replace(/\/\/.*$/mg, '');
  assert.ok(!/innerHTML/.test(code), 'no new innerHTML in tracker.js');
  assert.ok(!/insertAdjacentHTML|document\.write/.test(LIB + TRK));
});

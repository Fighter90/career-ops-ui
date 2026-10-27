/**
 * CAR-117 — #/tracker v2: status kanban with drag&drop, safe bulk moves,
 * table-grid fix.
 *
 * Layers covered here:
 *   1. unit — tracker-stages.js additions: the outcome-move map (the ONLY
 *      write path is the existing per-row outcome relay, POST /api/outcome —
 *      no invented endpoints), writable-state helpers.
 *   2. source-static — the view wiring: view toggle, kanban board a11y
 *      (role=list + labelled columns + an explicit keyboard Move control per
 *      card — drag is never the only way to change a status), DnD guarded to
 *      writable columns, destructive-move UI.confirm gate, bulk selection
 *      labels, and the table-grid fix (sticky header, nowrap date, colgroup).
 *
 * CAR-117 review round (Opus r2) — fabrication cluster locked OUT here:
 *   - NO undo: the outcome writer only appends, so "undoing" via
 *     /api/outcome would fabricate candidate history. The undo controller is
 *     DELETED from the lib; a revert needs a real set-status route (BACKLOG
 *     v1.246.0 item 2). These tests keep it deleted.
 *   - NO Discarded move target: the writer has no candidate-initiated
 *     discard type (no_response/offer_declined both fabricate company
 *     behaviour); Discarded changes only through the row's Outcome button.
 *   - moves-off degradation keys off the structured relay signal
 *     (HTTP 422 without a CLI code), never an error-message substring.
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
const LIB = readFileSync(R('public/js/lib/tracker-stages.js'), 'utf8');

const STAGES = ['Evaluated', 'Applied', 'Responded', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP', 'Hired'];

// ── 1 · the move engine (unit) ──────────────────────────────────────────────

test('MOVES: exactly the parent outcome.mjs states, canonical state → outcome type', () => {
  // Mirrors the parent lib/outcome-types.mjs OUTCOME_MAP — the per-row write
  // mechanism the view already uses (POST /api/outcome). No other states may
  // appear: Evaluated/Applied/Responded/Assessment/SKIP are pipeline-managed,
  // and Discarded is DELIBERATELY absent (r2 #3: no_response/offer_declined
  // would fabricate company behaviour for a candidate-initiated discard).
  assert.deepEqual(TS.MOVES, {
    Interview: 'interview_progress',
    Offer: 'offer_received',
    Hired: 'hired',
    Rejected: 'rejected',
  });
});

test('MOVES carries no Discarded target (fabrication guard, r2 #3)', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(TS.MOVES, 'Discarded'), false,
    'Discarded must not be a move target: the outcome writer has no honest type for it');
  // and the TODO keeping the decision visible exists in the lib source
  assert.match(LIB, /TODO.*[Dd]iscarded|[Dd]iscarded.*TODO/, 'the removal rationale must be documented in the lib');
});

test('isWritableState / writableStates: pipeline-managed stages are not move targets', () => {
  for (const s of ['Interview', 'Offer', 'Hired', 'Rejected']) {
    assert.equal(TS.isWritableState(s), true, s);
  }
  for (const s of ['Evaluated', 'Applied', 'Responded', 'Assessment', 'SKIP', 'Discarded', 'Ghosted', '']) {
    assert.equal(TS.isWritableState(s), false, s);
  }
  // writableStates keeps the SERVER's stage order (kanban/move-select order).
  assert.deepEqual(TS.writableStates(STAGES), ['Interview', 'Offer', 'Rejected', 'Hired']);
  // A renamed/unknown stage list degrades to whatever still matches.
  assert.deepEqual(TS.writableStates(['Applied', 'Done']), []);
  // No stages at all → the map's own keys (selector fallback).
  assert.equal(TS.writableStates([]).length, 4);
});

test('undo is DELETED, not dormant (r2 #1 — the outcome writer only appends)', () => {
  // An outcome-write "undo" fabricates candidate history: reverting
  // Interview→Offer would record a NEW interview_progress event. Until a real
  // set-status route exists, nothing may present itself as undo.
  assert.ok(!/createUndoController|createUndoBar|createUndoQueue/.test(LIB), 'no undo factories in the lib');
  assert.ok(!/createUndoController|createUndoBar|createUndoQueue/.test(TRK), 'no undo wiring in the view');
  assert.ok(!/tracker-undo-bar|tracker-undo-btn/.test(LIB + TRK), 'no undo bar DOM');
  // the whole client lib performs exactly ONE kind of write — the forward move
  const posts = [...LIB.matchAll(/API\.post\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(posts, ['/api/outcome'], 'the move engine writes only through the outcome relay');
});

// ── 2 · view wiring (source-static) ─────────────────────────────────────────

test('view toggle: Table/Kanban segmented control, aria-pressed, persisted, guarded', () => {
  // persistence + the two labels live in the factory (lib); the view wires it
  assert.match(LIB, /career-ops-ui:tracker-view/, 'the view choice persists per user');
  assert.match(LIB, /t\('track\.viewTable', 'Table'\)/);
  assert.match(LIB, /t\('track\.viewKanban', 'Kanban'\)/);
  assert.match(LIB, /role: 'group'/);
  assert.match(LIB, /'aria-pressed', tableActive/);
  assert.match(LIB, /opts\.initial \|\| 'table'/, 'table stays the default view');
  // r2 #5 — a tracker-stages load failure must not throw the whole route
  assert.match(TRK, /TS \? TS\.createViewToggle\(/);
  assert.match(TRK, /viewModeNow\(\)/, 'mode reads go through the null-safe accessor');
});

test('kanban board: role=list board, labelled columns, explicit keyboard Move per card', () => {
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

test('DnD is guarded INSIDE the handler bodies (r2 #12 — anchored, not substring)', () => {
  const over = LIB.slice(LIB.indexOf("'dragover'"), LIB.indexOf("'drop'"));
  assert.ok(over.length > 0 && over.length < 1200, 'the dragover handler body is sliceable');
  assert.match(over, /dragNum == null/, 'no drop candidate → no dragover acceptance');
  assert.match(over, /isWritableState\(stage\)/, 'drop acceptance requires a writable column');
  assert.match(over, /from === stage/, 'a same-stage drop is refused before any write path');
  const drop = LIB.slice(LIB.indexOf("'drop'"), LIB.indexOf('return col;'));
  assert.ok(drop.length > 0 && drop.length < 1600, 'the drop handler body is sliceable');
  assert.match(drop, /fold\(row\.status\) === stage/, 'drop re-checks the same-stage guard');
  assert.match(drop, /isWritableState/, 'drop re-checks writability');
});

test('moves write ONLY through the existing per-row outcome relay', () => {
  // the one write endpoint in the move engine:
  assert.match(LIB, /API\.post\('\/api\/outcome'/);
  // and there is no invented bulk/tracker/status endpoint anywhere:
  assert.ok(!/\/api\/tracker\/(status|bulk|move)/.test(LIB), 'no invented tracker write endpoints');
  assert.ok(!/\/api\/tracker\/(status|bulk|move)/.test(TRK), 'no invented tracker write endpoints in the view');
});

test('degrade keys off the STRUCTURED relay signal, never a message substring (r2 #7)', () => {
  const apply = LIB.slice(LIB.indexOf('async function applyMoves'));
  assert.ok(apply.length > 0);
  // HTTP 422 WITHOUT a CLI code = the writer is genuinely unavailable
  // (handled CLI failures answer 400 + code; script-error/timeout 422s carry codes).
  assert.match(apply, /status === 422/);
  assert.match(apply, /data && !data\.code|!data\.code|!code\b|!err\.data\.code|!code/);
  // and the old message-substring match is gone
  assert.ok(!/outcome\\\.mjs\/\.test/.test(LIB), 'no /outcome\\.mjs/.test(...) message matching');
  assert.ok(!/firstError && \/outcome/.test(LIB), 'no firstError-message degrade');
});

test('applyMoves returns applied = only the succeeded moves (r2 #2)', () => {
  const apply = LIB.slice(LIB.indexOf('async function applyMoves'));
  assert.match(apply, /applied\.push\(m\)/, 'a move is recorded as applied only after its write succeeded');
  assert.match(apply, /applied,/, 'applied is part of the result shape');
});

test('destructive moves are gated by UI.confirm and the Apply button is single-shot (r2 #8)', () => {
  const apply = LIB.slice(LIB.indexOf('function openMoveDialog'));
  assert.ok(apply.length > 0, 'openMoveDialog lives in the lib');
  // The destructive branch: UI.confirm first, a Cancel re-opens the preview
  // (nothing written), and run() (the write loop) is reached only after the
  // confirm resolved true.
  assert.match(apply, /if \(destructive\) \{[\s\S]*?await UI\.confirm\([\s\S]*?if \(!ok\) \{[\s\S]*?return;[\s\S]*?\}\s*\}\s*await run\(\);/,
    'destructive targets must pass UI.confirm before applyMoves runs');
  // The apply handler disables the button FIRST — a second click cannot
  // duplicate the outcome writes.
  assert.match(apply, /applyBtn\.addEventListener\('click', async \(\) => \{[\s\S]{0,220}?applyBtn\.disabled = true;/,
    'the Apply button must disable itself on the first click');
  // and the lib has no native confirm() (confirm-gate contract)
  const strippedLib = LIB.replace(/UI\.confirm\(/g, '');
  assert.ok(!/(?:^|[^.\w])confirm\(/m.test(strippedLib), 'lib uses only UI.confirm');
});

test('bulk selection: labelled checkboxes, full localized count, single flow', () => {
  assert.match(LIB, /t\('track\.bulkSelectAll', 'Select all rows on this page'\)/);
  assert.match(LIB, /t\('track\.bulkSelectRow', 'Select row #\{num\}'\)/);
  // r2 #11 — the count renders the FULL localized sentence with {n} replaced
  // (never a stripped placeholder + a bare number beside it).
  assert.match(LIB, /count\.textContent = t\('track\.bulkSelected', '\{n\} selected'\)\.replace\('\{n\}'/);
  assert.ok(!/\.replace\('\{n\}', ''\)/.test(LIB), 'no placeholder-stripped label');
  // select-all refreshes the count (r2 #6)
  const selAllBody = LIB.slice(LIB.indexOf("selAll.addEventListener"), LIB.indexOf('function checkCell'));
  assert.match(selAllBody, /sync\(\)/, 'the select-all handler must sync the bulk bar');
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

test('a11y regression guard: pinned table semantics survive the rewrite', () => {
  // sortable headers / aria-sort / status translation pins from the older
  // suites must still hold (they are re-asserted there; these catch a
  // wholesale move of the table out of tracker.js).
  assert.match(TRK, /function sortableTh\(label, key\)/);
  assert.match(TRK, /sortableTh\(t\('track\.col\.date'\), 'date'\)/);
  // FULL-M6 — both helpers moved to shared libs; the tracker keeps the
  // trackerStatusClass call-site name and delegates focus preservation.
  assert.match(TRK, /trackerStatusClass\(r\.status\)/);
  assert.match(TRK, /const trackerStatusClass = \(s\) => StatusClass\.of\(s\);/);
  assert.match(TRK, /FocusPreserved\.withFocusPreserved\(/);
  assert.match(TRK, /function openOutcomeModal\(/);
});

test('CSP/DOM hygiene: the new code never bypasses the el/textContent builders (r2 #12)', () => {
  assert.ok(!/innerHTML/.test(LIB), 'no innerHTML in tracker-stages.js');
  // tracker.js's two legacy `.innerHTML = ''` clears predate this change and
  // stay (string-literal wipes, not data injection); strip only LINE comments
  // (a `//` at line start after optional whitespace) so `https://` inside
  // string literals survives the strip.
  const code = TRK
    .replace(/tbody\.innerHTML = '';/g, '')
    .replace(/pgWrap\.innerHTML = '';/g, '')
    .replace(/^[ \t]*\/\/.*$/mg, '');
  assert.ok(!/innerHTML/.test(code), 'no new innerHTML in tracker.js');
  assert.ok(!/insertAdjacentHTML|document\.write/.test(LIB + TRK));
});

/**
 * CAR-237 — the «Воронка» funnel board (public/js/lib/tracker-kanban.js).
 *
 * Layers covered here:
 *   1. vm-realm logic — the pure parts of the lib in a synthetic window:
 *      the Notes-cell marker convention (parseNotesMarkers /
 *      buildNotesPayload) and moveRow (optimistic status move + revert on
 *      error — the researched Fighter90/flow pattern, adapted to the
 *      canonical POST /api/tracker/status relay).
 *   2. source-static — the write contract (ONE endpoint, no applications.md,
 *      no invented endpoints, CSP-safe DOM), the tracker.js wiring (the
 *      pinned table/toggle contract stays; renderKanban mounts the funnel
 *      lib), the index.html registration, and the ×19 locale keys.
 *
 * The DOM board itself is gated in a real browser
 * (tests/playwright-tracker-kanban.mjs): drag&drop needs real element
 * geometry, which a synthetic window does not provide.
 *
 * CI-isolated: file reads + a synthetic window, no network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const LIB = readFileSync(R('public/js/lib/tracker-kanban.js'), 'utf8');
const TRK = readFileSync(R('public/js/views/tracker.js'), 'utf8');
const HTML = readFileSync(R('public/index.html'), 'utf8');
const CSS = readFileSync(R('public/css/kanban.css'), 'utf8');

// Synthetic window — the lib reads everything off `window` at call time.
const w = {};
new Function('window', LIB)(w); // eslint-disable-line no-new-func
const TK = w.TrackerKanban;

// ── 1 · Notes-cell markers (the modal's data convention) ────────────────────

test('parseNotesMarkers: reads both markers out of a "; "-separated Notes cell', () => {
  const m = TK.parseNotesMarkers('[Заметки] recruiter screen booked; [Собеседование: 2026-11-05 14:30]');
  assert.equal(m.notes, 'recruiter screen booked');
  assert.equal(m.interviewAt, '2026-11-05 14:30');
});

test('parseNotesMarkers: the LAST marker of a kind wins (append-only journal)', () => {
  const m = TK.parseNotesMarkers(
    '[Заметки] old text; [Заметки] newer text; [Собеседование: 2026-11-05 14:30]; [Собеседование: 2026-11-20 09:00]');
  assert.equal(m.notes, 'newer text');
  assert.equal(m.interviewAt, '2026-11-20 09:00');
});

test('parseNotesMarkers: plain notes and junk never become markers', () => {
  assert.deepEqual(TK.parseNotesMarkers('called Tuesday; waiting for feedback'), { notes: '', interviewAt: '' });
  assert.deepEqual(TK.parseNotesMarkers(''), { notes: '', interviewAt: '' });
  assert.deepEqual(TK.parseNotesMarkers(null), { notes: '', interviewAt: '' });
  // An interview marker without a parseable timestamp is ignored, not guessed.
  assert.equal(TK.parseNotesMarkers('[Собеседование: someday]').interviewAt, '');
});

test('buildNotesPayload: only CHANGED markers are sent; unchanged stays silent', () => {
  const current = { notes: '[Заметки] booked; [Собеседование: 2026-11-05 14:30]' };
  // Nothing changed → '' → the caller skips the POST entirely.
  assert.equal(TK.buildNotesPayload(current, { notes: 'booked', interviewAt: '2026-11-05 14:30' }), '');
  // Notes changed → only the notes marker rides.
  assert.equal(
    TK.buildNotesPayload(current, { notes: 'booked + salary talk', interviewAt: '2026-11-05 14:30' }),
    '[Заметки] booked + salary talk');
  // Interview time changed → only the interview marker rides, T → space.
  assert.equal(
    TK.buildNotesPayload(current, { notes: 'booked', interviewAt: '2026-11-06T10:00' }),
    '[Собеседование: 2026-11-06 10:00]');
});

test('buildNotesPayload: collapses newlines/tabs (the route rejects control chars)', () => {
  const out = TK.buildNotesPayload({ notes: '' }, { notes: 'line1\nline2\tline3', interviewAt: '' });
  assert.equal(out, '[Заметки] line1 line2 line3');
  assert.equal(/[\r\n\t]/.test(out), false);
});

test('buildNotesPayload: stays within the route MAX_NOTE cap (200) and validates the datetime', () => {
  const out = TK.buildNotesPayload({ notes: '' }, { notes: 'x'.repeat(400), interviewAt: '' });
  assert.ok(out.length <= 200, `payload is ${out.length} chars — over the route cap`);
  // A malformed datetime is never sent.
  assert.equal(TK.buildNotesPayload({ notes: '' }, { notes: 'ok', interviewAt: 'tomorrow 10am' }), '[Заметки] ok');
});

// ── 2 · moveRow — optimistic move + revert (the researched flow pattern) ────

// A stubbed global UI so the lib's bare `UI.toast` resolves in this realm.
const toasts = [];
globalThis.UI = { toast: (msg, type) => toasts.push({ msg, type }) };

test('moveRow: optimistic set + success keeps the new status and toasts once', async () => {
  toasts.length = 0;
  const row = { num: 3, status: 'Applied' };
  const posts = [];
  const post = async (path, body) => { posts.push([path, body]); return { ok: true }; };
  const events = [];
  const ok = await TK.moveRow({
    row, to: 'Interview', post,
    onApplied: (r, from, to) => events.push(['applied', r.status, from, to]),
    onReverted: () => events.push(['reverted']),
  });
  assert.equal(ok, true);
  assert.deepEqual(posts, [['/api/tracker/status', { row: 3, state: 'Interview' }]]);
  assert.equal(row.status, 'Interview', 'the optimistic status stands after a 200');
  assert.deepEqual(events, [['applied', 'Interview', 'Applied', 'Interview']]);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'success');
});

test('moveRow: a failed POST reverts to the captured status and toasts the failure', async () => {
  toasts.length = 0;
  const row = { num: 4, status: 'Offer' };
  const post = async () => { throw new Error('502'); };
  const events = [];
  const ok = await TK.moveRow({
    row, to: 'Rejected', post,
    onApplied: (r) => events.push(['applied', r.status]),
    onReverted: (r, from) => events.push(['reverted', r.status, from]),
  });
  assert.equal(ok, false);
  assert.equal(row.status, 'Offer', 'the row is back on the captured snapshot');
  assert.deepEqual(events, [['applied', 'Rejected'], ['reverted', 'Offer', 'Offer']]);
  assert.equal(toasts[0].type, 'error');
});

test('moveRow: same-stage drop and backfill sentinels are no-ops (never a write)', async () => {
  toasts.length = 0;
  let called = 0;
  const post = async () => { called += 1; return { ok: true }; };
  assert.equal(await TK.moveRow({ row: { num: 1, status: 'Applied' }, to: 'Applied', post }), false);
  assert.equal(await TK.moveRow({ row: { num: 'N/A', status: 'Applied' }, to: 'Offer', post }), false);
  assert.equal(await TK.moveRow({ row: { num: 2, status: 'Applied' }, to: '', post }), false);
  assert.equal(called, 0, 'no POST for a no-op');
  assert.equal(toasts.length, 0);
});

test('moveRow: one write per row at a time (in-flight guard, no double-POST race)', async () => {
  toasts.length = 0;
  const row = { num: 7, status: 'Evaluated' };
  let resolvePost;
  const post = () => new Promise((r) => { resolvePost = r; });
  const first = TK.moveRow({ row, to: 'Applied', post });
  const second = await TK.moveRow({ row, to: 'Interview', post });
  assert.equal(second, false, 'a second move of the SAME in-flight row is ignored');
  resolvePost({ ok: true });
  assert.equal(await first, true);
  assert.equal(row.status, 'Applied', 'the ignored second move never mutated the row');
  // After completion the row can move again.
  const third = await TK.moveRow({ row, to: 'Interview', post: async () => ({ ok: true }) });
  assert.equal(third, true);
});

// ── 3 · source-static — the write contract ──────────────────────────────────

test('the lib writes ONLY through the canonical /api/tracker/status relay', () => {
  const posts = [...LIB.matchAll(/API\.post\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(posts, ['/api/tracker/status']);
  assert.ok(!/\/api\/tracker\/(bulk|move)/.test(LIB), 'no invented tracker write endpoints');
  assert.match(LIB, /API\.post\('\/api\/tracker\/status'/);
});

test('the browser lib never touches applications.md (no fs, no file writes)', () => {
  assert.ok(!/applications\.md/.test(LIB), 'the funnel lib must not mention the parent file');
  assert.ok(!/\brequire\(|\bfrom ['"]node:/.test(LIB), 'no node imports in a browser lib');
  assert.ok(!/writeFileSync|fs\./.test(LIB), 'no filesystem access');
});

test('CSP-safe DOM: no innerHTML, no inline handlers in the funnel lib', () => {
  assert.ok(!/innerHTML/.test(LIB), 'innerHTML is forbidden (UI.el only)');
  assert.ok(!/\son[a-z]+\s*=/.test(LIB), 'no inline event handlers');
});

test('DnD guards live INSIDE the handler bodies (anchored, not substring)', () => {
  const over = LIB.slice(LIB.indexOf("'dragover'"), LIB.indexOf("'dragleave'"));
  assert.ok(over.length > 0 && over.length < 1200, 'the dragover body is sliceable');
  assert.match(over, /dragNum == null/, 'no drop candidate → the column never accepts');
  assert.match(over, /fold\(row\.status\) === stage/, 'same-stage hover is refused before any write');
  const drop = LIB.slice(LIB.indexOf("'drop'"), LIB.indexOf('return col;'));
  assert.ok(drop.length > 0 && drop.length < 1800, 'the drop body is sliceable');
  assert.match(drop, /fold\(row\.status\) === stage/, 'drop re-checks the same-stage guard');
  assert.match(drop, /move\(row, stage\)/, 'the drop goes through moveRow (the one write path)');
});

test('keyboard fallback: cards are focusable; ←/→ and Enter are wired on the card', () => {
  assert.match(LIB, /tabIndex: 0/);
  assert.match(LIB, /draggable: 'true'/);
  const keydown = LIB.slice(LIB.indexOf("'keydown'"), LIB.indexOf('return el;'));
  assert.ok(keydown.length > 0);
  assert.match(keydown, /ArrowLeft/);
  assert.match(keydown, /ArrowRight/);
  assert.match(keydown, /openNotesModal\(ctx, r\)/, 'Enter opens the notes modal');
  assert.match(keydown, /move\(r, target\)/, 'arrow keys use the same canonical write path');
});

test('view persistence: career-ops-ui:trackView, table default, guarded storage', () => {
  assert.match(LIB, /career-ops-ui:trackView/);
  assert.match(LIB, /localStorage\.getItem\(VIEW_KEY\)/);
  assert.match(LIB, /try \{ localStorage\.setItem\(VIEW_KEY/, 'storage writes are guarded (private mode)');
  assert.match(LIB, /viewToggle\.mode\(\) !== 'kanban'/, 'table stays the default view');
});

// ── 4 · source-static — the tracker.js wiring (the pinned contract holds) ───

test('tracker.js: the table contract is intact and the funnel lib is wired in', () => {
  // Pinned by tests/tracker-v2.test.mjs — must survive the CAR-237 wiring.
  assert.match(TRK, /TS \? TS\.createViewToggle\(/, 'the legacy toggle factory stays wired');
  assert.match(TRK, /viewModeNow\(\)/, 'mode reads go through the null-safe accessor');
  // The table view keeps its own markup (the funnel is the OTHER tab).
  assert.match(TRK, /colgroup/);
  assert.match(TRK, /function sortableTh/);
  assert.match(TRK, /API\.post\('\/api\/tracker\/status'/, 'inline status edits unchanged');
  // The new wiring.
  assert.match(TRK, /TrackerKanban\.createBoard\(/, 'renderKanban mounts the funnel board');
  assert.match(TRK, /TrackerKanban\.funnelTab\(/, 'the funnel tab wiring runs on render');
  assert.match(TRK, /TrackerKanban\.saveViewPref\(/, 'every mode flip persists through the lib');
  assert.ok(!/TS\.kanbanBoard\(/.test(TRK), 'the old CAR-117 renderer is no longer mounted');
  assert.ok(!/career-ops-ui:trackView/.test(TRK), 'the persistence key lives in the lib, not the view');
});

test('index.html registers the stylesheet after components.css and the script before tracker.js', () => {
  const componentsCss = HTML.indexOf('/css/components.css');
  const kanbanCss = HTML.indexOf('/css/kanban.css');
  const overlaysCss = HTML.indexOf('/css/overlays.css');
  assert.ok(kanbanCss > componentsCss, 'kanban.css loads after components.css');
  assert.ok(kanbanCss < overlaysCss, 'kanban.css does not disturb the pinned trio order');
  const kanbanJs = HTML.indexOf('/js/lib/tracker-kanban.js');
  const stagesJs = HTML.indexOf('/js/lib/tracker-stages.js');
  const trackerJs = HTML.indexOf('/js/views/tracker.js');
  assert.ok(stagesJs > -1 && kanbanJs > stagesJs, 'the funnel lib loads after tracker-stages');
  assert.ok(kanbanJs < trackerJs, 'the funnel lib loads before the view wires it');
});

test('kanban.css exists, sits under the hard LOC limit, and stays token-based', () => {
  const lines = CSS.split('\n').length;
  assert.ok(lines > 0 && lines <= 800, `kanban.css is ${lines} lines`);
  assert.match(CSS, /\.funnel-board/);
  assert.match(CSS, /\.funnel-card/);
  assert.match(CSS, /max-width:\s*899px/, 'the mobile <900px strip is real');
  // No inline styles of forbidden role tokens (mirrors tests/css-role-tokens).
  assert.ok(!/color\s*:\s*var\(--(card|panel|panel-2|surface-elev1|line|border)\)/.test(CSS));
  assert.ok(!/background(-color)?\s*:\s*var\(--(fg|ink|muted|ok|go|err|error|danger|warn)\)/.test(CSS));
});

// ── 5 · i18n — the kanban.* keys exist in all 19 locales ────────────────────

const I18N_LANGS = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
const KANBAN_KEYS = [
  'kanban.title', 'kanban.hint', 'kanban.tab', 'kanban.boardAria', 'kanban.colAria',
  'kanban.cardAria', 'kanban.cardMenu', 'kanban.emptyHint', 'kanban.dropHere',
  'kanban.modalTitle', 'kanban.notes', 'kanban.notesPlaceholder', 'kanban.interviewAt',
  'kanban.status', 'kanban.save', 'kanban.saved', 'kanban.saveFailed', 'kanban.moveFailed',
  'kanban.moved',
];

function loadTable(lang) {
  const ctx = createContext({ window: {} });
  runInContext(readFileSync(R('public/js/lib/locales', `i18n-dict.${lang}.js`), 'utf8'), ctx);
  const g = `__I18N_DICT_${lang.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return ctx.window[g];
}

test('every kanban.* key exists in ALL 19 locales (and the dicts parse in a vm realm)', () => {
  for (const lang of I18N_LANGS) {
    const table = loadTable(lang);
    const missing = KANBAN_KEYS.filter((k) => typeof table[k] !== 'string' || !table[k].length);
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
  }
});

test('the en values are the en fallbacks the lib renders with (dict ↔ lib parity)', () => {
  const en = loadTable('en');
  for (const k of KANBAN_KEYS) {
    assert.ok(LIB.includes(`'${k}',`) || LIB.includes(`"${k}",`) || LIB.includes(`t('${k}',`)
      || LIB.includes(`'${k}'`) === true,
    `${k} is referenced by the lib`);
  }
  // The fallbacks inside t('kanban.x', 'fallback') match the en dict (sample).
  assert.match(LIB, /t\('kanban\.tab', 'Funnel'\)/);
  assert.match(LIB, /t\('kanban\.emptyHint', 'No applications'\)/);
  assert.equal(en['kanban.tab'], 'Funnel');
});

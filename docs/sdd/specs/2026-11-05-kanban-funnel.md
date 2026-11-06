# SPEC — CAR-237 «Воронка»: one understandable kanban board on #/tracker

Status: implemented on `feat/car237-kanban` (no PR — orchestrator integrates).
Owner file list (nothing else touched): `public/js/lib/tracker-kanban.js` (new),
`public/js/views/tracker.js` (tab wiring + render call only), `public/css/kanban.css`
(new, registered in `public/index.html`), the ×19 locale dicts (`kanban.*` keys only,
appended at the end), the i18n snapshot fixture, `tests/tracker-kanban.test.mjs` (new),
`tests/playwright-tracker-kanban.mjs` (new), `package.json` (browser-suite registration).

## 1. Problem

The owner's words (Linear CAR-237, P0): «Сейчас слишком много разделов, непонятно».
The tracker today spreads one mental model over many surfaces: stage tabs, filters,
an inline status select, bulk-move bar, the CAR-117 kanban with its preview dialogs
and read-only columns. The owner wants ONE board: see the funnel, drag a card
(«хоп, откликнулся»), assign an interview time, done.

## 2. Researched mechanism — Fighter90/flow (Apache-2.0, Rails + React/dnd-kit)

Read (upstream `develop`): `app/frontend/pages/Projects/Board/{BoardPage,BoardColumn,
SortableTaskCard}.tsx` + `useBoardDnd.ts`. UX patterns borrowed — **not** the code
(different stack: React/dnd-kit vs our no-build vanilla SPA):

- **Pre-drag snapshot, revert-only-on-failure.** flow captures the task list before
  any optimistic mutation (through a ref so the snapshot never freezes at first
  render) and on API failure restores that snapshot exactly; on success it does
  NOT re-fetch — the optimistic state already matches what the server stored. We
  port the shape: capture `prevStatus` from the row itself, mutate the row, let the
  board re-render, POST; on failure restore the captured status and re-render.
- **Optimistic visual move, single write per move.** flow moves the card during
  dragover and persists one PATCH `{ columnId, position }` at dragend. We have no
  intra-column ordering (the tracker is a table, not an ordered list), so the only
  persisted fact is the column change: one POST per move.
- **Drop-target outline on the hovered column** (flow: `outline: 2px solid brand`,
  `offset -2`), dragging card dimmed to opacity 0.4. Ported 1:1 as CSS on
  `.funnel-col.is-drop-target` / `.funnel-card.is-dragging`.
- **Column = droppable surface AND card = drop target** resolve to the same column
  id; an empty column stays a valid drop target. Ported: the cards host is the
  drop surface; every canonical column (including zero-count ones) accepts drops.
- **Keyboard fallback as a first-class path** (dnd-kit KeyboardSensor + per-column
  ←/→ move actions). Ported as card focus + ArrowLeft/ArrowRight, Enter for notes.
- **Count badge per column header; empty columns visible.** Ported verbatim;
  counts are `aria-live="polite"` so a screen reader hears the change.

Deliberately NOT ported: column reordering/rename (our column order IS the
canonical funnel from states.yml), per-column infinite scroll (a tracker is small),
collapsible columns, WebSocket broadcast refresh (our move IS the source of truth;
a re-render reads local state), drag overlays (HTML5 DnD gives us the ghost free).

## 3. Column map — one source of truth

Columns = `GET /api/tracker/stages` (canonical funnel incl. zero-count stages, in
states.yml order — Evaluated → Applied → Responded → Assessment → Interview →
Offer → Rejected → Discarded → SKIP → Hired), labels already localized ×19
server-side. Rows whose folded status matches no canonical stage land in a trailing
«Other» column (label: existing `track.kanbanOther`) so nothing vanishes; that
column accepts drags OUT but is never a drop target (the canonical route would
reject an unknown state with 400). No client-side whitelist anywhere.

## 4. Data flow — every write is the canonical v1.264.0 relay

```
drop / Arrow key / modal status select
  → optimistic: row.status = target → board re-renders (tab counts recount)
  → POST /api/tracker/status { row: <num>, state: <canonical stage> }
      → routes/tracker.mjs → set-status.mjs --row N <State> --json
      (applications.md lock; status-log transition appended server-side)
  → 200: done (no extra reload — the optimistic state matches the file)
  → 4xx/5xx: row.status = prev → board re-renders → toast kanban.moveFailed
```

No code path reads or writes `applications.md` directly from the browser lib; the
lib has no `fs`, no `innerHTML`, no invented endpoints (`/api/tracker/bulk|move`
stay forbidden — same guard as tracker-v2). Backfill sentinel rows (`N/A` / `—` /
`-`) are pre-guarded: they can never be moved because the POST needs a positive
integer row.

### Notes & interview time (modal «Заметки и время собеседования»)

The only existing canonical row-notes write is the same relay's `--note` flag:
`POST /api/tracker/status { row, state, note }` appends the note to the Notes cell
with `"; "` separators and is idempotent (a repeated identical note writes
nothing). Setting `state` to the row's CURRENT canonical stage means
`statusChanged = false` server-side — the status cell never moves, no status-log
noise; only the Notes cell changes. That is the modal's save path.

Marker convention (fixed data strings, locale-independent, per the owner's
canonical cell format):

- `[Заметки] <free text>` — the notes content;
- `[Собеседование: YYYY-MM-DD HH:mm]` — the interview time (local time, exactly
  the `datetime-local` value with `T` → space).

`parseNotesMarkers()` splits the Notes cell on `"; "` and returns the most recent
marker of each kind, so the modal pre-fills what is already recorded.
`buildNotesPayload()` returns ONLY the markers whose content changed (an unchanged
marker is never re-sent; newlines collapse to spaces; the payload stays ≤ 200
chars — the route's `MAX_NOTE`). Notes are append-only journal entries by design
(the parent writer cannot rewrite history); the modal says so through the
prefill — you always see the latest recorded value.

## 5. View wiring

`tracker.js` keeps its pinned source contract (`TS ? TS.createViewToggle(`,
`viewModeNow()`, the intact table with colgroup/sortableTh, the inline status
select). The funnel lib (`window.TrackerKanban`):

- `funnelTab(viewToggle, t)` — re-labels the toggle's second button to
  `kanban.tab` («Funnel»/«Воронка»), and restores the authoritative view choice
  from `localStorage['career-ops-ui:trackView']` (`'table'` | `'funnel'`) by
  clicking the matching existing button (ONE toggle DOM, no parallel state).
- `saveViewPref(mode)` — called from `applyViewMode()`, persists the effective mode.
- `createBoard(ctx)` — the board that `renderKanban()` mounts instead of the old
  CAR-117 renderer (`tracker-stages.js` keeps exporting `kanbanBoard` untouched —
  «не ломать»; the view simply no longer mounts it).

Table stays the default mode and the second tab («Таблица | Воронка»).

## 6. Keyboard model (a11y)

- Card: `tabindex="0"`, `role="listitem"`, `aria-label` = `#{num} {company}, {role}
  — {stage}` template. `role="list"` on the board and on every column's card host.
- ArrowLeft / ArrowRight on a focused card = move to the previous / next canonical
  column (same POST as a drop; `__other__` cards move toward the nearest canonical
  column). The move skips nothing else: every canonical stage is reachable.
- Enter on a focused card = open the modal (notes / interview time / status select).
- Column counts are `aria-live="polite"`; the drop hint `kanban.dropHere` replaces
  the empty hint of the hovered column while a valid drag is over it.
- Modal: the status `<select>` doubles as the mobile (<900px) mover — no drag
  required to change a status on a phone.

## 7. Mobile <900px

`.funnel-board` becomes a horizontal scroll strip (columns keep a min-width,
`overflow-x: auto`, momentum scrolling); drag remains possible where the platform
supports it, but nothing requires it: the modal's status select moves any card.

## 8. i18n

`kanban.*` keys (19, en source, appended at the END of every dict to minimize
merge conflicts): title, hint, tab, boardAria, colAria, cardAria, cardMenu,
emptyHint, dropHere, modalTitle, notes, notesPlaceholder, interviewAt, status,
save, saved, saveFailed, moveFailed, moved. Report links reuse the existing
localized `track.report`. The snapshot fixture is regenerated LAST.

## 9. Acceptance criteria

1. Drag a card between columns → the card lands in the target column, the POST
   fired, and a page reload keeps the new status (the relay wrote the file).
2. A failed POST (502/500) reverts the card and toasts; nothing is lost.
3. Keyboard: focus + ArrowRight performs the same move; Enter opens the modal.
4. The modal saves `[Заметки] …` / `[Собеседование: …` markers through the
   canonical relay (visible in the Notes cell; reload keeps them).
5. The table view is intact (default tab; all existing tracker tests green).
6. `kanban.*` keys ×19; snapshot regenerated; browser suite 0 fail.

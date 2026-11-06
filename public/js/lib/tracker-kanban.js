/* window.TrackerKanban — the CAR-237 «Воронка» board for #/tracker.
 * TODO: split by concern (markers / moveRow / board renderer / modal) if the
 * file grows past the comfortable band — see docs/sdd/CONVENTIONS.md.
 *
 * ONE understandable kanban: columns are the canonical funnel
 * (GET /api/tracker/stages — never a client whitelist), cards are tracker
 * rows, and every status change is the EXISTING canonical write
 * (POST /api/tracker/status → the parent set-status.mjs relay). UX patterns
 * researched from Fighter90/flow (Apache-2.0) and adapted — the pre-drag
 * snapshot that only reverts on failure, the drop-target outline on the
 * hovered column, the dimmed dragging card, keyboard as a first-class path,
 * visible zero-count columns with count badges. No code ported 1:1 (that
 * board is React/dnd-kit; this is the no-build vanilla SPA).
 *
 * Layers:
 *   1. Pure helpers (unit-tested in a synthetic window, no DOM):
 *      parseNotesMarkers / buildNotesPayload — the Notes-cell marker
 *      convention ([Заметки] … / [Собеседование: YYYY-MM-DD HH:mm]) and
 *      moveRow — the optimistic move + revert-on-error controller.
 *   2. DOM factories: funnelTab (the «Funnel» tab wiring + the authoritative
 *      career-ops-ui:trackView persistence) and createBoard (columns, cards,
 *      HTML5 drag&drop, keyboard fallback, the notes modal).
 *
 * CSP-safe: UI.el + addEventListener + textContent only — no raw HTML
 * injection, no inline handlers. No invented endpoints; the browser never
 * touches the parent tracker file (the canonical relay does, under its lock).
 */
window.TrackerKanban = (function () {
  // The authoritative view choice for #/tracker («Таблица | Воронка»).
  // The legacy career-ops-ui:tracker-view key (tracker-stages.js) keeps
  // trailing in sync because the funnel tab drives the SAME two buttons.
  const VIEW_KEY = 'career-ops-ui:trackView';

  // ── Notes-cell marker convention (data strings, locale-independent) ──────
  // The parent set-status.mjs appends notes "; "-separated and idempotently;
  // these two bracketed markers are how the funnel modal finds its own data
  // again. The route rejects control characters and caps the note at 200
  // chars, so the builder collapses newlines and enforces the cap.
  const NOTES_MARKER = '[Заметки]';
  const INTERVIEW_MARKER = '[Собеседование:';
  const MAX_NOTE = 200; // mirrors routes/tracker.mjs MAX_NOTE

  // Split the Notes cell into "; " entries and return the most recent marker
  // of each kind (the LAST wins — entries are append-only journal rows).
  function parseNotesMarkers(raw) {
    const out = { notes: '', interviewAt: '' };
    const text = String(raw == null ? '' : raw);
    if (!text) return out;
    for (const entry of text.split('; ')) {
      const e = entry.trim();
      if (e.indexOf(NOTES_MARKER) === 0) out.notes = e.slice(NOTES_MARKER.length).trim();
      else if (e.indexOf(INTERVIEW_MARKER) === 0) {
        const m = e.match(/\[\u0421\u043e\u0431\u0435\u0441\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u0435:\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
        if (m) out.interviewAt = m[1] + ' ' + m[2];
      }
    }
    return out;
  }

  // Build the "--note" payload for a modal save: ONLY the markers whose
  // content actually changed (an unchanged marker is never re-sent — the
  // server's idempotent append would no-op it anyway, and a no-change save
  // must not write at all). Newlines collapse to spaces (the route rejects
  // control characters) and the total stays within the route's 200-char cap.
  // Returns '' when nothing changed (the caller skips the POST).
  function buildNotesPayload(current, next) {
    const cur = parseNotesMarkers(current && current.notes);
    const parts = [];
    const clean = (s) => String(s == null ? '' : s).replace(/[\r\n\t\v\f\u2028\u2029]+/g, ' ').trim();
    const notes = clean(next && next.notes);
    const at = clean(next && next.interviewAt).replace('T', ' ');
    if (notes && notes !== cur.notes) {
      parts.push(NOTES_MARKER + ' ' + notes);
    }
    if (at && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at) && at !== cur.interviewAt) {
      parts.push('[Собеседование: ' + at + ']');
    }
    const payload = parts.join('; ');
    return payload.length > MAX_NOTE ? payload.slice(0, MAX_NOTE).trim() : payload;
  }

  // ── The move controller (optimistic + revert, the flow pattern) ──────────
  // moveRow({ row, to, post, t, onApplied, onReverted }):
  //   row   — the tracker row object (mutated in place; the view re-renders)
  //   to    — the target canonical stage label
  //   post  — injected (opts.post || API.post) so tests drive the failure
  // Captures prevStatus FIRST (the flow pre-drag snapshot, scoped to the one
  // field that can change), mutates optimistically, notifies, then writes.
  // On failure: restore the captured status, notify, toast. One POST per
  // move; concurrent moves of the SAME row are ignored (in-flight guard).
  const inFlight = new Set();
  function moveRow(opts) {
    const row = opts.row;
    const to = opts.to;
    const post = opts.post || (window.API && API.post);
    const t = opts.t || ((k, f) => f);
    const num = String(row && row.num);
    if (!row || !to || !post) return Promise.resolve(false);
    if (!/^\d+$/.test(num)) return Promise.resolve(false); // backfill sentinel — the POST needs a positive integer
    const from = String(row.status == null ? '' : row.status);
    if (from === to) return Promise.resolve(false); // same-column drop is a no-op, never a write
    if (inFlight.has(num)) return Promise.resolve(false); // one write per row at a time
    inFlight.add(num);
    row.status = to; // optimistic — the board re-renders through onApplied
    if (opts.onApplied) opts.onApplied(row, from, to);
    return Promise.resolve()
      .then(() => post('/api/tracker/status', { row: Number(num), state: to }))
      .then(() => {
        inFlight.delete(num);
        UI.toast(t('kanban.moved', 'Moved to {state}').replace('{state}', to), 'success');
        return true;
      })
      .catch(() => {
        inFlight.delete(num);
        row.status = from; // revert to the captured snapshot
        if (opts.onReverted) opts.onReverted(row, from, to);
        UI.toast(t('kanban.moveFailed', 'Could not move the card — reverted'), 'error');
        return false;
      });
  }

  // ── Tab wiring ────────────────────────────────────────────────────────────
  // funnelTab(viewToggle, t): the TS toggle keeps owning its two buttons
  // (table default, legacy persistence — the pinned source contract); this
  // re-labels the second button «Funnel» and restores the authoritative
  // career-ops-ui:trackView choice by clicking the matching existing button.
  function funnelTab(viewToggle, t) {
    const btns = viewToggle.el.querySelectorAll('button');
    if (!btns.length) return;
    if (btns[1]) btns[1].textContent = (t && t('kanban.tab', 'Funnel')) || 'Funnel';
    let pref = null;
    try { pref = localStorage.getItem(VIEW_KEY); } catch { /* private mode */ }
    if (pref !== 'funnel' && pref !== 'table') return;
    const isTable = viewToggle.mode() !== 'kanban';
    if ((pref === 'funnel') === isTable && btns[pref === 'funnel' ? 1 : 0]) {
      btns[pref === 'funnel' ? 1 : 0].click();
    }
  }

  // Persist the effective mode. Called from applyViewMode() — every toggle
  // change lands here, so the key is written exactly when the view flips.
  function saveViewPref(mode) {
    try { localStorage.setItem(VIEW_KEY, mode === 'table' ? 'table' : 'funnel'); } catch { /* private mode */ }
  }

  // ── The board ─────────────────────────────────────────────────────────────
  // ctx: { rows, stages, fold, statusLabel, scoreClass, t, onChanged }
  //   onChanged() fires after an OPTIMISTIC mutation so the host can recount
  //   its stage tabs; a revert fires it again with the restored status.
  function createBoard(ctx) {
    const c = UI.el;
    const t = ctx.t;
    const fold = ctx.fold;
    const stages = Array.isArray(ctx.stages) ? ctx.stages : [];

    // Module-of-call drag payload: dataTransfer.getData() is unread during
    // dragover, so the in-flight card's row number is kept here.
    let dragNum = null;

    const byStage = new Map();
    for (const s of stages) byStage.set(s, []);
    const others = [];
    for (const r of ctx.rows) {
      const st = fold(r.status);
      if (byStage.has(st)) byStage.get(st).push(r);
      else others.push(r);
    }

    const board = c('div', {
      className: 'funnel-board',
      role: 'list',
      'aria-label': t('kanban.boardAria', 'Applications by funnel stage'),
    });

    // The board heading with a localized HelpHint explaining the flow (the
    // ⋯/⎙ affordances, the drag + arrow-key moves, the canonical write).
    const root = c('div', { className: 'funnel-root' }, [
      c('div', { className: 'funnel-head' }, [
        c('strong', { className: 'funnel-title' }, t('kanban.title', 'Applications funnel')),
        window.HelpHint && window.HelpHint.icon
          ? window.HelpHint.icon('kanban.hint', { sectionLabel: t('kanban.title', 'Applications funnel') })
          : null,
      ].filter(Boolean)),
      board,
    ]);

    const canonicalIndex = (stage) => stages.indexOf(stage);

    const buildColumn = (stage, items, isOther) => {
      const label = isOther ? t('track.kanbanOther', 'Other') : ctx.statusLabel(stage);
      const host = c('div', {
        className: 'funnel-cards',
        role: 'list',
        'aria-label': t('kanban.colAria', '{stage} — {count} applications')
          .replace('{stage}', label).replace('{count}', String(items.length)),
        'data-stage': stage,
      });
      const count = c('span', {
        className: 'funnel-col-count',
        'aria-live': 'polite',
      }, String(items.length));
      const head = c('div', { className: 'funnel-colhdr' }, [
        c('span', { className: 'funnel-col-label', title: label }, label),
        count,
      ]);
      for (const r of items) host.appendChild(card(r, stage));
      const empty = c('div', { className: 'funnel-empty' },
        t('kanban.emptyHint', 'No applications'));
      if (!items.length) host.appendChild(empty);

      const col = c('div', {
        className: 'funnel-col' + (isOther ? ' is-other' : ''),
        'data-stage': stage,
      }, [head, host]);

      if (!isOther) {
        host.addEventListener('dragover', (e) => {
          if (dragNum == null) return; // no drop candidate → never accept
          const row = byNum(ctx.rows, dragNum);
          if (!row) return;
          if (fold(row.status) === stage) return; // same-stage drop is a no-op
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          col.classList.add('is-drop-target');
          if (!items.length) empty.textContent = t('kanban.dropHere', 'Drop to move here');
        });
        host.addEventListener('dragleave', (e) => {
          if (e.relatedTarget && (host === e.relatedTarget || host.contains(e.relatedTarget))) return;
          col.classList.remove('is-drop-target');
          if (!items.length) empty.textContent = t('kanban.emptyHint', 'No applications');
        });
        host.addEventListener('drop', (e) => {
          e.preventDefault();
          col.classList.remove('is-drop-target');
          if (!items.length) empty.textContent = t('kanban.emptyHint', 'No applications');
          const num = dragNum != null ? dragNum : Number(e.dataTransfer && e.dataTransfer.getData('text/plain'));
          dragNum = null;
          const row = byNum(ctx.rows, num);
          if (!row) return;
          if (fold(row.status) === stage) return; // re-check before any write
          move(row, stage);
        });
      }
      return col;
    };

    function move(row, to) {
      moveRow({
        row,
        to,
        t,
        onApplied: () => { if (ctx.onChanged) ctx.onChanged(); },
        onReverted: () => { if (ctx.onChanged) ctx.onChanged(); },
      });
    }

    function card(r, stage) {
      const scoreCls = ctx.scoreClass
        ? ctx.scoreClass(r.scoreNum ?? r.score)
        : ((r.scoreNum >= 4 && 'score-high') || (r.scoreNum >= 3 && 'score-mid') || 'score-low');
      const stageLabel = ctx.statusLabel(stage);
      const el = c('div', {
        className: 'funnel-card',
        role: 'listitem',
        tabIndex: 0,
        draggable: 'true',
        'data-num': String(r.num ?? ''),
        'aria-label': t('kanban.cardAria', '#{num} {company}, {role} — {stage}')
          .replace('{num}', String(r.num ?? '?'))
          .replace('{company}', r.company || '—')
          .replace('{role}', r.role || '—')
          .replace('{stage}', stageLabel),
      }, [
        c('div', { className: 'funnel-card-top' }, [
          c('span', { className: 'funnel-num' }, '#' + (r.num || '?')),
          c('strong', { className: 'funnel-company', title: r.company || '' }, r.company || '—'),
          c('span', { className: 'funnel-card-actions' }, [
            r.reportPath ? c('button', {
              type: 'button',
              className: 'btn btn-ghost btn-sm funnel-iconbtn',
              'data-num': String(r.num ?? ''),
              'aria-label': (ctx.reportLabel || 'Report') + ' — ' + (r.company || ''),
              title: ctx.reportLabel || 'Report',
              onClick: () => { window.Router.go('/reports/' + String(r.reportPath).replace(/^(\.\.\/)*reports\//, '').replace(/\.md$/, '')); },
            }, '⎙') : null,
            c('button', {
              type: 'button',
              className: 'btn btn-ghost btn-sm funnel-iconbtn funnel-menu',
              'data-num': String(r.num ?? ''),
              'aria-label': t('kanban.cardMenu', 'Notes and interview time') + ' — ' + (r.company || ''),
              title: t('kanban.cardMenu', 'Notes and interview time'),
              onClick: () => openNotesModal(ctx, r),
            }, '⋯'),
          ].filter(Boolean)),
        ]),
        r.role ? c('div', { className: 'funnel-role', title: r.role }, r.role) : null,
        c('div', { className: 'funnel-meta' }, [
          c('span', { className: 'score-pill ' + scoreCls }, r.score || '—'),
          c('span', { className: 'funnel-date' }, r.date || ''),
        ].filter(Boolean)),
      ].filter(Boolean));

      el.addEventListener('dragstart', (e) => {
        dragNum = r.num;
        el.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(r.num ?? ''));
          e.dataTransfer.effectAllowed = 'move';
        }
      });
      el.addEventListener('dragend', () => {
        dragNum = null;
        el.classList.remove('is-dragging');
        for (const col of board.querySelectorAll('.funnel-col.is-drop-target')) {
          col.classList.remove('is-drop-target');
        }
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          openNotesModal(ctx, r);
          return;
        }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const idx = canonicalIndex(stage);
        let target = null;
        if (e.key === 'ArrowRight') {
          target = stages[(idx === -1 ? -1 : idx) + 1] || (idx === -1 ? stages[0] : null);
          if (idx === -1 && !target) target = stages[0];
          if (idx === stages.length - 1) target = null;
        } else {
          target = idx > 0 ? stages[idx - 1] : (idx === -1 ? stages[stages.length - 1] : null);
        }
        if (!target) return;
        move(r, target);
      });
      return el;
    }

    for (const s of stages) board.appendChild(buildColumn(s, byStage.get(s) || [], false));
    if (others.length) board.appendChild(buildColumn('__other__', others, true));
    return root;
  }

  // ── The «Заметки и время собеседования» modal ─────────────────────────────
  // Saves through the SAME canonical relay: state = the row's CURRENT stage,
  // so the status cell never moves and only the Notes cell changes (the
  // server appends the note "; "-separated and idempotently). The status
  // <select> doubles as the mobile mover — the same moveRow write path.
  function openNotesModal(ctx, r) {
    const c = UI.el;
    const t = ctx.t;
    const fold = ctx.fold;
    const stages = Array.isArray(ctx.stages) ? ctx.stages : [];
    const stored = parseNotesMarkers(r.notes);

    const numOk = /^\d+$/.test(String(r.num ?? ''));
    const current = fold(r.status);
    const company = r.company || '—';

    // The status <select> doubles as the mobile mover — the same canonical
    // moveRow write path as a drop or an arrow key.
    const doMove = (to) => moveRow({
      row: r,
      to,
      t,
      onApplied: () => { if (ctx.onChanged) ctx.onChanged(); },
      onReverted: () => { if (ctx.onChanged) ctx.onChanged(); },
    });

    const statusSel = numOk && stages.length && stages.includes(current)
      ? c('select', {
        className: 'select',
        'aria-label': t('kanban.status', 'Status'),
        onChange: () => doMove(statusSel.value),
      }, stages.map((s) => c('option', { value: s }, ctx.statusLabel(s)))) : null;
    if (statusSel) statusSel.value = current;

    const notes = c('textarea', {
      className: 'input',
      rows: 3,
      maxLength: 180,
      placeholder: t('kanban.notesPlaceholder', 'e.g. recruiter screen booked, salary expectations…'),
      'aria-label': t('kanban.notes', 'Notes'),
    });
    notes.value = stored.notes;
    const at = c('input', {
      className: 'input',
      type: 'datetime-local',
      'aria-label': t('kanban.interviewAt', 'Interview time'),
    });
    if (stored.interviewAt) at.value = stored.interviewAt.replace(' ', 'T');

    const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' },
      t('kanban.save', 'Save'));
    saveBtn.addEventListener('click', async () => {
      const payload = buildNotesPayload(r, { notes: notes.value, interviewAt: at.value });
      if (!payload) { UI.closeModal(); return; } // nothing changed → no write
      saveBtn.disabled = true;
      try {
        await API.post('/api/tracker/status', {
          row: Number(r.num),
          state: current,
          note: payload,
        });
        r.notes = r.notes ? (String(r.notes).trim() + '; ' + payload) : payload;
        UI.toast(t('kanban.saved', 'Saved to the tracker'), 'success');
        UI.closeModal();
      } catch {
        UI.toast(t('kanban.saveFailed', 'Could not save — reverted'), 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });

    const body = c('div', { className: 'funnel-modal' }, [
      c('div', { className: 'funnel-modal-row' }, '#' + (r.num || '?') + ' ' + company),
      statusSel ? c('div', { className: 'funnel-field' }, [
        c('label', { htmlFor: 'funnel-status-sel' }, t('kanban.status', 'Status')),
        statusSel,
      ]) : null,
      c('div', { className: 'funnel-field' }, [
        c('label', { htmlFor: 'funnel-notes' }, t('kanban.notes', 'Notes')),
        notes,
      ]),
      c('div', { className: 'funnel-field' }, [
        c('label', { htmlFor: 'funnel-at' }, t('kanban.interviewAt', 'Interview time')),
        at,
      ]),
      c('div', { className: 'funnel-modal-actions' }, [saveBtn]),
    ].filter(Boolean));
    if (statusSel) statusSel.id = 'funnel-status-sel';
    notes.id = 'funnel-notes';
    at.id = 'funnel-at';

    UI.modal(t('kanban.modalTitle', 'Notes & interview time'), body);
  }

  function byNum(rows, num) {
    return (rows || []).find((r) => String(r.num) === String(num)) || null;
  }

  return {
    VIEW_KEY: VIEW_KEY,
    parseNotesMarkers: parseNotesMarkers,
    buildNotesPayload: buildNotesPayload,
    moveRow: moveRow,
    funnelTab: funnelTab,
    saveViewPref: saveViewPref,
    createBoard: createBoard,
    openNotesModal: openNotesModal,
  };
})();

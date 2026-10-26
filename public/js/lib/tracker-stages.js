/* window.TrackerStages — engine for the #/tracker board (CAR-117 v2).
 *
 * Two layers live here:
 *
 * 1. Pure stage helpers (v1.131.0) — the canonical funnel (stage labels in
 *    order) and the alias-fold map both come from the server
 *    (GET /api/tracker/stages → server/lib/states.mjs, which reads
 *    templates/states.yml). The client NEVER hardcodes the status whitelist —
 *    that is the v1.128.0 doctrine. foldStatus/stageCounts remain the funnel
 *    source of truth; a parent that renames or reorders a stage flows through
 *    with no client change.
 *
 * 2. The CAR-117 move engine — status changes go through the EXISTING per-row
 *    write mechanism the view already uses: the outcome relay
 *    (POST /api/outcome → parent outcome.mjs → set-status.mjs). No invented
 *    endpoints. Its outcome types cover exactly five canonical states, so
 *    those are the only move targets; every other column is read-only in the
 *    kanban and every move is previewed before it is written. Moves that left
 *    a non-writable state are warned about in the preview (they cannot be
 *    undone — the outcome writer records outcomes, it does not set pipeline
 *    states); the BACKLOG's upstream per-row set-status route port would
 *    lift that restriction.
 *
 * DOM-touching code uses UI.el/textContent only (CSP: no inline script, no
 * raw HTML injection). The view helpers moved here from tracker.js (company
 * history, liveness, move dialog) keep their original signatures.
 *
 * Unit-testable parts run in a synthetic window (tests/tracker-stages.test.mjs,
 * tests/tracker-v2.test.mjs) — they never touch DOM at module level.
 *
 * TODO: split by concern (board renderer / move flow / moved view panels) at
 * the next opportunity — see docs/sdd/CONVENTIONS.md file-size table.
 */
window.TrackerStages = (function () {
  // Normalize a raw status the same way the server keys its alias map: strip
  // stray markdown bold, trim, lowercase. Kept in sync with the endpoint's
  // key-building so "**Applied**" and "aplicado" both resolve.
  function norm(s) {
    return String(s == null ? '' : s).replace(/\*/g, '').trim().toLowerCase();
  }

  // Fold a row's raw status to its canonical stage label using the server alias
  // map. An unknown status is returned RAW (never invented into a stage) so it
  // still counts under ALL but lands in no canonical tab.
  function foldStatus(raw, aliases) {
    const k = norm(raw);
    if (!k) return '';
    if (aliases && Object.prototype.hasOwnProperty.call(aliases, k)) return aliases[k];
    return raw == null ? '' : String(raw);
  }

  // { <stageLabel>: n } for EVERY stage the server sent — including zero-count
  // stages, which is what gives the board its full-funnel CRM look. Unknown
  // statuses are ignored here (they surface only in the ALL count the caller
  // derives from rows.length).
  function stageCounts(rows, stages, aliases) {
    const counts = {};
    (stages || []).forEach(function (s) { counts[s] = 0; });
    (rows || []).forEach(function (r) {
      const folded = foldStatus(r && r.status, aliases);
      if (Object.prototype.hasOwnProperty.call(counts, folded)) counts[folded] += 1;
    });
    return counts;
  }

  // ── CAR-117 · the move engine ─────────────────────────────────────────────
  // Canonical state → outcome.mjs type (the parent's OUTCOME_MAP subset the
  // web view exposes). KEYS ARE CANONICAL LABELS from templates/states.yml,
  // so a server stage that matches a key is move-targetable and anything else
  // degrades to read-only. A state missing from this map can only be reached
  // by the pipeline/CLI flows — the kanban renders it but refuses drops.
  const MOVES = {
    Interview: 'interview_progress',
    Offer: 'offer_received',
    Hired: 'hired',
    Rejected: 'rejected',
    // Generic discard (states.yml: "Discarded by candidate or offer closed").
    // The outcome default note would claim "ghosted"; the move dialog carries
    // an optional note field so the user can qualify it (e.g. offer declined).
    Discarded: 'no_response',
  };

  function isWritableState(s) {
    return Object.prototype.hasOwnProperty.call(MOVES, s);
  }

  // The move targets, in the SERVER's stage order (drives both the kanban's
  // active columns and the move dialog's select). Falls back to the map's own
  // order when the server sent nothing.
  function writableStates(stages) {
    const list = (Array.isArray(stages) && stages.length) ? stages : Object.keys(MOVES);
    return list.filter(isWritableState);
  }

  // Bounded LIFO of executed move batches (session memory only) — the same
  // shape contract as the pipeline v2 undo queue, scoped to this view.
  function createUndoQueue(limit) {
    const cap = Math.max(1, limit || 5);
    const stack = [];
    return {
      push(batch) {
        if (!batch || !batch.length) return;
        stack.push(batch.slice());
        if (stack.length > cap) stack.shift();
      },
      pop() {
        return stack.pop() || null;
      },
      peek() {
        return stack.length ? stack[stack.length - 1] : null;
      },
      get size() {
        return stack.length;
      },
    };
  }

  // ── CAR-117 · kanban board ────────────────────────────────────────────────
  // ctx: { rows, stages, aliases, fold, statusLabel, statusClass, scoreClass,
  //        movesReady, t, onMove(rows, presetTo) }
  // Keyboard accessibility contract (documented in the PR): drag is a
  // pointer-only convenience — every card carries an explicit, keyboard-
  // operable Move control that opens the same previewed write path. Cards are
  // list items; columns are labelled lists; deprecated aria-dropeffect is
  // deliberately not used.
  function kanbanBoard(ctx) {
    const c = UI.el;
    const t = ctx.t;
    const fold = ctx.fold;
    const byStage = new Map();
    const others = [];
    for (const s of ctx.stages) byStage.set(s, []);
    for (const r of ctx.rows) {
      const st = fold(r.status);
      if (byStage.has(st)) byStage.get(st).push(r);
      else others.push(r);
    }

    const board = c('div', {
      className: 'v2-track-board',
      role: 'list',
      'aria-label': t('track.kanbanBoardAria', 'Applications by status'),
      style: { display: 'flex', gap: '12px', overflowX: 'auto', alignItems: 'stretch', paddingBottom: '8px' },
    });

    const buildColumn = (stage, items) => {
      const writable = isWritableState(stage);
      const count = items.length;
      // The trailing column for rows whose raw status matches no canonical
      // stage (legacy/unknown labels) gets its own localized name — the raw
      // marker must never surface.
      const isOther = stage === '__other__';
      const label = isOther ? t('track.kanbanOther', 'Other') : ctx.statusLabel(stage);
      const colName = writable
        ? (label + ' — ' + count)
        : (label + ' — ' + count + ' (' + t('track.kanbanReadonlyAria', 'read-only — this status changes in the pipeline') + ')');

      const head = c('div', {
        className: 'v2-track-colhdr',
        title: writable ? t('track.kanbanMoveHint', 'Drag a card to another column or press Move — the change is previewed before anything is written.') : t('track.kanbanReadOnly', 'Statuses here are set by the pipeline; record results from a row\'s Outcome button.'),
        style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--slate)', fontWeight: '600', fontSize: '13px' },
      }, [
        c('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
        c('span', {
          className: 'v2-chip' + (writable ? '' : ' v2-track-chip-muted'),
          'aria-hidden': 'true',
          style: { marginLeft: 'auto', flex: 'none' },
        }, String(count)),
      ]);

      const host = c('div', {
        className: 'v2-track-cards',
        role: 'list',
        'aria-label': colName,
        style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', overflowY: 'auto', flex: '1', minHeight: '60px' },
      });
      for (const r of items) host.appendChild(card(r, stage, label));
      if (!items.length) {
        host.appendChild(c('div', {
          role: 'listitem',
          style: { border: '1px dashed var(--slate)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '12px', color: 'var(--foggy)', textAlign: 'center' },
        }, writable ? t('track.kanbanEmpty', 'No applications') : '—'));
      }

      const col = c('div', {
        className: 'v2-track-col' + (writable ? '' : ' is-readonly'),
        style: { flex: '1 0 230px', maxWidth: '320px', minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--slate)', borderRadius: 'var(--radius)', background: 'var(--paper)', maxHeight: 'min(72vh, 720px)' },
      }, [head, host]);

      if (writable && ctx.movesReady !== false) {
        const over = '1px solid var(--hof)';
        const rest = '1px solid var(--slate)';
        host.addEventListener('dragover', (e) => {
          if (dragNum == null) return;
          const row = byNum(ctx.rows, dragNum);
          if (!row) return;
          const from = fold(row.status);
          if (from === stage) return; // same-stage drop is a no-op, never a write
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          host.style.border = over;
        });
        host.addEventListener('dragleave', (e) => {
          if (e.relatedTarget && host.contains(e.relatedTarget)) return;
          host.style.border = rest;
        });
        host.addEventListener('drop', (e) => {
          e.preventDefault();
          host.style.border = rest;
          const num = dragNum != null ? dragNum : Number(e.dataTransfer && e.dataTransfer.getData('text/plain'));
          dragNum = null;
          const row = byNum(ctx.rows, num);
          if (!row) return;
          if (fold(row.status) === stage) return;
          ctx.onMove([row], stage);
        });
      }
      return col;
    };

    for (const s of ctx.stages) board.appendChild(buildColumn(s, byStage.get(s) || []));
    if (others.length) board.appendChild(buildColumn('__other__', others));
    return board;

    function byNum(rows, num) {
      return rows.find((r) => String(r.num) === String(num)) || null;
    }

    function card(r, stage, stageLabel) {
      const scoreCls = ctx.scoreClass
        ? ctx.scoreClass(r.scoreNum ?? r.score)
        : ((r.scoreNum >= 4 && 'score-high') || (r.scoreNum >= 3 && 'score-mid') || 'score-low');
      const moveBtn = c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm v2-viewbtn v2-track-move',
        'data-key': String(r.num ?? ''),
        'aria-label': t('track.moveBtnAria', 'Move to another status') + ' — #' + (r.num || '?') + ' ' + (r.company || ''),
        title: t('track.moveBtnAria', 'Move to another status'),
        style: { marginLeft: 'auto', padding: '0 8px', fontSize: '11px', flex: 'none' },
        onClick: () => ctx.onMove([r], null),
      }, t('track.moveBtn', 'Move'));
      const el = c('div', {
        className: 'v2-track-card',
        role: 'listitem',
        'aria-label': '#' + (r.num || '?') + ' ' + (r.company || '') + (r.role ? ' — ' + r.role : '') + ', ' + stageLabel,
        draggable: 'true',
        style: { border: '1px solid var(--slate)', borderRadius: 'var(--radius-sm)', background: 'var(--elev)', padding: '8px 10px', cursor: 'grab' },
      }, [
        c('div', { style: { display: 'flex', gap: '6px', alignItems: 'baseline' } }, [
          c('span', { className: 'v2-chip v2-track-chip-muted', style: { flex: 'none' } }, '#' + (r.num || '?')),
          c('strong', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13.5px' }, title: r.company || '' }, r.company || '—'),
        ]),
        r.role ? c('div', { style: { fontSize: '12.5px', color: 'var(--foggy-strong)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.role }, r.role) : null,
        c('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' } }, [
          c('span', { className: 'score-pill ' + scoreCls, style: { flex: 'none' } }, r.score || '—'),
          c('span', { className: 'v2-chip v2-track-nowrap', style: { flex: 'none' } }, r.date || ''),
          r.pdfReady ? c('span', { className: 'v2-chip', title: t('track.col.pdf', 'PDF'), style: { flex: 'none' } }, '✓ PDF') : null,
          moveBtn,
        ].filter(Boolean)),
      ]);
      el.addEventListener('dragstart', (e) => {
        dragNum = r.num;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(r.num ?? ''));
          e.dataTransfer.effectAllowed = 'move';
        }
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => {
        dragNum = null;
        el.style.opacity = '';
      });
      return el;
    }
  }

  // Module-scoped drag payload. dataTransfer.getData() is unread during
  // dragover, so the in-flight card's # is kept here for the guard checks.
  let dragNum = null;

  // ── CAR-117 · move dialog (single + bulk share one previewed path) ────────
  // opts: { rows, presetTo, stages, fold, t, onApplied }
  // presetTo (a drop target or a bulk pick) skips the selector step. Every
  // destructive target passes UI.confirm BEFORE the preview can be written;
  // the preview itself always precedes the write.
  function openMoveDialog(opts) {
    const c = UI.el;
    const t = opts.t;
    const fold = opts.fold;
    const targets = writableStates(opts.stages);
    if (!targets.length || !opts.rows.length) return;
    if (opts.movesReady === false) {
      UI.toast(t('track.kanbanMovesOff', 'Status moves are unavailable — the outcome recorder was not found in the parent project.'), 'error');
      return;
    }

    // Localized stage label via a composed key. The key is built in a
    // variable first so the static t('…') coverage scan sees no phantom
    // 'track.status.' literal (same trick as the view's statusLabel).
    const sl = (s) => {
      const k = 'track.status.' + String(s == null ? '' : s).toLowerCase();
      return t(k, s || '');
    };
    const note = typeof opts.note === 'string' ? opts.note : '';
    const target = (opts.presetTo && isWritableState(opts.presetTo)) ? opts.presetTo : null;

    if (!target) {
      // Step 1 — pick a target (the keyboard path starts here).
      const names = opts.rows.slice(0, 3).map((r) => '#' + (r.num || '?') + ' ' + (r.company || '')).join(', ')
        + (opts.rows.length > 3 ? '…' : '');
      const sel = c('select', {
        className: 'select',
        'aria-label': t('track.moveTargetAria', 'Target status'),
        style: { maxWidth: '260px' },
      }, targets.map((s) => c('option', { value: s }, sl(s))));
      const first = opts.rows[0];
      const initial = targets.find((s) => fold(first.status) !== s);
      sel.value = (initial || targets[0]);
      const noteIn = c('input', { className: 'input', type: 'text', maxLength: 200, placeholder: t('track.moveNote', 'Note (optional, appended to each row)'), 'aria-label': t('track.moveNote', 'Note (optional, appended to each row)') });
      const go = () => {
        const to = sel.value;
        const rows = opts.rows.filter((r) => fold(r.status) !== to);
        if (!rows.length) {
          UI.toast(t('track.moveNoop', 'Selected rows are already in that status'));
          return;
        }
        openMoveDialog({ ...opts, presetTo: to, note: noteIn.value.trim() });
      };
      UI.modal(t('track.moveTitle', 'Move to status'), c('div', { style: { display: 'grid', gap: '10px', minWidth: '280px' } }, [
        c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, names),
        c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [sel, noteIn]),
        c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: 0 } }, t('track.kanbanMoveHint', 'Drag a card to another column or press Move — the change is previewed before anything is written.')),
        c('div', { style: { display: 'flex', gap: '8px' } }, [
          c('button', { className: 'btn btn-primary', type: 'button', onClick: go }, t('track.movePreview', 'Preview move')),
        ]),
      ]));
      return;
    }

    // Step 2 — the preview. Nothing is written before this is shown.
    const moves = opts.rows
      .filter((r) => fold(r.status) !== target)
      .map((r) => ({ row: r, from: fold(r.status), to: target }));
    if (!moves.length) {
      UI.toast(t('track.moveNoop', 'Selected rows are already in that status'));
      return;
    }
    const destructive = (target === 'Rejected' || target === 'Discarded');
    const nonUndoable = moves.filter((m) => !isWritableState(m.from));
    const list = c('ul', {
      style: { margin: '0', paddingLeft: '18px', maxHeight: '240px', overflowY: 'auto', fontSize: '13px' },
    }, moves.map((m) => c('li', { style: { margin: '2px 0' } },
      t('track.moveLine', '#{num} {company} — {role}: {from} → {to}')
        .replace('{num}', String(m.row.num ?? '?'))
        .replace('{company}', m.row.company || '—')
        .replace('{role}', m.row.role || '—')
        .replace('{from}', sl(m.from))
        .replace('{to}', sl(target)))));

    const applyBtn = c('button', {
      className: 'btn ' + (destructive ? 'btn-danger' : 'btn-primary'),
      type: 'button',
    }, t('track.moveApply', 'Move {n}').replace('{n}', String(moves.length)));

    const body = c('div', { style: { display: 'grid', gap: '10px', minWidth: '320px' } }, [
      c('strong', null, t('track.movePreviewTitle', 'Preview — {n} row(s) to {state}')
        .replace('{n}', String(moves.length))
        .replace('{state}', sl(target))),
      list,
      nonUndoable.length
        ? c('p', { style: { fontSize: '12.5px', color: 'var(--foggy)', margin: 0 } },
          t('track.moveNoUndo', 'Moves out of {state} cannot be undone automatically — the status writer only records outcomes.')
            .replace('{state}', sl(nonUndoable[0].from)))
        : null,
      note ? c('p', { style: { fontSize: '12.5px', color: 'var(--foggy)', margin: 0 } }, t('track.moveNote', 'Note (optional, appended to each row)') + ': ' + note) : null,
      c('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
        c('button', {
          className: 'btn btn-ghost', type: 'button',
          onClick: () => openMoveDialog({ ...opts, presetTo: null, note }),
        }, t('track.moveBack', 'Back')),
        applyBtn,
      ]),
    ].filter(Boolean));

    applyBtn.addEventListener('click', async () => {
      const run = async () => {
        UI.closeModal();
        const res = await applyMoves({ moves, note, onProgress: opts.onProgress });
        opts.onApplied(res, moves, target);
      };
      if (destructive) {
        const ok = await UI.confirm(
          t('track.moveConfirmTitle', 'Record {n} outcome(s)?').replace('{n}', String(moves.length)),
          t('track.moveConfirmBody', 'This records an outcome entry for every listed row and rewrites data/applications.md in the parent project. You reviewed the preview — continue?'),
          { danger: true, confirmLabel: t('track.moveConfirmOk', 'Write moves'), cancelLabel: t('common.cancel', 'Cancel') },
        );
        if (!ok) {
          // The confirm replaced this dialog; re-open it on the preview step.
          openMoveDialog({ ...opts, presetTo: target, note });
          return;
        }
      }
      await run();
    });

    UI.modal(t('track.moveTitle', 'Move to status'), body);
  }

  // Sequential per-row writes through the EXISTING outcome relay. set-status
  // takes the shared tracker lock, so parallel spawns would only contend.
  async function applyMoves(opts) {
    let done = 0;
    let failed = 0;
    let firstError = '';
    for (const m of opts.moves) {
      try {
        const res = await API.post('/api/outcome', {
          selector: String(m.row.num ?? ''),
          type: MOVES[m.to],
          note: opts.note || undefined,
          role: m.row.role || '',
        });
        if (!res || res.ok === false) throw new Error((res && res.error) || 'outcome failed');
        m.row.status = m.to;
        done += 1;
      } catch (e) {
        failed += 1;
        if (!firstError) firstError = (e && e.message) || 'outcome failed';
      }
      if (opts.onProgress) opts.onProgress(done + failed, opts.moves.length);
    }
    return { done, failed, firstError };
  }

  // ── CAR-117 · undo bar (session-scoped, body-level, pipeline-v2 shape) ────
  // deps: { t, onUndo } — onUndo is invoked with no args; the owner re-reads
  // the queue. The SHELL element is a singleton (#tracker-undo-bar, created
  // once and reused across view visits, exactly like the pipeline bar); the
  // buttons are rebuilt on every show so they always close over the CURRENT
  // controller. Returns { el, show, hide, busy, focusUndo }.
  function createUndoBar(deps) {
    const c = UI.el;
    const t = deps.t;
    let timer = 0;
    let btn = null;
    let undoCb = deps.onUndo;
    let el = null;
    try { el = document.getElementById('tracker-undo-bar'); } catch { el = null; }
    if (!el) {
      el = c('div', { id: 'tracker-undo-bar', className: 'v2-undo-bar', hidden: 'hidden' });
      document.body.appendChild(el);
    }
    function hide() {
      clearTimeout(timer);
      el.hidden = true;
    }
    function build(msg) {
      el.textContent = '';
      const label = c('span', { className: 'v2-undo-msg' }, msg);
      btn = c('button', {
        id: 'tracker-undo-btn',
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        onClick: () => { if (undoCb) undoCb(); },
      }, t('track.undoBtn', 'Undo'));
      const dismiss = c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        'aria-label': t('track.undoDismiss', 'Dismiss'),
        onClick: hide,
      }, '✕');
      el.appendChild(label);
      el.appendChild(btn);
      el.appendChild(dismiss);
    }
    function show(n, stateLabel) {
      build(t('track.undoMsg', 'Moved {n} row(s) to {state}')
        .replace('{n}', String(n)).replace('{state}', stateLabel));
      el.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(hide, 8000);
    }
    function busy(b) {
      if (!btn) return;
      btn.disabled = Boolean(b);
      btn.textContent = b ? t('track.undoBusy', 'Undoing…') : t('track.undoBtn', 'Undo');
    }
    function focusUndo() {
      if (btn) { try { btn.focus(); } catch { /* detached */ } }
    }
    return { el, show, hide, busy, focusUndo };
  }

  // ── view helpers moved from tracker.js (CAR-117 split; unchanged logic) ───

  // v1.190.0 — "Company history" evidence panel (read-only lookup over
  // GET /api/stats/company-history). Returns null on an empty tracker.
  function companyHistoryCard(rows, c, t) {
    const companies = [...new Set(
      (Array.isArray(rows) ? rows : []).map((r) => (r && r.company ? String(r.company).trim() : '')).filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));
    if (!companies.length) return null;

    const sel = c('select', { className: 'select', style: { maxWidth: '280px' }, 'aria-label': t('scan.col.company', 'Company') },
      companies.map((name) => c('option', { value: name }, name)));
    const btn = c('button', { className: 'btn btn-primary', type: 'button' }, t('track.histLookup', 'Look up'));
    const out = c('div', { style: { marginTop: '12px' } });

    btn.addEventListener('click', async () => {
      const company = sel.value;
      if (!company) return;
      btn.disabled = true;
      out.textContent = '';
      out.appendChild(c('div', { className: 'loading' }, t('track.histLoading', 'Reading the evidence…')));
      try {
        const res = await API.get('/api/stats/company-history?company=' + encodeURIComponent(company));
        out.textContent = '';
        if (!res || res.available === false) {
          out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
            t('track.histUnavailable', 'Company history is unavailable here — the parent career-ops company-history script was not found.')));
          return;
        }
        out.appendChild(companyHistoryEvidence(res, c, t));
      } catch (err) {
        out.textContent = '';
        out.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } },
          (err && err.message) || t('track.histFailed', 'Could not load company history')));
      } finally {
        btn.disabled = false;
      }
    });

    return c('div', { className: 'card mb-3' }, [
      c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('track.histTitle', 'Company history')),
      c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } },
        t('track.histHelp', 'Per-company evidence — how responsive a company has been to you, and whether the same role keeps getting reposted. Read-only; joins your tracker, follow-ups, and scan history.')),
      c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, [sel, btn]),
      out,
    ]);
  }

  // Render one company card ({ company, responsiveness, postingChurn, explanations }).
  function companyHistoryEvidence(card, c, t) {
    const resp = card.responsiveness || {};
    const churn = card.postingChurn || {};
    const RESP = {
      'silent-on-you': [t('track.histSilent', 'Silent on you'), 'badge badge-warn'],
      mixed: [t('track.histMixed', 'Mixed'), 'badge badge-info'],
      'responded-before': [t('track.histResponded', 'Responded before'), 'badge badge-ok'],
      'no-history': [t('track.histNoHistory', 'No history yet'), 'badge'],
    };
    const CHURN = {
      'reposts-detected': [t('track.histReposts', 'Reposts detected'), 'badge badge-warn'],
      'none-detected': [t('track.histNoReposts', 'No reposts'), 'badge'],
      'no-scan-data': [t('track.histNoScan', 'No scan data'), 'badge'],
    };
    const r = RESP[resp.label] || RESP['no-history'];
    const ch = CHURN[churn.label] || CHURN['no-scan-data'];
    const facts = Array.isArray(resp.facts) ? resp.facts : [];
    const silent = facts.filter((f) => f && 'silentDays' in f);
    const clusters = Array.isArray(churn.clusters) ? churn.clusters : [];

    const kids = [
      c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px' } }, [
        c('strong', null, String(card.company || '—')),
        c('span', { className: r[1] }, r[0]),
        c('span', { className: ch[1] }, ch[0]),
      ]),
    ];
    if (silent.length) {
      kids.push(c('p', { style: { fontSize: '13px', margin: '0 0 6px' } },
        t('track.histSilentCount', '{n} application(s) silent past your follow-up window:').replace('{n}', String(silent.length))));
      const ul = c('ul', { style: { margin: '0 0 8px', paddingLeft: '18px' } });
      for (const f of silent) {
        ul.appendChild(c('li', { style: { fontSize: '13px' } },
          `#${String(f.num)} · ${String(f.appliedDate || '')} · ${t('track.histDaysSilent', '{n}d silent').replace('{n}', String(f.silentDays))} · ${t('track.histFollowups', '{n} follow-ups').replace('{n}', String(f.followupsSent || 0))}`));
      }
      kids.push(ul);
    }
    if (clusters.length) {
      kids.push(c('p', { style: { fontSize: '13px', margin: '0 0 6px' } },
        t('track.histRepostCount', '{n} role(s) reposted:').replace('{n}', String(clusters.length))));
      const ul = c('ul', { style: { margin: '0 0 8px', paddingLeft: '18px' } });
      for (const cl of clusters) {
        ul.appendChild(c('li', { style: { fontSize: '13px' } },
          `${String(cl.role || '')} · ${String(cl.repostCount || 0)}× · ${String(cl.daysSpan || 0)}d · ${t('track.histLastSeen', 'last {d}').replace('{d}', String(cl.lastSeen || ''))}`));
      }
      kids.push(ul);
    }
    for (const e of (Array.isArray(card.explanations) ? card.explanations : [])) {
      kids.push(c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0' } }, String(e)));
    }
    return c('div', { className: 'card', style: { padding: '12px', marginTop: '4px' } }, kids);
  }

  // --- Liveness badge (#/tracker) -------------------------------------------
  // A zero-token "still live?" check for ATS-hosted postings; the client
  // mirrors the server's ATS host/path recognition.
  function isAtsPostingUrl(raw) {
    let u;
    try { u = new URL(raw); } catch { return false; }
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    const p = u.pathname;
    // Greenhouse: boards[.eu].greenhouse.io/{board}/jobs/{numericId}
    if (/(^|\.)greenhouse\.io$/.test(h) && /^\/[^/]+\/jobs\/\d+\/?$/.test(p)) return true;
    // Lever: jobs[.eu].lever.co/{slug}/{id}
    if (/^jobs\.(?:eu\.)?lever\.co$/.test(h) && /^\/[^/]+\/[^/?#]+\/?$/.test(p)) return true;
    // Ashby: jobs.ashbyhq.com/{org}/{jobId}[/application]
    if (h === 'jobs.ashbyhq.com' && /^\/[^/]+\/[^/]+(?:\/application)?\/?$/.test(p)) return true;
    // Workday: {tenant}.{wd?}.myworkdayjobs.com[/xx-XX]/{site}/job/{jobPath}
    if (/\.myworkdayjobs\.com$/.test(h) && /\/job\//.test(p)) return true;
    // SmartRecruiters: jobs.smartrecruiters.com/{company}/{numericId}[-slug]
    if (h === 'jobs.smartrecruiters.com' && /^\/[^/]+\/\d+/.test(p)) return true;
    return false;
  }

  function livenessAffordance(url, rowKey) {
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);
    if (!url || !isAtsPostingUrl(url)) return null;

    const wrap = c('span', { className: 'liveness-wrap', style: { marginLeft: '6px' } });
    const pill = (labelKey, fallback, cls, reason) => c('span', {
      className: 'badge ' + cls,
      title: reason || '',
    }, t(labelKey, fallback));

    const btn = c('button', {
      className: 'btn btn-ghost btn-sm',
      type: 'button',
      style: { padding: '0 8px', fontSize: '11px' },
      'data-key': String(rowKey ?? ''),
      'aria-label': t('track.liveCheckAria', 'Check whether this job posting is still live'),
      title: t('track.liveCheckAria', 'Check whether this job posting is still live'),
    }, t('track.liveCheck', 'Still live?'));

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = t('track.liveChecking', 'Checking…');
      try {
        const res = await API.get('/api/liveness?url=' + encodeURIComponent(url));
        const status = (res && res.result) || 'uncertain';
        wrap.textContent = '';
        if (status === 'live') {
          wrap.appendChild(pill('track.liveLive', 'Live', 'badge-ok', res && res.reason));
        } else if (status === 'expired') {
          wrap.appendChild(pill('track.liveExpired', 'Expired', 'badge-bad', res && res.reason));
        } else {
          wrap.appendChild(pill('track.liveUncertain', 'Unknown', 'badge-warn', res && res.reason));
        }
      } catch (e) {
        wrap.textContent = '';
        wrap.appendChild(pill('track.liveUncertain', 'Unknown', 'badge-warn', (e && e.message) || ''));
      }
    });

    wrap.appendChild(btn);
    return wrap;
  }

  // ── CAR-117 · view controllers ────────────────────────────────────────────
  // tracker.js sits against the 800-LOC contract, so the stateful view
  // controllers live here as factories and the view wires them together.
  // Each factory owns one concern and talks to the view only through the
  // callbacks it is given.

  // View toggle (Table | Kanban). Owns the persistence key + aria-pressed
  // state; `onChange` fires only when the mode actually changed. The default
  // is the table view (least surprise; the browser suites pin it).
  function createViewToggle(opts) {
    const c = UI.el;
    const t = opts.t;
    const KEY = 'career-ops-ui:tracker-view';
    let mode = opts.initial || 'table';
    try {
      if (localStorage.getItem(KEY) === 'kanban') mode = 'kanban';
    } catch { /* storage unavailable (private mode) — table default stands */ }
    const btnTable = c('button', {
      type: 'button',
      className: 'btn btn-sm v2-viewbtn',
      'aria-pressed': 'true',
      onClick: () => { if (set('table') && opts.onChange) opts.onChange('table'); },
    }, t('track.viewTable', 'Table'));
    const btnKanban = c('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm v2-viewbtn',
      'aria-pressed': 'false',
      onClick: () => { if (set('kanban') && opts.onChange) opts.onChange('kanban'); },
    }, t('track.viewKanban', 'Kanban'));
    function apply() {
      const tableActive = mode === 'table';
      btnTable.className = 'btn btn-sm v2-viewbtn' + (tableActive ? '' : ' btn-ghost');
      btnKanban.className = 'btn btn-sm v2-viewbtn' + (tableActive ? ' btn-ghost' : '');
      btnTable.setAttribute('aria-pressed', tableActive ? 'true' : 'false');
      btnKanban.setAttribute('aria-pressed', tableActive ? 'false' : 'true');
    }
    function set(m) {
      if (mode === m) return false;
      mode = m;
      try { localStorage.setItem(KEY, mode); } catch { /* private mode */ }
      apply();
      return true;
    }
    apply();
    return {
      el: c('div', {
        className: 'v2-toolbar',
        role: 'group',
        'aria-label': t('track.viewAria', 'Board layout'),
      }, [btnTable, btnKanban]),
      mode: () => mode,
    };
  }

  // Bulk selection bar (table view): checkbox column plumbing + the
  // "N selected → Move to …" bar. Selection survives paging and filtering;
  // Move hands the movable rows to `onPick` (the same previewed move dialog
  // as drag&drop — one write path).
  // opts: { t, stages, statusLabel, fold, onPick(rows, target), onChanged }
  function createBulkBar(opts) {
    const c = UI.el;
    const t = opts.t;
    const selection = new Set();
    let pageRows = [];
    const byNum = new Map();

    const count = c('strong', { className: 'v2-bulk-count', style: { fontVariantNumeric: 'tabular-nums' } }, '0');
    const progress = c('span', { role: 'status', 'aria-live': 'polite', className: 'v2-bulk-progress' });
    const target = c('select', {
      className: 'select',
      'aria-label': t('track.bulkTargetAria', 'Target status for the selected rows'),
      style: { maxWidth: '190px' },
    }, writableStates(opts.stages).map((s) => c('option', { value: s }, opts.statusLabel(s))));
    const moveBtn = c('button', {
      className: 'btn btn-primary btn-sm', type: 'button',
      onClick: () => {
        const to = target.value;
        const picked = [...selection].map((k) => byNum.get(k)).filter(Boolean);
        const movable = picked.filter((r) => opts.fold(r.status) !== to);
        if (!movable.length || !to) {
          UI.toast(t('track.moveNoop', 'Selected rows are already in that status'));
          return;
        }
        opts.onPick(movable, to);
      },
    }, t('track.bulkMove', 'Move'));
    const clearBtn = c('button', {
      className: 'btn btn-ghost btn-sm', type: 'button',
      onClick: () => { selection.clear(); if (opts.onChanged) opts.onChanged(); },
    }, t('track.bulkClear', 'Clear'));
    const bar = c('div', {
      className: 'v2-bulkbar mb-3', hidden: 'hidden',
      role: 'group', 'aria-label': t('track.bulkMove', 'Move'),
    }, [count, c('span', null, t('track.bulkSelected', '{n} selected').replace('{n}', '')), target, moveBtn, progress, clearBtn]);

    const selAll = c('input', {
      type: 'checkbox',
      'aria-label': t('track.bulkSelectAll', 'Select all rows on this page'),
    });
    selAll.addEventListener('change', () => {
      for (const r of pageRows) {
        if (selAll.checked) selection.add(String(r.num));
        else selection.delete(String(r.num));
      }
      if (opts.onChanged) opts.onChanged();
    });

    function checkCell(r) {
      const cb = c('input', {
        type: 'checkbox',
        className: 'v2-track-check',
        'data-key': String(r.num ?? ''),
        'aria-label': t('track.bulkSelectRow', 'Select row #{num}').replace('{num}', String(r.num ?? '')),
      });
      cb.checked = selection.has(String(r.num));
      cb.addEventListener('change', () => {
        const k = String(r.num);
        if (cb.checked) selection.add(k);
        else selection.delete(k);
        sync();
        syncSelAll();
      });
      return cb;
    }

    function sync() {
      count.textContent = String(selection.size);
      bar.hidden = selection.size === 0;
    }

    function syncSelAll() {
      const n = pageRows.filter((r) => selection.has(String(r.num))).length;
      selAll.checked = pageRows.length > 0 && n === pageRows.length;
      selAll.indeterminate = n > 0 && n < pageRows.length;
    }

    return {
      el: bar,
      selAll,
      checkCell,
      setRows(all) { byNum.clear(); for (const r of all) byNum.set(String(r.num), r); },
      setPage(rows) { pageRows = rows || []; },
      syncSelAll,
      progress(text) { progress.textContent = text || ''; },
      reset() { selection.clear(); sync(); },
      size: () => selection.size,
    };
  }

  // Move flow: opens the previewed move dialog and owns the post-write
  // bookkeeping (toasts, undo push, read-only degradation).
  // opts: { t, stages, fold, statusLabel, isReady(), onMovesOff(),
  //         onProgress(done, total), onUndoable(moves, target), onDone() }
  function createMoveFlow(opts) {
    function open(rows, presetTo) {
      openMoveDialog({
        rows,
        presetTo,
        stages: opts.stages,
        fold: opts.fold,
        movesReady: opts.isReady(),
        t: opts.t,
        onProgress: opts.onProgress,
        onApplied: applied,
      });
    }
    function applied(res, moves, target) {
      if (res.firstError && /outcome\.mjs/.test(res.firstError) && opts.onMovesOff) {
        opts.onMovesOff(); // the parent recorder is absent — degrade to read-only
      }
      if (res.done) {
        if (res.failed) {
          UI.toast(opts.t('track.moveFailed', '{n} row(s) could not be moved').replace('{n}', String(res.failed)), 'error');
        }
        UI.toast(
          opts.t('track.moveDone', 'Moved {n} row(s) to {state}')
            .replace('{n}', String(res.done))
            .replace('{state}', opts.statusLabel(target)),
          res.failed ? 'error' : 'success',
        );
        // Undo is offered only when every executed move LEFT a state the
        // outcome writer can re-record; moves out of pipeline-managed columns
        // were already warned about in the preview.
        if (moves.every((m) => isWritableState(m.from)) && opts.onUndoable) opts.onUndoable(moves, target);
        if (opts.onDone) opts.onDone();
      } else if (res.failed) {
        UI.toast(res.firstError
          || opts.t('track.moveFailed', '{n} row(s) could not be moved').replace('{n}', String(res.failed)), 'error');
        if (!opts.isReady() && opts.onDone) opts.onDone();
      }
      // Focus management: the modal that ran the move just closed, dropping
      // focus to <body>. Return it to the first moved row's Move control so a
      // keyboard user stays on the board instead of falling off it. Only
      // steals focus when nothing else already holds it.
      try {
        const num = String((moves[0] && moves[0].row && moves[0].row.num) ?? '');
        const btn = num ? document.querySelector('.v2-track-board .v2-track-move[data-key="' + (window.CSS && CSS.escape ? CSS.escape(num) : num) + '"]') : null;
        if (btn && document.activeElement === document.body) btn.focus();
      } catch { /* detached board */ }
    }
    return { open };
  }

  // Undo controller: bounded LIFO of executed batches + the body-level bar.
  // opts: { t, statusLabel, onRestored() }
  function createUndoController(opts) {
    const queue = createUndoQueue(5);
    const bar = createUndoBar({ t: opts.t, onUndo: () => undo() });
    async function undo() {
      const batch = queue.pop();
      bar.hide();
      if (!batch || !batch.length) return;
      bar.busy(true);
      bar.el.hidden = false;
      let done = 0;
      let failed = 0;
      for (const m of batch) {
        try {
          const res = await API.post('/api/outcome', {
            selector: String(m.row.num ?? ''),
            type: MOVES[m.from],
            role: m.row.role || '',
          });
          if (!res || res.ok === false) throw new Error('undo failed');
          m.row.status = m.from;
          done += 1;
        } catch { failed += 1; }
      }
      bar.busy(false);
      bar.hide();
      UI.toast(failed
        ? opts.t('track.undoFail', '{n} row(s) could not be restored').replace('{n}', String(failed))
        : opts.t('track.undoDone', 'Restored {n} row(s)').replace('{n}', String(done)),
      failed ? 'error' : 'success');
      if (opts.onRestored) opts.onRestored();
    }
    function push(moves, target) {
      queue.push(moves);
      bar.show(moves.length, opts.statusLabel(target));
      bar.focusUndo();
    }
    return { push, undo, bar };
  }

  return {
    norm: norm,
    foldStatus: foldStatus,
    stageCounts: stageCounts,
    MOVES: MOVES,
    isWritableState: isWritableState,
    writableStates: writableStates,
    createUndoQueue: createUndoQueue,
    kanbanBoard: kanbanBoard,
    openMoveDialog: openMoveDialog,
    applyMoves: applyMoves,
    createUndoBar: createUndoBar,
    createViewToggle: createViewToggle,
    createBulkBar: createBulkBar,
    createMoveFlow: createMoveFlow,
    createUndoController: createUndoController,
    companyHistoryCard: companyHistoryCard,
    companyHistoryEvidence: companyHistoryEvidence,
    isAtsPostingUrl: isAtsPostingUrl,
    livenessAffordance: livenessAffordance,
  };
})();

/* global Router, API, UI, I18n, FocusPreserved */
/**
 * #/tasks — the «Career tasks» personal kanban board (Growth group).
 *
 * A private task board in the style of the tracker funnel board: three
 * columns — Backlog / In Progress / Done — cards drag left-to-right, each
 * column shows a live count. Every change persists immediately (no
 * unsaved-guard), one canonical request per user action:
 *
 *   GET    /api/tasks            → {tasks:[…]} newest-updated first
 *   POST   /api/tasks            → 201 {task}   (create; server defaults status)
 *   PUT    /api/tasks/:id        → {task}       (status/title/notes/priority/tags)
 *   DELETE /api/tasks/:id        → {ok:true}
 *
 * Drag & drop follows the proven tracker-kanban mechanics (lib/tracker-kanban.js):
 * module-of-call drag payload (DataTransfer is unread during dragover), drop-target
 * outline on the hovered column, optimistic move that only reverts on failure,
 * keyboard as a first-class path (←/→ move, Enter opens the card), and a status
 * <select> on every card as the no-drag / mobile mover. One canonical PUT per move;
 * concurrent moves of the SAME task are ignored (in-flight guard).
 *
 * Pure helpers (unit-tested in a synthetic realm by tests/tasks-kanban.test.mjs):
 * parseTags, moveTarget, moveTask. The DOM board itself is gated in a real
 * browser (tests/playwright-career-tasks.mjs, mocked API).
 *
 * CSP-safe: UI.el + addEventListener + textContent only — no raw HTML, no
 * inline handlers. Reuses the funnel-* kanban stylesheet (public/css/kanban.css)
 * so the board inherits the drop-outline, dimmed-drag and mobile-strip styles.
 */
window.TasksView = (function () {
  'use strict';

  // The pinned status/priority vocabularies (server contract).
  const STATUSES = ['backlog', 'in-progress', 'done'];
  const PRIORITIES = ['high', 'normal', 'low'];
  const MAX_TAGS = 8;    // POST contract: tags ≤ 8 strings
  const MAX_TITLE = 200; // POST contract: title 1..200

  function statusLabel(t, status) {
    if (status === 'in-progress') return t('tasks.col.inProgress', 'In Progress');
    if (status === 'done') return t('tasks.col.done', 'Done');
    return t('tasks.col.backlog', 'Backlog');
  }

  function priorityLabel(t, priority) {
    if (priority === 'high') return t('tasks.prio.high', 'High');
    if (priority === 'low') return t('tasks.prio.low', 'Low');
    return t('tasks.prio.normal', 'Normal');
  }

  // The priority dot: warn for high, neutral for normal, muted for low.
  // Role-token discipline: --cv3-warn/--foggy-strong/--foggy are palette
  // values (declared in tokens-v3.css / app.css), not TEXT-role aliases, so
  // a fill is allowed (tests/css-role-tokens scans --warn, not --cv3-warn).
  function priorityDotColor(priority) {
    if (priority === 'high') return 'var(--cv3-warn)';
    if (priority === 'low') return 'var(--foggy)';
    return 'var(--foggy-strong)';
  }

  // "a, b, c" → ['a', 'b', 'c'] — trimmed, empty parts dropped, case-insensitive
  // duplicates collapsed, capped at MAX_TAGS (the POST contract limit).
  function parseTags(raw) {
    const seen = new Set();
    const out = [];
    for (const part of String(raw == null ? '' : raw).split(',')) {
      const tag = part.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
      if (out.length >= MAX_TAGS) break;
    }
    return out;
  }

  // Keyboard move target: the neighbour column for ArrowLeft/ArrowRight,
  // null at either end (no wraparound — left-to-right is the workflow).
  function moveTarget(from, key) {
    const idx = STATUSES.indexOf(from);
    if (idx === -1) return null;
    if (key === 'ArrowRight') return idx < STATUSES.length - 1 ? STATUSES[idx + 1] : null;
    if (key === 'ArrowLeft') return idx > 0 ? STATUSES[idx - 1] : null;
    return null;
  }

  // ── The move controller (optimistic + revert, the tracker-kanban pattern) ──
  // moveTask({ task, to, put, t, onApplied, onReverted }):
  //   task — mutated in place; the board re-renders through onApplied
  //   put  — injected so tests drive the failure (defaults to API.put)
  // Captures prevStatus FIRST (the pre-drag snapshot), mutates optimistically,
  // notifies, then writes ONE canonical PUT. On failure: restore the snapshot,
  // notify, toast. Concurrent moves of the SAME task are ignored; a same-column
  // drop and an unknown status are no-ops — never a write.
  const inFlight = new Set();
  function moveTask(opts) {
    const task = opts.task;
    const to = opts.to;
    const put = opts.put || ((window.API && API.put) || null);
    const t = opts.t || ((k, f) => f);
    if (!task || task.id == null || !to || !put) return Promise.resolve(false);
    if (!STATUSES.includes(to)) return Promise.resolve(false);
    const from = String(task.status == null ? 'backlog' : task.status);
    if (from === to) return Promise.resolve(false); // same-column drop is a no-op
    const key = String(task.id);
    if (inFlight.has(key)) return Promise.resolve(false); // one write per task at a time
    inFlight.add(key);
    task.status = to; // optimistic — the board re-renders through onApplied
    if (opts.onApplied) opts.onApplied(task, from, to);
    return Promise.resolve()
      .then(() => put('/api/tasks/' + encodeURIComponent(key), { status: to }))
      .then((res) => {
        inFlight.delete(key);
        const served = res && res.task;
        if (served && typeof served === 'object') Object.assign(task, served);
        UI.toast(t('tasks.moved', 'Moved to {state}').replace('{state}', statusLabel(t, to)), 'success');
        return true;
      })
      .catch(() => {
        inFlight.delete(key);
        task.status = from; // revert to the captured snapshot
        if (opts.onReverted) opts.onReverted(task, from, to);
        UI.toast(t('tasks.moveFailed', 'The move did not stick — reverted'), 'error');
        return false;
      });
  }

  // ── The page ───────────────────────────────────────────────────────────────
  Router.register('tasks', async function tasksView() {
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);

    const root = c('div');
    root.appendChild(c('h1', { className: 'page-title' }, t('tasks.title', 'Career tasks')));
    root.appendChild(c('p', { className: 'page-subtitle' },
      t('tasks.subtitle', 'A personal kanban board — drag tasks from Backlog through In Progress to Done.')));

    // Load the board. A failed GET is surfaced (never swallowed into an
    // empty-looking board) with a localized Retry that re-runs the route.
    let tasks = [];
    let loaded = false;
    let loadError = null;
    try {
      const res = await API.get('/api/tasks');
      tasks = (res && Array.isArray(res.tasks) ? res.tasks : []).filter((x) => x && x.id != null);
      loaded = true;
    } catch (e) {
      loadError = (e && e.message) || String(e);
    }
    if (!loaded) {
      const retry = c('button', { className: 'btn btn-ghost mt-3', type: 'button' }, t('tasks.retry', 'Retry'));
      retry.addEventListener('click', () => { Router.render(); });
      root.appendChild(c('div', { className: 'empty' }, [
        c('p', { style: { color: 'var(--danger)' } }, t('tasks.error', 'Could not load tasks')),
        loadError ? c('p', { style: { color: 'var(--foggy)', fontSize: '12px' } }, loadError) : null,
        retry,
      ]));
      return root;
    }

    const byId = (id) => tasks.find((x) => String(x.id) === String(id)) || null;
    const statusOf = (task) => (STATUSES.includes(task.status) ? task.status : 'backlog');
    const boardHost = c('div');
    let dragId = null;   // module-of-call payload: dataTransfer is unread during dragover
    let dragDone = false; // suppress the click that some browsers fire after a drop

    function move(task, to) {
      moveTask({
        task,
        to,
        t,
        onApplied: () => { renderBoard(); },
        onReverted: () => { renderBoard(); },
      });
    }

    function renderBoard() {
      const rebuild = () => {
        boardHost.textContent = '';
        boardHost.appendChild(buildBoard());
      };
      if (window.FocusPreserved) window.FocusPreserved.withFocusPreserved(boardHost, rebuild);
      else rebuild();
    }

    function buildBoard() {
      const board = c('div', {
        className: 'funnel-board',
        role: 'list',
        'aria-label': t('tasks.title', 'Career tasks'),
      });
      for (const status of STATUSES) board.appendChild(buildColumn(status));
      return board;
    }

    function buildColumn(status) {
      const items = tasks.filter((x) => statusOf(x) === status);
      const label = statusLabel(t, status);

      const empty = c('div', { className: 'funnel-empty' }, t('tasks.empty', 'No tasks here yet'));
      const host = c('div', {
        className: 'funnel-cards',
        role: 'list',
        'aria-label': label,
        'data-stage': status,
      });
      for (const task of items) host.appendChild(card(task, status));
      if (!items.length) host.appendChild(empty);

      const count = c('span', {
        className: 'funnel-col-count',
        'aria-live': 'polite',
      }, String(items.length));
      const addBtn = c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm funnel-iconbtn',
        'data-stage': status,
        'aria-label': t('tasks.add', 'Add task'),
        title: t('tasks.add', 'Add task'),
      }, '+');
      addBtn.addEventListener('click', () => openCreateModal(status));

      const col = c('div', {
        className: 'funnel-col',
        'data-stage': status,
      }, [
        c('div', { className: 'funnel-colhdr' }, [
          c('span', { className: 'funnel-col-label', title: label }, label),
          count,
          addBtn,
        ]),
        host,
      ]);

      host.addEventListener('dragover', (e) => {
        if (dragId == null) return; // no drop candidate → never accept
        const task = byId(dragId);
        if (!task) return;
        if (statusOf(task) === status) return; // same-column hover is refused
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        col.classList.add('is-drop-target');
        if (!items.length) empty.textContent = t('kanban.dropHere', 'Drop to move here');
      });
      host.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && (host === e.relatedTarget || host.contains(e.relatedTarget))) return;
        col.classList.remove('is-drop-target');
        if (!items.length) empty.textContent = t('tasks.empty', 'No tasks here yet');
      });
      host.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('is-drop-target');
        if (!items.length) empty.textContent = t('tasks.empty', 'No tasks here yet');
        const id = dragId != null ? dragId : ((e.dataTransfer && e.dataTransfer.getData('text/plain')) || null);
        dragId = null;
        const task = byId(id);
        if (!task) return;
        if (statusOf(task) === status) return; // re-check before any write
        move(task, status);
      });
      return col;
    }

    function card(task, status) {
      const prio = PRIORITIES.includes(task.priority) ? task.priority : 'normal';
      const tags = Array.isArray(task.tags) ? task.tags.slice(0, MAX_TAGS) : [];
      const el = c('div', {
        className: 'funnel-card',
        role: 'listitem',
        tabIndex: 0,
        draggable: 'true',
        'data-id': String(task.id ?? ''),
        'data-key': 'task-' + String(task.id ?? ''),
        'aria-label': (task.title || '—') + ' — ' + statusLabel(t, status),
      }, [
        c('div', { className: 'funnel-card-top' }, [
          c('span', {
            'aria-hidden': 'true',
            title: priorityLabel(t, prio),
            style: {
              flex: 'none',
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              display: 'inline-block',
              background: priorityDotColor(prio),
            },
          }),
          c('strong', { className: 'funnel-company', title: task.title || '' }, task.title || '—'),
        ]),
        c('div', { className: 'funnel-meta' }, [
          c('span', { className: 'dash-chip' }, priorityLabel(t, prio)),
        ].concat(tags.map((tg) => c('span', { className: 'dash-chip' }, tg)))),
        statusSelect(task),
      ].filter(Boolean));

      el.addEventListener('dragstart', (e) => {
        dragId = String(task.id ?? '');
        dragDone = true;
        el.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(task.id ?? ''));
          e.dataTransfer.effectAllowed = 'move';
        }
      });
      el.addEventListener('dragend', () => {
        dragId = null;
        setTimeout(() => { dragDone = false; }, 0);
        el.classList.remove('is-dragging');
        for (const col of boardHost.querySelectorAll('.funnel-col.is-drop-target')) {
          col.classList.remove('is-drop-target');
        }
      });
      el.addEventListener('click', (e) => {
        // The card's own select (and any future button) owns its clicks.
        if (e.target.closest('select, button, input, textarea, label')) return;
        if (dragDone) return; // a drop is not a click
        openDetailsModal(task);
      });
      el.addEventListener('keydown', (e) => {
        if (e.target !== el) return; // keys aimed at the inner select stay there
        if (e.key === 'Enter') {
          e.preventDefault();
          openDetailsModal(task);
          return;
        }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const target = moveTarget(status, e.key);
        if (!target) return;
        move(task, target);
      });
      return el;
    }

    // The no-drag / mobile mover on every card — the same canonical move path
    // as a drop or an arrow key (tracker-kanban fallback mechanics).
    function statusSelect(task) {
      const sel = c('select', {
        className: 'select',
        'data-key': 'task-status-' + String(task.id ?? ''),
        'aria-label': t('kanban.status', 'Status'),
        'data-stage': statusOf(task),
      }, STATUSES.map((s) => c('option', { value: s }, statusLabel(t, s))));
      sel.value = statusOf(task);
      sel.addEventListener('change', () => {
        const target = sel.value;
        moveTask({
          task,
          to: target,
          t,
          onApplied: () => { renderBoard(); },
          onReverted: () => { renderBoard(); },
        }).then((ok) => {
          if (!ok) sel.value = statusOf(task); // ignored move → snap back
        });
      });
      return sel;
    }

    // ── Modals ───────────────────────────────────────────────────────────────
    function openCreateModal(status) {
      const title = c('input', {
        className: 'input', type: 'text', maxLength: MAX_TITLE,
        'aria-label': t('tasks.field.title', 'Title'),
        placeholder: t('tasks.field.title', 'Title'),
      });
      const notes = c('textarea', {
        className: 'input', rows: 3,
        'aria-label': t('tasks.field.notes', 'Notes'),
        placeholder: t('tasks.field.notes', 'Notes'),
      });
      const prio = c('select', { className: 'select', 'aria-label': t('tasks.field.priority', 'Priority') },
        PRIORITIES.map((p) => c('option', { value: p }, priorityLabel(t, p))));
      prio.value = 'normal';
      const tags = c('input', {
        className: 'input', type: 'text',
        'aria-label': t('tasks.field.tags', 'Tags (comma-separated)'),
        placeholder: t('tasks.field.tags', 'Tags (comma-separated)'),
      });
      const st = c('select', { className: 'select', 'aria-label': t('kanban.status', 'Status') },
        STATUSES.map((s) => c('option', { value: s }, statusLabel(t, s))));
      st.value = status;

      const createBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('tasks.add', 'Add task'));
      createBtn.addEventListener('click', async () => {
        const name = title.value.trim();
        if (!name) { title.focus(); return; } // contract: title 1..200
        createBtn.disabled = true;
        try {
          const res = await API.post('/api/tasks', {
            title: name,
            notes: notes.value,
            priority: prio.value,
            tags: parseTags(tags.value),
          });
          const task = (res && res.task) || { id: 'local-' + Date.now(), title: name, status: 'backlog' };
          tasks.unshift(task);
          // The pinned POST contract carries no status — the server default
          // stands; a different preselected column is one canonical follow-up
          // PUT (the same write path a card move uses). A failed follow-up
          // leaves the card where the server created it — the truthful state.
          if (statusOf(task) !== st.value) {
            try {
              const moved = await API.put('/api/tasks/' + encodeURIComponent(String(task.id)), { status: st.value });
              if (moved && moved.task) Object.assign(task, moved.task);
            } catch { /* the create stands */ }
          }
          UI.toast(t('tasks.created', 'Task created'), 'success');
          UI.closeModal();
          renderBoard();
        } catch (err) {
          UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
          createBtn.disabled = false;
        }
      });

      const body = c('div', { className: 'funnel-modal' }, [
        labeledField('tasks-create-title', t('tasks.field.title', 'Title'), title),
        labeledField('tasks-create-notes', t('tasks.field.notes', 'Notes'), notes),
        labeledField('tasks-create-prio', t('tasks.field.priority', 'Priority'), prio),
        labeledField('tasks-create-tags', t('tasks.field.tags', 'Tags (comma-separated)'), tags),
        labeledField('tasks-create-status', t('kanban.status', 'Status'), st),
        c('div', { className: 'funnel-modal-actions' }, [createBtn]),
      ]);
      UI.modal(t('tasks.add', 'Add task'), body);
    }

    function openDetailsModal(task) {
      const title = c('input', {
        className: 'input', type: 'text', maxLength: MAX_TITLE,
        'aria-label': t('tasks.field.title', 'Title'),
      });
      title.value = task.title || '';
      const notes = c('textarea', { className: 'input', rows: 4, 'aria-label': t('tasks.field.notes', 'Notes') });
      notes.value = task.notes || '';
      const prio = c('select', { className: 'select', 'aria-label': t('tasks.field.priority', 'Priority') },
        PRIORITIES.map((p) => c('option', { value: p }, priorityLabel(t, p))));
      prio.value = PRIORITIES.includes(task.priority) ? task.priority : 'normal';
      const tags = c('input', {
        className: 'input', type: 'text',
        'aria-label': t('tasks.field.tags', 'Tags (comma-separated)'),
      });
      tags.value = Array.isArray(task.tags) ? task.tags.join(', ') : '';

      const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('tasks.save', 'Save'));
      saveBtn.addEventListener('click', async () => {
        const name = title.value.trim();
        if (!name) { title.focus(); return; } // contract: title 1..200
        saveBtn.disabled = true;
        try {
          const res = await API.put('/api/tasks/' + encodeURIComponent(String(task.id)), {
            title: name,
            notes: notes.value,
            priority: prio.value,
            tags: parseTags(tags.value),
          });
          if (res && res.task) Object.assign(task, res.task);
          UI.closeModal();
          renderBoard();
        } catch (err) {
          UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
          saveBtn.disabled = false;
        }
      });

      const delBtn = c('button', { className: 'btn btn-danger', type: 'button' }, t('tasks.delete', 'Delete task'));
      delBtn.addEventListener('click', async () => {
        const ok = await UI.confirm(
          t('tasks.delete', 'Delete task'),
          t('tasks.deleteConfirm', 'Delete this task?'),
          { danger: true },
        );
        if (!ok) return;
        try {
          await API.del('/api/tasks/' + encodeURIComponent(String(task.id)));
          tasks = tasks.filter((x) => String(x.id) !== String(task.id));
          UI.closeModal();
          renderBoard();
        } catch (err) {
          UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
        }
      });

      const body = c('div', { className: 'funnel-modal' }, [
        labeledField('tasks-detail-title', t('tasks.field.title', 'Title'), title),
        labeledField('tasks-detail-notes', t('tasks.field.notes', 'Notes'), notes),
        labeledField('tasks-detail-prio', t('tasks.field.priority', 'Priority'), prio),
        labeledField('tasks-detail-tags', t('tasks.field.tags', 'Tags (comma-separated)'), tags),
        c('div', { className: 'funnel-modal-actions', style: { justifyContent: 'space-between' } }, [delBtn, saveBtn]),
      ]);
      UI.modal(t('tasks.modalTitle', 'Task'), body);
    }

    // Label + control pair with a resolved htmlFor IDREF (the a11y-form-wires
    // contract: every literal points at an id declared in THIS file).
    function labeledField(id, labelText, control) {
      control.id = id;
      return c('div', { className: 'funnel-field' }, [
        c('label', { htmlFor: id }, labelText),
        control,
      ]);
    }

    renderBoard();
    root.appendChild(boardHost);
    return root;
  });

  return {
    STATUSES: STATUSES,
    PRIORITIES: PRIORITIES,
    MAX_TAGS: MAX_TAGS,
    MAX_TITLE: MAX_TITLE,
    statusLabel: statusLabel,
    priorityLabel: priorityLabel,
    parseTags: parseTags,
    moveTarget: moveTarget,
    moveTask: moveTask,
  };
})();

/* global window, document, fetch, AbortController, setTimeout, clearTimeout, UI, I18n */
/**
 * llm-page-kit.js — CAR-119, the shared template for the 12 AI-tool pages.
 *
 * One component the LLM views (deep, career-plan, orientation, networking,
 * mock-interview, memory, market, cv-studio, docs-assistant, two-pager,
 * funded, mode-page ×7) consume instead of hand-rolling the same
 * form → button → "Generating…" scaffolding:
 *
 *   LlmPageKit.layout(...)       — two-column page: form (sticky) | result;
 *                                  < 1280 px it collapses to "Input / Result"
 *                                  tabs (CSS + a two-button toggle).
 *   LlmPageKit.createRun(...)    — progress panel: renders SYNCHRONOUSLY on
 *                                  click (visible ≤ 300 ms), stages, live
 *                                  elapsed/ETA line, a role=log aria-live=polite
 *                                  run log, and a keyboard-reachable Cancel
 *                                  wired to an AbortSignal.
 *   LlmPageKit.postJSON(...)     — the cancellable JSON POST transport the run
 *                                  controller hands to the view (API.post has
 *                                  no signal parameter and api.js is not part
 *                                  of CAR-119's file set; hoisting signal
 *                                  support into API.call is the follow-up).
 *   LlmPageKit.jobPicker(...)    — "autofill from tracker": a combobox
 *                                  (input + datalist) over GET /api/tracker
 *                                  that fills company/role fields on pick.
 *   LlmPageKit.historyDrawer(...)— saved-session cards (date, name, preview)
 *                                  for views that already own a save/list
 *                                  endpoint (mock-interview, networking).
 *
 * SAFETY — the auto-start bug class (v1.248.2: auto.js ran a PAID generation
 * from ?go=1 without confirmation): this kit reads no URL parameters, no hash,
 * and fires no request outside an explicit user click handler. Every run
 * begins in a view's button listener.
 *
 * CANCELLATION HONESTY: aborting the signal tears down the browser→app HTTP
 * request (the response is never delivered and the connection closes). The
 * app's LLM relay routes do not yet watch for the closed socket, so the
 * provider call may still finish server-side and its result is discarded —
 * full server-side cancellation (the /api/auto-pipeline pattern, which does
 * thread the signal) is a server change and stays a hand-off.
 *
 * CSP-safe by construction: DOM built only through UI.el / createElement; no
 * innerHTML with data; every user-visible string goes through I18n.t with an
 * EN fallback (the CAR-119 `llm2.*` keys ship EN-fallback only — dictionaries
 * are intentionally not edited in this ticket).
 */
window.LlmPageKit = (function () {
  const t = (k, f) => (window.I18n && window.I18n.t) ? window.I18n.t(k, f) : f;
  const el = (tag, attrs, children) => UI.el(tag, attrs, children);

  // ── pure helpers (unit-tested) ──────────────────────────────────────────

  /** 75 → '1m 15s', 42 → '42s', 0 → '0s'. Used by the live ETA line. */
  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const m = Math.floor(s / 60);
    const rest = s % 60;
    if (m <= 0) return s + 's';
    return m + 'm ' + String(rest).padStart(2, '0') + 's';
  }

  /**
   * Dedup tracker rows into one option per company+role (the most RECENT
   * row wins — rows arrive newest-first), skipping blanks. Pure.
   */
  function dedupTrackerRows(rows) {
    const seen = new Map();
    for (const r of (Array.isArray(rows) ? rows : [])) {
      if (!r) continue;
      const company = String(r.company || '').trim();
      const role = String(r.role || '').trim();
      if (!company && !role) continue;
      const key = (company + '\u0000' + role).toLowerCase();
      if (!seen.has(key)) seen.set(key, { company, role });
    }
    return Array.from(seen.values());
  }

  // ── cancellable JSON transport (API.call conventions, + signal) ─────────

  function currentLang() {
    try { return (window.I18n && window.I18n.getLang && window.I18n.getLang()) || 'en'; }
    catch { return 'en'; }
  }

  async function postJSON(path, body, signal) {
    const lang = currentLang();
    const augmented = (body && typeof body === 'object' && !Array.isArray(body) && body.lang === undefined)
      ? { ...body, lang }
      : body;
    let res;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Language': lang },
        body: JSON.stringify(augmented),
        signal,
      });
    } catch (netErr) {
      if (signal && signal.aborted) { const e = new Error('aborted'); e.aborted = true; throw e; }
      const err = new Error(t('api.netError', 'Network error') + ': ' + ((netErr && netErr.message) || 'Failed to fetch') + ` (POST ${path})`);
      err.network = true;
      throw err;
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      let msg = data.error || res.statusText || ('HTTP ' + res.status);
      if (Array.isArray(data.details) && data.details.length) msg += ' — ' + data.details.join(' · ');
      msg += ` (POST ${path} · HTTP ${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  // ── two-column layout ───────────────────────────────────────────────────

  /**
   * layout({ form, result, t }) → { root, show(name), resultPane }
   *   form / result — ready DOM nodes (form column is sticky on ≥1280 px).
   *   show('form'|'result') — mobile-tab pane switch; on desktop both show.
   */
  function layout({ form, result }) {
    // CAR-119 review #11 — per-instance id suffix (same discipline as
    // jobPicker's listId): two layouts in one document (router transitions,
    // tabbed pages) must never produce duplicate ids.
    const uid = 'llm2-' + Math.random().toString(36).slice(2, 8);
    const tabbar = el('div', { className: 'llm2__tabs', role: 'tablist', 'aria-label': t('llm2.tabsLabel', 'AI tool panels') }, [
      el('button', {
        type: 'button', className: 'llm2__tab is-active', role: 'tab', id: uid + '-tab-form',
        'aria-selected': 'true', 'aria-controls': uid + '-pane-form',
        onClick: () => show('form'),
      }, t('llm2.tabForm', 'Input')),
      el('button', {
        type: 'button', className: 'llm2__tab', role: 'tab', id: uid + '-tab-result',
        'aria-selected': 'false', 'aria-controls': uid + '-pane-result',
        onClick: () => show('result'),
      }, t('llm2.tabResult', 'Result')),
    ]);
    const formPane = el('div', { className: 'llm2__form', role: 'tabpanel', id: uid + '-pane-form', 'aria-labelledby': uid + '-tab-form' }, [form]);
    const resultPane = el('div', { className: 'llm2__result', role: 'tabpanel', id: uid + '-pane-result', 'aria-labelledby': uid + '-tab-result' }, [result]);

    function show(name) {
      const formActive = name !== 'result';
      // ≥1280 px CSS shows both panes regardless of the tab state.
      formPane.hidden = !formActive;
      resultPane.hidden = formActive;
      tabbar.children[0].classList.toggle('is-active', formActive);
      tabbar.children[0].setAttribute('aria-selected', String(formActive));
      tabbar.children[1].classList.toggle('is-active', !formActive);
      tabbar.children[1].setAttribute('aria-selected', String(!formActive));
    }
    const root = el('div', { className: 'llm2' }, [tabbar, formPane, resultPane]);
    // CAR-119 — mobile starts on the Input tab (the Result pane is hidden
    // until its tab is clicked); the ≥1280 px CSS overrides [hidden] so the
    // desktop layout always shows both columns.
    show('form');
    return { root, show, formPane, resultPane };
  }

  // ── run controller: progress / ETA / cancel / log ───────────────────────

  /**
   * createRun({ stages, etaSeconds }) → controller
   *   .begin()         — SYNCHRONOUSLY paints the progress panel (the ≤300 ms
   *                      acceptance criterion: no await precedes the first
   *                      paint), moves focus to the run log, returns true
   *                      (or false when a run is already active).
   *   .stage(i)        — marks stages 0..i-1 done, i active.
   *   .log(line)       — appends a line to the role=log region.
   *   .finish()        — success teardown (panel removed, timer cleared).
   *   .fail(err)       — failure teardown (panel shows the error).
   *   .cancel()        — the Cancel button: aborts .signal and paints the
   *                      honest cancelled state.
   *   .signal          — AbortSignal for the view's POST.
   *   .active          — true between begin() and finish/fail/cancel.
   * The view mounts it with .mount(container) right after creating it.
   */
  function createRun({ stages, etaSeconds, onBegin } = {}) {
    const stageList = Array.isArray(stages) ? stages.slice() : [];
    const eta = Math.max(0, Number(etaSeconds) || 0);
    const ctrl = new AbortController();
    let host = null;
    let panel = null;
    let logEl = null;
    let etaLine = null;
    let stageEls = [];
    let timer = null;
    let startedAt = 0;
    let active = false;
    let cancelled = false;

    function mount(container) { host = container; return api; }

    function tick() {
      if (!active || !etaLine) return;
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(eta - elapsed));
      etaLine.textContent = t('llm2.progressEta', '⏱ ~{eta} · elapsed {elapsed}')
        .replace('{eta}', formatDuration(remaining))
        .replace('{elapsed}', formatDuration(elapsed));
      timer = setTimeout(tick, 1000);
    }

    function teardownPanel() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      panel = null; logEl = null; etaLine = null; stageEls = [];
      active = false;
    }

    function begin() {
      // One run per controller (CAR-119 review #5/#6): a cancelled or
      // aborted controller is SPENT — begin refuses, and the view (which
      // creates a fresh controller per click) starts a clean run. Refusing
      // here is what keeps "cancel → accidental re-begin" from firing a
      // request on a dead signal that would abort silently.
      if (active || cancelled || ctrl.signal.aborted) return false;
      cancelled = false;
      active = true;
      startedAt = Date.now();
      // CAR-119 review #2 — let the page reveal the result pane BEFORE the
      // panel paints (below 1280 px the result column starts tab-hidden;
      // without this the whole run would render into a hidden pane).
      if (typeof onBegin === 'function') { try { onBegin(); } catch { /* view decision */ } }
      panel = el('div', { className: 'llm2run', role: 'status' }, [
        el('div', { className: 'llm2run__head' }, [
          el('span', { className: 'llm2run__state' }, t('llm2.progressRunning', 'Working…')),
          (etaLine = el('span', { className: 'llm2run__eta' }, '')),
          el('button', {
            type: 'button', className: 'btn btn-ghost btn-sm llm2run__cancel',
            onClick: () => api.cancel(),
          }, t('llm2.cancel', 'Cancel')),
        ]),
        el('div', { className: 'llm2run__bar', 'aria-hidden': 'true' }, [el('span', { className: 'llm2run__bar-fill' })]),
        stageList.length
          ? el('div', { className: 'llm2run__stages' }, stageList.map((label, i) => {
              const dot = el('span', { className: 'llm2run__stage' + (i === 0 ? ' is-active' : '') }, [
                el('span', { className: 'llm2run__stage-dot', 'aria-hidden': 'true' }, '●'),
                el('span', { className: 'llm2run__stage-label' }, label),
              ]);
              return dot;
            }))
          : null,
        logEl = el('div', {
          className: 'llm2run__log', role: 'log', 'aria-live': 'polite',
          'aria-label': t('llm2.logLabel', 'Run log'), tabindex: '-1',
        }),
      ].filter(Boolean));
      stageEls = Array.from(panel.querySelectorAll('.llm2run__stage'));
      // CAR-119 review #4 — never pile states up: a stale cancelled/failed
      // panel from an earlier run in this host is replaced, not stacked.
      if (host) host.replaceChildren();
      if (host) host.appendChild(panel);
      tick();
      // a11y — the user asked for work; announce where the progress lives.
      try { logEl.focus(); } catch { /* detached in tests */ }
      return true;
    }

    function stage(i) {
      stageEls.forEach((node, idx) => {
        node.classList.toggle('is-done', idx < i);
        node.classList.toggle('is-active', idx === i);
      });
    }

    function log(line) {
      if (!logEl) return;
      logEl.appendChild(el('div', { className: 'llm2run__logline' }, String(line == null ? '' : line)));
      logEl.scrollTop = logEl.scrollHeight;
    }

    function finish() {
      if (!active) return;
      api.log(t('llm2.done', 'Done'));
      teardownPanel();
    }

    function fail(err, paint, failText) {
      if (!active) return;
      const message = (err && err.message) || String(err || t('common.error', 'Error'));
      const lead = (typeof failText === 'string' && failText.trim()) || t('common.error', 'Error');
      // CAR-119 review #12 — the condition collapses to one question: did
      // the USER cancel? An aborted signal is always the cancel path here
      // (the kit owns the only AbortController).
      if (cancelled || ctrl.signal.aborted) {
        // cancel() already painted the cancelled state — never paint a
        // phantom error over it.
        teardownPanel();
        return;
      }
      teardownPanel();
      // CAR-119 review #4 — views with their own failure surface (the chat
      // bubble, the pinned empty-state box, the output region) pass
      // paint === false and announce the failure themselves; no double
      // role=alert.
      if (paint === false) return;
      if (host) {
        host.appendChild(el('div', { className: 'llm2run llm2run--fail', role: 'alert' }, [
          el('span', null, lead + ': ' + message),
        ]));
      }
    }

    function cancel() {
      if (!active || cancelled) return;
      cancelled = true;
      try { ctrl.abort(); } catch { /* already aborted */ }
      const hadHost = host;
      teardownPanel();
      if (hadHost) {
        hadHost.appendChild(el('div', { className: 'llm2run llm2run--cancelled', role: 'status' }, [
          el('span', null, t('llm2.cancelled',
            'Cancelled — the request was aborted and its result discarded. The server may still finish in the background.')),
        ]));
      }
    }

    const api = {
      mount, begin, stage, log, finish, fail, cancel,
      get signal() { return ctrl.signal; },
      get active() { return active; },
      get cancelled() { return cancelled; },
    };
    return api;
  }

  /**
   * run({ run, request, onDone, intro, failPaint, failText }) — wiring:
   *   run.begin(); if intro → logged as the first line (the view's own
   *   localized "what is happening" message, e.g. net.building); then
   *   request(signal) → finish + onDone; failures paint the kit's error
   *   panel (pass failPaint:false when the view announces the failure in
   *   its own surface) and rethrow for the view; an aborted run resolves
   *   silently (the cancelled panel already shows).
   * `request` receives the AbortSignal and returns a promise (usually
   * LlmPageKit.postJSON(path, body, signal) or API.post for the
   * not-yet-cancellable endpoints).
   */
  async function run({ run: ctrl, request, onDone, intro, failPaint, failText }) {
    if (!ctrl.begin()) return undefined;
    if (intro) ctrl.log(intro);
    try {
      const res = await request(ctrl.signal);
      ctrl.finish();
      if (typeof onDone === 'function') onDone(res);
      return res;
    } catch (e) {
      ctrl.fail(e, failPaint, failText);
      if (ctrl.cancelled || (e && e.aborted) || (ctrl.signal && ctrl.signal.aborted)) return undefined;
      throw e;
    }
  }

  // ── autofill: job picker over the tracker ───────────────────────────────

  /**
   * jobPicker({ map, fields }) → element
   *   map    — { company: 'company', role: 'role', ... } target input map
   *   fields — the view's { name → <input> } table the map points into
   * A combobox (input + native datalist — CSP-safe, keyboard + SR accessible)
   * over GET /api/tracker. Picking an entry fills the mapped inputs. Fails
   * soft: no rows / failed GET → honest muted note, no picker.
   */
  function jobPicker({ map, fields }) {
    const box = el('div', { className: 'llm2pick card' });
    const listId = 'llm2pick-' + Math.random().toString(36).slice(2, 8);
    const input = el('input', {
      type: 'text', className: 'input', list: listId,
      placeholder: t('llm2.pickPh', 'Start typing a company or role…'),
      'aria-label': t('llm2.pickTitle', 'Autofill from tracker'),
    });
    const datalist = el('datalist', { id: listId });
    box.append(
      el('label', { className: 'llm2pick__title' }, [
        t('llm2.pickTitle', 'Autofill from tracker'),
        input, datalist,
      ]),
    );
    let options = [];
    let loaded = false;
    async function load() {
      if (loaded) return;
      loaded = true;
      let rows = [];
      try {
        const r = await window.API.get('/api/tracker');
        rows = (r && r.rows) || [];
      } catch { rows = []; }
      options = dedupTrackerRows(rows);
      if (!options.length) {
        box.replaceChildren(el('p', { className: 'llm2pick__empty' },
          t('llm2.pickNone', 'No tracker applications yet — fill the fields manually.')));
        return;
      }
      for (const opt of options.slice(0, 800)) {
        datalist.appendChild(el('option', { value: opt.company + (opt.role ? ' — ' + opt.role : '') }));
      }
    }
    input.addEventListener('change', () => {
      const v = (input.value || '').trim().toLowerCase();
      if (!v) return;
      const hit = options.find((o) => (o.company + (o.role ? ' — ' + o.role : '')).toLowerCase() === v)
        || options.find((o) => o.company.toLowerCase() === v);
      if (!hit) return;
      for (const [src, target] of Object.entries(map || {})) {
        const targetEl = fields && fields[target];
        if (targetEl && hit[src]) targetEl.value = hit[src];
      }
    });
    load(); // background fill; typing works against the tracker once loaded
    return box;
  }

  // ── history drawer (views that already own a save endpoint) ─────────────

  /**
   * historyDrawer({ title, load, onView, onDelete, labels }) → { el, refresh }
   *   load()     — async → [{ name, mtime? }] (the view's list endpoint)
   *   onView(s)  — opens the entry (the view's own fetch/modal)
   *   onDelete(s)— performs the delete (the view's own endpoint)
   *   labels     — optional overrides so views reuse their ALREADY-TRANSLATED
   *                strings instead of the kit's EN fallbacks:
   *                { view, del, confirm, empty, refresh, deleted }
   * Delete goes through UI.confirm (focus-trapped, keyboard-reachable).
   * True undo is not possible without a server restore endpoint — the
   * confirm dialog says so.
   */
  function historyDrawer({ title, load, onView, onDelete, labels = {} } = {}) {
    const L = {
      view: labels.view ?? t('llm2.historyView', 'View'),
      del: labels.del ?? t('llm2.historyDelete', 'Delete'),
      confirm: labels.confirm ?? t('llm2.historyConfirmDelete', 'Delete "{name}"? This cannot be undone.'),
      empty: labels.empty ?? t('llm2.historyEmpty', 'Nothing saved yet.'),
      refresh: labels.refresh ?? t('llm2.refresh', 'Refresh'),
      deleted: labels.deleted ?? t('llm2.historyDeleted', 'Deleted'),
    };
    const list = el('div', { className: 'llm2hist__list' });
    const drawer = el('div', { className: 'llm2hist' }, [
      el('div', { className: 'llm2hist__head' }, [
        el('h2', { className: 'llm2hist__title' }, title || t('llm2.history', 'History')),
        el('button', {
          type: 'button', className: 'btn btn-ghost btn-sm', onClick: () => refresh(),
        }, '↻ ' + L.refresh),
      ]),
      list,
    ]);

    async function refresh() {
      let entries = [];
      let failed = null;
      try { entries = (await load()) || []; } catch (e) { failed = e; }
      list.replaceChildren();
      if (failed) {
        list.appendChild(el('p', { className: 'llm2hist__empty', role: 'alert' },
          t('common.error', 'Error') + ': ' + ((failed && failed.message) || t('common.error', 'Error'))));
        return;
      }
      if (!entries.length) {
        list.appendChild(el('p', { className: 'llm2hist__empty' }, L.empty));
        return;
      }
      for (const s of entries) {
        const iso = s && s.mtime ? new Date(s.mtime).toISOString() : '';
        const dateLabel = s && s.mtime ? new Date(s.mtime).toLocaleString() : '';
        list.appendChild(el('div', { className: 'llm2hist__card' }, [
          el('span', { className: 'llm2hist__name', title: dateLabel }, String((s && s.name) || '')),
          iso ? el('time', { className: 'llm2hist__date', datetime: iso }, dateLabel) : null,
          el('span', { className: 'llm2hist__actions' }, [
            typeof onView === 'function'
              ? el('button', { type: 'button', className: 'btn btn-ghost btn-sm', onClick: () => onView(s) }, L.view)
              : null,
            typeof onDelete === 'function'
              ? el('button', {
                  type: 'button', className: 'btn btn-ghost btn-sm', 'aria-label': L.del,
                  onClick: async (e) => {
                    const name = String((s && s.name) || '');
                    const message = String(L.confirm).replace('{name}', name);
                    const ok = await UI.confirm(L.del, message, { danger: true });
                    if (!ok) return;
                    try {
                      await onDelete(s);
                      UI.toast(L.deleted + ' · ' + name, 'success');
                      refresh();
                    } catch (err) {
                      UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
                    }
                  },
                }, '🗑')
              : null,
          ].filter(Boolean)),
        ]));
      }
    }
    refresh();
    return { el: drawer, refresh };
  }

  return {
    layout, createRun, run, postJSON, jobPicker, historyDrawer,
    // pure helpers, exported for the unit tests
    formatDuration, dedupTrackerRows,
  };
})();

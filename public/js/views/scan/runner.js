/* global window, UI, API */
/**
 * scan/runner.js — the #/scan execution engine (file-size split of views/scan.js,
 * P-16). Owns run-state (Scan/Stop buttons, aria-busy), the indeterminate/
 * determinate progress bar, the persistent error banner + Retry, the SSE console
 * stream, and the per-source runners (ATS / regional / both). Extracted VERBATIM
 * (de-indent only) so behaviour is byte-for-byte identical; loaded via <script src>
 * BEFORE views/scan.js.
 *
 * Factory: `window.createScanRunner(ctx)` → { runScanAll, stopScan, teardown }.
 *   ctx = { consoleEl, statusRegion, errBanner,
 *           scanProgress, scanProgressBar, scanProgressLabel, scanProgressWrap,
 *           scanBtn, stopBtn, dryRun, companySelect, maxPerSource,
 *           t, c, refreshResults, resetResultsCache }
 *   - `activeES` / `lastRunFn` are runner-internal (only the runner touches them).
 *   - The live-poll timers `__activeScanPollHandle` / `__activeScanDoneTimeout`
 *     and `__cancelActiveScanPoll()` are owned at views/scan.js module scope (the
 *     hashchange teardown must cancel an in-flight poll after the view unmounts).
 *     Both files are classic <script> tags, so those top-level bindings live in
 *     the shared global lexical environment — the runner references them directly,
 *     exactly as the pre-split single file did.
 *   - `teardown()` (v1.243.0, views-3) is the navigate-away hook: scan.js
 *     stashes the runner at module scope and its hashchange handler closes an
 *     in-flight EventSource so the stream cannot outlive its view.
 */
(function () {
  window.createScanRunner = function (ctx) {
    const {
      consoleEl, statusRegion, errBanner, terminalEl,
      scanProgress, scanProgressBar, scanProgressLabel, scanProgressWrap,
      scanBtn, stopBtn, dryRun, companySelect, maxPerSource,
      t, c, refreshResults, resetResultsCache,
    } = ctx;

    // v1.244.2 — console-strip status dot (.scan-terminal__dot). The
    // wrapper is optional: unit tests boot the runner without it.
    function setTerminalState(state) {
      if (terminalEl) terminalEl.dataset.state = state;
    }

    // v1.46.0 (WS2 #6/#21/#24) — run-state, Stop, persistent error banner.
    let activeES = null;   // in-flight EventSource handle (for #6 Stop)
    let lastRunFn = null;  // for the #24 Retry action
    // CAR-93 — every branch that releases the stream handle must CLOSE it
    // first: leaving a live EventSource in `activeES` made stopScan()/
    // teardown() no-ops (they saw null) and — should a transport ever
    // bypass the API.stream close-on-done contract — the socket would
    // auto-reconnect after the server closed, re-launching a scan or
    // burning SCAN_BUSY with no visible way to stop it.
    function clearActiveES() {
      if (activeES) { try { activeES.close(); } catch { /* already closed */ } }
      activeES = null;
    }

    // back to indeterminate (animated stripe) for the next run
    function resetScanProgress() {
      scanProgress.classList.remove('is-determinate');
      scanProgressBar.style.width = '';
      scanProgress.removeAttribute('aria-valuenow');
      scanProgressLabel.textContent = t('scan.progress', 'Scanning…');
    }
    // determinate fill + live "<label> NN%" from a progress SSE event
    function setScanProgress(done, total) {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      scanProgress.classList.add('is-determinate');
      scanProgressBar.style.width = pct + '%';
      scanProgress.setAttribute('aria-valuenow', String(pct));
      scanProgressLabel.textContent = t('scan.progress', 'Scanning…') + ' ' + pct + '%';
    }

    function setScanRunning(running) {
      scanBtn.disabled = running;
      scanBtn.setAttribute('aria-busy', running ? 'true' : 'false');
      stopBtn.hidden = !running;
      scanProgressWrap.hidden = !running;   // v1.63.0/1.63.1 — progress bar + caption follow scan state
      if (running) resetScanProgress();     // v1.63.2 — start each run indeterminate, then fill on progress events
      // v1.244.2 — console-strip dot follows the run state ('idle' here;
      // done/error overrides land at their own call sites below).
      setTerminalState(running ? 'running' : 'idle');
      // v1.55.4 — UX-6: while the multi-minute crawl is running, Stop
      // is the primary action — promote it to a prominent destructive
      // button so the user can find and trust it under load. Quiet
      // ghost otherwise (it's hidden then anyway).
      stopBtn.className = running
        ? 'btn btn-danger scan-stop-btn'
        : 'btn btn-ghost scan-stop-btn';
    }
    function announce(msg) { statusRegion.textContent = msg; }
    function clearScanError() { errBanner.hidden = true; errBanner.textContent = ''; }
    function showScanError(msg) {
      errBanner.textContent = '';
      errBanner.appendChild(c('strong', null,
        '✗ ' + t('scan.errBannerTitle', 'Scan failed') + ': '));
      errBanner.appendChild(c('span', null, String(msg || 'unknown error')));
      errBanner.appendChild(c('button', {
        className: 'btn btn-ghost',
        onClick: () => { clearScanError(); if (lastRunFn) lastRunFn(); },
      }, '↻ ' + t('scan.errRetry', 'Retry scan')));
      errBanner.hidden = false;
      announce(t('scan.statusFailed', 'Scan failed') + ': ' + (msg || ''));
      setTerminalState('error');   // v1.244.2 — dot turns red until the next run
    }
    function stopScan() {
      clearActiveES();
      __cancelActiveScanPoll();
      appendMeta(consoleEl, '\n■ ' + t('scan.stopped', 'stopped') + '\n');
      announce(t('scan.statusStopped', 'Scan stopped'));
      setScanRunning(false);
    }

    // v1.243.0 (views-3) — the navigate-away hook, owned at scan.js module
    // scope (the hashchange handler calls it via __activeScanRunner). Closing
    // the EventSource used to happen only through Stop: navigating away
    // mid-scan orphaned the stream (it kept streaming into detached nodes,
    // the server kept running, and the next #/scan visit hit SCAN_BUSY with
    // no visible way to stop the orphan). teardown() is the silent variant:
    // close the stream + poll, end run-state — no console line, no toast,
    // the user has already left the page. The server-side scan itself
    // continues; that is the honest contract (a closed SSE connection does
    // not kill the child process) and the results still land in the shared
    // last-scan snapshot the next visit reads.
    function teardown() {
      clearActiveES();
      __cancelActiveScanPoll();
      setScanRunning(false);
    }

    function streamTo(consoleEl, path, kind, onDone) {
      consoleEl.textContent = '';
      clearScanError();
      setScanRunning(true);
      UI.toast(`${kind} scan…`, 'success');
      // Cancel any prior in-flight poll so back-to-back scan clicks don't
      // accumulate intervals, and assign the new one to the module-level handle
      // so __cancelActiveScanPoll() (on hashchange) can clean up.
      __cancelActiveScanPoll();
      __activeScanPollHandle = setInterval(() => {
        refreshResults().catch(() => {});
      }, 2500);

      activeES = API.stream(path, (ev, data) => {
        if (ev === 'log') {
          const cls = data.stream === 'stderr' ? ' err' : '';
          const span = c('span', { className: cls }, data.line + '\n');
          consoleEl.appendChild(span);
          consoleEl.scrollTop = consoleEl.scrollHeight;
        } else if (ev === 'start') {
          appendMeta(consoleEl, `▶ ${data.script}\n`);
        } else if (ev === 'progress') {
          setScanProgress(data.done, data.total);
        } else if (ev === 'done') {
          __cancelActiveScanPoll();
          clearActiveES();
          setScanRunning(false);
          setTerminalState('done');   // v1.244.2 — green dot after a clean finish
          const okMsg = data.counts
            ? `\n✓ done · raw=${data.counts.raw}, NEW=${data.counts.fresh}` +
              (data.errors ? ` · ${data.errors} non-fatal errors` : '')
            : `\n✓ exit ${data.code}`;
          appendMeta(consoleEl, okMsg + '\n');
          const fresh = data.counts?.fresh;
          const doneMsg = fresh != null ? `${kind}: ${fresh} ${t('scan.newOffers', 'new offers')}` : `${kind} done`;
          UI.toast(doneMsg, 'success');
          announce(t('scan.statusDone', 'Scan complete') + ' · ' + doneMsg);
          // Final refresh + onDone, with a small delay so the JSON file
          // is flushed to disk on the server side. v1.22.0 (L-5) — capture
          // the handle so hashchange cleanup can clear it.
          __activeScanDoneTimeout = setTimeout(() => {
            __activeScanDoneTimeout = null;
            refreshResults().catch(() => {});
            if (onDone) onDone();
          }, 300);
        } else if (ev === 'error') {
          __cancelActiveScanPoll();
          clearActiveES();
          setScanRunning(false);
          appendMeta(consoleEl, `\n✗ ${data.message}\n`);
          UI.toast(data.message, 'error');
          showScanError(data.message);
        }
      });
    }

    // v1.16.0 — both runEnScan / runRuScan now hit the consolidated
    // endpoint `/api/stream/scan?source=ats|regional`. The legacy
    // `/api/stream/scan-{en,ru}` aliases stay live with Sunset headers
    // through v1.16 but are no longer the SPA's transport.
    // v1.80.0 — add the optional per-source cap to a scan request (0/empty = ∞).
    function addMaxPerSource(params) {
      const n = parseInt(maxPerSource.value, 10);
      if (Number.isFinite(n) && n > 0) params.set('maxPerSource', String(n));
    }
    function runEnScan() {
      lastRunFn = runEnScan;
      const params = new URLSearchParams();
      params.set('source', 'ats');
      if (dryRun.checked) params.set('dryRun', '1');
      const company = companySelect.value;
      if (company) params.set('company', company);
      addMaxPerSource(params);
      resetResultsCache();
      streamTo(consoleEl, '/api/stream/scan?' + params.toString(), 'ATS', refreshResults);
    }
    function runRuScan() {
      lastRunFn = runRuScan;
      const params = new URLSearchParams();
      params.set('source', 'regional');
      if (dryRun.checked) params.set('dryRun', '1');
      streamTo(consoleEl, '/api/stream/scan?' + params.toString(), 'Regional', refreshResults);
    }
    // v1.12.0 — single SSE connection to the consolidated endpoint.
    // The server runs ATS then regional sequentially and emits multiple
    // `start` / `done` events in one stream so the UI sees both phases.
    // v1.18.0 — legacy `/api/stream/scan-{en,ru}` aliases retired.
    // Everything goes through the consolidated endpoint.
    function runScanAll() {
      const params = new URLSearchParams();
      params.set('source', 'both');
      if (dryRun.checked) params.set('dryRun', '1');
      const company = companySelect.value;
      if (company) params.set('company', company);
      addMaxPerSource(params);

      consoleEl.textContent = '';
      clearScanError();
      setScanRunning(true);
      lastRunFn = runScanAll;
      resetResultsCache();   // v1.80.0 — clear before scan; poll + done refill
      UI.toast(t('scan.runAll', 'Scanning all sources…'), 'success');

      // v1.78.1 — live auto-refresh. Poll the results table every 2.5s while the
      // (multi-minute) scan runs and re-read it once more after each phase, so
      // vacancies appear in the table automatically without a manual reload.
      // Mirrors the streamTo() path; cleaned up on done/error/stop/hashchange via
      // __cancelActiveScanPoll().
      __cancelActiveScanPoll();
      __activeScanPollHandle = setInterval(() => { refreshResults().catch(() => {}); }, 2500);

      let phase = null;       // 'ats' | 'regional' as we move between phases
      let totalNew = 0;
      activeES = API.stream('/api/stream/scan?' + params.toString(), (ev, data) => {
        if (ev === 'start') {
          // Inferred from the server-emitted script label so a single stream
          // can carry multiple phases.
          phase = (data.script === 'en-scanner') ? 'ats' : 'regional';
          appendMeta(consoleEl,
            phase === 'ats'
              ? '▶ ATS scan (Greenhouse + Ashby + Lever + Workable + SmartRecruiters + Workday + RSS)\n'
              : '\n▶ Regional scan (hh.ru + Habr Career)\n');
        } else if (ev === 'progress') {
          setScanProgress(data.done, data.total);
        } else if (ev === 'log') {
          const cls = data.stream === 'stderr' ? ' err' : '';
          consoleEl.appendChild(c('span', { className: cls }, data.line + '\n'));
          consoleEl.scrollTop = consoleEl.scrollHeight;
        } else if (ev === 'done') {
          const fresh = data.counts?.fresh ?? 0;
          totalNew += fresh;
          const label = phase === 'ats' ? 'ATS' : 'Regional';
          appendMeta(consoleEl, `✓ ${label} done · NEW=${fresh}\n`);
          // The consolidated `source=both` stream emits an intermediate `done`
          // with `final:false` (ATS) then a terminal one (Regional). Only the
          // terminal done ends the run.
          const terminal = !data || data.final !== false;
          if (terminal) {
            // v1.78.1 — stop the live poll, end the run, then do one last refresh
            // a beat later so the server has flushed last-scan.json. Guarantees
            // the results table shows the final set without a manual reload.
            __cancelActiveScanPoll();
            clearActiveES();
            setScanRunning(false);
            setTerminalState('done');   // v1.244.2 — green dot after a clean finish
            announce(t('scan.statusDone', 'Scan complete') + ' · NEW=' + totalNew);
            __activeScanDoneTimeout = setTimeout(() => {
              __activeScanDoneTimeout = null;
              refreshResults().catch(() => {});
            }, 300);
          } else {
            // F-011: surface the ATS phase's results immediately while the
            // regional phase keeps running.
            refreshResults().catch(() => {});
          }
        } else if (ev === 'error') {
          __cancelActiveScanPoll();
          const label = phase === 'ats' ? 'ATS' : (phase === 'regional' ? 'Regional' : 'scan');
          const msg = (data && data.message) || 'unknown error';
          appendMeta(consoleEl, `\n✗ ${label} error: ${msg}\n`);
          clearActiveES();
          setScanRunning(false);
          UI.toast(msg, 'error');
          showScanError(label + ' — ' + msg);
        }
      });
      // EventSource closes on the last `done`; show the summary toast then.
      // We can't easily distinguish "ATS done" from "all done" without a
      // server-side `phase: 'final'` marker, so the toast fires on each done
      // and the user reads the meta line for context.
      Promise.resolve().then(() => {
        // Defensive: schedule a final summary once the stream is idle.
        setTimeout(() => {
          if (totalNew > 0) UI.toast(`${t('nav.scan', 'Scan')}: ${totalNew} ${t('scan.newOffers', 'new offers')}`, 'success');
        }, 800);
      });
    }

    // Appends a dim "meta" line to the SSE console (run markers, done/error
    // summaries). Runner-local: only the stream handlers use it.
    function appendMeta(el, text) {
      const span = document.createElement('span');
      span.className = 'meta';
      span.textContent = text;
      el.appendChild(span);
      el.scrollTop = el.scrollHeight;
    }

    // v1.243.0 (views-3) — teardown() exported for the route-change cleanup;
    // stopScan stays the user-visible control.
    return { runScanAll, stopScan, teardown };
  };

  // ── CAR-115 — quick view: the scan page's row-preview side panel ──────
  // Click/Enter on a results row opens a fixed panel with the posting
  // details (title, meta, salary, description) and the actions (Evaluate,
  // To-pipeline, ★ favorite, Open posting). Escape / backdrop / ✕ close it
  // and return focus to the row. Lives beside the page's other runtime
  // machinery; `ctx.view.openQuickView` is the late-bound open(r) entry.
  // ctx = { c, t, SR, view }
  window.createScanQuickView = function (ctx) {
    const { c, t, SR, view } = ctx;
    const backdrop = c('div', { className: 'v2-scan-backdrop' });
    const panel = c('div', {
      className: 'v2-scan-panel', role: 'dialog', 'aria-modal': 'true',
      'aria-label': t('scan.v2.quickView', 'Quick view'),
    });
    let current = null;
    let lastFocus = null;
    const closeBtn = c('button', {
      className: 'btn btn-ghost btn-sm v2-scan-qv-close', type: 'button',
      'aria-label': t('common.closeDialog', 'Close dialog'),
      onClick: () => close(),
    }, '✕ ' + t('common.closeDialog', 'Close dialog'));
    const titleEl = c('h2', { className: 'v2-scan-qv-title' });
    const metaEl = c('p', { className: 'muted v2-scan-qv-meta' });
    const salaryEl = c('p', { className: 'v2-scan-qv-salary' });
    const descEl = c('div', {
      className: 'v2-scan-qv-desc', tabindex: '0',
      'aria-label': t('scan.v2.description', 'Description'),
    });
    const starBtn = c('button', {
      className: 'btn btn-ghost btn-sm', type: 'button',
      onClick: () => {
        if (!current) return;
        window.ScanPrefs.toggleFavorite(current.url);
        starSync();
        SR.render();
      },
    });
    const evalBtn = c('button', {
      className: 'btn btn-primary btn-sm', type: 'button',
      onClick: () => {
        // The disabled attribute alone cannot stop a programmatic click —
        // the handler re-checks the safe-URL gate (CAR-115 test contract).
        if (!current || !/^https?:\/\//i.test(current.url || '')) return;
        if (window.Router) window.Router.go('/evaluate?url=' + encodeURIComponent(current.url));
      },
    }, t('scan.v2.evaluate', 'Evaluate'));
    const pipeBtn = c('button', {
      className: 'btn btn-ghost btn-sm', type: 'button',
      onClick: async () => {
        if (!current || !/^https?:\/\//i.test(current.url || '')) return;
        try {
          const r = await window.API.post('/api/pipeline', { url: current.url });
          window.UI.toast(r && r.deduped
            ? t('scan.v2.pipelineDup', 'Already in the pipeline')
            : t('scan.v2.pipelineAdded', 'Added to the pipeline'), 'success');
        } catch (e) {
          window.UI.toast((e && e.message) || t('common.error', 'Error'), 'error');
        }
      },
    }, t('scan.v2.toPipeline', 'To pipeline'));
    const linkBtn = c('a', {
      className: 'btn btn-ghost btn-sm', target: '_blank', rel: 'noopener',
    }, t('scan.v2.openPosting', 'Open posting ↗'));
    function starSync() {
      const on = !!(current && window.ScanPrefs.isFavorite(current.url));
      starBtn.textContent = on ? '★' : '☆';
      starBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const name = on ? t('scan.unstar', 'Remove from favorites') : t('scan.star', 'Add to favorites');
      starBtn.setAttribute('aria-label', name);
      starBtn.title = name;
    }
    function open(r) {
      current = r;
      const wt = r.workplaceType || (r.isRemote ? 'Remote' : 'Onsite');
      const days = window.JobFacets ? window.JobFacets.daysSince(r.date) : null;
      const fresh = days == null ? '' : (days <= 0 ? t('scan.freshToday', 'today') : days + t('scan.dSuffix', 'd'));
      titleEl.textContent = r.title || r.company || '—';
      metaEl.textContent = [r.company, r.location, r.source, fresh, wt].filter(Boolean).join(' · ');
      salaryEl.textContent = r.salary || '';
      salaryEl.hidden = !r.salary;
      // Descriptions arrive as plain text (server-capped); rendered as a
      // text node — the panel never touches innerHTML with data.
      descEl.textContent = String(r.description || '').slice(0, 4000)
        || t('scan.v2.noDescription', 'No description captured for this posting.');
      const safeUrl = /^https?:\/\//i.test(r.url || '') ? r.url : null;
      // Only a real http(s) posting can be evaluated / pipelined / opened —
      // the actions disable for anything else (the link is dropped too).
      if (safeUrl) { evalBtn.removeAttribute('disabled'); pipeBtn.removeAttribute('disabled'); }
      else { evalBtn.setAttribute('disabled', ''); pipeBtn.setAttribute('disabled', ''); }
      linkBtn.setAttribute('href', safeUrl || '');
      linkBtn.hidden = !safeUrl;
      starSync();
      panel.replaceChildren(
        closeBtn, titleEl, metaEl, salaryEl, descEl,
        c('div', { className: 'v2-scan-qv-actions' }, [evalBtn, pipeBtn, starBtn, linkBtn]));
      backdrop.classList.add('is-open');
      panel.classList.add('is-open');
      lastFocus = document.activeElement;
      closeBtn.focus();
    }
    function close() {
      panel.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      if (lastFocus && typeof lastFocus.focus === 'function') { try { lastFocus.focus(); } catch { /* detached */ } }
      lastFocus = null;
      current = null;
    }
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    backdrop.addEventListener('click', () => close());
    if (view) view.openQuickView = open;
    return [backdrop, panel];
  };

  // ── CAR-115 extraction — the reposts/ghost detector panel (moved verbatim
  // from views/scan.js; it is page-level runtime UI, not execution logic).
  // window.createRepostsPanel({ c, t }) → <details> panel, lazily fetching
  // GET /api/scan/reposts on first open.
  window.createRepostsPanel = function (fctx) {
    const c = fctx.c;
    const t = fctx.t;
// v1.83.0 — repost / ghost-posting detector.
// A collapsed panel that lazy-loads GET /api/scan/reposts on first open:
// company+role clusters re-listed under different URLs within a window =
// likely stale / ghost postings. CSP-safe (addEventListener, no innerHTML).
// v1.244.2 — styled disclosure header (.reposts-summary) carries a subtle
// cluster-count badge, filled in once the lazy fetch lands.
const repostsCount = c('span', { className: 'reposts-badge', hidden: '' });
const repostsBody = c('div', { className: 'reposts-body' });
const repostsPanel = c('details', { className: 'card mb-3 reposts' }, [
  c('summary', { className: 'reposts-summary' }, [
    c('span', null, '🔁 ' + t('scan.reposts.title', 'Reposted / ghost roles')),
    repostsCount,
  ]),
  repostsBody,
]);
let repostsLoaded = false;
repostsPanel.addEventListener('toggle', async () => {
  if (!repostsPanel.open || repostsLoaded) return;
  repostsLoaded = true;
  // CAR-112 — shimmer rows instead of a bare «Loading…» text.
  repostsBody.replaceChildren(window.Skeleton.block(4, t('common.loading', 'Loading…')));
  try {
    const d = await API.get('/api/scan/reposts');
    repostsBody.textContent = '';
    const clusters = Array.isArray(d.clusters) ? d.clusters : [];
    // v1.244.2 — subtle count badge in the disclosure header.
    if (clusters.length > 0) {
      repostsCount.textContent = String(clusters.length);
      repostsCount.hidden = false;
    }
    if (clusters.length === 0) {
      repostsBody.appendChild(c('p', { className: 'muted' },
        t('scan.reposts.empty', 'No reposted roles detected in scan history.')));
      return;
    }
    repostsBody.appendChild(c('p', { className: 'muted' },
      t('scan.reposts.intro', 'Roles re-listed under different URLs (possible stale / ghost postings):')));
    repostsBody.appendChild(c('table', { className: 'tbl' }, [
      c('thead', null, c('tr', null, [
        c('th', null, t('scan.reposts.company', 'Company')),
        c('th', null, t('scan.reposts.role', 'Role')),
        c('th', null, t('scan.reposts.count', 'Reposts')),
        c('th', null, t('scan.reposts.span', 'Span')),
        c('th', null, t('scan.reposts.range', 'First → Last')),
      ])),
      c('tbody', null, clusters.map((cl) => c('tr', null, [
        c('td', null, cl.company || ''),
        c('td', null, cl.role || ''),
        c('td', null, String(cl.repostCount || 0)),
        c('td', null, (cl.daysSpan || 0) + 'd'),
        c('td', null, (cl.firstSeen || '') + ' → ' + (cl.lastSeen || '')),
      ]))),
    ]));
  } catch {
    repostsBody.textContent = t('common.error', 'Error');
  }
});

    return repostsPanel;
  };

  // ── CAR-115 extraction — the Active-companies panel (moved verbatim from
  // views/scan.js; the counter + Workday-fallback chip are page runtime UI).
  // window.createScanCompaniesPanel(fctx) → { setLabel, refreshWorkdayChip, el }.
  // scan.js keeps the literal tracked subscriptions:
  //   addScanRefreshListener(setLabel); addScanRefreshListener(refreshWorkdayChip);
  window.createScanCompaniesPanel = function (fctx) {
    const c = fctx.c;
    const t = fctx.t;
    const companies = fctx.companies;
    // The CAR-100 counter slice (vm-extracted by tests/car100) reads the
    // free `SR` and `apiCompanies` names exactly as the pre-extraction
    // view did — scan.js keeps this mirror in sync after a live-registry
    // reclassification (setApiCompanies below).
    const SR = fctx.SR;
    let apiCompanies = fctx.apiCompanies || [];
    const setApiCompanies = (list) => { apiCompanies = list || []; };
    const portalsErr = fctx.portalsErr;
    const addRefreshListener = fctx.addRefreshListener;
      // Companies list — collapsed by default, expand on click, with a
    // search filter + visual grouping by API support. 87 entries flat
    // is overwhelming; this lets the user dive in only when needed.
    const list = c('div', {
      className: 'flex',
      style: { flexWrap: 'wrap', gap: '8px', marginTop: '12px' },
    });
    const filterIn = c('input', {
      className: 'input',
      placeholder: t('scan.companiesFilter', 'Filter companies…'),
      style: { maxWidth: '320px', marginTop: '12px', display: 'none' },
    });
    let expanded = false;
    let query = '';

    function rerender() {
      list.innerHTML = '';
      const q = query.trim().toLowerCase();
      const matched = q
        ? companies.filter((co) => (co.name || '').toLowerCase().includes(q))
        : companies;
      // Group: API-backed first, websearch-only second.
      const apiSet = new Set(getApiCompanies());
      const apis = matched.filter((co) => apiSet.has(co));
      const others = matched.filter((co) => !apiSet.has(co));
      // Each company tag is a flex-row of two buttons:
      //   1. Name button — clicking it pre-fills the results-table
      //      filter with the company name (so the user immediately
      //      sees that company's hits in the table above).
      //   2. ↗ link button — only shown when careers_url is set;
      //      opens the careers page in a new tab.
      const tag = (co, hasApi) => {
        const name = co.name || co;
        const careersUrl = co.careers_url || co.careersUrl || (co._api && co._api.url);
        const wrap = c('span', {
          className: 'tag',
          style: {
            fontSize: '13px',
            background: hasApi ? 'rgba(0,138,5,.10)' : 'var(--beach)',
            color: hasApi ? 'var(--kazan)' : 'var(--foggy)',
            padding: '4px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          },
        });
        const filterBtn = c('button', {
          type: 'button',
          title: t('scan.tagClickToFilter', 'Click to filter results by this company'),
          style: {
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            padding: '2px 4px',
            cursor: 'pointer',
          },
          onClick: () => fctx.onFilterByName(name),
        }, (hasApi ? '✓ ' : '○ ') + name);
        wrap.appendChild(filterBtn);
        if (careersUrl) {
          const link = c('a', {
            href: careersUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: t('scan.tagOpenCareers', 'Open careers page in a new tab'),
            style: {
              textDecoration: 'none',
              color: 'inherit',
              opacity: 0.7,
              padding: '0 2px',
            },
          }, '↗');
          wrap.appendChild(link);
        }
        return wrap;
      };
      if (apis.length) {
        const head = c('div', {
          style: { width: '100%', fontSize: '12px', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.04em',
            color: 'var(--kazan)' },
        }, '✓ ' + t('scan.apiBacked', 'Direct API') + ` · ${apis.length}`);
        list.appendChild(head);
        apis.forEach((co) => list.appendChild(tag(co, true)));
      }
      if (others.length) {
        const head = c('div', {
          style: { width: '100%', fontSize: '12px', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.04em',
            color: 'var(--foggy)', marginTop: apis.length ? '12px' : 0 },
        }, '○ ' + t('scan.websearchBacked', 'Web-search only') + ` · ${others.length}`);
        list.appendChild(head);
        others.forEach((co) => list.appendChild(tag(co, false)));
      }
      if (matched.length === 0) {
        list.appendChild(c('div', { style: { color: 'var(--foggy)' } }, t('common.empty', 'No results')));
      }
    }

    // F-011: count companies that produced at least one hit in the
    // last scan run. Updated after every refreshResults() via the
    // setLabel closure below. Falls back to the static tracked count
    // before the first scan completes.
    // CAR-100 — the counter's two numbers must live in ONE universe.
    // Rows arrive from every source a scan touched (an hh.ru / telegram
    // run alone surfaces hundreds of employers no portals.yml entry
    // names), so counting distinct row companies read 1554/90 on prod
    // while the tooltip promises "configured in portals.yml". Pairing:
    // numerator = distinct companies among rows the API-backed tracked
    // scan itself fetched, matched against apiCompanies — the set the
    // page already builds with isApiBackedCompany; denominator = those
    // same API-backed enabled tracked companies. Row identity: the
    // scanner stamps the portals entry name on every row it fetches
    // (`_entry`; `company` on rows saved by older builds — the same
    // `_entry ?? company` rule en-scanner's carry-over logic uses).
    function activeFromLastScan() {
      const rows = SR.getRows();
      const tracked = new Set(
        apiCompanies.map((co) => String((co && co.name) || '').toLowerCase()).filter(Boolean)
      );
      const seen = new Set();
      for (const r of rows) {
        if (!r || typeof r !== 'object') continue;
        const name = r._entry ?? (r.company || r.companyName);
        if (!name) continue;
        const lc = String(name).toLowerCase();
        if (tracked.has(lc)) seen.add(lc);
      }
      return seen.size;
    }
    const labelN = () => {
      const fromScan = activeFromLastScan();
      // CAR-100 — the pre-scan fallback reads the same universe as the
      // denominator: companies.length also counts web-search-only entries
      // and could even exceed apiCompanies.length (e.g. "104/90").
      const n = fromScan > 0 ? fromScan : apiCompanies.length;
      return `${n}/${apiCompanies.length}`;
    };
    const setLabel = () => {
      toggleBtn.textContent = (expanded ? '▾ ' : '▸ ') + t('scan.activeCo') + ` ${labelN()}`;
    };
    const toggleBtn = c('button', {
      className: 'btn btn-ghost btn-sm',
      // U-6 (v1.58.26) — the chip read `✦ Active companies 96/80` —
      // unclear what 96 vs 80 stood for. `title` is a hover tooltip
      // (and screen-reader-fallback) explaining: N = companies
      // currently surfacing results; M = companies configured in
      // portals.yml. Localized via the new `scan.activeCo.help` key.
      title: t('scan.activeCo.help', 'Active: companies currently surfacing results. Total: configured in portals.yml.'),
      'aria-label': t('scan.activeCo.help', 'Active: companies currently surfacing results. Total: configured in portals.yml.'),
      onClick: () => {
        expanded = !expanded;
        list.style.display = expanded ? '' : 'none';
        filterIn.style.display = expanded ? '' : 'none';
        setLabel();
        if (expanded) rerender();
      },
    }, '▸ ' + t('scan.activeCo') + ` ${labelN()}`);
    // Hook into the existing refreshResults() flow: the VIEW (scan.js)
    // owns the tracked subscriptions — addScanRefreshListener(setLabel) +
    // addScanRefreshListener(refreshWorkdayChip) — and detaches them on
    // route change. The factory only exposes the callbacks.

    filterIn.addEventListener('input', (e) => {
      query = e.target.value;
      rerender();
    });
    list.style.display = 'none';

    // v1.17.0 — render a 🔒 chip when the server reports the most
    // recent Workday fetch fell back (CAPTCHA / 4xx / non-JSON HTML).
    // The /api/scan-results endpoint exposes workdayFallback as part
    // of the latest snapshot. Empty when no fallback has occurred.
    const wdFallback = c('div', {
      id: 'workday-fallback-chip',
      style: { display: 'none', marginBottom: '12px', padding: '8px 12px',
        background: 'rgba(244, 173, 47, .12)', borderLeft: '3px solid var(--warn, #f4ad2f)',
        borderRadius: '4px', fontSize: '13px' },
    });
    // Hook into the same refresh dispatch as Active Companies counter.
    // Reads workdayFallback from /api/scan-results when it lands.
    function refreshWorkdayChip() {
      API.get('/api/scan-results').then((d) => {
        const wf = d && d.workdayFallback;
        if (!wf || !wf.apiUrl) {
          wdFallback.style.display = 'none';
          return;
        }
        const tenant = (wf.apiUrl.match(/https?:\/\/([^./]+)\./) || [, 'unknown'])[1];
        wdFallback.innerHTML = '';
        wdFallback.appendChild(c('strong', null, '🔒 ' + t('scan.workdayBlocked', 'Workday tenant blocked')));
        wdFallback.appendChild(c('span', { style: { marginLeft: '8px', color: 'var(--foggy)' } },
          `${tenant} · ${wf.reason} · ` + t('scan.workdayFallbackHint',
            'fallback: use /career-ops scan (Playwright) for this tenant')));
        wdFallback.style.display = '';
      }).catch(() => { /* network blip — chip stays hidden */ });
    }
    // Initial check on page load so users who navigate to /#/scan after
    // a prior session's blocked Workday see the chip immediately.
    refreshWorkdayChip();

    return {
      setLabel,
      refreshWorkdayChip,
      setApiCompanies,
      el: c('div', { className: 'card mt-5' }, [
        wdFallback,
        portalsErr
          ? c('div', { className: 'empty' }, [
              c('strong', null, t('scan.failedPortals')),
              c('p', { style: { color: 'var(--foggy)', marginTop: '8px' } }, portalsErr.message),
            ])
          : companies.length === 0
          ? c('div', { className: 'empty' }, t('scan.allDisabled'))
          : c('div', null, [toggleBtn, filterIn, list]),
      ]),
    };
  };
})();

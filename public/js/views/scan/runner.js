/* global window, UI, API */
/**
 * scan/runner.js — the #/scan execution engine (file-size split of views/scan.js,
 * P-16). Owns run-state (Scan/Stop buttons, aria-busy), the indeterminate/
 * determinate progress bar, the persistent error banner + Retry, the SSE console
 * stream, and the per-source runners (ATS / regional / both). Extracted VERBATIM
 * (de-indent only) so behaviour is byte-for-byte identical; loaded via <script src>
 * BEFORE views/scan.js.
 *
 * Factory: `window.createScanRunner(ctx)` → { runScanAll, stopScan }.
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
 */
(function () {
  window.createScanRunner = function (ctx) {
    const {
      consoleEl, statusRegion, errBanner,
      scanProgress, scanProgressBar, scanProgressLabel, scanProgressWrap,
      scanBtn, stopBtn, dryRun, companySelect, maxPerSource,
      t, c, refreshResults, resetResultsCache,
    } = ctx;

    // v1.46.0 (WS2 #6/#21/#24) — run-state, Stop, persistent error banner.
    let activeES = null;   // in-flight EventSource handle (for #6 Stop)
    let lastRunFn = null;  // for the #24 Retry action

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
    }
    function stopScan() {
      if (activeES) { try { activeES.close(); } catch { /* already closed */ } activeES = null; }
      __cancelActiveScanPoll();
      appendMeta(consoleEl, '\n■ ' + t('scan.stopped', 'stopped') + '\n');
      announce(t('scan.statusStopped', 'Scan stopped'));
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
          activeES = null;
          setScanRunning(false);
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
          activeES = null;
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
            activeES = null;
            setScanRunning(false);
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
          activeES = null;
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

    return { runScanAll, stopScan };
  };
})();

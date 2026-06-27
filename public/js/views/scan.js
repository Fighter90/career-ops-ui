/* global Router, API, UI, I18n */

// Module-level handle for the active scan-results poll. We track it across
// view renders so navigating away from /scan during an in-flight scan
// doesn't leak setInterval timers (one per scan) into the page lifetime.
let __activeScanPollHandle = null;
// v1.22.0 (L-5) — also track the post-done setTimeout below; navigating
// off `#/scan` in the 300 ms window between an `event: done` and the
// final refreshResults() used to leak the timer + the toast.
let __activeScanDoneTimeout = null;
function __cancelActiveScanPoll() {
  if (__activeScanPollHandle) {
    clearInterval(__activeScanPollHandle);
    __activeScanPollHandle = null;
  }
  if (__activeScanDoneTimeout) {
    clearTimeout(__activeScanDoneTimeout);
    __activeScanDoneTimeout = null;
  }
}
// Cancel on every route change — the renderer always begins from a clean slate.
window.addEventListener('hashchange', __cancelActiveScanPoll);

Router.register('scan', async () => {
  // Clean up any stale poll from a previous /scan visit.
  __cancelActiveScanPoll();
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  let portalsData = null;
  let portalsErr = null;
  try {
    portalsData = await API.get('/api/portals');
  } catch (e) {
    portalsErr = e;
  }
  const p = portalsData?.portals || {};
  const companies = (p.tracked_companies || p.companies || []).filter((c) => c.enabled !== false);
  const apiCompanies = companies.filter((co) =>
    co.api ||
    /jobs\.ashbyhq\.com|jobs\.lever\.co|job-boards\.greenhouse\.io/.test(co.careers_url || '')
  );

  // v1.46.0 (WS2 #5) — the SSE log is an aria-live log region so SR
  // users hear each scanned line; tabindex makes it keyboard-scrollable.
  const consoleEl = c('pre', {
    className: 'console', id: 'scan-console',
    role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions',
    'aria-label': t('scan.consoleLabel', 'Scan output log'),
    tabindex: '0',
  }, t('scan.consoleReady'));
  // (#5) assertive region for terminal announcements (done / failed /
  // stopped) — visually hidden, separate from the polite log stream.
  const statusRegion = c('div', {
    id: 'scan-status', role: 'status', 'aria-live': 'assertive',
    className: 'visually-hidden',
  });
  // (#24) persistent error banner with a Retry — replaces relying on
  // the 3.5 s toast alone for a failed/aborted scan.
  const errBanner = c('div', {
    id: 'scan-error', role: 'alert',
    className: 'card scan-error-banner',
  });
  errBanner.hidden = true;
  // v1.63.0 — indeterminate progress bar; shown while a scan is in flight
  // (toggled by setScanRunning), hidden otherwise. v1.63.1 — wrapped with a
  // visible "Scanning…" caption and a taller (8px) bar so it's noticeable.
  // v1.63.2 — native <progress> with a custom background renders as a static
  // gray bar. Use a div track + bar: indeterminate animated stripe until the
  // first `progress` SSE event, then a determinate fill showing live %.
  const scanProgressBar = c('div', { className: 'scan-progress__bar' });
  const scanProgress = c('div', {
    id: 'scan-progress', className: 'scan-progress',
    role: 'progressbar', 'aria-label': t('scan.progress', 'Scanning…'),
    'aria-valuemin': '0', 'aria-valuemax': '100',
  }, [scanProgressBar]);
  const scanProgressLabel = c('span', { className: 'scan-progress-label', 'aria-hidden': 'true' }, t('scan.progress', 'Scanning…'));
  const scanProgressWrap = c('div', { className: 'scan-progress-wrap' }, [scanProgressLabel, scanProgress]);
  scanProgressWrap.hidden = true;

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
  const resultsEl = c('div', { id: 'scan-results' });

  const dryRun = c('input', { type: 'checkbox', id: 'dry-run' });
  const filterText = c('input', { className: 'input', placeholder: t('scan.filterText') });
  const filterRemote = c('select', { className: 'select' }, [
    c('option', { value: '' }, t('scan.allTypes')),
    c('option', { value: 'remote' }, t('scan.remoteOnly')),
    c('option', { value: 'hybrid' }, t('scan.hybrid')),
    c('option', { value: 'onsite' }, t('scan.onsite', 'on-site')),
    c('option', { value: 'reloc' }, t('scan.reloc')),
  ]);
  // v1.67.0 — salary от/до range. Numbers only; bounds are currency-agnostic
  // (see window.Skills.parseSalaryRange). v1.68.0 — when a bound is set, jobs
  // with no listed salary are dropped (window.Skills.salaryInRange). Labels
  // render ABOVE each input (the .field wrapper), so no in-field placeholder.
  const filterSalaryMin = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1000',
    className: 'input', 'aria-label': t('scan.salaryFrom', 'Salary from'),
  });
  const filterSalaryMax = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1000',
    className: 'input', 'aria-label': t('scan.salaryTo', 'Salary to'),
  });
  // v1.29.0 — source dropdown is now dynamic. We fetch the canonical
  // list from `GET /api/scan/sources` (backed by
  // `server/lib/sources/registry.mjs`) so adding a new adapter = one
  // edit in the registry, the dropdown updates automatically.
  // Fallback list mirrors the registry at build time and is only used
  // if the fetch fails (offline / server starting up / cached SPA hits
  // a temporarily-unreachable backend). Kept alphabetical by label.
  const FALLBACK_SOURCES = [
    { value: 'arbeitsagentur',  label: 'Arbeitsagentur' },
    { value: 'ashby',           label: 'Ashby' },
    { value: 'bamboohr',        label: 'BambooHR' },
    { value: 'breezy',          label: 'Breezy HR' },
    { value: 'comeet',          label: 'Comeet' },
    { value: 'glints',          label: 'Glints' },
    { value: 'greenhouse',      label: 'Greenhouse' },
    { value: 'ibm',             label: 'IBM' },
    { value: 'jobstreet',       label: 'Jobstreet / SEEK' },
    { value: 'lever',           label: 'Lever' },
    { value: 'personio',        label: 'Personio' },
    { value: 'recruitee',       label: 'Recruitee' },
    { value: 'remoteok',        label: 'RemoteOK' },
    { value: 'remotive',        label: 'Remotive' },
    { value: 'rss',             label: 'RSS' },
    { value: 'smartrecruiters', label: 'SmartRecruiters' },
    { value: 'solidjobs',       label: 'SolidJobs' },
    { value: 'workable',        label: 'Workable' },
    { value: 'workday',         label: 'Workday' },
    { value: 'workingnomads',   label: 'Working Nomads' },
    { value: 'geekjob',         label: 'GeekJob' },
    { value: 'getmatch',        label: 'GetMatch' },
    { value: 'habr-career',     label: 'Habr Career' },
    { value: 'hh.ru',           label: 'hh.ru' },
    { value: 'trudvsem',        label: 'Trudvsem' },
  ];
  const filterSource = c('select', { className: 'select' }, [
    c('option', { value: '' }, t('scan.allSources')),
  ]);
  function paintSourceOptions(list) {
    // Keep the "all sources" first option; drop the rest and re-render.
    while (filterSource.children.length > 1) filterSource.removeChild(filterSource.lastChild);
    list
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((s) => filterSource.appendChild(c('option', { value: s.value }, s.label)));
  }
  paintSourceOptions(FALLBACK_SOURCES);
  // Best-effort live refresh from the registry. Network failure → keep
  // the fallback list. Race vs. user interaction is fine — appending
  // to a <select> after first paint doesn't reset the user's choice.
  (async () => {
    try {
      const r = await API.get('/api/scan/sources');
      if (r && Array.isArray(r.sources) && r.sources.length) paintSourceOptions(r.sources);
    } catch {}
  })();
  // v1.78.0 — geography filter. A country <select> (with flag emoji) populated
  // from the countries detected in the current result set, so the user can keep
  // only roles tied to a given country — alongside the Remote/Hybrid/Onsite
  // work-type filter (search both country-bound AND remote work).
  const filterCountry = c('select', { className: 'select' }, [
    c('option', { value: '' }, t('scan.allCountries', 'All countries')),
  ]);
  function paintCountryOptions(rows) {
    const prev = filterCountry.value;
    while (filterCountry.children.length > 1) filterCountry.removeChild(filterCountry.lastChild);
    for (const co of window.Countries.countriesIn(rows)) {
      filterCountry.appendChild(c('option', { value: co.code }, `${co.flag} ${co.name} (${co.count})`));
    }
    if (prev && [...filterCountry.options].some((o) => o.value === prev)) filterCountry.value = prev;
  }
  const filterScope = c('select', { className: 'select' }, [
    c('option', { value: 'all' }, t('scan.scopeAll')),
    c('option', { value: 'fresh' }, t('scan.scopeFresh')),
  ]);

  const companySelect = c('select', { className: 'select', id: 'company-select' }, [
    c('option', { value: '' }, t('scan.allCompanies')),
    ...apiCompanies.map((co) => c('option', { value: co.name }, co.name)),
  ]);

  // v1.46.0 (WS2 #6/#21/#24) — run-state, Stop, persistent error banner.
  let activeES = null;   // in-flight EventSource handle (for #6 Stop)
  let lastRunFn = null;  // for the #24 Retry action
  const scanBtn = c('button', {
    className: 'btn btn-primary scan-run-btn',
    onClick: () => runScanAll(),
    title: 'Greenhouse + Ashby + Lever + Workable + SmartRecruiters + Workday + RSS + hh.ru + Habr Career',
  }, '🌐 ' + t('scan.btnRun', 'Scan'));
  const stopBtn = c('button', {
    className: 'btn btn-ghost scan-stop-btn',
    onClick: () => stopScan(),
  }, '■ ' + t('scan.stop', 'Stop'));
  stopBtn.hidden = true;

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
        const doneMsg = fresh != null ? `${kind}: ${fresh} new offers` : `${kind} done`;
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
  function runEnScan() {
    lastRunFn = runEnScan;
    const params = new URLSearchParams();
    params.set('source', 'ats');
    if (dryRun.checked) params.set('dryRun', '1');
    const company = companySelect.value;
    if (company) params.set('company', company);
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

    consoleEl.textContent = '';
    clearScanError();
    setScanRunning(true);
    lastRunFn = runScanAll;
    UI.toast(t('scan.runAll', 'Scanning all sources…'), 'success');

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
        // F-011: re-read /api/scan-results so the Active-Companies counter
        // + filters update incrementally between phases.
        refreshResults();
        // The consolidated `source=both` stream emits an intermediate
        // `done` with `final:false` (ATS) then a terminal one (Regional,
        // no `final` field). Only the terminal done ends the run.
        if (!data || data.final !== false) {
          activeES = null;
          setScanRunning(false);
          announce(t('scan.statusDone', 'Scan complete') + ' · NEW=' + totalNew);
        }
      } else if (ev === 'error') {
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
        if (totalNew > 0) UI.toast(`Scan: ${totalNew} new offers`, 'success');
      }, 800);
    });
  }

  // Render the rich table of last-scan results
  let lastResults = { en: null, ru: null };
  // Active chip selections (multi-select, intersection across categories)
  const activeTech = new Set();
  const activeLevel = new Set();
  const activeDynamic = new Set();

  async function refreshResults() {
    try {
      lastResults = await API.get('/api/scan-results');
    } catch {
      lastResults = { en: null, ru: null };
    }
    renderResults();
    // F-011: notify the Active-Companies counter (and any other listener)
    // that the result corpus changed so they can recompute their labels.
    document.body.dispatchEvent(new CustomEvent('scan:refresh'));
  }
  function getRows() {
    const scope = filterScope.value || 'all';
    const en = lastResults.en;
    const ru = lastResults.ru;
    const enRows = (scope === 'fresh' ? en?.fresh : (en?.filtered || en?.fresh)) || [];
    const ruRows = (scope === 'fresh' ? ru?.fresh : (ru?.filtered || ru?.fresh)) || [];
    return [...enRows, ...ruRows];
  }
  // v1.30.0 — replaces the hardcoded 200-row truncation. UI.paginate
  // auto-clamps the page when filters narrow the list (so the user
  // can't end up on an empty trailing page), and re-renders via
  // onChange when paginator buttons are clicked. PAGE_SIZE picked to
  // match the prior 200-row visual density per page.
  const PAGE_SIZE = 200;
  const pager = UI.paginate({ pageSize: PAGE_SIZE, onChange: () => renderResults() });
  function renderResults() {
    resultsEl.innerHTML = '';
    const allRows = getRows();
    // v1.78.0 — refresh the country dropdown from the (scope-filtered) corpus so
    // it lists exactly the countries present, each with a count.
    paintCountryOptions(allRows);
    const enWhen = lastResults.en?.when ? new Date(lastResults.en.when).toLocaleString('ru') : null;
    const ruWhen = lastResults.ru?.when ? new Date(lastResults.ru.when).toLocaleString('ru') : null;

    // Header summary — labels neutralized to "ATS / Regional" so the
    // adapter geography isn't baked into the UI (F-010).
    const atsLabel = t('scan.atsBadge', 'ATS adapters');
    const regionalLabel = t('scan.regionalBadge', 'Regional portals');
    const summary = c('div', { className: 'flex gap-3 mb-3', style: { flexWrap: 'wrap' } }, [
      enWhen && c('span', { className: 'badge badge-info' }, `${atsLabel} · ${enWhen} · ${lastResults.en.fresh?.length || 0} new / ${lastResults.en.filtered?.length || 0} matching`),
      ruWhen && c('span', { className: 'badge badge-info' }, `${regionalLabel} · ${ruWhen} · ${lastResults.ru.fresh?.length || 0} new / ${lastResults.ru.filtered?.length || 0} matching`),
    ]);
    resultsEl.appendChild(summary);

    if (!allRows.length) {
      resultsEl.appendChild(c('div', { className: 'empty' }, t('scan.noResults')));
      return;
    }

    // ── Chip facets (skills + level + dynamic keywords) ──
    // Dynamic keywords adapt to whatever roles the user actually scanned —
    // gives meaningful chips even for non-engineering profiles (marketing,
    // design, finance, …) where the hardcoded TECH_GROUPS would be empty.
    const facets = window.Skills.computeFacets(allRows);
    // Filter dynamic keywords by script — non-Russian UI shouldn't show
    // Cyrillic-only tokens like "разработчик" leaking from Habr data.
    const lang = (window.I18n && I18n.getLang()) || 'en';
    const script = lang === 'ru' ? 'all' : 'latin';
    const dynKeywords = window.Skills.extractDynamicKeywords(allRows, { limit: 20, script });
    const dynCounts = Object.fromEntries(dynKeywords);
    // v1.55.6 — UX-4: the stack / level / dynamic facet chips are a
    // secondary refinement — collapse them behind the same "Advanced
    // filters" disclosure so a fresh result set leads with the table,
    // not a wall of chips. The body keeps the original flex-column.
    const chipsContainer = c('details', { className: 'mb-3 scan-advanced' });
    chipsContainer.appendChild(c('summary', null, t('scan.advancedFilters', 'Advanced filters')));
    const chipsBody = c('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    if (Object.keys(facets.tech).length) chipsBody.appendChild(buildChipRow(t('scan.chip.stack'), facets.tech, activeTech));
    if (Object.keys(facets.level).length) chipsBody.appendChild(buildChipRow(t('scan.chip.level'), facets.level, activeLevel));
    if (dynKeywords.length) chipsBody.appendChild(buildChipRow(t('scan.chip.dynamic', 'Keywords'), dynCounts, activeDynamic));
    // Only surface the cluster when there is at least one chip row.
    if (chipsBody.childNodes.length) {
      chipsContainer.appendChild(chipsBody);
      resultsEl.appendChild(chipsContainer);
    }

    // ── Now apply ALL filters (text/remote/source + chips) ──
    const q = (filterText.value || '').toLowerCase().trim();
    const fr = filterRemote.value;
    const fs = filterSource.value;
    const fc = filterCountry.value; // v1.78.0 — country code or '' (all)
    const salMin = parseInt(filterSalaryMin.value, 10);
    const salMax = parseInt(filterSalaryMax.value, 10);
    const rows = allRows.filter((r) => {
      if (q && !((r.company + ' ' + r.title + ' ' + (r.location || '')).toLowerCase().includes(q))) return false;
      if (fr === 'remote' && !r.isRemote) return false;
      if (fr === 'hybrid' && !/hybrid/i.test(r.workplaceType || '')) return false;
      if (fr === 'onsite' && (r.isRemote || /remote|hybrid/i.test(r.workplaceType || ''))) return false;
      if (fr === 'reloc' && !r.relocates) return false;
      if (fs && r.source !== fs) return false;
      if (fc && !window.Countries.rowInCountry(r, fc)) return false;
      if (!window.Skills.salaryInRange(r, salMin, salMax)) return false;
      if (!window.Skills.rowMatches(r, activeTech, activeLevel)) return false;
      if (activeDynamic.size) {
        let any = false;
        for (const k of activeDynamic) if (window.Skills.rowHasKeyword(r, k)) { any = true; break; }
        if (!any) return false;
      }
      return true;
    });
    if (!rows.length) {
      resultsEl.appendChild(c('div', { className: 'empty' }, t('track.noMatch')));
      return;
    }
    // v1.12.0 — sort boosted rows to the top of each render. Stable
    // within the boosted/non-boosted partition so the underlying scan
    // order is preserved otherwise. Boost is sourced from
    // `portals.yml::title_filter.seniority_boost` and stamped server-side
    // by both en-scanner and ru-scanner.
    // v1.30.0 — sort the FULL filtered set FIRST (so the boost-to-top
    // invariant holds across pages), then page-slice.
    const sortedAll = rows.slice().sort((a, b) => {
      const ab = a && a._boosted ? 1 : 0;
      const bb = b && b._boosted ? 1 : 0;
      return bb - ab;
    });
    const sorted = pager.slice(sortedAll);
    const tbody = c('tbody', null, sorted.map((r) => {
      const wt = r.workplaceType || (r.isRemote ? 'Remote' : 'Onsite');
      const wtClass = /remote/i.test(wt) ? 'badge-ok' : /hybrid/i.test(wt) ? 'badge-info' : '';
      // Title cell shows a "⬆ boosted" pill before the link when the
      // server-side scanner matched a `seniority_boost` keyword on the
      // title. Title attribute reveals WHICH keyword matched, so the
      // user can trace it back to portals.yml.
      // v1.76.0 — trust badge (parent career-ops v1.13.0). Only shown when
      // trust_filter is enabled AND the posting is below "high" trust. The badge
      // is language-neutral (⚠ + score/100); the tooltip lists the flag codes,
      // so it renders identically across all 12 locales with no i18n keys.
      const trustBadge = (r._trustLevel && r._trustLevel !== 'high') ? c('span', {
        className: 'badge ' + (r._trustLevel === 'low' ? 'badge-bad' : 'badge-warn'),
        title: 'Trust ' + (r._trustScore != null ? r._trustScore + '/100' : '?')
          + (r._trustFlags && r._trustFlags.length ? ' · ' + r._trustFlags.join(', ') : ''),
        style: { marginRight: '6px', fontSize: '11px' },
      }, '⚠ ' + (r._trustScore != null ? r._trustScore : '')) : null;
      const titleCell = c('td', null, [
        r._boosted ? c('span', {
          className: 'badge badge-info',
          title: t('scan.boostedBy', 'Boosted by') + ': ' + (r._boostedBy || '?'),
          style: { marginRight: '6px', fontSize: '11px' },
        }, '⬆ ' + t('scan.boosted', 'boosted')) : null,
        trustBadge,
        c('a', { href: r.url, target: '_blank', rel: 'noopener', style: { color: 'var(--rausch)' } }, r.title),
      ]);
      return c('tr', null, [
        c('td', { style: { minWidth: '160px' } }, r.company || '—'),
        titleCell,
        c('td', { style: { fontSize: '13px', color: 'var(--foggy)' } }, r.location || '—'),
        c('td', null, c('span', { className: 'badge ' + wtClass }, wt)),
        c('td', null, r.relocates ? c('span', { className: 'badge badge-info' }, 'reloc') : ''),
        c('td', { style: { fontSize: '13px', color: 'var(--foggy)' } }, r.salary || ''),
        c('td', null, c('span', { className: 'tag' }, r.source)),
      ]);
    }));
    resultsEl.appendChild(c('div', { className: 'table-wrap' },
      c('table', { className: 'tbl' }, [
        c('thead', null, c('tr', null,
          [t('scan.col.company'), t('scan.col.role'), t('scan.col.loc'), t('scan.col.type'), 'Reloc', t('scan.col.salary'), t('scan.col.source')].map((h) => c('th', null, h))
        )),
        tbody,
      ])
    ));
    // v1.30.0 — paginator replaces the v1.12-v1.29.x "first 200 of N"
    // hint. controls() returns null when there's only one page, so
    // small result sets stay clean.
    resultsEl.appendChild(pager.controls(sorted.length, rows.length));
  }

  // v1.68.0 — filters are now Apply-driven (was live-on-input). The user asked
  // for an explicit "Apply" so the salary range visibly re-filters the results.
  function applyFilters() { pager.reset(); renderResults(); }
  function resetFilters() {
    filterText.value = '';
    filterRemote.value = '';
    filterSalaryMin.value = '';
    filterSalaryMax.value = '';
    filterSource.value = '';
    filterCountry.value = '';
    filterScope.value = 'all';
    applyFilters();
  }
  // Enter in any text/number field applies (keyboard parity with the button).
  ;[filterText, filterSalaryMin, filterSalaryMax].forEach((el) =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilters(); } }));
  // Selects feel broken if they need a second click, so they apply on change.
  ;[filterRemote, filterSource, filterCountry, filterScope].forEach((el) =>
    el.addEventListener('change', applyFilters));
  const applyBtn = c('button', { className: 'btn btn-primary', type: 'button', onClick: applyFilters }, t('scan.applyFilters', 'Apply'));
  const resetBtn = c('button', { className: 'btn btn-ghost', type: 'button', onClick: resetFilters }, t('scan.resetFilters', 'Reset'));
  // Labelled field: the control is WRAPPED in a <label> (implicit association
  // → accessible name for SR users, no id wiring needed). .field is a flex
  // column so the caption text sits ABOVE the control.
  const field = (labelText, el) => c('label', { className: 'field scan-field' }, [c('span', { className: 'scan-field__label' }, labelText), el]);

  // Build a chip row for one facet category. Active selections survive across re-renders
  // because activeTech / activeLevel are scoped above.
  function buildChipRow(label, counts, activeSet) {
    const row = c('div', { className: 'chip-row' }, c('span', { className: 'chip-label' }, label));
    // Sort by count desc, then alpha
    const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!ordered.length) {
      row.appendChild(c('span', { style: { color: 'var(--foggy)', fontSize: '12px' } }, '—'));
      return row;
    }
    for (const [name, count] of ordered) {
      const isOn = activeSet.has(name);
      const chip = c('span', {
        className: 'chip' + (isOn ? ' on' : ''),
        onClick: () => {
          if (activeSet.has(name)) activeSet.delete(name);
          else activeSet.add(name);
          renderResults();
        },
      }, [name, c('span', { className: 'chip-count' }, String(count))]);
      row.appendChild(chip);
    }
    if (activeSet.size) {
      row.appendChild(c('span', {
        className: 'chip clear',
        onClick: () => { activeSet.clear(); renderResults(); },
      }, t('scan.chip.clear')));
    }
    return row;
  }

  // load results on first render
  refreshResults();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('scan.title')),
        // F-010: neutral label, no EN/RU split. apiCompanies is the
        // count of ATS-tracked companies; the rest are regional portals.
        c('p', { className: 'page-subtitle' }, t('scan.subtitle')),
      ]),
    ]),

    // v1.65.0 — hh.ru is now scraped from its public website (works from any
    // IP, no User-Agent / proxy setup), so the old HH_USER_AGENT diagnostics
    // card is gone for good.
    null,

    c('div', { className: 'card mb-3' }, [
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', alignItems: 'flex-end' } }, [
        c('div', { className: 'field', style: { flex: 1, marginBottom: 0, minWidth: '220px' } }, [
          c('label', { htmlFor: 'company-select' }, t('scan.companyLbl')),
          companySelect,
        ]),
        c('label', { className: 'flex', htmlFor: 'dry-run', style: { gap: '8px', userSelect: 'none' } }, [
          dryRun, c('span', null, t('scan.dryRun')),
        ]),
        // Single "Scan" button — runs every enabled source (EN APIs +
        // RU portals) in one go. The earlier separate EN-scan / RU-scan
        // buttons were noisy; users almost always want everything.
        // Title attribute lists what it actually crawls so the
        // expectation is set on hover.
        scanBtn,
        stopBtn,
        c('button', { className: 'btn btn-ghost', onClick: () => Router.go('/pipeline') }, t('scan.btnPipe')),
      ]),
    ]),

    c('div', null, [errBanner, scanProgressWrap, statusRegion, consoleEl]),

    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title', style: { marginTop: 0 } }, t('scan.results')),
      // v1.68.0 — every filter is a labelled .field (label ABOVE the control),
      // laid out in one panel so it's obvious what each box does. An explicit
      // Apply button re-runs the filter (esp. the salary range); Reset clears.
      c('div', { className: 'scan-filters', role: 'group', 'aria-label': t('scan.filtersGroup', 'Result filters') }, [
        field(t('scan.lblSearch', 'Search'), filterText),
        field(t('scan.lblType', 'Work type'), filterRemote),
        field(t('scan.salaryFrom', 'Salary from'), filterSalaryMin),
        field(t('scan.salaryTo', 'Salary to'), filterSalaryMax),
        field(t('scan.lblSource', 'Source'), filterSource),
        field(t('scan.lblCountry', 'Country'), filterCountry),
        field(t('scan.lblScope', 'Scope'), filterScope),
        c('div', { className: 'scan-filters__actions field' }, [
          c('label', { 'aria-hidden': 'true', style: { visibility: 'hidden' } }, '·'),
          c('div', { className: 'flex', style: { gap: '8px' } }, [applyBtn, resetBtn]),
        ]),
      ]),
      c('p', { className: 'field-hint scan-filters__hint' }, t('scan.filtersHint',
        'Fill any boxes and press Apply. Salary from/to keeps only jobs whose pay overlaps your range — jobs with no listed salary are hidden once you set a salary. Amounts are compared as plain numbers (currency is ignored).')),
      resultsEl,
    ]),

    (() => {
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
        const apiSet = new Set(apiCompanies);
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
            onClick: () => {
              filterText.value = name;
              applyFilters();
              filterText.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
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
      function activeFromLastScan() {
        const rows = getRows();
        const seen = new Set();
        for (const r of rows) {
          const name = (r && (r.company || r.companyName));
          if (name) seen.add(String(name).toLowerCase());
        }
        return seen.size;
      }
      const labelN = () => {
        const fromScan = activeFromLastScan();
        const n = fromScan > 0 ? fromScan : companies.length;
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
      // Hook into the existing refreshResults() flow without restructuring
      // the closure: every renderResults() call invalidates this counter,
      // and renderResults() is itself called from refreshResults() right
      // after the new /api/scan-results comes back. Re-stamp the label
      // every time the SSE done event fires by listening to a custom
      // event the page dispatches on body.
      document.body.addEventListener('scan:refresh', setLabel);

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
        fetch('/api/scan-results').then((r) => r.json()).then((d) => {
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
      document.body.addEventListener('scan:refresh', refreshWorkdayChip);
      // Initial check on page load so users who navigate to /#/scan after
      // a prior session's blocked Workday see the chip immediately.
      refreshWorkdayChip();

      return c('div', { className: 'card mt-5' }, [
        wdFallback,
        portalsErr
          ? c('div', { className: 'empty' }, [
              c('strong', null, t('scan.failedPortals')),
              c('p', { style: { color: 'var(--foggy)', marginTop: '8px' } }, portalsErr.message),
            ])
          : companies.length === 0
          ? c('div', { className: 'empty' }, t('scan.allDisabled'))
          : c('div', null, [toggleBtn, filterIn, list]),
      ]);
    })(),
  ]);
});

function appendMeta(el, text) {
  const span = document.createElement('span');
  span.className = 'meta';
  span.textContent = text;
  el.appendChild(span);
  el.scrollTop = el.scrollHeight;
}

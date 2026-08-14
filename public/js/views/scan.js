/* global Router, API, UI, I18n, HelpHint */

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
  // v1.89.0 (Epic 14) — the saved two-pager powers a "fit-to-what-you-want"
  // badge on each result row. Best-effort load; absent/empty → no badge.
  let twoPagerData = null;
  try { ({ twoPager: twoPagerData } = await API.get('/api/two-pager')); }
  catch { twoPagerData = null; }

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
  const resultsEl = c('div', { id: 'scan-results' });

  const dryRun = c('input', { type: 'checkbox', id: 'dry-run' });
  const filterText = c('input', { className: 'input', id: 'scan-filter-text', placeholder: t('scan.filterText') });
  // v1.109.0 — "Exclude" keywords: comma-separated terms; a row is hidden if its
  // company/title/location contains ANY of them. Pairs with the include search
  // (which now treats commas as OR — "roles to find").
  const filterExclude = c('input', { className: 'input', id: 'scan-filter-exclude', placeholder: t('scan.filterExclude', 'Exclude words (comma-separated)…') });
  // v1.78.1 — consume a one-shot search term handed off from the top-bar global
  // search (Enter on a non-URL query → #/scan with this box pre-filled). The
  // initial SR.render() below reads filterText.value, so the first paint is
  // already filtered by the term.
  if (window.__scanSearchPrefill) {
    filterText.value = window.__scanSearchPrefill;
    window.__scanSearchPrefill = '';
  }
  const filterRemote = c('select', { className: 'select', id: 'scan-filter-remote' }, [
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
    className: 'input', id: 'scan-filter-salary-min', 'aria-label': t('scan.salaryFrom', 'Salary from'),
  });
  const filterSalaryMax = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1000',
    className: 'input', id: 'scan-filter-salary-max', 'aria-label': t('scan.salaryTo', 'Salary to'),
  });
  // v1.29.0 — source dropdown is now dynamic. We fetch the canonical
  // list from `GET /api/scan/sources` (backed by
  // `server/lib/sources/registry.mjs`) so adding a new adapter = one
  // edit in the registry, the dropdown updates automatically.
  // Fallback list mirrors the registry at build time and is only used
  // if the fetch fails (offline / server starting up / cached SPA hits
  // a temporarily-unreachable backend). Kept alphabetical by label.
  const filterSource = c('select', { className: 'select', id: 'scan-filter-source' }, [
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
  paintSourceOptions(window.ScanResults.FALLBACK_SOURCES);
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
  const filterCountry = c('select', { className: 'select', id: 'scan-filter-country' }, [
    c('option', { value: '' }, t('scan.allCountries', 'All countries')),
  ]);
  const filterScope = c('select', { className: 'select', id: 'scan-filter-scope' }, [
    c('option', { value: 'all' }, t('scan.scopeAll')),
    c('option', { value: 'fresh' }, t('scan.scopeFresh')),
  ]);
  // v1.80.0 — "Posted within" age filter (client-side, by job.date). Jobs with
  // no listed date pass (don't penalize missing data, like the other filters).
  const filterAge = c('select', { className: 'select', id: 'scan-filter-age' }, [
    c('option', { value: '' }, t('scan.ageAny', 'Any time')),
    c('option', { value: '1' }, t('scan.age1d', 'Last 24 hours')),
    c('option', { value: '7' }, t('scan.age7d', 'Last 7 days')),
    c('option', { value: '30' }, t('scan.age30d', 'Last 30 days')),
  ]);
  // v1.129.0 — Seniority facet (zero-token, client-side via job-facets.js).
  // Buckets each posting's title into lead/staff/senior/mid/junior/intern;
  // the dropdown auto-populates from what's actually in the results (like the
  // country filter). Titles with no seniority word (bucket null) always pass.
  const filterSeniority = c('select', { className: 'select', id: 'scan-filter-seniority' }, [
    c('option', { value: '' }, t('scan.allSeniority', 'All seniority')),
  ]);
  // v1.80.0 — ⭐ favorites-only toggle (localStorage-backed, by job URL).
  const favOnly = c('input', { type: 'checkbox', id: 'fav-only' });

  const companySelect = c('select', { className: 'select', id: 'company-select' }, [
    c('option', { value: '' }, t('scan.allCompanies')),
    ...apiCompanies.map((co) => c('option', { value: co.name }, co.name)),
  ]);
  // v1.80.0 — optional per-source cap (0/empty = unlimited, the default).
  const maxPerSource = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '10',
    className: 'input', placeholder: '∞',
    'aria-label': t('scan.maxPerSource', 'Max jobs per source'),
    style: { maxWidth: '110px' },
  });

  // v1.46.0 (WS2 #6/#21/#24) — run-state, Stop, persistent error banner.
  // The scan-execution engine (progress bar, run-state, Stop, SSE stream, and the
  // per-source runners) lives in public/js/views/scan/runner.js; `runner` is
  // assigned below once SR / refreshResults exist. The buttons defer to it — the
  // onClick arrows resolve `runner.*` at click time, after the factory has run.
  let runner;
  const scanBtn = c('button', {
    className: 'btn btn-primary scan-run-btn',
    onClick: () => runner.runScanAll(),
    title: 'Greenhouse + Ashby + Lever + Workable + SmartRecruiters + Workday + RSS + hh.ru + Habr Career',
  }, '🌐 ' + t('scan.btnRun', 'Scan'));
  const stopBtn = c('button', {
    className: 'btn btn-ghost scan-stop-btn',
    onClick: () => runner.stopScan(),
  }, '■ ' + t('scan.stop', 'Stop'));
  stopBtn.hidden = true;

  // v1.80.0 — reset the results cache before a scan so the table visibly clears,
  // then the live poll + terminal `done` refill it with the new run's results.
  function resetResultsCache() {
    lastResults = { en: null, ru: null };
    SR.render();
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
    SR.render();
    // F-011: notify the Active-Companies counter (and any other listener)
    // that the result corpus changed so they can recompute their labels.
    document.body.dispatchEvent(new CustomEvent('scan:refresh'));
  }
  // v1.30.0 — replaces the hardcoded 200-row truncation. UI.paginate
  // auto-clamps the page when filters narrow the list (so the user
  // can't end up on an empty trailing page), and re-renders via
  // onChange when paginator buttons are clicked. PAGE_SIZE picked to
  // match the prior 200-row visual density per page.
  const PAGE_SIZE = 200;
  const pager = UI.paginate({ pageSize: PAGE_SIZE, onChange: () => SR.render() });
  // v1.132.0 — the results-rendering subsystem was extracted to
  // public/js/lib/scan-results.js (file-size-contract split). It closes over
  // this context; lastResults is passed as a getter because refreshResults()
  // reassigns it. FALLBACK_SOURCES also moved there (window.ScanResults).
  const SR = window.ScanResults.create({
    resultsEl, t,
    filterScope, filterText, filterExclude, filterRemote, filterSource,
    filterCountry, filterSeniority, filterAge, favOnly, filterSalaryMin, filterSalaryMax,
    activeTech, activeLevel, activeDynamic, pager, twoPagerData,
    getLastResults: () => lastResults,
  });

  // The scan-execution engine is created now that SR + refreshResults +
  // resetResultsCache all exist; the Scan/Stop buttons defer to it via `runner`
  // (file-size split → public/js/views/scan/runner.js).
  runner = window.createScanRunner({
    consoleEl, statusRegion, errBanner,
    scanProgress, scanProgressBar, scanProgressLabel, scanProgressWrap,
    scanBtn, stopBtn, dryRun, companySelect, maxPerSource,
    t, c, refreshResults, resetResultsCache,
  });

  // v1.68.0 — filters are now Apply-driven (was live-on-input). The user asked
  // for an explicit "Apply" so the salary range visibly re-filters the results.
  // The filter state machine (apply/reset + saved-search serialization) lives in
  // public/js/views/scan/filters.js (file-size split).
  const { applyFilters, resetFilters, getFilterState, setFilterState } = window.createScanFilters(
    {
      filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
      filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
      activeTech, activeLevel, activeDynamic,
    },
    { pager, SR },
  );
  // Enter in any text/number field applies (keyboard parity with the button).
  ;[filterText, filterExclude, filterSalaryMin, filterSalaryMax].forEach((el) =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilters(); } }));
  // Selects/checkboxes feel broken if they need a second click, so they apply on change.
  ;[filterRemote, filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly].forEach((el) =>
    el.addEventListener('change', applyFilters));

  // v1.80.0 — saved-searches bar (localStorage via window.ScanPrefs).
  const ssSelect = c('select', { className: 'select', 'aria-label': t('scan.savedSearches', 'Saved searches') },
    [c('option', { value: '' }, t('scan.savedNone', 'Saved searches…'))]);
  const ssName = c('input', { className: 'input', placeholder: t('scan.savedName', 'Name this search…'), style: { maxWidth: '200px' } });
  function refreshSavedSearches(selected) {
    while (ssSelect.children.length > 1) ssSelect.removeChild(ssSelect.lastChild);
    for (const s of window.ScanPrefs.listSearches()) ssSelect.appendChild(c('option', { value: s.name }, s.name));
    if (selected != null) ssSelect.value = selected;
  }
  refreshSavedSearches();
  ssSelect.addEventListener('change', () => {
    const name = ssSelect.value;
    if (!name) return;
    const s = window.ScanPrefs.getSearch(name);
    if (s) setFilterState(s.filters);
  });
  const ssSaveBtn = c('button', { className: 'btn btn-ghost', type: 'button', onClick: () => {
    const name = (ssName.value || '').trim();
    if (!name) { UI.toast(t('scan.savedNeedName', 'Enter a name to save the search'), 'error'); return; }
    window.ScanPrefs.saveSearch(name, getFilterState());
    ssName.value = '';
    refreshSavedSearches(name);
    UI.toast(t('scan.savedOk', 'Search saved'), 'success');
  } }, '💾 ' + t('scan.saveSearch', 'Save search'));
  const ssDelBtn = c('button', { className: 'btn btn-ghost', type: 'button', onClick: () => {
    const name = ssSelect.value;
    if (!name) return;
    window.ScanPrefs.removeSearch(name);
    refreshSavedSearches('');
    UI.toast(t('scan.savedDeleted', 'Search deleted'), 'success');
  } }, '🗑 ' + t('scan.deleteSearch', 'Delete'));
  const savedSearchBar = c('div', { className: 'flex', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' } },
    [ssSelect, ssName, ssSaveBtn, ssDelBtn]);
  const applyBtn = c('button', { className: 'btn btn-primary', type: 'button', id: 'scan-apply', onClick: applyFilters }, t('scan.applyFilters', 'Apply'));
  const resetBtn = c('button', { className: 'btn btn-ghost', type: 'button', onClick: resetFilters }, t('scan.resetFilters', 'Reset'));
  // Labelled field: the control is WRAPPED in a <label> (implicit association
  // → accessible name for SR users, no id wiring needed). .field is a flex
  // column so the caption text sits ABOVE the control.
  const field = (labelText, el) => c('label', { className: 'field scan-field' }, [c('span', { className: 'scan-field__label' }, labelText), el]);


  // v1.83.0 — repost / ghost-posting detector.
  // A collapsed panel that lazy-loads GET /api/scan/reposts on first open:
  // company+role clusters re-listed under different URLs within a window =
  // likely stale / ghost postings. CSP-safe (addEventListener, no innerHTML).
  const repostsBody = c('div', { className: 'reposts-body' });
  const repostsPanel = c('details', { className: 'card mb-3 reposts' }, [
    c('summary', { className: 'reposts-summary' }, '🔁 ' + t('scan.reposts.title', 'Reposted / ghost roles')),
    repostsBody,
  ]);
  let repostsLoaded = false;
  repostsPanel.addEventListener('toggle', async () => {
    if (!repostsPanel.open || repostsLoaded) return;
    repostsLoaded = true;
    repostsBody.textContent = t('common.loading', 'Loading…');
    try {
      const d = await API.get('/api/scan/reposts');
      repostsBody.textContent = '';
      const clusters = Array.isArray(d.clusters) ? d.clusters : [];
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

  // load results on first render
  refreshResults();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('scan.title'), 'help.hint.scan'),
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
        // v1.80.0 — optional per-source cap (∞ by default).
        c('div', { className: 'field', style: { marginBottom: 0 } }, [
          c('label', null, t('scan.maxPerSource', 'Max per source')),
          maxPerSource,
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

    repostsPanel,

    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title', style: { marginTop: 0 } }, t('scan.results')),
      // v1.80.0 — saved-searches bar (name + Save + apply/delete).
      savedSearchBar,
      // v1.68.0 — every filter is a labelled .field (label ABOVE the control),
      // laid out in one panel so it's obvious what each box does. An explicit
      // Apply button re-runs the filter (esp. the salary range); Reset clears.
      c('div', { className: 'scan-filters', role: 'group', 'aria-label': t('scan.filtersGroup', 'Result filters') }, [
        field(t('scan.lblSearch', 'Search'), filterText),
        field(t('scan.lblExclude', 'Exclude'), filterExclude),
        field(t('scan.lblType', 'Work type'), filterRemote),
        field(t('scan.salaryFrom', 'Salary from'), filterSalaryMin),
        field(t('scan.salaryTo', 'Salary to'), filterSalaryMax),
        field(t('scan.lblSource', 'Source'), filterSource),
        field(t('scan.lblCountry', 'Country'), filterCountry),
        field(t('scan.lblSeniority', 'Seniority'), filterSeniority),
        field(t('scan.lblAge', 'Posted within'), filterAge),
        field(t('scan.lblScope', 'Scope'), filterScope),
        // v1.80.0 — ⭐ favorites-only toggle (labelled checkbox field).
        c('label', { className: 'field scan-field', htmlFor: 'fav-only' }, [
          c('span', { className: 'scan-field__label' }, t('scan.favOnly', '★ Favorites')),
          c('span', { className: 'flex', style: { gap: '6px', alignItems: 'center', height: '38px' } }, [favOnly, c('span', { style: { fontSize: '13px', color: 'var(--foggy)' } }, t('scan.favOnlyHint', 'starred only'))]),
        ]),
        // v1.148.0 — actions are a full-width, right-aligned row (styled by
        // .scan-filters__actions); the old hidden-label alignment hack + inner
        // flex wrapper are no longer needed.
        c('div', { className: 'scan-filters__actions' }, [applyBtn, resetBtn]),
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
        const rows = SR.getRows();
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
      // the closure: every SR.render() call invalidates this counter,
      // and SR.render() is itself called from refreshResults() right
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

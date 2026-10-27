/* global Router, API, UI, I18n, HelpHint */

// Module-level handle for the active scan-results poll. We track it across
// view renders so navigating away from /scan during an in-flight scan
// doesn't leak setInterval timers (one per scan) into the page lifetime.
let __activeScanPollHandle = null;
// v1.22.0 (L-5) — also track the post-done setTimeout below; navigating
// off `#/scan` in the 300 ms window between an `event: done` and the
// final refreshResults() used to leak the timer + the toast.
let __activeScanDoneTimeout = null;
// Language-switch survival: I18n.onChange re-renders the CURRENT view, and
// everything declared inside render() is recreated — including the loaded
// results corpus and the user's filter-chip selections. A language switch
// therefore blanked #/scan (the heavy /api/scan-results round-trip re-ran
// from scratch, leaving a seconds-long empty page on data-heavy instances)
// and reset the facet chips. These live at module level so a re-render
// repaints the already-loaded corpus instantly; refreshResults() still
// refreshes in the background as before.
let lastResults = { en: null, ru: null };
let refreshSeq = 0;
let resultsEverLoaded = false;
const activeTech = new Set();
const activeLevel = new Set();
const activeDynamic = new Set();
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

// v1.243.0 (views-3) — the Active-companies counter label and the
// Workday-fallback chip subscribed to the body-level 'scan:refresh' event on
// EVERY #/scan visit and were never removed: N visits = N handlers per
// refresh tick, each re-fetching /api/scan-results. Track this visit's
// subscriptions in module scope and detach them all on route change (the
// router always begins a new view from a clean slate).
const __scanRefreshListeners = new Set();
function addScanRefreshListener(fn) {
  document.body.addEventListener('scan:refresh', fn);
  __scanRefreshListeners.add(fn);
}
// CAR-115 — same tracked-subscription pattern for the filter bar's
// outside-click/Escape handlers (any event type on body).
const __scanBodyListeners = new Set();
function addScanBodyListener(type, fn) {
  document.body.addEventListener(type, fn);
  __scanBodyListeners.add([type, fn]);
}
function detachScanBodyListeners() {
  for (const [type, fn] of __scanBodyListeners) {
    try { document.body.removeEventListener(type, fn); } catch { /* stub env */ }
  }
  __scanBodyListeners.clear();
}
function detachScanRefreshListeners() {
  for (const fn of __scanRefreshListeners) document.body.removeEventListener('scan:refresh', fn);
  __scanRefreshListeners.clear();
}

// v1.243.0 (views-3) — the scan-execution engine (scan/runner.js) of the
// CURRENT #/scan view. Its EventSource was orphaned on navigate-away: the
// SSE stream stayed open (the server keeps scanning; the next Scan click hit
// SCAN_BUSY) while the view kept streaming into detached nodes. The
// hashchange handler below closes it silently.
let __activeScanRunner = null;
function __teardownActiveScanRunner() {
  const r = __activeScanRunner;
  __activeScanRunner = null;
  if (r && typeof r.teardown === 'function') {
    try { r.teardown(); } catch { /* detached DOM is fine to touch */ }
  }
}

// CAR-115 review r2 — the live filter debounce must not outlive the route:
// a pending 250 ms timer firing after a hashchange would render into the
// detached tree and replaceState('#/scan?…') over ANOTHER page's URL. The
// view registers its timer handle here; the hashchange handler (and the
// same-mount re-render path) cancels it.
let __scanCommitTimerCancel = null;
function __cancelScanCommitDebounce() {
  if (typeof __scanCommitTimerCancel === 'function') __scanCommitTimerCancel();
  __scanCommitTimerCancel = null;
}

// Cancel on every route change — the renderer always begins from a clean slate.
window.addEventListener('hashchange', () => {
  __cancelActiveScanPoll();
  __teardownActiveScanRunner();
  __cancelScanCommitDebounce();
  detachScanRefreshListeners();
  detachScanBodyListeners();
});

// v1.244.0 — UI.paginate pins pageSize at creation, but the #/scan page-size
// control (the scan-redesign contract's #scan-page-size) must change it at
// runtime. Swap the inner paginator behind a stable facade (a size change
// starts a fresh page 0); SR and the filter state machine keep holding ONE
// pager object, so no other file learns about the swap.
function createResizablePager(initialSize, onChange) {
  let inner = UI.paginate({ pageSize: initialSize, onChange });
  return {
    get page() { return inner.page; },
    get pageSize() { return inner.pageSize; },
    reset() { inner.reset(); },
    slice(arr) { return inner.slice(arr); },
    controls(visibleCount, totalCount) { return inner.controls(visibleCount, totalCount); },
    setPageSize(n) { inner = UI.paginate({ pageSize: n, onChange }); },
  };
}

// v1.243.0 (views-3) — adapter-aware API classification. The old inline
// 3-host regex (jobs.ashbyhq.com | jobs.lever.co | job-boards.greenhouse.io)
// had drifted from the server adapter registry: eu.greenhouse / eu.lever
// boards and Workday / SmartRecruiters / Workable companies were labelled
// "Web-search only" and the Active-companies denominator shrank. Classify
// against the REGISTRY the view already fetches (GET /api/scan/sources →
// adapter ids, with the drift-gated FALLBACK_SOURCES until it lands): an
// explicit `api:` field, an explicit `provider:` matching an adapter id, or
// a careers_url host naming one (myworkdayjobs.com → 'workday'). Deliberately
// NOT a hardcoded host list — an adapter registered server-side flows through
// by its id, so the client cannot drift the way the regex did.
function hostOf(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(/^\w+:\/\//.test(raw) ? raw : 'https://' + raw).hostname.toLowerCase();
  } catch { return ''; }
}
function isApiBackedCompany(co, adapterIds) {
  if (!co || typeof co !== 'object') return false;
  if (co.api) return true; // explicit boards-api endpoint — the scanner honours it
  const ids = adapterIds instanceof Set ? adapterIds : new Set(adapterIds || []);
  if (co.provider && ids.has(co.provider)) return true; // explicit provider pin
  const h = hostOf(co.careers_url || co.careersUrl);
  if (!h) return false;
  // ≥4 chars: 3-char ids ('hh', 'rss', 'gem', 'ibm') would false-hit as
  // substrings of unrelated hosts; those adapters are provider-pinned
  // (matched above) or regional, never URL-detected.
  for (const id of ids) {
    if (id.length >= 4 && h.includes(id)) return true;
  }
  return false;
}

Router.register('scan', async () => {
  // Clean up any stale poll/listeners from a previous /scan visit.
  __cancelActiveScanPoll();
  detachScanRefreshListeners();
  detachScanBodyListeners();
  // CAR-93 — the stale runner used to be torn down ONLY on hashchange, so
  // a same-hash re-render (a locale switch calls Router.render() with no
  // hashchange; Save-like re-entries too) left the old EventSource
  // streaming into detached nodes and the poll writing into them. Tear
  // the runner down here as well — it is a no-op when none is running.
  __teardownActiveScanRunner();
  __cancelScanCommitDebounce(); // a previous visit's pending filter timer dies here too
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  // CAR-115 — filter state lives in the URL (#/scan?q=…&src=…): parsed
  // BEFORE anything renders, mirrored back on every live apply.
  const urlState = (() => {
    try {
      const qs = (window.location.hash || '').split('?')[1] || '';
      if (!qs) return { params: null, sort: null };
      const p = new URLSearchParams(qs);
      // Whitelist the sort keys the table actually offers — an unknown
      // ?sort= must not silently become a title sort with all headers
      // reading aria-sort=none.
      const sortKey = ['title', 'seniority', 'salary'].includes(p.get('sort')) ? p.get('sort') : null;
      return {
        params: qs,
        sort: sortKey ? { key: sortKey, dir: p.get('dir') === 'asc' ? 'asc' : 'desc' } : null,
      };
    } catch { return { params: null, sort: null }; }
  })();
  // CAR-115 — density (row height) for the windowed results table,
  // persisted like the other scan prefs. Mutable: the pagebar toggle flips it.
  let density = (() => {
    try { return localStorage.getItem('career-ops-ui:scan:density') === 'compact' ? 'compact' : 'comfortable'; }
    catch { return 'comfortable'; }
  })();
  // Late-bound view services the results subsystem calls back into.
  const view = {};
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
  const companies = (p.tracked_companies || p.companies || []).filter((co) => co.enabled !== false);
  // v1.243.0 (views-3) — registry-driven classification (see isApiBackedCompany
  // above). Starts from the build-time fallback mirror; the live
  // GET /api/scan/sources fetch below re-classifies if the server registry
  // carries adapter ids this build's fallback lacks.
  const adapterIdSet = new Set((window.ScanResults.FALLBACK_SOURCES || []).map((s) => s.value));
  let apiCompanies = companies.filter((co) => isApiBackedCompany(co, adapterIdSet));

  // v1.46.0 (WS2 #5) — the SSE log is an aria-live log region so SR
  // users hear each scanned line; tabindex makes it keyboard-scrollable.
  const consoleEl = c('pre', {
    className: 'console', id: 'scan-console',
    role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions',
    'aria-label': t('scan.consoleLabel', 'Scan output log'),
    tabindex: '0',
  }, t('scan.consoleReady'));
  // v1.244.2 — refined console strip: the pre lives inside a .scan-terminal
  // wrapper that owns the dark-slate chrome + status dot. The wrapper's
  // data-state (idle/running/done/error) is driven by scan/runner.js.
  // CAR-115 — compact status bar: the log is COLLAPSED by default (dot +
  // one visible line); the Log button expands it (acceptance: the terminal
  // no longer spends a full-width band; log on click).
  const logBtn = c('button', {
    className: 'btn btn-ghost btn-sm v2-scan-logbtn', type: 'button',
    'aria-expanded': 'false', 'aria-controls': 'scan-console',
    'aria-label': t('scan.v2.log', 'Toggle scan log'),
    title: t('scan.v2.log', 'Toggle scan log'),
    onClick: () => {
      const open = terminalEl.classList.toggle('v2-scan-log-open');
      logBtn.setAttribute('aria-expanded', String(open));
    },
  }, '▤ ' + t('scan.v2.log', 'Log'));
  const terminalEl = c('div', { className: 'scan-terminal', 'data-state': 'idle' }, [
    c('span', { className: 'scan-terminal__dot', 'aria-hidden': 'true' }),
    consoleEl,
    logBtn,
  ]);
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
  // (which now treats commas as OR — "roles to find"). CAR-115 — the main
  // search also takes inline "-word" exclusions; this field stays for
  // multi-term exclusion lists in the More-filters popover.
  const filterExclude = c('input', { className: 'input', id: 'scan-filter-exclude', placeholder: t('scan.filterExclude', 'Exclude words (comma-separated)…'), 'aria-label': t('scan.filterExclude', 'Exclude words (comma-separated)…') });
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
  // with no listed salary are dropped (window.Skills.salaryInRange). CAR-115 —
  // the Salary popover adds a "include without salary" toggle that restores
  // salary-less rows while bounds are set. No in-field placeholders.
  const filterSalaryMin = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1000',
    className: 'input', id: 'scan-filter-salary-min', 'aria-label': t('scan.salaryFrom', 'Salary from'),
  });
  const filterSalaryMax = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1000',
    className: 'input', id: 'scan-filter-salary-max', 'aria-label': t('scan.salaryTo', 'Salary to'),
  });
  const filterSalaryAny = c('input', { type: 'checkbox', id: 'scan-filter-salary-any' });
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
    // CAR-93 — removing the selected <option> RESETS the select to '' (the
    // old comment claimed appending doesn't, but the removal does): the
    // live registry refresh silently unfilters the table until the next
    // render, then drops the filter for good. Capture the choice (or the
    // pending saved-search stash) and restore it after the repaint; a
    // choice that is no longer offered is a harmless no-op.
    const want = filterSource.dataset.want || '';
    const prev = want || filterSource.value;
    while (filterSource.children.length > 1) filterSource.removeChild(filterSource.lastChild);
    list
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((s) => filterSource.appendChild(c('option', { value: s.value }, s.label)));
    if (prev && [...filterSource.options].some((o) => o.value === prev)) {
      filterSource.value = prev;
      if (want) delete filterSource.dataset.want;
    }
  }
  paintSourceOptions(window.ScanResults.FALLBACK_SOURCES);
  // Best-effort live refresh from the registry. Network failure → keep
  // the fallback list. paintSourceOptions restores the user's choice
  // across the repaint (CAR-93 — the removal of the selected <option>
  // used to reset the select to '').
  // v1.243.0 (views-3) — when the live registry carries adapter ids this
  // build's fallback lacked, re-classify the companies with it: the
  // dropdown, the Direct-API / Web-search groups and the Active-companies
  // denominator then follow the server registry, not a build snapshot.
  (async () => {
    try {
      const r = await API.get('/api/scan/sources');
      if (r && Array.isArray(r.sources) && r.sources.length) {
        paintSourceOptions(r.sources);
        let changed = false;
        for (const s of r.sources) {
          if (s && s.value && !adapterIdSet.has(s.value)) { adapterIdSet.add(s.value); changed = true; }
        }
        if (changed) {
          apiCompanies = companies.filter((co) => isApiBackedCompany(co, adapterIdSet));
          paintCompanyOptions();
          setApiCompanies(apiCompanies); // CAR-115 — panel mirror follows
        }
      }
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

  // v1.243.0 (views-3) — the company dropdown is painted through
  // paintCompanyOptions() (not inline children) so the live-registry
  // re-classification below can rebuild it, preserving the user's choice.
  const companySelect = c('select', { className: 'select', id: 'company-select' });
  function paintCompanyOptions() {
    const chosen = companySelect.value;
    companySelect.textContent = '';
    companySelect.appendChild(c('option', { value: '' }, t('scan.allCompanies')));
    for (const co of apiCompanies) companySelect.appendChild(c('option', { value: co.name }, co.name));
    companySelect.value = chosen || ''; // a stale choice is a harmless no-op
  }
  paintCompanyOptions();
  // v1.80.0 — optional per-source cap (0/empty = unlimited, the default).
  // Width owned by .scan-launcher CSS (v1.244.2 chrome pass) — no inline style.
  const maxPerSource = c('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '10',
    className: 'input', id: 'max-per-source', placeholder: '∞',
    'aria-label': t('scan.maxPerSource', 'Max jobs per source'),
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
    if (window.Countries && window.Countries.resetCache) window.Countries.resetCache(); // FULL-R5
    SR.render();
  }
  // Render the rich table of last-scan results — state is MODULE-level
  // (language-switch survival, see the top of this file), so a re-render
  // from I18n.onChange repaints what is already loaded.
  // Active chip selections (multi-select, intersection across categories)

  // v1.243.0 (views-3) — latest-wins: the 2.5s live poll and the done/error
  // refreshes overlap, and a slow response landing AFTER a newer one used to
  // overwrite its fresher rows; worse, a failed GET wiped the table to
  // {en:null,ru:null}. Sequence every call; a stale or failed response leaves
  // the last good table (and the last good labels) untouched.
  // CAR-93 — a failed FIRST load used to leave #scan-results blank (and a
  // failure after resetResultsCache() rendered as "No results"), both
  // indistinguishable from a broken page. resultsEverLoaded separates
  // "nothing yet" (error state + Retry) from "had data" (keep the table).
  async function refreshResults() {
    const mySeq = ++refreshSeq;
    try {
      const next = await API.get('/api/scan-results');
      if (mySeq !== refreshSeq) return; // a newer refresh owns the table now
      lastResults = next;
      // FULL-R5 — the location strings changed; drop the countries memo.
      if (window.Countries && window.Countries.resetCache) window.Countries.resetCache();
      resultsEverLoaded = true;
    } catch (e) {
      if (mySeq !== refreshSeq) return;
      // Network blip — keep the previous table instead of wiping it.
      // CAR-93 — unless nothing was ever loaded: then show an error state,
      // never a blank area that reads as a dead page.
      if (!resultsEverLoaded) {
        resultsEl.replaceChildren(c('div', { className: 'empty', role: 'alert' }, [
          c('strong', null, '✗ ' + t('common.error', 'Error')),
          (e && e.message) ? c('p', { style: { margin: '8px 0 12px', color: 'var(--foggy)', wordBreak: 'break-word' } }, String(e.message)) : null,
          c('button', {
            className: 'btn btn-ghost btn-sm',
            onClick: () => refreshResults(),
          }, '↻ ' + t('common.retry', 'Retry')),
        ]));
      }
      return;
    }
    SR.render();
    // F-011: notify the Active-Companies counter (and any other listener)
    // that the result corpus changed so they can recompute their labels.
    document.body.dispatchEvent(new CustomEvent('scan:refresh'));
  }
  // v1.30.0 — replaces the hardcoded 200-row truncation. UI.paginate
  // auto-clamps the page when filters narrow the list (so the user
  // can't end up on an empty trailing page), and re-renders via
  // onChange when paginator buttons are clicked.
  // v1.244.0 — the page size is user-selectable (#scan-page-size, default
  // 50 per the scan-redesign contract) through createResizablePager above.
  const PAGE_SIZE = 50;
  const pager = createResizablePager(PAGE_SIZE, () => SR.render());
  // v1.244.0 — rows-per-page control (AC3). Plain-number options (the
  // contract recommends 50/100/200/500; 25 added as the tight end). The
  // accessible name reuses the existing scan.results key — no new
  // user-visible strings in this change (the four scan.*Icon/postedMeta
  // keys are the i18n scope). Lives OUTSIDE resultsEl (a re-render rebuilds
  // that subtree) in the .scan-pagebar right above the table.
  const PAGE_SIZES = [25, 50, 100, 200];
  const pageSizeSelect = c('select', {
    className: 'select', id: 'scan-page-size',
    'aria-label': t('scan.results', 'Vacancies found'),
  }, PAGE_SIZES.map((n) => c('option', { value: String(n) }, String(n))));
  pageSizeSelect.value = String(PAGE_SIZE);
  pageSizeSelect.addEventListener('change', () => {
    const n = parseInt(pageSizeSelect.value, 10);
    if (Number.isFinite(n) && n > 0) { pager.setPageSize(n); SR.render(); }
  });
  // CAR-115 — density toggle (compact/comfortable row height). The label
  // names the mode it will SWITCH TO (aria-pressed carries the state).
  const densityBtn = c('button', {
    className: 'btn btn-ghost btn-sm v2-scan-density', type: 'button',
    onClick: () => {
      density = density === 'compact' ? 'comfortable' : 'compact';
      densityBtn.textContent = '≡ ' + (density === 'compact'
        ? t('scan.v2.comfortable', 'Comfortable')
        : t('scan.v2.compact', 'Compact'));
      densityBtn.setAttribute('aria-pressed', String(density === 'compact'));
      densityBtn.setAttribute('aria-label', t('scan.v2.density', 'Row density') + ': ' + density);
      try { localStorage.setItem('career-ops-ui:scan:density', density); } catch { /* private mode */ }
      SR.render();
    },
  });
  densityBtn.textContent = '≡ ' + (density === 'compact' ? t('scan.v2.compact', 'Compact') : t('scan.v2.comfortable', 'Comfortable'));
  densityBtn.setAttribute('aria-pressed', String(density === 'compact'));
  densityBtn.setAttribute('aria-label', t('scan.v2.density', 'Row density') + ': ' + density);
  const scanPagebar = c('div', { className: 'scan-pagebar' }, [densityBtn, pageSizeSelect]);
  // v1.132.0 — the results-rendering subsystem was extracted to
  // public/js/lib/scan-results.js (file-size-contract split). It closes over
  // this context; lastResults is passed as a getter because refreshResults()
  // reassigns it. FALLBACK_SOURCES also moved there (window.ScanResults).
  // CAR-115 — the ctx carries the URL-seeded sort, the density model and the
  // late-bound `view` services (filter API / quick view / URL sync); the
  // on* callbacks delegate so creation order never matters.
  const SR = window.ScanResults.create({
    resultsEl, t,
    filterScope, filterText, filterExclude, filterRemote, filterSource,
    filterCountry, filterSeniority, filterAge, favOnly, filterSalaryMin, filterSalaryMax,
    filterSalaryAny,
    activeTech, activeLevel, activeDynamic, pager, twoPagerData,
    view,
    sort: urlState.sort,
    getDensity: () => density,
    onSortChange: () => { if (view.syncUrl) view.syncUrl(); }, // getSort rides the URL mirror
    onFilterChange: () => { if (view.syncUrl) view.syncUrl(); },
    onQuickView: (r) => { if (view.openQuickView) view.openQuickView(r); },
    getLastResults: () => lastResults,
  });

  // The scan-execution engine is created now that SR + refreshResults +
  // resetResultsCache all exist; the Scan/Stop buttons defer to it via `runner`
  // (file-size split → public/js/views/scan/runner.js).
  runner = window.createScanRunner({
    consoleEl, statusRegion, errBanner, terminalEl,
    scanProgress, scanProgressBar, scanProgressLabel, scanProgressWrap,
    scanBtn, stopBtn, dryRun, companySelect, maxPerSource,
    t, c, refreshResults, resetResultsCache,
  });
  // v1.243.0 (views-3) — stash the runner at module scope so the hashchange
  // teardown can close an in-flight EventSource when the user navigates away.
  __activeScanRunner = runner;

  // v1.68.0 was Apply-driven; CAR-115 makes filtering LIVE again (the
  // acceptance contract: no Apply button, < 50 ms on a 3.6k-row corpus).
  // The filter state machine (URL sync + active chips + presets) lives in
  // public/js/views/scan/filters.js.
  const filtersApi = window.createScanFilters(
    {
      filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
      filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
      filterSalaryAny,
      activeTech, activeLevel, activeDynamic,
    },
    { pager, SR, view, t },
  );
  // CAR-93 — Enter applies immediately; typing applies after a 250 ms
  // debounce (live filtering without a per-keystroke re-render storm).
  // CAR-115 review r2 — the timer handle lives at VIEW scope: commit()
  // (Enter) cancels a pending debounce (one render, not two), and the
  // route teardown cancels it (a late commit must not render into a
  // detached tree or rewrite another route's URL — see syncUrl's guard).
  let commitTimer = null;
  function commitDebounced() {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => { commitTimer = null; commit(); }, 250);
  }
  function commit() {
    if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
    filtersApi.commitFilters();
    syncFilterBar();
  }
  __scanCommitTimerCancel = () => {
    if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
  };
  view.syncUrl = (extra) => filtersApi.syncUrl(extra);

  // ── CAR-115 — the filter bar UI + presets (scan/filters.js factory) ───
  const filterBar = window.createScanFilterBar({
    c, t, refs: {
      filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
      filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
      filterSalaryAny,
    },
    api: filtersApi,
    addBodyListener: addScanBodyListener,
  });
  const presetsWrap = filterBar.presetsWrap;
  function syncFilterBar() { filterBar.sync(); }
  // (commit / commitDebounced / view.syncUrl are defined above — the funnel
  // needs the filter bar object, so it stays the single definition point.)

  // ── CAR-115 — quick view side panel (scan/runner.js factory) ──────────
  const quickView = window.createScanQuickView({ c, t, SR, view });

  // Selects/checkboxes apply immediately (and void any pending saved-search
  // stash — CAR-93); text/number inputs go through the debounced commit;
  // Enter applies at once.
  ;[filterRemote, filterSource, filterCountry, filterSeniority, filterScope, filterAge].forEach((el) =>
    el.addEventListener('change', () => {
      // CAR-93 — a manual change on a dynamically-painted select voids any
      // pending saved-search stash (dataset.want), so the next repaint
      // cannot resurrect an option the user just moved away from.
      if (el.dataset && 'want' in el.dataset) delete el.dataset.want;
      commit();
    }));
  ;[filterText, filterExclude, filterSalaryMin, filterSalaryMax].forEach((el) => {
    el.addEventListener('input', () => commitDebounced());
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  });
  filterSalaryAny.addEventListener('change', commit);
  favOnly.addEventListener('change', commit);

  // Restore a shared #/scan?… URL on load (filters + sort), before the
  // first render reads the filter elements.
  if (urlState.params) {
    const restored = filtersApi.filtersFromUrl(window.location.hash || '');
    if (restored) filtersApi.setFilterState(restored);
  }
  syncFilterBar();


  // CAR-112 — the first paint shows shimmer rows instead of an empty table
  // while GET /api/scan-results is in flight; SR.render() replaces them when
  // the data lands (or the CAR-93 error state on a failed first load).
  resultsEl.replaceChildren(window.Skeleton.block(6, t('common.loading', 'Loading…')));
  // load results on first render
  refreshResults();

  // CAR-115 extraction — page-level panels moved to scan/runner.js; scan.js
  // keeps the literal tracked subscriptions the lifecycle test pins.
  const repostsPanel = window.createRepostsPanel({ c, t });
  const companiesPanel = window.createScanCompaniesPanel({
    c, t,
    companies,
    apiCompanies,
    SR,
    portalsErr,
    addRefreshListener: addScanRefreshListener,
    onFilterByName: (name) => {
      filterText.value = name;
      commit();
      filterText.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  });
  const { setLabel, refreshWorkdayChip, setApiCompanies, el: companiesSection } = companiesPanel;
  addScanRefreshListener(setLabel);
  addScanRefreshListener(refreshWorkdayChip);

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

    // v1.244.2 — launcher redesigned as ONE aligned control row
    // (.scan-launcher): every cell is a small-caps label above a 40px
    // control, so select / checkbox / cap input / buttons share a single
    // baseline. [Scan] stays the visually dominant primary; [Pipeline]
    // rides as the ghost secondary.
    c('div', { className: 'card mb-3 scan-launcher' }, [
      c('div', { className: 'scan-cell scan-cell--grow' }, [
        c('label', { className: 'scan-field__label', htmlFor: 'company-select' }, t('scan.companyLbl')),
        companySelect,
      ]),
      c('label', { className: 'scan-cell scan-cell--check', htmlFor: 'dry-run' }, [
        c('span', { className: 'scan-checkline' }, [
          dryRun,
          c('span', null, t('scan.dryRun')),
        ]),
      ]),
      // v1.80.0 — optional per-source cap (∞ by default).
      c('div', { className: 'scan-cell scan-cell--max' }, [
        c('label', { className: 'scan-field__label', htmlFor: 'max-per-source' }, t('scan.maxPerSource', 'Max per source')),
        maxPerSource,
      ]),
      // Single "Scan" button — runs every enabled source (EN APIs +
      // RU portals) in one go. The earlier separate EN-scan / RU-scan
      // buttons were noisy; users almost always want everything.
      // Title attribute lists what it actually crawls so the
      // expectation is set on hover.
      // v1.244.2 — Scan/Stop/Pipeline live in one action cell so the
      // group wraps as a unit instead of stranding a lone button.
      c('div', { className: 'scan-cell scan-launcher__actions' }, [
        scanBtn,
        stopBtn,
        c('button', { className: 'btn btn-ghost', onClick: () => Router.go('/pipeline') }, t('scan.btnPipe')),
      ]),
    ]),

    c('div', null, [errBanner, scanProgressWrap, statusRegion, terminalEl]),

    repostsPanel,

    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title', style: { marginTop: 0 } }, t('scan.results')),
      // CAR-115 — ONE filter system: the live chip bar (search + popover
      // filters, applied as you type/select — built by the filters.js
      // factory) + saved-search preset chips. The old .scan-filters grid +
      // Apply button is gone (acceptance: no Apply button; live chips).
      filterBar.barEl,
      presetsWrap,
      // v1.244.0 — rows-per-page for the results pager (AC3) + the CAR-115
      // density toggle; both sit above the table, outside the re-rendered
      // #scan-results subtree.
      scanPagebar,
      resultsEl,
    ]),

    // CAR-115 — quick-view side panel + backdrop (fixed, one instance;
    // the factory returns the [backdrop, panel] pair — spread it in).
    ...quickView,

    companiesSection,
  ]);
});

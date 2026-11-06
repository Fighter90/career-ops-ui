/* global Router, API, UI, I18n, HelpHint, MapPrefs, PostingUrlKey */
// TODO: split by concern — the CAR-117 pattern (tracker-stages.js /
// tracker-import.js); buildHeaderMenu is the next extract candidate.

// ── CAR-236 · the shared tracker-row loader ────────────────────────────────
// Every consumer (#/tracker table + funnel board, #/pipeline overview,
// #/stats tabs) reads tracker rows through this one module, so a navigation
// costs ONE /api/tracker fetch instead of three or four, and the table never
// ships more than one page of rows:
//   - TrackerRows.mount() — a view render calls it FIRST: it drops the
//     previous mount's shared promise, so a fresh navigation always re-reads.
//   - TrackerRows.all({ fresh }) — the ALL-rows read (no params — the legacy
//     `{ rows }` shape; the funnel board and the stats aggregates need every
//     row). Memoized per mount; `{ fresh: true }` bypasses the cache and
//     never poisons it (the pipeline's post-mutation refresh()).
//   - TrackerRows.page(n, { status }) — the TABLE's server-side pagination
//     (`?page=&pageSize=200`, optionally `?status=<canonical stage>`). The
//     route caps pageSize at 500 and answers `{ rows, total, funnel }` with
//     the funnel computed over the FULL history regardless of the filters —
//     which is what keeps the stage tabs truthful under pagination.
window.TrackerRows = (function () {
  const TABLE_PAGE_SIZE = 200; // server-side page size for the #/tracker table
  let shared = null; // the per-mount ALL-rows promise
  function mount() { shared = null; }
  function all(opts) {
    const fresh = !!(opts && opts.fresh);
    if (!fresh && shared) return shared;
    const p = window.API.get('/api/tracker');
    if (fresh) return p; // a fresh read bypasses the cache and never poisons it
    shared = p;
    // A failed read must not stick for the whole mount: the next all() retries.
    p.catch(() => { if (shared === p) shared = null; });
    return p;
  }
  function page(n, opts) {
    const o = opts || {};
    const size = o.pageSize || TABLE_PAGE_SIZE;
    const num = (Number.isFinite(n) && n >= 1) ? Math.floor(n) : 1;
    let url = '/api/tracker?page=' + num + '&pageSize=' + size;
    if (o.status) url += '&status=' + encodeURIComponent(String(o.status));
    return window.API.get(url);
  }
  return { mount: mount, all: all, page: page, TABLE_PAGE_SIZE: TABLE_PAGE_SIZE };
})();

Router.register('tracker', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  // CAR-112 — the page h1 exists the moment the route opens, BEFORE the data
  // fetch: the router's focus target (focusNewView reads h1/.page-title) and
  // the heading tree are present while the three GETs are in flight, with
  // shimmer rows standing in for the board instead of a bare «Loading…».
  // The title is static per view (existing i18n keys); the full page returned
  // below replaces this shell when the data lands, and a render superseded by
  // a newer navigation is discarded by the router's epoch check.
  const shell = document.getElementById('content');
  if (shell) {
    shell.replaceChildren(
      c('header', { className: 'page-header' }, [
        HelpHint.title(t('track.title'), 'help.hint.tracker'),
      ]),
      window.Skeleton.block(8, t('common.loading', 'Loading…')),
    );
  }
  // v1.131.0 — CRM stage-tab board. Rows +
  // the canonical funnel are fetched together; the stages endpoint fails soft
  // to an empty funnel (the board degrades to an ALL-only view) so the tracker
  // still renders if the parent's states.yml is momentarily unreadable.
  // CAR-236 — the view declares its mount FIRST (drops the previous mount's
  // shared promise), the persisted view choice decides WHAT to fetch: the
  // table is the default, so it reads one server page (?page=1&pageSize=200);
  // a restored funnel board reads ALL rows (it groups every application).
  TrackerRows.mount();
  const TS = window.TrackerStages;
  const viewToggle = TS ? TS.createViewToggle({ t, onChange: () => onModeFlip() }) : null;
  const initialMode = viewToggle ? viewToggle.mode() : 'table';
  const PAGE_SIZE = TrackerRows.TABLE_PAGE_SIZE;
  const [data, stagesData, commute] = await Promise.all([
    initialMode === 'kanban' ? TrackerRows.all() : TrackerRows.page(1),
    API.get('/api/tracker/stages').catch(() => ({ stages: [], aliases: {} })),
    API.get('/api/commute').catch(() => null),
  ]);
  // CAR-236 — mode-aware row state. `rows` always feeds the ACTIVE view: the
  // funnel board sees ALL rows, the table sees one server page. `allRows`
  // caches the ALL-rows read for this mount (loaded eagerly above when the
  // funnel choice was restored, lazily on the first funnel flip); once loaded,
  // the table derives its pages locally from it, so a status move on the
  // board is already in when the user flips back (no staleness, no fetch).
  let allRows = initialMode === 'kanban' ? (data.rows || []) : null;
  let rows = initialMode === 'kanban' ? allRows : (data.rows || []);
  let serverTotal = rows.length;
  let serverFunnel = null; // the paginated response's whole-history funnel (pure-table path)
  if (initialMode !== 'kanban') {
    serverTotal = (data && data.total != null) ? data.total : rows.length;
    serverFunnel = (data && data.funnel) || {};
  }
  const STAGES = Array.isArray(stagesData.stages) ? stagesData.stages : [];
  const ALIASES = stagesData.aliases || {};
  const fold = (s) => (TS ? TS.foldStatus(s, ALIASES) : (s || ''));
  const commutePrefs = MapPrefs ? MapPrefs.loadCommute() : { maxMinutes: null, showUnknown: true };
  const commuteOf = (r) => {
    if (!commute) return null;
    const key = PostingUrlKey ? PostingUrlKey.normalizeUrl(r.url || '') : '';
    return (commute.byNum || {})[r.num] || (key && (commute.byUrl || {})[key]) || null;
  };
  const hasCommute = Boolean(commute?.available);
  // CAR-117 — status moves write through the EXISTING per-row outcome relay
  // (POST /api/outcome). When the parent script is missing, the first failed
  // write flips this off and the board re-renders read-only with a hint.
  let movesReady = true;

  // ── CAR-236 · whole-history numbers ───────────────────────────────────────
  // The stage tabs, the header count and the hired banner describe the WHOLE
  // tracker, never just the table's current page. With allRows in memory the
  // numbers recount client-side (fresh after board moves); the pure-table
  // path reads the server response's funnel — computed over the FULL history
  // regardless of the page/status filters.
  const funnelSum = (f) => Object.keys(f || {}).reduce((a, k) => a + (f[k] || 0), 0);
  function totalForTabs() {
    if (allRows) return allRows.length;
    if (serverFunnel && Object.keys(serverFunnel).length) return funnelSum(serverFunnel);
    return serverTotal;
  }
  function countsForTabs() {
    if (allRows) return TS ? TS.stageCounts(allRows, STAGES, ALIASES) : {};
    const counts = {};
    for (const s of STAGES) counts[s] = (serverFunnel && serverFunnel[s]) || 0;
    return counts;
  }
  // An optimistic status move adjusts the whole-history funnel in place (the
  // allRows path needs no bump — stageCounts recounts from the mutated rows).
  function bumpFunnel(prev, next) {
    if (!serverFunnel) return;
    if (serverFunnel[prev]) serverFunnel[prev] -= 1;
    serverFunnel[next] = (serverFunnel[next] || 0) + 1;
  }

  const filterScore = c('select', { className: 'select', style: { maxWidth: '180px' }, 'aria-label': t('track.anyScore') }, [
    c('option', { value: '' }, t('track.anyScore')),
    c('option', { value: '4' }, t('track.scoreHigh')),
    c('option', { value: '3' }, t('track.scoreMid')),
    c('option', { value: '0' }, t('track.scoreLow')),
  ]);
  // NEW-D3 (v1.58.38) — explicit aria-label so screen readers announce the
  // input's purpose (WCAG 4.1.2), the placeholder alone would not.
  const filterText = c('input', {
    type: 'search',
    className: 'input',
    placeholder: t('track.search'),
    'aria-label': t('track.searchAria', 'Search applications by company name or role title'),
  });
  const commuteLimits = [...new Set([commute?.maxMinutes, 30, 45, 60, 90, commutePrefs.maxMinutes]
    .map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  const filterCommute = c('select', {
    className: 'select', style: { maxWidth: '210px' }, 'aria-label': t('commute.filter', 'Maximum drive time'),
  }, [
    c('option', { value: '' }, t('commute.any', 'Any drive time')),
    ...commuteLimits.map((n) => c('option', { value: String(n) }, n === Number(commute?.maxMinutes)
      ? t('commute.max', '≤ {n} min (profile)').replace('{n}', n)
      : t('commute.upTo', '≤ {n} min').replace('{n}', n))),
  ]);
  filterCommute.value = commutePrefs.maxMinutes == null ? '' : String(commutePrefs.maxMinutes);
  const showUnknown = c('input', { type: 'checkbox', checked: commutePrefs.showUnknown });
  const unknownLabel = c('label', { className: 'map-check' }, [showUnknown, t('commute.unknown', 'Show unknown drive time')]);

  // v1.131.0 — the CRM stage-tab strip. Replaces the v1.55.8 funnel chip bar +
  // the status <select>: a tab per canonical stage (from GET /api/tracker/stages,
  // whole-history counts, INCLUDING zero-count stages for the full-funnel look),
  // plus a leading ALL tab. Active stage drives the filter; the labels are the
  // canonical status labels verbatim (same as the row badges), so no client-side
  // whitelist and no new i18n keys. `activeStage === ''` means ALL.
  // v1.248.2 — the stage tabs and row badges TRANSLATE their displayed label
  // (track.status.*); the canonical value stays canonical everywhere it is
  // DATA: the tab's filter value, the stage-folding comparisons, sorting and
  // the URL are untouched. Unknown/alias statuses fall back to the raw label
  // (t() returns the fallback), so the server-driven whitelist stays the only
  // source of truth (v1.128.0 doctrine). The key is composed in a variable so
  // the static t('…') coverage scan sees no phantom literal key.
  const statusLabel = (s) => {
    const key = 'track.status.' + String(s || '').toLowerCase();
    return t(key, s || '');
  };
  let activeStage = '';
  const tabBar = c('div', {
    className: 'tracker-tabs',
    role: 'tablist',
    'aria-label': t('track.funnelAria', 'Filter by status'),
  });
  function renderTabs() {
    tabBar.textContent = '';
    const counts = countsForTabs(); // CAR-236 — whole-history counts, never page-local
    const tab = (label, stageValue, n) => {
      const active = activeStage === stageValue;
      const b = c('button', {
        className: 'tracker-tab' + (active ? ' is-active' : ''),
        type: 'button',
        role: 'tab',
        'aria-selected': active ? 'true' : 'false',
        // The count span is aria-hidden (decorative once folded into the name),
        // so the button carries an explicit accessible name that KEEPS the count
        // — parity with the old chips' "Applied · 5" readout for screen readers.
        'aria-label': label + ' — ' + n,
        onClick: () => {
          // Clicking the active stage clears back to ALL (parity with the old
          // funnel-chip toggle behaviour).
          activeStage = (activeStage === stageValue) ? '' : stageValue;
          pager.reset();
          // CAR-236 — the stage filter rides the SERVER in table mode
          // (?status=<canonical stage>, page 1); the board filters its
          // all-rows client-side as before.
          const restoreTabFocus = () => {
            const nowActive = tabBar.querySelector('.tracker-tab.is-active');
            if (nowActive) nowActive.focus();
          };
          if (viewModeNow() === 'table') loadTable(1).then(restoreTabFocus);
          else { refreshView(); restoreTabFocus(); }
        },
      }, [
        c('span', null, label),
        c('span', { className: 'tracker-tab-n', 'aria-hidden': 'true' }, String(n)),
      ]);
      return b;
    };
    tabBar.appendChild(tab(t('track.allStatus', 'All'), '', totalForTabs()));
    // The tab's DISPLAYED caption is the localized label; the tab's filter
    // VALUE stays the canonical stage label `s` (comparison + folding below).
    for (const s of STAGES) tabBar.appendChild(tab(statusLabel(s), s, counts[s] || 0));
  }

  const tbody = c('tbody');
  const pgWrap = c('div'); // paginator container, re-rendered on each filter change

  // ── CAR-236 · server-side table pagination ────────────────────────────────
  // The paginator stays the control surface, but its page buttons drive
  // TrackerRows.page re-fetches (?page=&pageSize=200) instead of a client-side
  // slice: every filtered row of the CURRENT page renders, and the pager pages
  // over the WHOLE total. One superseded-load token guards every async table
  // (re)load below.
  let loadToken = 0;
  const pager = UI.paginate({ pageSize: PAGE_SIZE, onChange: () => { loadTable(pager.page + 1); } });

  // The table's paging source once ALL rows are in memory (the funnel board
  // was visited): the active stage filter folds rows the same way the server's
  // ?status= does, so both paging paths agree on the total.
  function stageList() {
    if (!allRows) return null;
    return activeStage ? allRows.filter((r) => fold(r.status) === activeStage) : allRows;
  }

  // (Re)load the table for 1-based server page `n` — from the server while
  // the funnel board has not been visited, locally from allRows afterwards.
  // Re-renders through applyFilters().
  async function loadTable(n) {
    const token = ++loadToken;
    let d;
    if (allRows) {
      const list = stageList();
      const start = (Math.max(1, n || 1) - 1) * PAGE_SIZE;
      d = { rows: list.slice(start, start + PAGE_SIZE), total: list.length };
    } else {
      try {
        d = await TrackerRows.page(Math.max(1, n || 1), activeStage ? { status: activeStage } : {});
      } catch {
        return; // keep the current page; mount failures surface through the router
      }
    }
    if (token !== loadToken) return; // a newer load superseded this one
    rows = d.rows || [];
    serverTotal = (d.total != null) ? d.total : rows.length;
    applyFilters();
  }

  // ── CAR-117 · view mode (table | kanban) ──────────────────────────────────
  // The table stays the DEFAULT (least surprise; the browser suites pin it).
  // The mode state, its persistence and the toggle buttons live in the lib
  // factory (createViewToggle); the view only reacts to changes.

  function filtered() {
    const out = [];
    for (const r of rows) {
      if (activeStage && fold(r.status) !== activeStage) continue;
      if (filterScore.value === '4' && (r.scoreNum ?? -1) < 4) continue;
      if (filterScore.value === '3' && (r.scoreNum ?? -1) < 3) continue;
      if (filterScore.value === '0' && (r.scoreNum ?? 0) >= 3) continue;
      if (hasCommute) {
        const cm = commuteOf(r);
        const remote = cm?.precision === 'remote';
        const known = remote || Number.isFinite(cm?.min);
        if (!known && !showUnknown.checked) continue;
        if (filterCommute.value && known && !remote && cm.min > Number(filterCommute.value)) continue;
      }
      const q = filterText.value.toLowerCase().trim();
      // Search the PRESENTED identity too, so a confidential row is findable by
      // the agency in its Via column and not only by the literal '?'.
      const hay = window.CompanyPresentation
        ? window.CompanyPresentation.companySearchText(r)
        : (r.company + ' ' + r.role);
      if (q && !hay.toLowerCase().includes(q)) continue;
      out.push(r);
    }
    return out;
  }

  // v1.49.0 (WS2 #11) — client-side sort on date / score / status.
  let sortKey = null;       // 'date' | 'score' | 'status' | 'commute' | null
  let sortDir = 'asc';      // 'asc' | 'desc'
  function sorted(arr) {
    if (!sortKey) return arr;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r) => sortKey === 'score' ? (r.scoreNum ?? null)
      : sortKey === 'commute' ? (commuteOf(r)?.precision === 'remote' ? 0 : commuteOf(r)?.min ?? Number.POSITIVE_INFINITY)
      : sortKey === 'date' ? (r.date || '')
      : (r.status || '');
    return [...arr].sort((a, b) => {
      const x = val(a); const y = val(b);
      // CAR-129 — a missing value is not the smallest value: rows without
      // one sort LAST under either direction (the old -1 sentinel made
      // unscored rows always come first on the default ascending sort).
      if (x == null && y != null) return 1;
      if (y == null && x != null) return -1;
      if (typeof x === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }

  // ── CAR-117 · move flow + bulk selection (lib controllers) ────────────────
  // tracker.js sits against the 800-LOC contract, so the stateful controllers
  // live in lib/tracker-stages.js and are wired together here. There is NO
  // undo (r2 #1 — the outcome writer is append-only; an outcome-write revert
  // would fabricate candidate history).
  const moveFlow = TS ? TS.createMoveFlow({
    t,
    stages: STAGES,
    fold,
    statusLabel,
    isReady: () => movesReady,
    onMovesOff: () => { movesReady = false; }, // structured 422-no-code: the parent recorder is absent
    onProgress: (d, n) => { if (bulk) bulk.progress(d + '/' + n); },
    onDone: () => {
      if (bulk) { bulk.reset(); bulk.progress(''); }
      refreshView();
    },
  }) : null;
  const bulk = TS ? TS.createBulkBar({
    t,
    stages: STAGES,
    statusLabel,
    fold,
    onPick: (movable, target) => moveFlow.open(movable, target),
    onChanged: () => refreshView(),
  }) : null;
  // r2 #5 — guarded like its siblings: a tracker-stages load failure must not
  // throw the whole route; mode() reads go through the null-safe accessor
  // below (default: table). CAR-236 — the toggle itself is created BEFORE the
  // mount fetch (the restored choice decides what to fetch); its onChange
  // lands on onModeFlip, which loads what the new mode needs first.
  const viewModeNow = () => (viewToggle ? viewToggle.mode() : 'table');

  function applyFilters() {
    renderTabs(); // whole-history counts; reflects the active stage tab
    const all = sorted(filtered());
    // CAR-236 — server pagination: every filtered row of the CURRENT page
    // renders (no client slice); the pager pages over the whole filtered
    // total and its page-change drives a TrackerRows.page re-fetch.
    const page = all;
    // L-FOCUS (v1.243.0) — this rebuild replaces the nodes a keyboard user is
    // on (a row's Report/Outcome button, a .pg-btn), dropping focus to <body>.
    // Restore it (see lib/focus-preserve.js).
    FocusPreserved.withFocusPreserved(tbody, () => {
      tbody.innerHTML = '';
      // CAR-210 — the first-run empty state (title + body + CTA) no longer
      // renders inside the min-width table (cut off at 390px): it gets a
      // full-width host instead, and the table is hidden while it shows.
      // CAR-236 — "no applications at all" (totalForTabs() === 0), never
      // "this page has none": with server pagination an empty filtered page
      // must fall through to the in-table no-match notice below.
      if (rows.length === 0) {
        if (totalForTabs() === 0) {
          FocusPreserved.withFocusPreserved(emptyHost, () => {
            emptyHost.textContent = '';
            emptyHost.appendChild(c('div', { className: 'card empty' }, [
              c('strong', null, t('track.emptyTitle', 'No applications yet')),
              c('p', { style: { margin: '8px 0 0' } }, t('track.emptyBody', 'Run the pipeline or evaluate a JD to populate this tracker.')),
              c('div', { style: { marginTop: '12px' } },
                c('a', { href: '#/pipeline', className: 'btn btn-primary btn-sm' }, t('track.emptyCta', 'Open pipeline'))),
            ]));
          });
          return;
        }
      }
      emptyHost.textContent = '';
      if (all.length === 0) {
        // WS2 #26 — a filter that excluded everything keeps the in-table
        // notice (a short single line survives the scroll container).
        const emptyCell = c('td', { colspan: hasCommute ? 12 : 10, style: { textAlign: 'center', padding: '40px', color: 'var(--foggy)' } }, t('track.noMatch'));
        tbody.appendChild(c('tr', null, emptyCell));
        return;
      }
      for (const r of page) tbody.appendChild(row(r));
    });
    if (bulk) {
      bulk.setRows(rows);
      bulk.setPage(page);
      bulk.syncSelAll();
      bulk.el.hidden = bulk.size() === 0 || viewModeNow() !== 'table';
    }
    FocusPreserved.withFocusPreserved(pgWrap, () => {
      pgWrap.innerHTML = '';
      const pagerTotal = allRows ? stageList().length : serverTotal;
      if (pagerTotal === 0) return;
      pgWrap.appendChild(pager.controls(page.length, pagerTotal));
    });
  }

  // WS2 #11 — a sortable column header: a button inside the th so it's
  // keyboard-operable; aria-sort reflects state; click toggles dir. NOTE date
  // sort is a string compare — correct only because r.date is ISO YYYY-MM-DD.
  function sortableTh(label, key) {
    const th = c('th', { scope: 'col', 'aria-sort': 'none' });
    const txt = c('span', null, label);
    const ind = c('span', { 'aria-hidden': 'true', style: { marginInlineStart: '4px' } }, '⇅');
    const btn = c('button', {
      className: 'tbl-sort',
      style: { background: 'none', border: 0, font: 'inherit', cursor: 'pointer', color: 'inherit', padding: 0 },
      onClick: () => {
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        // CAR-236 — no pager.reset(): sorting reorders the CURRENT page's
        // rows; paging stays where the user is.
        // aria-sort belongs only on sortable headers — reset just those (not the
        // plain columns), then mark the active one.
        for (const h of th.parentElement.children) {
          if (h.hasAttribute('aria-sort')) h.setAttribute('aria-sort', 'none');
          const i = h.querySelector('.tbl-sort .tbl-sort-ind');
          if (i) i.textContent = '⇅';
        }
        th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
        ind.textContent = sortDir === 'asc' ? '▲' : '▼';
        applyFilters();
      },
    }, [txt, ind]);
    ind.className = 'tbl-sort-ind';
    th.appendChild(btn);
    return th;
  }
  // Resetting the pager when filter inputs change keeps page-1 sticky.
  // CAR-117 — filters drive BOTH hosts, so refreshView() re-renders whichever
  // view is active.
  // CAR-236 — score/text/commute are NOT server parameters: they filter
  // client-side WITHIN the current page, so the pager keeps the page (the old
  // reset-to-page-1 semantic belonged to the client-side 25-row pager).
  ;[filterScore, filterText, filterCommute, showUnknown].forEach((el) =>
    el.addEventListener('input', () => { refreshView(); })
  );
  ;[filterCommute, showUnknown].forEach((el) => el.addEventListener('input', () => {
    MapPrefs?.saveCommute({ maxMinutes: filterCommute.value ? Number(filterCommute.value) : null, showUnknown: showUnknown.checked });
  }));
  function commuteCell(cm) {
    if (!cm) return c('td', { className: 'commute-cell is-unknown' }, '?');
    if (cm.precision === 'remote') return c('td', { className: 'commute-cell' }, t('commute.remote', 'Remote'));
    if (!Number.isFinite(cm.min)) return c('td', { className: 'commute-cell is-unknown' }, '?');
    const over = commute?.maxMinutes && cm.min > commute.maxMinutes;
    const detail = [Number.isFinite(cm.km) ? cm.km + ' km' : '', cm.precision || ''].filter(Boolean).join(' · ');
    return c('td', { className: 'commute-cell' + (over ? ' is-over' : ''), title: detail },
      (over ? '⚠ ' : '') + cm.min + ' min');
  }
  function scoreCls(v) {
    return (window.ScoreTone && window.ScoreTone.scoreClass)
      ? window.ScoreTone.scoreClass(v)
      : (v >= 4 ? 'score-high' : v >= 3 ? 'score-mid' : 'score-low');
  }
  // ── v1.246.0 backlog #2 · inline status edit ───────────────────────────────
  // The status badge becomes a compact <select> of the canonical stages
  // (GET /api/tracker/stages — never a hardcoded whitelist). onChange POSTs
  // /api/tracker/status (the parent set-status.mjs relay). Success updates the
  // row in place — status, the select's tone class and the tab counts — so the
  // focused select is never torn down; failure reverts the value and toasts.
  // Without stages (endpoint down) the read-only badge renders as before.
  function statusCell(r) {
    const folded = fold(r.status);
    // Route-review LOW fixes: a status the canonical stages don't know (a
    // hand-edited cell the server canonicalizer tolerates) and a backfill
    // sentinel row (`N/A` / `—` / `-` — POST can never address it) render
    // the read-only badge instead of a select that misrepresents or 400s.
    const SENTINEL = /^(n\/a|—|-)$/i;
    if (!STAGES.length || !STAGES.includes(folded) || SENTINEL.test(String(r.num ?? '').trim())) {
      return c('span', { className: 'badge ' + trackerStatusClass(r.status) }, statusLabel(folded));
    }
    const sel = c('select', {
      className: 'badge ' + trackerStatusClass(r.status),
      // Row-scoped identity — FocusPreserved/data-key convention (CAR-93).
      'data-key': String(r.num ?? ''),
      'data-i18n-aria-label': 'track.inlineStatusAria',
      'aria-label': t('track.inlineStatusAria', 'Change status'),
      onChange: () => { changeStatus(r, sel); },
    }, STAGES.map((s) => c('option', { value: s }, statusLabel(s))));
    sel.value = folded;
    return sel;
  }
  async function changeStatus(r, sel) {
    const target = sel.value;
    const prev = fold(r.status);
    if (!target || target === prev) return;
    sel.disabled = true;
    try {
      await API.post('/api/tracker/status', { row: Number(r.num), state: target });
      r.status = target;
      // In-place refresh: the select keeps focus; the tabs recount.
      // CAR-236 — keep the mount's other row copies in sync: the funnel
      // board's allRows twin (so flipping to the board shows the move), and
      // the whole-history funnel counts (the pure-table path's tab numbers).
      if (allRows) {
        const twin = allRows.find((x) => String(x.num) === String(r.num));
        if (twin) twin.status = target;
      }
      bumpFunnel(prev, target);
      sel.className = 'badge ' + trackerStatusClass(r.status);
      renderTabs();
      UI.toast(t('track.statusUpdated', 'Status updated to {state}').replace('{state}', statusLabel(target)), 'success');
      // A row that no longer matches the active stage tab must leave the view.
      if (activeStage && fold(target) !== activeStage) applyFilters();
    } catch {
      sel.value = prev;
      UI.toast(t('track.statusUpdateFailed', 'Could not update the status'), 'error');
    } finally {
      sel.disabled = false;
    }
  }
  function row(r) {
    // v1.128.0 — finer 4-tier tone (>=4.2/3.8/3.0) with a
    // letter-grade fallback, via the shared ScoreTone helper. Falls back to the
    // old coarse split only if the helper script somehow didn't load.
    const score = scoreCls(r.scoreNum ?? r.score);
    // v1.131.0 — CRM company cell: a brand logo (favicon of the company's own
    // domain, derived from the name) when the user has enabled logos; otherwise
    // just the name. CompanyLogo.badge returns null when the pref is off, so
    // this is zero extra requests by default (same contract as #/scan).
    // v1.227.0 — a confidential posting stores '?' as the employer and names the
    // agency in Via. Show that attribution instead of a bare '?', and resolve the
    // logo from the agency name (no domain heuristic can match '?'). Presentation
    // only — r.company itself is never rewritten.
    const pres = window.CompanyPresentation
      ? window.CompanyPresentation.companyPresentation(r)
      : { label: r.company || '', logoName: r.company || '', confidential: false, via: '' };
    const companyLabel = !pres.confidential
      ? (pres.label || '—')
      : (pres.via
        ? t('track.confidentialVia', 'Confidential · via {via}').replace('{via}', pres.via)
        : t('track.confidential', 'Confidential employer'));
    const logo = window.CompanyLogo ? window.CompanyLogo.badge(r.url, pres.logoName) : null;
    const companyCell = logo
      ? c('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, [logo, c('span', null, companyLabel)])
      : companyLabel;
    return c('tr', null, [
      c('td', null, bulk ? bulk.checkCell(r) : null),
      c('td', null, r.num || ''),
      // CAR-117 grid fix — the date is a single line in every locale
      // («2026-/08-25» used to wrap), tabular so digits align down the column.
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } }, r.date || ''),
      c('td', null, companyCell),
      c('td', null, r.role || ''),
      hasCommute ? c('td', null, commuteOf(r)?.location || r.location || '—') : null,
      hasCommute ? commuteCell(commuteOf(r)) : null,
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap' } }, c('span', { className: 'score-pill ' + score }, r.score || '—')),
      // Inline status edit (v1.246.0 backlog #2): the badge is now a compact
      // canonical-stage <select> (statusCell). The badge caption convention
      // holds — the displayed label is the localized canonical label, the raw
      // status is folded through the server alias map first, and
      // trackerStatusClass + every comparison still read the canonical value.
      // (For ATS postings) a lazy "still live?" check rides alongside; the
      // affordance is null for non-ATS rows.
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap' } }, [
        statusCell(r),
        TS ? TS.livenessAffordance(r.url, r.num) : null,
      ]),
      // G-006 (v1.15.0) — Legitimacy column. Mirrors the badge tint used on
      // /#/reports cards. Empty string when the source row had no Legitimacy
      // column (graceful degrade for pre-v1.15 trackers).
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap' } }, r.legitimacy
        ? c('span', { className: 'badge ' + legitimacyClass(r.legitimacy) }, r.legitimacy)
        : c('span', { style: { color: 'var(--foggy)' } }, '—')),
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap' } }, r.pdfReady ? '✓' : '—'),
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap' } }, [
        r.reportPath ? c('button', {
          className: 'btn btn-ghost btn-sm',
          // CAR-93 — row-scoped identity for the focus restore: the
          // tag|class|text marker is identical for this button on every
          // row, which sent focus to row 1 after a rebuild.
          'data-key': String(r.num ?? ''),
          'aria-label': t('track.report') + ((r.company || r.role) ? ' — ' + (r.company || r.role) : ''),
          onClick: () => Router.go('/reports/' + r.reportPath.replace(/^(\.\.\/)*reports\//, '').replace(/\.md$/, '')),
        }, t('track.report')) : '',
        // Record an application outcome (rejected / offer / hired / …): opens a
        // preview-then-confirm modal that shells the parent outcome.mjs to
        // archive artifacts + sync the tracker. Every row gets it.
        c('button', {
          className: 'btn btn-ghost btn-sm',
          type: 'button',
          'data-key': String(r.num ?? ''),
          'aria-label': t('track.outcome.record', 'Record outcome') + (r.company ? ' — ' + r.company : ''),
          onClick: () => openOutcomeModal(r, c, t),
        }, t('track.outcome.btn', 'Outcome')),
      ].filter(Boolean)),
    ]);
  }

  // CAR-210 — full-width host for the first-run empty state; lives OUTSIDE the
  // min-width table so the CTA is not clipped inside the 760px scroll box.
  const emptyHost = c('div', { hidden: true });

  applyFilters();

  // ── CAR-117 · the two hosts ────────────────────────────────────────────────
  const kanbanHost = c('div', { className: 'mb-3' });

  function renderKanban() {
    const visible = sorted(filtered());
    FocusPreserved.withFocusPreserved(kanbanHost, () => {
      kanbanHost.textContent = '';
      if (!visible.length) {
        kanbanHost.appendChild(c('div', {
          className: 'card mb-3',
          style: { textAlign: 'center', padding: '40px', color: 'var(--foggy)' },
        }, rows.length === 0
          ? t('track.emptyTitle', 'No applications yet')
          : t('track.noMatch')));
        return;
      }
      // CAR-237 — the «Воронка» board (lib/tracker-kanban.js): columns are the
      // canonical funnel, cards are rows, drops write the canonical
      // /api/tracker/status relay with an optimistic move + revert. onChanged
      // recounts the stage tabs after every optimistic mutation.
      kanbanHost.appendChild(window.TrackerKanban.createBoard({
        rows: visible,
        stages: STAGES,
        fold,
        statusLabel,
        scoreClass: (v) => scoreCls(v),
        reportLabel: t('track.report'),
        t,
        // An optimistic mutation (or its revert) recounts the stage tabs AND
        // rebuilds the board so the card visibly lands in its new column.
        onChanged: () => { renderTabs(); renderKanban(); },
      }));
    });
  }

  function refreshView() {
    applyFilters();
    if (viewModeNow() === 'kanban') renderKanban();
  }

  // ── CAR-236 · the mode flip loads first, then applies visibility ──────────
  // Funnel board: the ALL-rows read — once per mount (TrackerRows.all() is
  // memoized), with shimmer rows standing in while it is in flight. Table:
  // derived from allRows when the board has been visited (its moves are
  // already in — no staleness, no fetch), otherwise the mount's server page
  // is already current and only the visibility flips.
  let modeLoads = 0;
  async function onModeFlip() {
    const mode = viewModeNow();
    const token = ++modeLoads;
    if (mode === 'kanban') {
      if (allRows == null) {
        FocusPreserved.withFocusPreserved(kanbanHost, () => {
          kanbanHost.textContent = '';
          kanbanHost.appendChild(window.Skeleton
            ? window.Skeleton.block(6, t('common.loading', 'Loading…'))
            : c('div', { className: 'card mb-3', style: { padding: '24px', textAlign: 'center', color: 'var(--foggy)' } }, t('common.loading', 'Loading…')));
        });
        let d = null;
        try { d = await TrackerRows.all(); } catch { d = { rows: [] }; }
        if (token !== modeLoads) return; // a newer flip superseded this load
        allRows = (d && d.rows) || [];
      }
      rows = allRows;
      applyFilters();
      // renderKanban() is applyViewMode's own non-table branch below — one
      // board build per flip, not two.
    } else if (allRows) {
      // Page 1 of the board-fresh rows (board moves are already in).
      pager.reset();
      await loadTable(1);
      if (token !== modeLoads) return;
    }
    applyViewMode();
  }

  function applyViewMode() {
    const tableActive = viewModeNow() === 'table';
    // CAR-210 — a first-run empty tracker shows the full-width empty host
    // instead of the (hidden) table; the kanban host keeps its own empty card.
    // CAR-236 — "first run" is a whole-history fact (totalForTabs()), never a
    // page-local one: an empty filtered page must not hide the table.
    const emptyFirstRun = totalForTabs() === 0;
    emptyHost.hidden = !(tableActive && emptyFirstRun);
    tableWrap.style.display = tableActive && !emptyFirstRun ? '' : 'none';
    pgWrap.style.display = tableActive && !emptyFirstRun ? '' : 'none';
    kanbanHost.style.display = tableActive ? 'none' : '';
    if (!tableActive) renderKanban();
    if (bulk) bulk.el.hidden = bulk.size() === 0 || tableActive;
    // CAR-237 — the funnel lib owns the authoritative view-persistence key;
    // applyViewMode is the one place every mode flip lands.
    if (window.TrackerKanban) window.TrackerKanban.saveViewPref(viewModeNow());
  }

  // v1.118.0 — parent v1.18.0 parity: job-landed celebration. When any row
  // reaches the canonical 'Hired' state, greet it above the board — static
  // markup, no timers/confetti (CSP-safe, calm-by-default). v1.131.0: count by
  // the FOLDED status so a Spanish/legacy alias (e.g. "contratado") still lands.
  // CAR-236 — in board mode rows IS allRows, so this is already the
  // whole-tracker count; the table-only path tops it up from the server
  // funnel's Hired bucket below (computed over the FULL history).
  const hiredCount = rows.filter((r) => fold(r && r.status) === 'Hired').length;
  const hiredWhole = allRows
    ? hiredCount
    : Math.max(hiredCount, (serverFunnel && serverFunnel.Hired) || 0);
  const hiredBanner = hiredCount
    ? c('div', { className: 'card mb-3 hired-banner', role: 'status' }, [
      c('span', { className: 'hired-banner-emoji', 'aria-hidden': 'true' }, '🎉'),
      c('strong', null, t('track.hiredTitle', 'Congratulations — job landed!')),
      c('span', null, ` ${hiredWhole} × ${statusLabel('Hired')} · ${t('track.hiredNote', 'The search that ends well.')}`),
    ])
    : null;

  // CAR-117 grid fix — bounded height + sticky thead: the header stays visible
  // while the body scrolls (the stylesheet already gives th an opaque
  // background). Widths stabilize the grid through the colgroup below.
  const tableWrap = c('div', {
    className: 'table-wrap',
    style: { maxHeight: 'min(72vh, 760px)', overflow: 'auto' },
  }, c('table', { className: 'tbl' }, [
    c('colgroup', null, (hasCommute
      ? ['36px', '56px', '104px', '', '', '', '88px', '72px', '118px', '132px', '60px', '170px']
      : ['36px', '56px', '104px', '', '', '72px', '118px', '132px', '60px', '170px']
    ).map((wd) => (wd ? c('col', { style: { width: wd } }) : c('col')))),
    c('thead', null, c('tr', null, [
      c('th', { scope: 'col' }, bulk ? bulk.selAll : null),
      c('th', { scope: 'col' }, '#'),
      sortableTh(t('track.col.date'), 'date'),
      c('th', { scope: 'col' }, t('scan.col.company')),
      c('th', { scope: 'col' }, t('scan.col.role')),
      hasCommute ? c('th', { scope: 'col' }, t('commute.col.place', 'Location')) : null,
      hasCommute ? sortableTh(t('commute.col.time', 'Drive'), 'commute') : null,
      sortableTh(t('track.col.score', 'Score'), 'score'),
      sortableTh(t('track.col.status'), 'status'),
      c('th', { scope: 'col' }, [
        t('track.col.legitimacy', 'Legitimacy'),
        ' ',
        // U-11 (v1.58.31) — header gets a localized info chip explaining the
        // "High / Caution / Suspicious" scale that sets each row's badge.
        // tabindex=0 + role=img + aria-label so it's reachable by keyboard +
        // screen reader.
        c('span', {
          className: 'th-info',
          tabIndex: 0,
          role: 'img',
          title: t('track.col.legitimacy.help', 'Confidence that the posting is real (High / Caution / Suspicious).'),
          'aria-label': t('track.col.legitimacy.help', 'Confidence that the posting is real (High / Caution / Suspicious).'),
        }, 'ⓘ'),
      ]),
      c('th', { scope: 'col' }, t('track.col.pdf', 'PDF')),
      c('th', { scope: 'col' }, t('track.col.actions', 'Actions')),
    ].filter(Boolean))),
    tbody,
  ]));
  // Sticky thead, applied once here so every header keeps its pinned markup
  // shape above (the '#' th's exact source form is locked by tests).
  for (const th of tableWrap.querySelectorAll('thead th')) {
    th.style.position = 'sticky';
    th.style.top = '0';
    th.style.zIndex = '2';
  }

  // CAR-237 — the funnel tab wiring runs BEFORE the first applyViewMode():
  // applyViewMode persists the effective mode, so a restore issued after it
  // would read its own 'table' write instead of the stored «Воронка» choice.
  // Runs after the hosts above exist — the restore (when it fires) calls
  // applyViewMode() synchronously through the toggle's onChange.
  if (viewToggle && window.TrackerKanban) window.TrackerKanban.funnelTab(viewToggle, t);

  applyViewMode();

  return c('div', null, [
    hiredBanner,
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('track.title'), 'help.hint.tracker'),
        c('p', { className: 'page-subtitle' }, `${totalForTabs()} ${t('track.entriesIn')} data/applications.md`),
      ]),
      // CAR-117 tail (P3.2) — the four heavy operations (Normalize / Dedup /
      // Merge TSV / Import CSV) collapse into the compact «⋯» overflow menu
      // built by buildHeaderMenu below: the toolbar stops presenting
      // destructive bulk ops as big buttons. Handlers unchanged — runFix
      // keeps its UI.confirm gate before the POST; the CSV import keeps its
      // preview → confirm modal (lib/tracker-import.js).
      buildHeaderMenu(rows, c, t),
    ]),

    c('div', { className: 'card mb-3' }, [
      tabBar,
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
        filterScore, hasCommute ? filterCommute : null, hasCommute ? unknownLabel : null, filterText,
        viewToggle ? viewToggle.el : null,
      ].filter(Boolean)),
    ]),

    bulk ? bulk.el : null,
    // CAR-236 — the card describes the whole tracker: allRows when the board
    // loaded them, the current server page otherwise (static per mount, as
    // before).
    TS ? TS.companyHistoryCard(allRows || rows, c, t) : null,

    emptyHost,
    tableWrap,
    kanbanHost,
    pgWrap,
  ].filter(Boolean));
});
// v1.190.0 — "Company history" and the liveness affordance moved to
// lib/tracker-stages.js (CAR-117 split: tracker.js was over the 800-LOC
// contract; the two panels are self-contained and travel with the board
// engine they now serve).

// CAR-117 tail (P3.2) — the header's four heavy operations (Normalize / Dedup /
// Merge TSV / Import CSV) collapse into one compact «⋯» overflow button: the
// toolbar stops shouting destructive bulk ops, and each action keeps its
// existing confirm-gated handler (runFix = UI.confirm BEFORE the POST — the
// gate is pinned by tests/confirm-gate.test.mjs; the CSV import keeps its
// preview → confirm modal in lib/tracker-import.js).
//
// Menu contract mirrors lib/help-hint.js, the project's popover pattern:
//   - CSP-safe: UI.el + addEventListener + textContent, no innerHTML;
//   - the trigger is a real <button> with aria-expanded + aria-haspopup; the
//     menu is role="menu" and its items role="menuitem" <button>s;
//   - Escape closes and returns focus to the trigger (explicit dismissal);
//     outside click / resize / scroll close passively, listeners detached;
//   - the menu is appended to document.body and positioned under the trigger
//     (clamped to the viewport, RTL-mirrored), so a board re-render can
//     never clip it; disabled items keep the U-10 (v1.58.30) empty-tracker
//     tooltip semantics.
//
//     v1.268.1 review — the menu is appended to document.body, so a
//     navigation while it is open left it hanging over the NEW page. The
//     router's cleanup registry closes it via ONE module-level registration
//     with a single slot: buildHeaderMenu (and the toolbar) is re-created on
//     every #/tracker visit, so a per-render hook would leak one registry
//     entry per visit. Armed when the menu opens, nulled inside closeMenu
//     (its `if (!menu)` guard makes that idempotent).
let activeMenuClose = null;
Router.onRouteChange(() => activeMenuClose && activeMenuClose());

function buildHeaderMenu(rows, c, t) {
  const empty = rows.length === 0;
  const emptyTitle = t('track.fixEmpty', 'Add a row to the tracker first — this rewrites data/applications.md and there is nothing to rewrite yet.');
  const enabledTitle = t('track.fixHint', 'Rewrites data/applications.md in place');

  let menu = null;
  const trigger = c('button', {
    className: 'btn btn-ghost',
    type: 'button',
    'aria-label': t('track.moreActions', 'More actions'),
    title: t('track.moreActions', 'More actions'),
    'aria-haspopup': 'true',
    'aria-expanded': 'false',
  }, '⋯');

  function onDocClick(e) {
    if (!menu) return;
    if (menu.contains(e.target) || trigger.contains(e.target)) return;
    closeMenu(false);
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(true); } }
  // Passive window-driven closes; own wrappers so the event object never
  // leaks into closeMenu's `refocus` (the CAR-18 help-hint lesson).
  function onWinClose() { if (menu) closeMenu(false); }

  function closeMenu(refocus) {
    if (!menu) return;
    activeMenuClose = null; // v1.268.1 — disarm the route-change slot (idempotent)
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onWinClose);
    window.removeEventListener('scroll', onWinClose, true);
    if (menu.parentNode) menu.parentNode.removeChild(menu);
    menu = null;
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) { try { trigger.focus(); } catch { /* detached */ } }
  }

  function position() {
    const r = trigger.getBoundingClientRect();
    const rtl = (document.documentElement.getAttribute('dir') === 'rtl');
    const margin = 8;
    const mw = Math.min(menu.offsetWidth || 200, window.innerWidth - margin * 2);
    let left = rtl ? (r.right - mw) : r.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - mw - margin));
    const mh = menu.offsetHeight || 0;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - margin && r.top - mh - 6 > margin) top = r.top - mh - 6;
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
  }

  // U-10 (v1.58.30) — Normalize / Dedup / Merge stay disabled when
  // data/applications.md is empty (aria-disabled mirrors it), with the
  // localized tooltip explaining why; Import CSV is never disabled on an
  // empty tracker (an import is exactly how the first rows arrive).
  const fixItem = (label, api) => c('button', {
    type: 'button',
    role: 'menuitem',
    className: 'btn btn-ghost tracker-menu-item',
    disabled: empty,
    'aria-disabled': empty ? 'true' : 'false',
    title: empty ? emptyTitle : enabledTitle,
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      borderRadius: '0',
      justifyContent: 'flex-start',
      paddingInline: '10px',
    },
    // the destructive gate stays in runFix: UI.confirm BEFORE the POST
    onClick: () => { closeMenu(true); runFix(trigger, api, t); },
  }, label);

  const importItem = () => window.TrackerImport ? c('button', {
    type: 'button',
    role: 'menuitem',
    className: 'btn btn-ghost tracker-menu-item',
    title: t('import.btn', 'Import CSV'),
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      borderRadius: '0',
      justifyContent: 'flex-start',
      paddingInline: '10px',
    },
    // its destructive gate is the picker's own preview → confirm modal
    onClick: () => { closeMenu(true); window.TrackerImport.pick(trigger, t); },
  }, t('import.btn', 'Import CSV')) : null;

  const items = () => [
    fixItem(t('track.normalize'), '/api/run/normalize'),
    fixItem(t('track.dedup'), '/api/run/dedup'),
    fixItem(t('track.merge'), '/api/run/merge'),
    // CAR-181 — import another tracker's CSV export.
    // (Flow lives in lib/tracker-import.js — the CAR-117 split pattern.)
    importItem(),
  ].filter(Boolean);

  trigger.addEventListener('click', () => {
    if (menu) { closeMenu(true); return; } // toggling the trigger is an explicit dismissal
    menu = c('div', {
      role: 'menu',
      'aria-label': t('track.moreActions', 'More actions'),
      style: {
        position: 'fixed',
        zIndex: 'var(--z-popover)',
        minWidth: '200px',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        background: 'var(--paper)',
        color: 'var(--ink)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: 'var(--shadow-lg)',
        fontSize: 'var(--font-size-md)',
      },
    }, items());
    document.body.appendChild(menu);
    position();
    trigger.setAttribute('aria-expanded', 'true');
    // v1.268.1 — a navigation while the menu is open must close it: arm the
    // module-level route-change slot (single registration, see file top).
    activeMenuClose = () => closeMenu(false);
    const first = menu.querySelector('button:not(:disabled)');
    if (first) { try { first.focus(); } catch { /* detached */ } }
    // defer listener attach so the opening click doesn't immediately close it
    setTimeout(() => {
      if (!menu) return;
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', onWinClose);
      window.addEventListener('scroll', onWinClose, true);
    }, 0);
  });

  return trigger;
}

async function runFix(btn, path, t) {
  // WS2 #9 — normalize/dedup/merge REWRITE the parent data/applications.md in
  // place. Focus-trapped confirm before this destructive write.
  const op = (path.split('/').pop() || 'fix');
  if (!(await UI.confirm(
    t('track.fixConfirmTitle', 'Rewrite applications.md?'),
    t('track.fixConfirmBody', 'This runs "{op}" and rewrites data/applications.md in the parent project in place. This cannot be undone from here. Continue?')
      .replace('{op}', op),
    { danger: true, confirmLabel: t('track.fixConfirmOk', 'Run it'), cancelLabel: t('common.cancel', 'Cancel') }))) {
    return;
  }
  UI.toast(t('track.runStart'));
  try {
    const r = await UI.withSpinner(btn, () => API.post(path));
    UI.toast(t('track.done') + ' · exit ' + r.code, r.code === 0 ? 'success' : 'error');
    UI.modal(t('track.outputTitle', 'Output'), UI.el('pre', { className: 'console' }, (r.stdout || '') + (r.stderr ? '\n\n' + r.stderr : '')));
  } catch (e) {
    UI.toast((e && e.message) || 'tracker error', 'error');
  }
}

// CAR-93 — the classifier used to be declared in both tracker.js and
// dashboard.js as a top-level `statusClass`, so the window binding
// belonged to whichever file loaded last and one view's badges silently
// followed the other's classifier. FULL-M6 — the two copies are
// consolidated into lib/status-class.js (namespaced, so the collision
// stays impossible) and the dashboard copy's missing Hired branch is gone
// with the copy itself.
const trackerStatusClass = (s) => StatusClass.of(s);

// G-006 (v1.15.0) — tint Legitimacy badges the same way /#/reports does.
// High / verified / strong → ok. Medium / caution / partial → warn.
// Low / suspicious / posting may be fake → bad.
// v1.243.0 (views-3) — the warn tier is checked BEFORE the bad tier: the
// server's actual verdict string is "Proceed with Caution", and the bad
// branch's `s.includes('proceed')` used to match it first, tinting a
// caution verdict with the bad badge (proceed-before-caution ordering bug).
function legitimacyClass(s) {
  s = (s || '').toLowerCase();
  if (s.includes('high') || s.includes('verified') || s.includes('strong')) return 'badge-ok';
  if (s.includes('medium') || s.includes('caution') || s.includes('partial')) return 'badge-warn';
  if (s.includes('low') || s.includes('suspicious') || s.includes('fake') || s.includes('proceed')) return 'badge-bad';
  return 'badge-info';
}

// L-FOCUS (v1.243.0) — a rebuild that replaces the node a keyboard user is on
// (a paginator button, a row button, a <select>) drops focus to <body>.
// FULL-M6 — the three byte-identical view copies (tracker/reports/stats) are
// consolidated into the shared lib/focus-preserve.js helper.

// CAR-36 (v1.243.0 regression run) — the "Record outcome" modal is a child of
// the app-chrome #modal node, NOT of the #content subtree the router replaces
// on navigation: after opening it, ANY nav click left the modal mounted over
// the new view, intercepting every pointer event (only × / Esc still worked).
// Arm a window-level hashchange guard owned by THIS modal instance (the
// event fires at window — a document-level listener never receives it,
// which is exactly how the first attempt shipped dead (v1.243.0 regression,
// caught live on prod):
// navigating away from #/tracker closes it. UI.modal's onClose (fired on every
// dismissal path — × / Esc / backdrop / programmatic close) removes the
// guard, so a modal a later view opens is never closed by a stale listener.
function armTrackerModalNavGuard() {
  const onHashChange = () => {
    let cur = null;
    try { cur = Router.current(); } catch { cur = null; }
    if (cur && cur.name === 'tracker') return; // same-view re-render (params/query), not a real navigation
    UI.closeModal();
  };
  const detach = () => window.removeEventListener('hashchange', onHashChange);
  window.addEventListener('hashchange', onHashChange);
  return detach;
}
// L262-SPA — the CSV-import modal (lib/tracker-import.js) arms the same
// guard; exposed here so the lib does not duplicate the hashchange listener.
window.TrackerModalNavGuard = armTrackerModalNavGuard;

// --- Record-outcome modal (#/tracker) --------------------------------------
// A preview-then-confirm form that records an application's final outcome via
// the parent outcome.mjs (archives the submitted artifacts + syncs the canonical
// tracker state). Two POSTs to /api/outcome: a dry-run PREVIEW that shows the
// resulting state without writing, then — only after the user sees it — the real
// write. CSP-safe: UI.el + addEventListener + textContent, no innerHTML.
const OUTCOME_OPTIONS = [
  { value: 'rejected', key: 'track.outcome.rejected', fb: 'Rejected' },
  { value: 'offer_received', key: 'track.outcome.offer', fb: 'Offer received' },
  { value: 'hired', key: 'track.outcome.hired', fb: 'Hired / accepted' },
  { value: 'offer_declined', key: 'track.outcome.declined', fb: 'Offer declined' },
  { value: 'no_response', key: 'track.outcome.ghosted', fb: 'No response / ghosted' },
  { value: 'interview_progress', key: 'track.outcome.interview', fb: 'Advanced to interview' },
];

function openOutcomeModal(r, c, t) {
  // Match by report # (unambiguous) when present, else the company name.
  const selector = r.num ? String(r.num) : (r.company || '');

  const select = c('select', { className: 'input', 'aria-label': t('track.outcome.record', 'Record outcome') },
    OUTCOME_OPTIONS.map((o) => c('option', { value: o.value }, t(o.key, o.fb))));
  const note = c('input', { className: 'input', type: 'text', maxLength: 500, placeholder: t('track.outcome.notePh', 'Note (optional)'), 'aria-label': t('track.outcome.notePh', 'Note (optional)') });
  const result = c('div', { role: 'status', style: { fontSize: '13px', minHeight: '18px', color: 'var(--foggy)' } }, '');

  const previewBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('track.outcome.preview', 'Preview'));
  const recordBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('track.outcome.record', 'Record outcome'));
  // Hidden until a preview succeeds. Inline style.display (not the [hidden]
  // attribute) so an author `.btn { display:inline-flex }` cannot un-hide it.
  recordBtn.style.display = 'none';

  const resetPreview = () => { recordBtn.style.display = 'none'; result.textContent = ''; };
  select.addEventListener('change', resetPreview);
  note.addEventListener('input', resetPreview);

  previewBtn.addEventListener('click', async () => {
    if (!selector) { result.textContent = t('track.outcome.failed', 'Could not record the outcome'); return; }
    previewBtn.disabled = true;
    try {
      const p = await API.post('/api/outcome', { selector, type: select.value, note: note.value.trim(), role: r.role || '', dryRun: true });
      if (!p || p.available === false) {
        result.textContent = t('track.outcome.failed', 'Could not record the outcome');
        recordBtn.style.display = 'none';
        return;
      }
      result.textContent = t('track.outcome.previewResult', 'Will set #{num} {company} → {state}')
        .replace('{num}', p.num).replace('{company}', p.company).replace('{state}', p.canonicalState);
      recordBtn.style.display = '';
    } catch (e) {
      result.textContent = (e && e.message) || t('track.outcome.failed', 'Could not record the outcome');
      recordBtn.style.display = 'none';
    } finally {
      previewBtn.disabled = false;
    }
  });

  recordBtn.addEventListener('click', async () => {
    recordBtn.disabled = true;
    try {
      const res = await API.post('/api/outcome', { selector, type: select.value, note: note.value.trim(), role: r.role || '' });
      UI.toast(t('track.outcome.recorded', 'Outcome recorded') + ' → ' + (res.canonicalState || ''), 'success');
      UI.closeModal();
      Router.render();
    } catch (e) {
      UI.toast((e && e.message) || t('track.outcome.failed', 'Could not record the outcome'), 'error');
    } finally {
      recordBtn.disabled = false;
    }
  });

  const body = c('div', { style: { display: 'grid', gap: '10px', minWidth: '280px' } }, [
    c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } },
      `#${r.num || '?'} ${r.company || ''}${r.role ? ' · ' + r.role : ''}`),
    select, note, result,
    c('div', { style: { display: 'flex', gap: '8px' } }, [previewBtn, recordBtn]),
  ]);
  // CAR-36 — the guard's detach doubles as UI.modal's onClose: every
  // dismissal path (× / Esc / backdrop / record-success close / nav-away
  // close) removes the hashchange listener exactly once.
  const detachNavGuard = armTrackerModalNavGuard();
  UI.modal(t('track.outcome.record', 'Record outcome'), body, detachNavGuard);
}


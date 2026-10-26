/* global Router, API, UI, I18n, HelpHint, MapPrefs, PostingUrlKey */
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
  const [data, stagesData, commute] = await Promise.all([
    API.get('/api/tracker'),
    API.get('/api/tracker/stages').catch(() => ({ stages: [], aliases: {} })),
    API.get('/api/commute').catch(() => null),
  ]);
  const rows = data.rows || [];
  const STAGES = Array.isArray(stagesData.stages) ? stagesData.stages : [];
  const ALIASES = stagesData.aliases || {};
  const TS = window.TrackerStages;
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

  const filterScore = c('select', { className: 'select', style: { maxWidth: '180px' } }, [
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
    const counts = TS ? TS.stageCounts(rows, STAGES, ALIASES) : {};
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
          refreshView();
          // renderTabs() (called from applyFilters) tears down and rebuilds every
          // tab button, so the one that was just clicked — and had focus — is
          // gone. Restore focus to the now-active tab so keyboard users stay on
          // the strip (WAI-ARIA Tabs pattern). Scoped to tab activation only, so
          // sort/search/paging re-renders never steal focus.
          const nowActive = tabBar.querySelector('.tracker-tab.is-active');
          if (nowActive) nowActive.focus();
        },
      }, [
        c('span', null, label),
        c('span', { className: 'tracker-tab-n', 'aria-hidden': 'true' }, String(n)),
      ]);
      return b;
    };
    tabBar.appendChild(tab(t('track.allStatus', 'All'), '', rows.length));
    // The tab's DISPLAYED caption is the localized label; the tab's filter
    // VALUE stays the canonical stage label `s` (comparison + folding below).
    for (const s of STAGES) tabBar.appendChild(tab(statusLabel(s), s, counts[s] || 0));
  }

  const tbody = c('tbody');
  const pgWrap = c('div'); // paginator container, re-rendered on each filter change

  // 25 rows per page — same default the activity log uses. The paginator
  // auto-clamps when the filter narrows the list so the user can't land on an
  // empty page after typing in the search.
  const pager = UI.paginate({ pageSize: 25, onChange: () => applyFilters() });

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

  // ── CAR-117 · undo, move flow, bulk selection (lib controllers) ───────────
  // tracker.js sits against the 800-LOC contract, so the stateful controllers
  // live in lib/tracker-stages.js and are wired together here. The undo bar
  // mounts itself once at body level (singleton shell, like the pipeline bar).
  const undoCtl = TS ? TS.createUndoController({ t, statusLabel, onRestored: () => refreshView() }) : null;
  const moveFlow = TS ? TS.createMoveFlow({
    t,
    stages: STAGES,
    fold,
    statusLabel,
    isReady: () => movesReady,
    onMovesOff: () => { movesReady = false; }, // the parent recorder is absent — degrade to read-only
    onProgress: (d, n) => { if (bulk) bulk.progress(d + '/' + n); },
    onUndoable: (moves, target) => { if (undoCtl) undoCtl.push(moves, target); },
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
  // Created before the first applyFilters() below reads its mode (TDZ).
  const viewToggle = TS.createViewToggle({ t, onChange: () => applyViewMode() });

  function applyFilters() {
    renderTabs(); // whole-history counts; reflects the active stage tab
    const all = sorted(filtered());
    const page = pager.slice(all);
    // L-FOCUS (v1.243.0) — this rebuild replaces the nodes a keyboard user is
    // on (a row's Report/Outcome button, a .pg-btn), dropping focus to <body>.
    // Restore it (see withFocusPreserved below).
    withFocusPreserved(tbody, () => {
      tbody.innerHTML = '';
      if (all.length === 0) {
        // WS2 #26 — distinguish first-run (no data at all) from a filter that
        // excluded everything; the former gets an actionable CTA.
        const emptyCell = rows.length === 0
          ? c('td', { colspan: hasCommute ? 12 : 10, style: { textAlign: 'center', padding: '40px', color: 'var(--foggy)' } }, [
              c('strong', null, t('track.emptyTitle', 'No applications yet')),
              c('p', { style: { margin: '8px 0 0' } }, t('track.emptyBody', 'Run the pipeline or evaluate a JD to populate this tracker.')),
              c('a', { href: '#/pipeline', className: 'btn btn-primary btn-sm', style: { marginTop: '12px' } }, t('track.emptyCta', 'Open pipeline')),
            ])
          : c('td', { colspan: hasCommute ? 12 : 10, style: { textAlign: 'center', padding: '40px', color: 'var(--foggy)' } }, t('track.noMatch'));
        tbody.appendChild(c('tr', null, emptyCell));
        return;
      }
      for (const r of page) tbody.appendChild(row(r));
    });
    if (bulk) {
      bulk.setRows(rows);
      bulk.setPage(page);
      bulk.syncSelAll();
      bulk.el.hidden = bulk.size() === 0 || viewToggle.mode() !== 'table';
    }
    withFocusPreserved(pgWrap, () => {
      pgWrap.innerHTML = '';
      if (all.length === 0) return;
      pgWrap.appendChild(pager.controls(page.length, all.length));
    });
  }

  // WS2 #11 — a sortable column header: a button inside the th so it's
  // keyboard-operable; aria-sort reflects state; click toggles dir. NOTE date
  // sort is a string compare — correct only because r.date is ISO YYYY-MM-DD.
  function sortableTh(label, key) {
    const th = c('th', { scope: 'col', 'aria-sort': 'none' });
    const txt = c('span', null, label);
    const ind = c('span', { 'aria-hidden': 'true', style: { marginLeft: '4px' } }, '⇅');
    const btn = c('button', {
      className: 'tbl-sort',
      style: { background: 'none', border: 0, font: 'inherit', cursor: 'pointer', color: 'inherit', padding: 0 },
      onClick: () => {
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        pager.reset();
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
  ;[filterScore, filterText, filterCommute, showUnknown].forEach((el) =>
    el.addEventListener('input', () => { pager.reset(); refreshView(); })
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
      // Status badge + (for ATS postings) a lazy "still live?" check. The
      // affordance is null for non-ATS rows, so most rows are unchanged.
      // v1.248.2 — the badge CAPTION is the localized canonical label (the raw
      // status is folded through the server alias map first, so "contratado"
      // shows as "Hired"/«Нанят»); trackerStatusClass + every comparison
      // still read the canonical value.
      c('td', { className: 'v2-track-nowrap', style: { whiteSpace: 'nowrap' } }, [
        c('span', { className: 'badge ' + trackerStatusClass(r.status) }, statusLabel(fold(r.status))),
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

  applyFilters();

  // ── CAR-117 · the two hosts ────────────────────────────────────────────────
  const kanbanHost = c('div', { className: 'mb-3' });

  function renderKanban() {
    const visible = sorted(filtered());
    withFocusPreserved(kanbanHost, () => {
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
      kanbanHost.appendChild(TS.kanbanBoard({
        rows: visible,
        stages: STAGES,
        fold,
        statusLabel,
        scoreClass: (v) => scoreCls(v),
        movesReady,
        t,
        onMove: (picked, presetTo) => moveFlow.open(picked, presetTo),
      }));
    });
  }

  function refreshView() {
    applyFilters();
    if (viewToggle.mode() === 'kanban') renderKanban();
  }

  function applyViewMode() {
    const tableActive = viewToggle.mode() === 'table';
    tableWrap.style.display = tableActive ? '' : 'none';
    pgWrap.style.display = tableActive ? '' : 'none';
    kanbanHost.style.display = tableActive ? 'none' : '';
    if (!tableActive) renderKanban();
    if (bulk) bulk.el.hidden = bulk.size() === 0 || tableActive;
  }

  // v1.118.0 — parent v1.18.0 parity: job-landed celebration. When any row
  // reaches the canonical 'Hired' state, greet it above the board — static
  // markup, no timers/confetti (CSP-safe, calm-by-default). v1.131.0: count by
  // the FOLDED status so a Spanish/legacy alias (e.g. "contratado") still lands.
  const hiredCount = rows.filter((r) => fold(r && r.status) === 'Hired').length;
  const hiredBanner = hiredCount
    ? c('div', { className: 'card mb-3 hired-banner', role: 'status' }, [
      c('span', { className: 'hired-banner-emoji', 'aria-hidden': 'true' }, '🎉'),
      c('strong', null, t('track.hiredTitle', 'Congratulations — job landed!')),
      c('span', null, ` ${hiredCount} × ${statusLabel('Hired')} · ${t('track.hiredNote', 'The search that ends well.')}`),
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

  applyViewMode();

  return c('div', null, [
    hiredBanner,
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('track.title'), 'help.hint.tracker'),
        c('p', { className: 'page-subtitle' }, `${rows.length} ${t('track.entriesIn')} data/applications.md`),
      ]),
      // U-10 (v1.58.30) — Normalize / Dedup / Merge buttons disabled when
      // data/applications.md is empty. Clicking them on an empty tracker is a
      // no-op that still hit the parent project; now the user sees the action is
      // unavailable and gets a localized tooltip explaining why.
      (() => {
        const empty = rows.length === 0;
        const emptyTitle = t('track.fixEmpty', 'Add a row to the tracker first — this rewrites data/applications.md and there is nothing to rewrite yet.');
        const enabledTitle = t('track.fixHint', 'Rewrites data/applications.md in place');
        const make = (api, label) =>
          c('button', {
            className: 'btn btn-ghost',
            disabled: empty,
            title: empty ? emptyTitle : enabledTitle,
            'aria-disabled': empty ? 'true' : 'false',
            onClick: (e) => runFix(e.currentTarget, api, t),
          }, label);
        return c('div', { className: 'flex gap-3' }, [
          make('/api/run/normalize', t('track.normalize')),
          make('/api/run/dedup', t('track.dedup')),
          make('/api/run/merge', t('track.merge')),
        ]);
      })(),
    ]),

    c('div', { className: 'card mb-3' }, [
      tabBar,
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
        filterScore, hasCommute ? filterCommute : null, hasCommute ? unknownLabel : null, filterText,
        viewToggle ? viewToggle.el : null,
      ].filter(Boolean)),
    ]),

    bulk ? bulk.el : null,
    TS ? TS.companyHistoryCard(rows, c, t) : null,

    tableWrap,
    kanbanHost,
    pgWrap,
  ].filter(Boolean));
});
// v1.190.0 — "Company history" and the liveness affordance moved to
// lib/tracker-stages.js (CAR-117 split: tracker.js was over the 800-LOC
// contract; the two panels are self-contained and travel with the board
// engine they now serve).

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

// CAR-93 — renamed from statusClass: dashboard.js declares the SAME name as
// a top-level function in a sibling classic script, so the window binding
// belonged to whichever file loaded last and one view's badges silently
// followed the other's classifier (the dashboard copy has no Hired branch —
// a re-order would have cost tracker its badge-hired). Distinct names keep
// each view's classifier its own.
function trackerStatusClass(s) {
  s = (s || '').toLowerCase();
  // v1.118.0 — parent v1.18.0 parity: Hired (job landed) gets the celebratory tint.
  if (s.includes('hired')) return 'badge-hired';
  if (s.includes('offer')) return 'badge-ok';
  if (s.includes('reject') || s.includes('discard')) return 'badge-bad';
  if (s.includes('interview') || s.includes('respond')) return 'badge-info';
  if (s.includes('skip')) return 'badge-warn';
  return '';
}

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
// Snapshot the focused element among the container's focusable descendants,
// let `mutate()` rebuild, then restore focus to the matching node (matched by
// the same control). No-op when focus is outside the container. Kept
// file-local: lib/ is shared and outside this change's file set; tracker.js,
// reports.js and stats.js each carry this same copy.
// CAR-93 — the marker was tag|class|text, which is IDENTICAL for the same
// control on every row (the Outcome/Report buttons, the Still-live button),
// so focus jumped to row 1. The marker now keys on data-key (row-scoped
// controls carry one) or aria-label before falling back to the text — and
// all three copies stay byte-identical.
function withFocusPreserved(container, mutate) {
  const markOf = (el) => el.tagName + '|' + el.className + '|'
    + ((el.getAttribute && (el.getAttribute('data-key') || el.getAttribute('aria-label'))) || '')
    + '|' + (el.textContent || '');
  let marker = null;
  try {
    const doc = container.ownerDocument || document;
    const active = doc.activeElement;
    if (active && active !== container && container.contains(active)) {
      marker = markOf(active);
    }
  } catch { marker = null; }
  mutate();
  if (!marker) return;
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let candidates = [];
  try { candidates = Array.from(container.querySelectorAll(sel)); } catch { return; }
  for (const el of candidates) {
    if (markOf(el) === marker) {
      try { el.focus(); } catch { /* detached node */ }
      return;
    }
  }
}

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
  const note = c('input', { className: 'input', type: 'text', maxLength: 500, placeholder: t('track.outcome.notePh', 'Note (optional)') });
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

/* global Router, API, UI, I18n, HelpHint, ReportOps */
// The rep2.* keys below (CAR-118 #/reports v2) are translated in all 19
// locale dicts (public/js/lib/locales/i18n-dict.<lang>.js) and enforced by
// tests/i18n-coverage.test.mjs. The old rep.thr45/40/35 keys are no longer
// referenced here: their dict values carried CLI commands and CAR-118 bans
// those from this UI (the action copy is the rep2.act* keys).
// CAR-137 i18n: the v2empty.reports.* empty-state strings live in all 19
// locale dicts (the ×19 fan-out landed in the same change).
Router.register('reports', async (params) => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  // single report view
  if (params[0]) {
    const slug = params.join('/');
    const r = await API.get('/api/reports/' + encodeURIComponent(slug));
    return c('div', null, [
      c('header', { className: 'page-header' }, [
        c('div', null, [
          // CAR-118 review finding 4 — the detail view keeps the report's
          // RAW H1 (rewriting a legacy hand-written title could
          // mis-attribute role and company; the list rewrites only when a
          // recognised label was stripped).
          c('h1', { className: 'page-title' }, r.title || slug),
          c('p', { className: 'page-subtitle' }, [r.date, r.archetype, r.legitimacy].filter(Boolean).join(' · ')),
        ]),
        c('div', { className: 'flex gap-3' }, [
          c('button', { className: 'btn btn-ghost', onClick: () => Router.go('/reports') }, t('rep.allReports')),
          r.url && UI.safeHref(r.url) && c('a', { className: 'btn btn-ghost', href: UI.safeHref(r.url), target: '_blank', rel: 'noopener' }, t('rep.openJd')), // FULL-R5 — report URLs are LLM-written; only http(s) links
          c('button', {
            className: 'btn btn-primary',
            onClick: (e) => window.PdfGenerate.run({ kind: 'report', slug, button: e.currentTarget }),
          }, '📄 ' + t('common.generatePdf', 'Generate PDF')),
        ]),
      ]),
      c('div', { className: 'card md', html: UI.md(r.markdown) }),
    ]);
  }

  // list view
  const data = await API.get('/api/reports');
  const reports = data.reports || [];

  if (reports.length === 0) {
    // CAR-137 — the v2empty pattern (CAR-124): explanation + a tagged,
    // decorative example of the filled state + the real first step.
    return c('div', null, [
      c('header', { className: 'page-header' }, [
        c('div', null, [
          HelpHint.title(t('rep.title'), 'help.hint.reports'),
          // QA BUG-010 — the populated list view has a subtitle; the
          // empty state was the only page missing the descriptive line.
          c('p', { className: 'page-subtitle' },
            t('rep.subtitle', 'Saved evaluation & deep-research reports from reports/')),
        ]),
      ]),
      c('div', { className: 'empty' }, [
        c('p', { style: { fontWeight: 600, margin: '0 0 4px' } },
          t('v2empty.reports.emptyTitle', 'No reports yet')),
        c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0 0 12px' } },
          t('v2empty.reports.emptyBody', 'Evaluate your first job posting to generate a scored report — it lands here as a searchable row like the one below.')),
        c('div', { className: 'v2-empty-example', 'aria-hidden': 'true' }, [
          c('span', { className: 'v2-empty-example__tag' }, t('v2empty.exampleTag', 'Example')),
          c('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' } }, [
            c('span', { style: { fontWeight: '700', fontSize: '14px' } }, 'Acme Robotics — Senior Backend Engineer'),
            c('span', { className: 'score-pill score-good' }, '4.5/5'),
            c('span', { style: { color: 'var(--foggy)', fontSize: '12px' } }, '2026-10-01'),
          ]),
        ]),
        c('p', { style: { margin: '12px 0 0' } },
          c('a', { className: 'btn btn-primary', href: '#/evaluate' },
            '▶ ' + t('v2empty.reports.openEvaluate', 'Run an evaluation'))),
      ]),
    ]);
  }

  // ── CAR-118 — search / filters / sort / view state ────────────────────────
  const PREFS_KEY = 'career-ops-ui:reports-prefs';
  const DEBOUNCE_MS = 200;

  function loadPrefs() {
    try { return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function savePrefs(prefs) {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
    catch { /* private mode — the view still works, it just forgets */ }
  }

  const prefs = loadPrefs();
  const state = {
    q: '',
    company: '',
    legitimacy: '',
    band: 'all',
    dateFrom: '',
    dateTo: '',
    sortKey: ['date', 'score', 'company'].includes(prefs.sortKey) ? prefs.sortKey : 'date',
    sortDir: prefs.sortDir === 'asc' ? 'asc' : 'desc',
    view: prefs.view === 'cards' ? 'cards' : 'table',
  };
  const persist = () => savePrefs({ view: state.view, sortKey: state.sortKey, sortDir: state.sortDir });

  // Debounced live filters (ReportOps.debounce carries .cancel() — the
  // reset button must be able to kill a pending keystroke, review
  // finding 8: a stale 200 ms callback would otherwise resurrect a filter
  // the user just cleared).
  const searchApply = ReportOps.debounce((e) => applyState({ q: e.target.value }), DEBOUNCE_MS);
  const companyApply = ReportOps.debounce((e) => applyState({ company: e.target.value }), DEBOUNCE_MS);

  // v1.180.0 — the table layout (kept next to the new card view). A long
  // "Score not detected" chip used to squeeze the title column to
  // near-zero; a table gives every field its own column (reports-table
  // gate). CAR-118 adds the card view + the live filter toolbar.
  const tbody = c('tbody');
  const cardsWrap = c('div', { className: 'report-cards' });
  const pgWrap = c('div');
  const countEl = c('span', { className: 'report-count' });
  const pager = UI.paginate({ pageSize: 20, onChange: () => renderList() });

  // ── row / card builders ───────────────────────────────────────────────────
  function scoreChip(rep) {
    // FIX-3 (v1.161.0) — a report with no parseable score shows a MUTED
    // chip, not empty space. CAR-118 — a parsed score is ALWAYS «x.x/5»
    // (ReportOps.formatScore), coloured on the 4-band scale.
    return rep.scoreNum != null
      ? c('span', { className: 'score-pill score-' + ReportOps.bandOf(rep.scoreNum) },
        ReportOps.formatScore(rep.scoreNum))
      : c('span', {
        className: 'score-pill score-muted',
        title: t('rep.scoreUnparsedHint', 'Open the report to see the score'),
      }, t('rep.scoreUnparsed', 'Score not detected'));
  }

  function makeRow(rep) {
    const open = () => Router.go('/reports/' + rep.slug);
    const title = ReportOps.displayTitle(rep) || rep.slug;
    // WS2 #37 — keyboard-operable: role=link, tabindex, Enter/Space.
    return c('tr', {
      className: 'report-row',
      role: 'link',
      tabindex: '0',
      'aria-label': (rep.title || rep.slug),
      onClick: open,
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      },
    }, [
      c('td', { className: 'report-title-cell' }, title),
      // CAR-53 (v1.246.0) — ISO dates ("2026-07-01") must never wrap
      // mid-string; .report-date-cell pins them to one line.
      c('td', { className: 'report-date-cell' }, rep.date || '—'),
      c('td', null, rep.legitimacy || '—'),
      c('td', null, scoreChip(rep)),
    ]);
  }

  // CAR-118 — the legend rows, as in-card action buttons (spec: «Подать»
  // ≥4.5, «Найти контакт» 4.0–4.4, «Исследовать» 3.5–3.9). CLI-free.
  // Review finding 9 — #/deep, #/apply and #/contacto (mode-page factory)
  // consume NO hash query parameters today (deep's inputs are #deep-company
  // / #deep-role and are never prefilled from the URL), so there is no
  // context to pass yet; report→form autofill is CAR-119's «выбор вакансии
  // из трекера/отчёта» scope. The buttons navigate to the band's flow.
  function actionFor(rep) {
    const band = ReportOps.bandOf(rep.scoreNum);
    if (band === 'high') return { route: '/apply', cls: 'btn-primary', label: t('rep2.actApply', 'Apply now — top fit') };
    if (band === 'good') return { route: '/contacto', cls: '', label: t('rep2.actContact', 'Apply, or find a warm contact first') };
    if (band === 'mid') return { route: '/deep', cls: '', label: t('rep2.actResearch', 'Research the company first') };
    return null; // low / unparsed: no suggested action
  }

  function makeCard(rep) {
    const open = () => Router.go('/reports/' + rep.slug);
    const title = ReportOps.displayTitle(rep) || rep.slug;
    const act = actionFor(rep);
    // The whole upper region is the link (role=link + Enter/Space, same
    // contract as the table rows); the action button is a SIBLING below —
    // never nested inside the link region.
    return c('article', { className: 'report-card' }, [
      c('div', {
        className: 'report-card-main',
        role: 'link',
        tabindex: '0',
        'aria-label': title,
        onClick: open,
        onKeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        },
      }, [
        c('h3', { className: 'report-card-title' }, title),
        c('div', { className: 'report-card-meta' }, [
          c('span', { className: 'report-date-cell' }, rep.date || '—'),
          rep.legitimacy ? c('span', { className: 'chip report-legit-chip' }, rep.legitimacy) : null,
          scoreChip(rep),
          rep.pdf ? c('span', { className: 'chip report-pdf-chip' }, t('rep2.pdfBadge', 'PDF')) : null,
        ]),
      ]),
      act ? c('div', { className: 'report-card-actions' },
        c('button', { type: 'button', className: 'btn btn-sm ' + act.cls, onClick: () => Router.go(act.route) }, act.label)) : null,
    ]);
  }

  // ── table (sortable headers) ──────────────────────────────────────────────
  function sortPatch(key) {
    if (state.sortKey === key) return { sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' };
    return { sortKey: key, sortDir: key === 'company' ? 'asc' : 'desc' };
  }

  function sortTh(key, labelNode) {
    return c('th', { scope: 'col', 'data-sort-key': key, 'aria-sort': 'none' },
      c('button', {
        type: 'button',
        className: 'th-sort',
        title: t('rep2.sortLabel', 'Sort by'),
        onClick: () => applyState(sortPatch(key)),
      }, [
        labelNode,
        c('span', { className: 'th-arrow', 'aria-hidden': 'true' }, '↕'),
      ]));
  }

  const headRow = c('tr', null, [
    sortTh('company', t('rep.colReport', 'Report')),
    sortTh('date', t('track.col.date', 'Date')),
    // Legitimacy has no sort dimension (the filter covers it) — plain th.
    c('th', { scope: 'col' }, t('track.col.legitimacy', 'Legitimacy')),
    sortTh('score', t('rep.score', 'Score')),
  ]);
  const tableWrap = c('div', { className: 'reports-scroll' },
    c('table', { className: 'tbl reports-tbl' }, [c('thead', null, headRow), tbody]));

  // ── toolbar ───────────────────────────────────────────────────────────────
  const hiddenLabel = (id, key, fallback) =>
    c('label', { htmlFor: id, className: 'visually-hidden' }, t(key, fallback));

  const searchInp = c('input', {
    type: 'search',
    id: 'reports-search',
    placeholder: t('rep2.searchPh', 'Company or role…'),
    autoComplete: 'off',
    onInput: searchApply,
  });
  const companyInp = c('input', {
    type: 'text',
    id: 'reports-company',
    list: 'reports-company-options',
    placeholder: t('rep2.companyPh', 'Company…'),
    autoComplete: 'off',
    onInput: companyApply,
  });
  const datalist = c('datalist', { id: 'reports-company-options' },
    ReportOps.companies(reports).map((name) => c('option', { value: name })));

  const legSel = c('select', {
    id: 'reports-legitimacy',
    onChange: (e) => applyState({ legitimacy: e.target.value }),
  }, [
    c('option', { value: '' }, t('rep2.legitimacyAll', 'All')),
    ...Array.from(new Set(reports.map((r) => r.legitimacy).filter(Boolean))).sort()
      .map((v) => c('option', { value: v }, v)),
  ]);

  // CAR-118 (review) — band labels are LITERAL keys (the i18n-coverage
  // gate scans quoted-key literals; string-built keys bypassed it).
  const BAND_LABEL_KEYS = {
    high: 'rep2.bandHigh', good: 'rep2.bandGood', mid: 'rep2.bandMid', low: 'rep2.bandLow',
  };
  const BAND_LABEL_FALLBACKS = {
    high: 'High (4.5+)', good: 'Good (4.0+)', mid: 'Mid (3.5+)', low: 'Below 3.5',
  };
  const bandLabel = (id) => t(BAND_LABEL_KEYS[id], BAND_LABEL_FALLBACKS[id]);

  const bandSel = c('select', {
    id: 'reports-band',
    onChange: (e) => applyState({ band: e.target.value }),
  }, [
    c('option', { value: 'all' }, t('rep2.bandAll', 'All scores')),
    ...ReportOps.BANDS.map((b) => c('option', { value: b.id }, bandLabel(b.id))),
  ]);

  const fromInp = c('input', {
    type: 'date', id: 'reports-date-from',
    onChange: (e) => applyState({ dateFrom: e.target.value }),
  });  const toInp = c('input', {
    type: 'date', id: 'reports-date-to',
    onChange: (e) => applyState({ dateTo: e.target.value }),
  });

  const sortSel = c('select', {
    id: 'reports-sort',
    onChange: (e) => applyState(sortPatch(e.target.value)),
  }, [
    c('option', { value: 'date' }, t('rep2.sortDate', 'Date')),
    c('option', { value: 'score' }, t('rep2.sortScore', 'Score')),
    c('option', { value: 'company' }, t('rep2.sortCompany', 'Company')),
  ]);
  const dirBtn = c('button', { type: 'button', className: 'btn btn-ghost btn-sm report-dir-btn' });

  const tableRadio = c('input', {
    type: 'radio', name: 'reports-view', id: 'reports-view-table', value: 'table',
    checked: state.view === 'table',
    onChange: () => applyState({ view: 'table' }),
  });
  const cardsRadio = c('input', {
    type: 'radio', name: 'reports-view', id: 'reports-view-cards', value: 'cards',
    checked: state.view === 'cards',
    onChange: () => applyState({ view: 'cards' }),
  });
  const viewGroup = c('div', {
    className: 'report-view-toggle',
    role: 'radiogroup',
    'aria-label': t('rep2.viewLabel', 'View'),
  }, [
    tableRadio,
    c('label', { htmlFor: 'reports-view-table' }, t('rep2.viewTable', 'Table')),
    cardsRadio,
    c('label', { htmlFor: 'reports-view-cards' }, t('rep2.viewCards', 'Cards')),
  ]);

  const resetBtn = c('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm',
    onClick: () => {
      // Kill pending debounces FIRST (review finding 8) — a stale 200 ms
      // callback must not re-apply a filter the user just cleared.
      searchApply.cancel();
      companyApply.cancel();
      searchInp.value = ''; companyInp.value = ''; legSel.value = '';
      bandSel.value = 'all'; fromInp.value = ''; toInp.value = '';
      applyState({ q: '', company: '', legitimacy: '', band: 'all', dateFrom: '', dateTo: '' });
    },
  }, t('rep2.reset', 'Reset filters'));

  const toolbar = c('div', { className: 'card report-toolbar' }, [
    c('div', { className: 'report-toolbar-row report-toolbar-search' }, [
      c('div', { className: 'report-field report-field-grow' }, [
        hiddenLabel('reports-search', 'rep2.searchLabel', 'Search reports'),
        searchInp,
      ]),
      viewGroup,
    ]),
    c('div', { className: 'report-toolbar-row' }, [
      c('div', { className: 'report-field' }, [
        hiddenLabel('reports-company', 'rep2.companyLabel', 'Company'),
        companyInp, datalist,
      ]),
      c('div', { className: 'report-field' }, [
        hiddenLabel('reports-legitimacy', 'track.col.legitimacy', 'Legitimacy'),
        legSel,
      ]),
      c('div', { className: 'report-field' }, [
        hiddenLabel('reports-band', 'rep2.bandLabel', 'Score band'),
        bandSel,
      ]),
      c('div', { className: 'report-field' }, [
        hiddenLabel('reports-date-from', 'rep2.dateFrom', 'From date'),
        fromInp,
      ]),
      c('div', { className: 'report-field' }, [
        hiddenLabel('reports-date-to', 'rep2.dateTo', 'To date'),
        toInp,
      ]),
      c('div', { className: 'report-field' }, [
        hiddenLabel('reports-sort', 'rep2.sortLabel', 'Sort by'),
        c('div', { className: 'report-sort-pair' }, [sortSel, dirBtn]),
      ]),
      resetBtn,
    ]),
  ]);

  // ── score histogram (click a column = filter) ─────────────────────────────
  const histogramWrap = c('div', {
    className: 'report-histogram',
    role: 'group',
    'aria-label': t('rep2.histogramLabel', 'Score distribution — click a column to filter'),
  });

  function renderHistogram() {
    const hist = ReportOps.scoreHistogram(reports);
    const entries = ReportOps.BANDS.map((b) => [b.id, hist[b.id] || 0]);
    const max = Math.max(1, ...entries.map(([, n]) => n));
    FocusPreserved.withFocusPreserved(histogramWrap, () => {
      histogramWrap.innerHTML = '';
      for (const [id, n] of entries) {
        const label = bandLabel(id);
        histogramWrap.appendChild(c('button', {
          type: 'button',
          className: 'report-hist-btn band-' + id,
          'aria-pressed': state.band === id ? 'true' : 'false',
          title: label + ' · ' + n,
          onClick: () => applyState({ band: state.band === id ? 'all' : id }),
        }, [
          c('span', { className: 'report-hist-count' }, String(n)),
          c('span', { className: 'report-hist-bar', 'aria-hidden': 'true' },
            c('span', { className: 'report-hist-fill', style: { height: Math.round((n / max) * 100) + '%' } })),
          c('span', { className: 'report-hist-label' }, label),
        ]));
      }
      // Unparsed — display-only (the band filter selects scored bands).
      // CAR-118 review finding 12 — this is the ONLY place the unparsed
      // count appears, so it must stay in the accessibility tree: a note
      // with a label, never aria-hidden.
      histogramWrap.appendChild(c('span', {
        className: 'report-hist-btn band-unparsed',
        role: 'note',
        'aria-label': t('rep2.bandUnparsed', 'No score') + ' · ' + (hist.unparsed || 0),
        title: t('rep2.bandUnparsed', 'No score') + ' · ' + (hist.unparsed || 0),
      }, [
        c('span', { className: 'report-hist-count' }, String(hist.unparsed || 0)),
        c('span', { className: 'report-hist-bar', 'aria-hidden': 'true' }),
        c('span', { className: 'report-hist-label' }, t('rep2.bandUnparsed', 'No score')),
      ]));
    });
  }

  // PR-9 follow-up — surface the action-by-score bands inline. CAR-118:
  // CLI-free copy (the old dict-backed rows carried shell commands).
  // CAR-58 (v1.246.0) — the numeric band ("≥ 4.5") is isolated from RTL
  // bidi mirroring. RTL deep sweep: the isolation moved OFF the <td> onto
  // an inner span — a cell with its own `direction: ltr` also re-anchors
  // `text-align: start` to the physical left, breaking column alignment
  // under [dir="rtl"] (header right-aligned, cells left-aligned).
  const tdNum = { padding: '4px 8px', fontWeight: 600 };
  const ltrNum = (s) => c('span', { style: { direction: 'ltr', unicodeBidi: 'isolate' } }, s);
  const tdTxt = { padding: '4px 8px' };
  const thresholdsCard = c('details', {
    className: 'card report-legend',
    open: false,
  }, [
    c('summary', { style: { cursor: 'pointer', fontWeight: 600 } },
      '🎯 ' + t('rep.thresholdsTitle', 'Score → next step')),
    c('div', { style: { marginTop: '8px', fontSize: '14px' } }, [
      c('table', { style: { width: '100%', borderCollapse: 'collapse' } }, [
        c('thead', null, c('tr', null, [
          c('th', { style: { textAlign: 'start', padding: '4px 8px' } }, t('rep.score', 'Score')),
          c('th', { style: { textAlign: 'start', padding: '4px 8px' } }, t('rep.thrAction', 'Next step')),
        ])),
        c('tbody', null, [
          // CAR-58 (v1.246.0) — the band cells are numeric compositions;
          // each gets an isolated LTR direction.
          c('tr', null, [
            c('td', { style: tdNum }, ltrNum('≥ 4.5')),
            c('td', { style: tdTxt }, t('rep2.actApply', 'Apply now — top fit')),
          ]),
          c('tr', null, [
            c('td', { style: tdNum }, ltrNum('4.0 – 4.4')),
            c('td', { style: tdTxt }, t('rep2.actContact', 'Apply, or find a warm contact first')),
          ]),
          c('tr', null, [
            c('td', { style: tdNum }, ltrNum('3.5 – 3.9')),
            c('td', { style: tdTxt }, t('rep2.actResearch', 'Research the company first')),
          ]),
          c('tr', null, [
            c('td', { style: tdNum }, ltrNum('< 3.5')),
            c('td', { style: tdTxt }, t('rep2.actLow', 'Skip unless there is a personal reason')),
          ]),
        ]),
      ]),
      c('p', { style: { fontSize: '12px', color: 'var(--foggy)', marginTop: '8px' } }, [
        t('rep.thresholdsSource', 'From '),
        c('a', {
          href: 'https://career-ops.org/docs/introduction/guides/scan-job-portals',
          target: '_blank', rel: 'noopener noreferrer',
        }, 'career-ops.org/docs'),
        '.',
      ]),
    ]),
  ]);

  // L-FOCUS (v1.243.0) — render() replaces the focused row / .pg-btn and
  // focus fell to <body>. FULL-M6 — the three byte-identical view copies
  // (tracker/reports/stats) are consolidated into the shared
  // lib/focus-preserve.js helper.

  // ── state funnel ──────────────────────────────────────────────────────────
  // Every control change flows through applyState: merge → persist →
  // reset the paginator to page 1 → repaint chrome + list.
  function applyState(patch) {
    Object.assign(state, patch);
    persist();
    pager.reset();
    syncChrome();
    renderList();
  }

  function syncChrome() {
    for (const th of headRow.querySelectorAll('th[data-sort-key]')) {
      const key = th.getAttribute('data-sort-key');
      const active = key === state.sortKey;
      th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
      const arrow = th.querySelector('.th-arrow');
      if (arrow) arrow.textContent = active ? (state.sortDir === 'asc' ? '↑' : '↓') : '↕';
    }
    dirBtn.textContent = state.sortDir === 'asc' ? '↑' : '↓';
    dirBtn.setAttribute('aria-label', state.sortDir === 'asc'
      ? t('rep2.sortDirAsc', 'Sorted ascending — switch to descending')
      : t('rep2.sortDirDesc', 'Sorted descending — switch to ascending'));
    sortSel.value = state.sortKey;
    bandSel.value = state.band;
    tableWrap.hidden = state.view !== 'table';
    cardsWrap.hidden = state.view !== 'cards';
    tableRadio.checked = state.view === 'table';
    cardsRadio.checked = state.view === 'cards';
    renderHistogram();
  }

  function renderList() {
    const list = ReportOps.sortReports(ReportOps.applyFilters(reports, state), state.sortKey, state.sortDir);
    countEl.textContent = list.length + ' / ' + reports.length;
    const page = pager.slice(list);
    const inactive = state.view === 'cards' ? tbody : cardsWrap;
    inactive.innerHTML = '';

    // L-FOCUS — restore focus across the rebuild (paginator page change
    // was a keyboard dead-end: the clicked .pg-btn was destroyed
    // mid-click). The table path keeps the exact pinned shape.
    FocusPreserved.withFocusPreserved(tbody, () => {
      tbody.innerHTML = '';
      if (state.view !== 'cards') {
        if (list.length === 0) {
          tbody.appendChild(c('tr', null, c('td', { colSpan: '4', className: 'report-empty-cell' },
            t('rep2.noMatches', 'No reports match the current filters'))));
        } else page.forEach((rep) => tbody.appendChild(makeRow(rep)));
      }
    });
    FocusPreserved.withFocusPreserved(cardsWrap, () => {
      cardsWrap.innerHTML = '';
      if (state.view === 'cards') {
        if (list.length === 0) {
          cardsWrap.appendChild(c('div', { className: 'report-cards-empty' },
            t('rep2.noMatches', 'No reports match the current filters')));
        } else page.forEach((rep) => cardsWrap.appendChild(makeCard(rep)));
      }
    });
    FocusPreserved.withFocusPreserved(pgWrap, () => {
      pgWrap.innerHTML = '';
      pgWrap.appendChild(pager.controls(page.length, list.length));
    });
  }

  dirBtn.addEventListener('click', () => applyState({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' }));
  syncChrome();
  renderList();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('rep.title'), 'help.hint.reports'),
        c('p', { className: 'page-subtitle' }, `${reports.length} ${t('rep.inDir')} reports/`),
      ]),
      countEl,
    ]),
    toolbar,
    histogramWrap,
    tableWrap,
    cardsWrap,
    pgWrap,
    thresholdsCard,
  ]);
});

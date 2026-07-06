/* global Router, API, UI, I18n */
Router.register('tracker', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const data = await API.get('/api/tracker');
  const rows = data.rows || [];

  const filterStatus = c('select', { className: 'select', style: { maxWidth: '180px' } }, [
    c('option', { value: '' }, t('track.allStatus')),
    ...[...new Set(rows.map((r) => r.status).filter(Boolean))].map((s) => c('option', { value: s }, s)),
  ]);
  const filterScore = c('select', { className: 'select', style: { maxWidth: '180px' } }, [
    c('option', { value: '' }, t('track.anyScore')),
    c('option', { value: '4' }, t('track.scoreHigh')),
    c('option', { value: '3' }, t('track.scoreMid')),
    c('option', { value: '0' }, t('track.scoreLow')),
  ]);
  // NEW-D3 (v1.58.38) — explicit aria-label so screen readers
  // announce the input's purpose. The placeholder alone would only
  // resolve to a generic "edit text" / "search field" on SR readout,
  // failing WCAG 4.1.2 (Name, Role, Value) for a standalone search
  // input with no <label> sibling.
  const filterText = c('input', {
    type: 'search',
    className: 'input',
    placeholder: t('track.search'),
    'aria-label': t('track.searchAria', 'Search applications by company name or role title'),
  });

  // v1.55.8 — UX-8: a clickable funnel summary at the top so the
  // pipeline state is legible at a glance ("12 Applied · 5 Interview
  // · 2 Offer …"). Counts are the whole-history breakdown (mirrors
  // the server `funnel` from GET /api/tracker?page=). Clicking a chip
  // sets the Status filter (clicking the active one clears it).
  const funnelBar = c('div', {
    className: 'tracker-funnel',
    role: 'group',
    'aria-label': t('track.funnelAria', 'Filter by status'),
  });
  const FUNNEL_ORDER = ['Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'Evaluated', 'SKIP'];
  function renderFunnel() {
    funnelBar.textContent = '';
    const counts = {};
    for (const r of rows) {
      const s = (r && r.status) || '—';
      counts[s] = (counts[s] || 0) + 1;
    }
    const chip = (label, value, n, active) => {
      const b = c('button', {
        className: 'tracker-chip' + (active ? ' tracker-chip--active' : ''),
        'aria-pressed': active ? 'true' : 'false',
        onClick: () => {
          filterStatus.value = (filterStatus.value === value) ? '' : value;
          pager.reset();
          applyFilters();
        },
      }, `${label} · ${n}`);
      return b;
    };
    funnelBar.appendChild(chip(t('track.allStatus', 'All'), '', rows.length, !filterStatus.value));
    Object.keys(counts)
      .sort((a, b) => {
        const ia = FUNNEL_ORDER.indexOf(a); const ib = FUNNEL_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .forEach((s) => funnelBar.appendChild(chip(s, s, counts[s], filterStatus.value === s)));
  }

  const tbody = c('tbody');
  const pgWrap = c('div'); // paginator container, re-rendered on each filter change

  // 25 rows per page — same default the activity log uses. The paginator
  // auto-clamps when the filter narrows the list so the user can't land
  // on an empty page after typing in the search.
  const pager = UI.paginate({ pageSize: 25, onChange: () => applyFilters() });

  function filtered() {
    const out = [];
    for (const r of rows) {
      if (filterStatus.value && r.status !== filterStatus.value) continue;
      if (filterScore.value === '4' && (r.scoreNum ?? -1) < 4) continue;
      if (filterScore.value === '3' && (r.scoreNum ?? -1) < 3) continue;
      if (filterScore.value === '0' && (r.scoreNum ?? 0) >= 3) continue;
      const q = filterText.value.toLowerCase().trim();
      if (q && !((r.company + ' ' + r.role).toLowerCase().includes(q))) continue;
      out.push(r);
    }
    return out;
  }

  // v1.49.0 (WS2 #11) — client-side sort on date / score / status.
  let sortKey = null;       // 'date' | 'score' | 'status' | null
  let sortDir = 'asc';      // 'asc' | 'desc'
  function sorted(arr) {
    if (!sortKey) return arr;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r) => sortKey === 'score' ? (r.scoreNum ?? -1)
      : sortKey === 'date' ? (r.date || '')
      : (r.status || '');
    return [...arr].sort((a, b) => {
      const x = val(a); const y = val(b);
      if (typeof x === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }

  function applyFilters() {
    renderFunnel(); // whole-history chips; reflects the active Status filter
    const all = sorted(filtered());
    const page = pager.slice(all);
    tbody.innerHTML = '';
    pgWrap.innerHTML = '';
    if (all.length === 0) {
      // WS2 #26 — distinguish first-run (no data at all) from a filter
      // that excluded everything; the former gets an actionable CTA.
      const emptyCell = rows.length === 0
        ? c('td', { colspan: 9, style: { textAlign: 'center', padding: '40px', color: 'var(--foggy)' } }, [
            c('strong', null, t('track.emptyTitle', 'No applications yet')),
            c('p', { style: { margin: '8px 0 0' } }, t('track.emptyBody', 'Run the pipeline or evaluate a JD to populate this tracker.')),
            c('a', { href: '#/pipeline', className: 'btn btn-primary btn-sm', style: { marginTop: '12px' } }, t('track.emptyCta', 'Open pipeline')),
          ])
        : c('td', { colspan: 9, style: { textAlign: 'center', padding: '40px', color: 'var(--foggy)' } }, t('track.noMatch'));
      tbody.appendChild(c('tr', null, emptyCell));
      return;
    }
    for (const r of page) tbody.appendChild(row(r));
    pgWrap.appendChild(pager.controls(page.length, all.length));
  }

  // WS2 #11 — a sortable column header: a button inside the th so it's
  // keyboard-operable; aria-sort reflects state; click toggles dir.
  // NOTE date sort is a string compare — correct only because r.date is
  // ISO YYYY-MM-DD (the parent tracker's canonical format).
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
        // aria-sort belongs only on sortable headers — reset just those
        // (not the 6 plain columns), then mark the active one.
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
  ;[filterStatus, filterScore, filterText].forEach((el) =>
    el.addEventListener('input', () => { pager.reset(); applyFilters(); })
  );
  function row(r) {
    const scoreCls = r.scoreNum >= 4 ? 'score-high' : r.scoreNum >= 3 ? 'score-mid' : 'score-low';
    return c('tr', null, [
      c('td', null, r.num || ''),
      c('td', null, r.date || ''),
      c('td', null, r.company || ''),
      c('td', null, r.role || ''),
      c('td', null, c('span', { className: 'score-pill ' + scoreCls }, r.score || '—')),
      c('td', null, c('span', { className: 'badge ' + statusClass(r.status) }, r.status || '')),
      // G-006 (v1.15.0) — Legitimacy column. Mirrors the badge tint used
      // on /#/reports cards. Empty string when the source row had no
      // Legitimacy column (graceful degrade for pre-v1.15 trackers).
      c('td', null, r.legitimacy
        ? c('span', { className: 'badge ' + legitimacyClass(r.legitimacy) }, r.legitimacy)
        : c('span', { style: { color: 'var(--foggy)' } }, '—')),
      c('td', null, r.pdfReady ? '✓' : '—'),
      c('td', null, r.reportPath ? c('button', {
        className: 'btn btn-ghost btn-sm',
        'aria-label': t('track.report') + ((r.company || r.role) ? ' — ' + (r.company || r.role) : ''),
        onClick: () => Router.go('/reports/' + r.reportPath.replace(/^reports\//, '').replace(/\.md$/, '')),
      }, t('track.report')) : ''),
    ]);
  }

  applyFilters();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('track.title')),
        c('p', { className: 'page-subtitle' }, `${rows.length} ${t('track.entriesIn')} data/applications.md`),
      ]),
      // U-10 (v1.58.30) — Normalize / Dedup / Merge buttons disabled
      // when data/applications.md is empty. Clicking them on an empty
      // tracker is a no-op that still hit the parent project; now the
      // user sees the action is unavailable and gets a localized
      // tooltip explaining why.
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
      funnelBar,
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } }, [
        filterStatus, filterScore, filterText,
      ]),
    ]),

    c('div', { className: 'table-wrap' },
      c('table', { className: 'tbl' }, [
        c('thead', null, c('tr', null, [
          c('th', { scope: 'col' }, '#'),
          sortableTh(t('track.col.date'), 'date'),
          c('th', { scope: 'col' }, t('scan.col.company')),
          c('th', { scope: 'col' }, t('scan.col.role')),
          sortableTh(t('track.col.score', 'Score'), 'score'),
          sortableTh(t('track.col.status'), 'status'),
          c('th', { scope: 'col' }, [
            t('track.col.legitimacy', 'Legitimacy'),
            ' ',
            // U-11 (v1.58.31) — header gets a localized info chip
            // explaining the "High / Caution / Suspicious" scale that
            // sets each row's badge. tabindex=0 + role=img + aria-label
            // so the help text is reachable by keyboard + screen reader.
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
        ])),
        tbody,
      ])
    ),
    pgWrap,
  ]);
});

async function runFix(btn, path, t) {
  // WS2 #9 — normalize/dedup/merge REWRITE the parent data/applications.md
  // in place. Focus-trapped confirm before this destructive write.
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

function statusClass(s) {
  s = (s || '').toLowerCase();
  if (s.includes('offer')) return 'badge-ok';
  if (s.includes('reject') || s.includes('discard')) return 'badge-bad';
  if (s.includes('interview') || s.includes('respond')) return 'badge-info';
  if (s.includes('skip')) return 'badge-warn';
  return '';
}

// G-006 (v1.15.0) — tint Legitimacy badges the same way /#/reports does.
// High / verified / strong → ok. Medium / caution / partial → warn.
// Low / suspicious / posting may be fake → bad.
function legitimacyClass(s) {
  s = (s || '').toLowerCase();
  if (s.includes('high') || s.includes('verified') || s.includes('strong')) return 'badge-ok';
  if (s.includes('low') || s.includes('suspicious') || s.includes('fake') || s.includes('proceed')) return 'badge-bad';
  if (s.includes('medium') || s.includes('caution') || s.includes('partial')) return 'badge-warn';
  return 'badge-info';
}

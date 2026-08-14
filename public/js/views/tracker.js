/* global Router, API, UI, I18n, HelpHint */
Router.register('tracker', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  // v1.131.0 — CRM stage-tab board. Rows +
  // the canonical funnel are fetched together; the stages endpoint fails soft
  // to an empty funnel (the board degrades to an ALL-only view) so the tracker
  // still renders if the parent's states.yml is momentarily unreadable.
  const [data, stagesData] = await Promise.all([
    API.get('/api/tracker'),
    API.get('/api/tracker/stages').catch(() => ({ stages: [], aliases: {} })),
  ]);
  const rows = data.rows || [];
  const STAGES = Array.isArray(stagesData.stages) ? stagesData.stages : [];
  const ALIASES = stagesData.aliases || {};
  const TS = window.TrackerStages;
  const fold = (s) => (TS ? TS.foldStatus(s, ALIASES) : (s || ''));

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

  // v1.131.0 — the CRM stage-tab strip. Replaces the v1.55.8 funnel chip bar +
  // the status <select>: a tab per canonical stage (from GET /api/tracker/stages,
  // whole-history counts, INCLUDING zero-count stages for the full-funnel look),
  // plus a leading ALL tab. Active stage drives the filter; the labels are the
  // canonical status labels verbatim (same as the row badges), so no client-side
  // whitelist and no new i18n keys. `activeStage === ''` means ALL.
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
          applyFilters();
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
    for (const s of STAGES) tabBar.appendChild(tab(s, s, counts[s] || 0));
  }

  const tbody = c('tbody');
  const pgWrap = c('div'); // paginator container, re-rendered on each filter change

  // 25 rows per page — same default the activity log uses. The paginator
  // auto-clamps when the filter narrows the list so the user can't land on an
  // empty page after typing in the search.
  const pager = UI.paginate({ pageSize: 25, onChange: () => applyFilters() });

  function filtered() {
    const out = [];
    for (const r of rows) {
      if (activeStage && fold(r.status) !== activeStage) continue;
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
    renderTabs(); // whole-history counts; reflects the active stage tab
    const all = sorted(filtered());
    const page = pager.slice(all);
    tbody.innerHTML = '';
    pgWrap.innerHTML = '';
    if (all.length === 0) {
      // WS2 #26 — distinguish first-run (no data at all) from a filter that
      // excluded everything; the former gets an actionable CTA.
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
  ;[filterScore, filterText].forEach((el) =>
    el.addEventListener('input', () => { pager.reset(); applyFilters(); })
  );
  function row(r) {
    // v1.128.0 — finer 4-tier tone (>=4.2/3.8/3.0) with a
    // letter-grade fallback, via the shared ScoreTone helper. Falls back to the
    // old coarse split only if the helper script somehow didn't load.
    const scoreCls = (window.ScoreTone && window.ScoreTone.scoreClass)
      ? window.ScoreTone.scoreClass(r.scoreNum ?? r.score)
      : (r.scoreNum >= 4 ? 'score-high' : r.scoreNum >= 3 ? 'score-mid' : 'score-low');
    // v1.131.0 — CRM company cell: a brand logo (favicon of the company's own
    // domain, derived from the name) when the user has enabled logos; otherwise
    // just the name. CompanyLogo.badge returns null when the pref is off, so
    // this is zero extra requests by default (same contract as #/scan).
    const logo = window.CompanyLogo ? window.CompanyLogo.badge(r.url, r.company) : null;
    const companyCell = logo
      ? c('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, [logo, c('span', null, r.company || '—')])
      : (r.company || '');
    return c('tr', null, [
      c('td', null, r.num || ''),
      c('td', null, r.date || ''),
      c('td', null, companyCell),
      c('td', null, r.role || ''),
      c('td', null, c('span', { className: 'score-pill ' + scoreCls }, r.score || '—')),
      c('td', null, c('span', { className: 'badge ' + statusClass(r.status) }, r.status || '')),
      // G-006 (v1.15.0) — Legitimacy column. Mirrors the badge tint used on
      // /#/reports cards. Empty string when the source row had no Legitimacy
      // column (graceful degrade for pre-v1.15 trackers).
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

  // v1.118.0 — parent v1.18.0 parity: job-landed celebration. When any row
  // reaches the canonical 'Hired' state, greet it above the board — static
  // markup, no timers/confetti (CSP-safe, calm-by-default). v1.131.0: count by
  // the FOLDED status so a Spanish/legacy alias (e.g. "contratado") still lands.
  const hiredCount = rows.filter((r) => fold(r && r.status) === 'Hired').length;
  const hiredBanner = hiredCount
    ? c('div', { className: 'card mb-3 hired-banner', role: 'status' }, [
      c('span', { className: 'hired-banner-emoji', 'aria-hidden': 'true' }, '🎉'),
      c('strong', null, t('track.hiredTitle', 'Congratulations — job landed!')),
      c('span', null, ` ${hiredCount} × Hired · ${t('track.hiredNote', 'The search that ends well.')}`),
    ])
    : null;

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
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } }, [
        filterScore, filterText,
      ]),
    ]),

    companyHistoryCard(rows, c, t),

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
        ])),
        tbody,
      ])
    ),
    pgWrap,
  ]);
});

// v1.190.0 — "Company history" evidence panel. Read-only lookup over
// GET /api/stats/company-history?company= (a zero-token relay of the parent's
// company-history.mjs) — per-company responsiveness (has this company ever
// replied to you?) and posting churn (does the same role keep getting reposted?),
// joined from your tracker + follow-ups + scan history. Returns null on an empty
// tracker so nothing renders when there is nothing to look up.
function companyHistoryCard(rows, c, t) {
  const companies = [...new Set(
    (Array.isArray(rows) ? rows : []).map((r) => (r && r.company ? String(r.company).trim() : '')).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
  if (!companies.length) return null;

  const sel = c('select', { className: 'select', style: { maxWidth: '280px' }, 'aria-label': t('scan.col.company', 'Company') },
    companies.map((name) => c('option', { value: name }, name)));
  const btn = c('button', { className: 'btn btn-primary', type: 'button' }, t('track.histLookup', 'Look up'));
  const out = c('div', { style: { marginTop: '12px' } });

  btn.addEventListener('click', async () => {
    const company = sel.value;
    if (!company) return;
    btn.disabled = true;
    out.textContent = '';
    out.appendChild(c('div', { className: 'loading' }, t('track.histLoading', 'Reading the evidence…')));
    try {
      const res = await API.get('/api/stats/company-history?company=' + encodeURIComponent(company));
      out.textContent = '';
      if (!res || res.available === false) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('track.histUnavailable', 'Company history is unavailable here — the parent career-ops company-history script was not found.')));
        return;
      }
      out.appendChild(companyHistoryEvidence(res, c, t));
    } catch (err) {
      out.textContent = '';
      out.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } },
        (err && err.message) || t('track.histFailed', 'Could not load company history')));
    } finally {
      btn.disabled = false;
    }
  });

  return c('div', { className: 'card mb-3' }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('track.histTitle', 'Company history')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } },
      t('track.histHelp', 'Per-company evidence — how responsive a company has been to you, and whether the same role keeps getting reposted. Read-only; joins your tracker, follow-ups, and scan history.')),
    c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, [sel, btn]),
    out,
  ]);
}

// Render one company card ({ company, responsiveness:{label,facts}, postingChurn:{label,clusters}, explanations }).
function companyHistoryEvidence(card, c, t) {
  const resp = (card && card.responsiveness) || {};
  const churn = (card && card.postingChurn) || {};
  const RESP = {
    'silent-on-you': [t('track.histSilent', 'Silent on you'), 'badge badge-warn'],
    mixed: [t('track.histMixed', 'Mixed'), 'badge badge-info'],
    'responded-before': [t('track.histResponded', 'Responded before'), 'badge badge-ok'],
    'no-history': [t('track.histNoHistory', 'No history yet'), 'badge'],
  };
  const CHURN = {
    'reposts-detected': [t('track.histReposts', 'Reposts detected'), 'badge badge-warn'],
    'none-detected': [t('track.histNoReposts', 'No reposts'), 'badge'],
    'no-scan-data': [t('track.histNoScan', 'No scan data'), 'badge'],
  };
  const r = RESP[resp.label] || RESP['no-history'];
  const ch = CHURN[churn.label] || CHURN['no-scan-data'];
  const facts = Array.isArray(resp.facts) ? resp.facts : [];
  const silent = facts.filter((f) => f && 'silentDays' in f);
  const clusters = Array.isArray(churn.clusters) ? churn.clusters : [];

  const kids = [
    c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px' } }, [
      c('strong', null, String((card && card.company) || '—')),
      c('span', { className: r[1] }, r[0]),
      c('span', { className: ch[1] }, ch[0]),
    ]),
  ];
  if (silent.length) {
    kids.push(c('p', { style: { fontSize: '13px', margin: '0 0 6px' } },
      t('track.histSilentCount', '{n} application(s) silent past your follow-up window:').replace('{n}', String(silent.length))));
    const ul = c('ul', { style: { margin: '0 0 8px', paddingLeft: '18px' } });
    for (const f of silent) {
      ul.appendChild(c('li', { style: { fontSize: '13px' } },
        `#${String(f.num)} · ${String(f.appliedDate || '')} · ${t('track.histDaysSilent', '{n}d silent').replace('{n}', String(f.silentDays))} · ${t('track.histFollowups', '{n} follow-ups').replace('{n}', String(f.followupsSent || 0))}`));
    }
    kids.push(ul);
  }
  if (clusters.length) {
    kids.push(c('p', { style: { fontSize: '13px', margin: '0 0 6px' } },
      t('track.histRepostCount', '{n} role(s) reposted:').replace('{n}', String(clusters.length))));
    const ul = c('ul', { style: { margin: '0 0 8px', paddingLeft: '18px' } });
    for (const cl of clusters) {
      ul.appendChild(c('li', { style: { fontSize: '13px' } },
        `${String(cl.role || '')} · ${String(cl.repostCount || 0)}× · ${String(cl.daysSpan || 0)}d · ${t('track.histLastSeen', 'last {d}').replace('{d}', String(cl.lastSeen || ''))}`));
    }
    kids.push(ul);
  }
  for (const e of (Array.isArray(card && card.explanations) ? card.explanations : [])) {
    kids.push(c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0' } }, String(e)));
  }
  return c('div', { className: 'card', style: { padding: '12px', marginTop: '4px' } }, kids);
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

function statusClass(s) {
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
function legitimacyClass(s) {
  s = (s || '').toLowerCase();
  if (s.includes('high') || s.includes('verified') || s.includes('strong')) return 'badge-ok';
  if (s.includes('low') || s.includes('suspicious') || s.includes('fake') || s.includes('proceed')) return 'badge-bad';
  if (s.includes('medium') || s.includes('caution') || s.includes('partial')) return 'badge-warn';
  return 'badge-info';
}

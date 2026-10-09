/* global Router, API, UI, I18n */
Router.register('activity', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  // Filter chips for the most common action prefixes. Labels are localized
  // (CAR-49 v1.246.0 — they used to render the raw prefix slugs); pipeline/
  // scan/evaluate/cv reuse the existing nav/page keys via the alias map, the
  // three without a canonical sibling carry their own activity.filter.* keys.
  const FILTERS = [
    { key: '',            label: t('activity.filter.all', 'All actions') },
    { key: 'pipeline.',   label: t('activity.filter.pipeline', 'Pipeline') },
    { key: 'cv.',         label: t('activity.filter.cv', 'CV') },
    { key: 'jd.',         label: t('activity.filter.jd', 'Job descriptions') },
    { key: 'evaluate',    label: t('activity.filter.evaluate', 'Evaluate') },
    { key: 'scan.',       label: t('activity.filter.scan', 'Scan') },
    { key: 'stream.',     label: t('activity.filter.stream', 'Streams') },
    { key: 'script.',     label: t('activity.filter.script', 'Scripts') },
  ];
  let activeFilter = '';

  // CAR-49 (v1.246.0) — the ACTION column used to show the raw event slug
  // ("stream.scan", "config.save"). Known slugs map to activity.act.* keys;
  // dynamic families (stream.<x>, script.<x>) translate the family word and
  // keep the machine tail as an identifier. Anything unknown falls back to
  // the raw slug, so a future server action can never render a bare key.
  // (Template-literal keys — the static i18n-coverage scan skips them, same
  // convention as cv-diagnostics.js's t(`diag.section.${k}`).)
  function dictHit(key) {
    const v = t(key, null);
    return v && v !== key ? v : null;
  }
  function actionLabel(action) {
    const slug = String(action || '');
    if (!slug) return '';
    const exact = dictHit(`activity.act.${slug}`);
    if (exact) return exact;
    const dot = slug.indexOf('.');
    if (dot > 0) {
      const famLabel = dictHit(`activity.prefix.${slug.slice(0, dot)}`);
      if (famLabel) return `${famLabel} · ${slug.slice(dot + 1)}`;
    }
    return slug;
  }

  const tableBody = c('tbody');
  const empty = c('div', { className: 'empty' }, t('activity.empty'));
  empty.hidden = true;

  function renderRow(evt) {
    const ts = new Date(evt.ts);
    const time = isNaN(ts) ? evt.ts : ts.toLocaleString();
    const dot = evt.ok === false ? '✗' : evt.ok === true ? '✓' : '·';
    const cls = evt.ok === false ? 'badge-bad' : evt.ok === true ? 'badge-ok' : 'badge-info';
    // The raw slug stays discoverable (title attr; mono tail for dynamic
    // families) while the visible label reads in the UI language.
    const label = actionLabel(evt.action);
    const actionCell = label === evt.action
      ? c('code', null, label)
      : c('span', { title: evt.action }, [
          label,
          c('code', { className: 'activity-raw-slug' }, evt.action),
        ]);
    return c('tr', null, [
      c('td', { style: { whiteSpace: 'nowrap', color: 'var(--foggy)', fontVariantNumeric: 'tabular-nums' } }, time),
      c('td', null, actionCell),
      c('td', { style: { wordBreak: 'break-all', maxWidth: '480px' } }, evt.target || c('span', { style: { color: 'var(--foggy)' } }, '—')),
      c('td', null, [
        c('span', { className: 'badge ' + cls }, dot),
        evt.detail ? c('span', { style: { marginLeft: '8px', color: 'var(--foggy)', fontSize: '13px' } }, evt.detail) : null,
      ]),
    ]);
  }

  // Pagination — we request the most recent 500 events (see load());
  // show 25 per page (paginator clamps on filter change). The activity
  // log grows unbounded, so when we hit the 500 cap the older history
  // is NOT shown — surface that explicitly (WS2 #38; comment was stale
  // at "200" while the code requested 500).
  const CAP = 500;
  let allEvents = [];
  const pgWrap = c('div');
  const truncNote = c('p', {
    className: 'page-subtitle', role: 'note',
    style: { display: 'none', color: 'var(--foggy)', marginTop: '8px' },
  });
  const pager = UI.paginate({ pageSize: 25, onChange: () => render() });

  function render() {
    tableBody.innerHTML = '';
    pgWrap.innerHTML = '';
    if (allEvents.length === 0) {
      empty.hidden = false;
      truncNote.style.display = 'none';
      return;
    }
    empty.hidden = true;
    const page = pager.slice(allEvents);
    for (const evt of page) tableBody.appendChild(renderRow(evt));
    pgWrap.appendChild(pager.controls(page.length, allEvents.length));
    // At the cap the server dropped older events — say so.
    truncNote.textContent = t('activity.truncated', 'Showing the most recent {n} events; older history is not displayed.')
      .replace('{n}', String(CAP));
    truncNote.style.display = allEvents.length >= CAP ? '' : 'none';
  }

  // CAR-20 (v1.243.0) — request token: rapid filter clicks (or a filter
  // click racing the Refresh button) used to let a SLOW older response
  // resolve last and clobber the table with the wrong slice. Each load
  // claims a token; only the newest may touch the DOM. Failures are
  // caught here so neither the filter click nor UI.withSpinner can end
  // in an unhandled rejection.
  let loadToken = 0;
  async function load() {
    const myToken = ++loadToken;
    const params = activeFilter ? `?type=${encodeURIComponent(activeFilter)}&limit=500` : '?limit=500';
    try {
      const data = await API.get('/api/activity' + params);
      if (myToken !== loadToken) return; // a newer load owns the table
      allEvents = data.events || [];
      pager.reset();
      render();
    } catch (err) {
      if (myToken !== loadToken) return;
      UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
    }
  }

  const filterRow = c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } },
    FILTERS.map((f) =>
      c('button', {
        className: 'btn btn-ghost btn-sm' + (f.key === activeFilter ? ' active' : ''),
        'data-filter': f.key,
        onClick: async (e) => {
          activeFilter = f.key;
          filterRow.querySelectorAll('button').forEach((b) =>
            b.classList.toggle('active', b.dataset.filter === f.key));
          // CAR-20 (v1.243.0) — the reload is now awaited (load() has its
          // own try/catch + stale-response token).
          await load();
        },
      }, f.label)
    )
  );

  await load();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('activity.title')),
        c('p', { className: 'page-subtitle' }, t('activity.subtitle')),
      ]),
      c('div', { className: 'flex gap-3' }, [
        c('button', { className: 'btn btn-ghost', onClick: (e) => UI.withSpinner(e.currentTarget, load) }, t('activity.refresh')),
      ]),
    ]),

    c('div', { className: 'card mb-3' }, [filterRow]),
    empty,
    c('div', { className: 'table-wrap' },
      c('table', { className: 'tbl' }, [
        c('thead', null, c('tr', null,
          [t('activity.col.time'), t('activity.col.action'), t('activity.col.target'), t('activity.col.result')]
            .map((h) => c('th', null, h))
        )),
        tableBody,
      ])
    ),
    pgWrap,
    truncNote,
  ]);
});

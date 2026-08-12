/* global Router, API, UI, I18n */
Router.register('activity', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  // Filter chips for the most common action prefixes.
  const FILTERS = [
    { key: '',            label: t('activity.filter.all', 'All actions') },
    { key: 'pipeline.',   label: 'pipeline' },
    { key: 'cv.',         label: 'cv' },
    { key: 'jd.',         label: 'jd' },
    { key: 'evaluate',    label: 'evaluate' },
    { key: 'scan.',       label: 'scan' },
    { key: 'stream.',     label: 'stream' },
    { key: 'script.',     label: 'script' },
  ];
  let activeFilter = '';

  const tableBody = c('tbody');
  const empty = c('div', { className: 'empty' }, t('activity.empty'));
  empty.hidden = true;

  function renderRow(evt) {
    const ts = new Date(evt.ts);
    const time = isNaN(ts) ? evt.ts : ts.toLocaleString();
    const dot = evt.ok === false ? '✗' : evt.ok === true ? '✓' : '·';
    const cls = evt.ok === false ? 'badge-bad' : evt.ok === true ? 'badge-ok' : 'badge-info';
    return c('tr', null, [
      c('td', { style: { whiteSpace: 'nowrap', color: 'var(--foggy)', fontVariantNumeric: 'tabular-nums' } }, time),
      c('td', null, c('code', null, evt.action || '')),
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

  async function load() {
    const params = activeFilter ? `?type=${encodeURIComponent(activeFilter)}&limit=500` : '?limit=500';
    const data = await API.get('/api/activity' + params);
    allEvents = data.events || [];
    pager.reset();
    render();
  }

  const filterRow = c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } },
    FILTERS.map((f) =>
      c('button', {
        className: 'btn btn-ghost btn-sm' + (f.key === activeFilter ? ' active' : ''),
        'data-filter': f.key,
        onClick: (e) => {
          activeFilter = f.key;
          filterRow.querySelectorAll('button').forEach((b) =>
            b.classList.toggle('active', b.dataset.filter === f.key));
          load();
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

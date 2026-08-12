/* global Router, API, UI, I18n */
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
          c('h1', { className: 'page-title' }, r.title || slug),
          c('p', { className: 'page-subtitle' }, [r.date, r.archetype, r.legitimacy].filter(Boolean).join(' · ')),
        ]),
        c('div', { className: 'flex gap-3' }, [
          c('button', { className: 'btn btn-ghost', onClick: () => Router.go('/reports') }, t('rep.allReports')),
          r.url && c('a', { className: 'btn btn-ghost', href: r.url, target: '_blank', rel: 'noopener' }, t('rep.openJd')),
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
    return c('div', null, [
      c('header', { className: 'page-header' }, [
        c('div', null, [
          c('h1', { className: 'page-title' }, t('rep.title')),
          // QA BUG-010 — the populated list view has a subtitle; the
          // empty state was the only page missing the descriptive line.
          c('p', { className: 'page-subtitle' },
            t('rep.subtitle', 'Saved evaluation & deep-research reports from reports/')),
        ]),
      ]),
      c('div', { className: 'empty' }, t('rep.empty')),
    ]);
  }

  // 12 reports per page → 3 rows × 4-card grid on a wide screen
  const cardsWrap = c('div', { className: 'card-row' });
  const pgWrap = c('div');
  const pager = UI.paginate({ pageSize: 12, onChange: () => render() });

  function makeCard(rep) {
    const cls = rep.scoreNum >= 4 ? 'score-high' : rep.scoreNum >= 3 ? 'score-mid' : 'score-low';
    // WS2 #37 — was a mouse-only <div onClick>. Make it a real
    // keyboard-operable control: role=link, tabindex, Enter/Space.
    const open = () => Router.go('/reports/' + rep.slug);
    return c('div', {
      className: 'card',
      style: { cursor: 'pointer' },
      role: 'link',
      tabindex: '0',
      'aria-label': (rep.title || rep.slug),
      onClick: open,
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      },
    }, [
      c('div', { className: 'flex-between' }, [
        c('div', null, [
          c('div', { style: { fontWeight: 700, fontSize: '15.5px' } }, rep.title || rep.slug),
          c('div', { className: 'flex gap-1 mt-3' }, [
            rep.date && c('span', { className: 'tag' }, rep.date),
            rep.legitimacy && c('span', { className: 'tag' }, rep.legitimacy),
          ]),
        ]),
        // FIX-3 (v1.161.0) — a report with no parseable score (after the
        // v1.159.0 locale-aware parser) shows a MUTED chip, not empty space,
        // so the user can tell "unparsed" from "failed". The whole card is
        // already a role=link that opens the report (where the score is in the
        // body); the chip reuses the existing neutral `.score-muted` token.
        rep.scoreNum != null
          ? c('span', { className: 'score-pill ' + cls }, rep.score)
          : c('span', {
            className: 'score-pill score-muted',
            title: t('rep.scoreUnparsedHint', 'Open the report to see the score'),
          }, t('rep.scoreUnparsed', 'Score not detected')),
      ]),
    ]);
  }

  function render() {
    const page = pager.slice(reports);
    cardsWrap.innerHTML = '';
    pgWrap.innerHTML = '';
    page.forEach((rep) => cardsWrap.appendChild(makeCard(rep)));
    pgWrap.appendChild(pager.controls(page.length, reports.length));
  }
  render();

  // PR-9 follow-up — surface the canonical career-ops.org action-by-score
  // table inline so users see what to do with each report without
  // jumping to help. Collapsible <details>: open by default first time
  // (no localStorage gate; cheap & obvious).
  const thresholdsCard = c('details', {
    className: 'card',
    style: { marginBottom: '16px' },
    open: true,
  }, [
    c('summary', { style: { cursor: 'pointer', fontWeight: 600 } },
      '🎯 ' + t('rep.thresholdsTitle', 'Score → next step')),
    c('div', { style: { marginTop: '8px', fontSize: '14px' } }, [
      c('table', { style: { width: '100%', borderCollapse: 'collapse' } }, [
        c('thead', null, c('tr', null, [
          c('th', { style: { textAlign: 'left', padding: '4px 8px' } }, t('rep.score', 'Score')),
          c('th', { style: { textAlign: 'left', padding: '4px 8px' } }, t('rep.thrAction', 'Next step')),
        ])),
        c('tbody', null, [
          c('tr', null, [
            c('td', { style: { padding: '4px 8px', fontWeight: 600 } }, '≥ 4.5'),
            c('td', { style: { padding: '4px 8px' } }, t('rep.thr45', 'Run /career-ops apply — high fit, push immediately')),
          ]),
          c('tr', null, [
            c('td', { style: { padding: '4px 8px', fontWeight: 600 } }, '4.0 – 4.4'),
            c('td', { style: { padding: '4px 8px' } }, t('rep.thr40', 'Apply, or /career-ops contacto for warm intro first')),
          ]),
          c('tr', null, [
            c('td', { style: { padding: '4px 8px', fontWeight: 600 } }, '3.5 – 3.9'),
            c('td', { style: { padding: '4px 8px' } }, t('rep.thr35', 'Run /career-ops deep — research the company / role first')),
          ]),
          c('tr', null, [
            c('td', { style: { padding: '4px 8px', fontWeight: 600 } }, '< 3.5'),
            c('td', { style: { padding: '4px 8px' } }, t('rep.thrLow', 'Skip unless you have a specific personal reason')),
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

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('rep.title')),
        c('p', { className: 'page-subtitle' }, `${reports.length} ${t('rep.inDir')} reports/`),
      ]),
    ]),
    thresholdsCard,
    cardsWrap,
    pgWrap,
  ]);
});

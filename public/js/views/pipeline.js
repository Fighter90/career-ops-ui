/* global Router, API, UI, I18n */
Router.register('pipeline', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  // F-V54-B — compact, screen-reader-friendly URL for row-action
  // aria-labels: host + the tail of the path (last 2 segments), so two
  // jobs on the same board don't collapse to an identical announced
  // name. Falls back to a trailing slice if the URL won't parse.
  function shortUrl(u) {
    try {
      const { hostname, pathname } = new URL(u);
      const segs = pathname.split('/').filter(Boolean);
      const tail = segs.slice(-2).join('/');
      return tail ? `${hostname}/…/${tail}` : hostname;
    } catch {
      const s = String(u || '');
      return s.length > 48 ? '…' + s.slice(-47) : s;
    }
  }

  // ── state ──
  let allUrls = [];
  let filterQuery = '';
  let activeUrl = null;       // currently selected for preview
  let previewBody = '';
  let previewError = '';   // WS2 #22 — distinct from previewBody
  let previewLoading = false;

  // v1.55.7 — UX-7: a scan can fill the pipeline with 1000s of URLs.
  // Rendering every row (each a flex div + <a> + 2 buttons) on every
  // filter keystroke is slow and floods the a11y tree. Above the
  // threshold we virtualize: render only the scroll viewport ± a
  // small buffer (a vanilla-JS react-window). At/below it we keep the
  // original simple full render so typical pipelines are unchanged.
  const VIRTUALIZE_THRESHOLD = 1000;
  const ROW_H = 56;   // measured uniform row height (px) incl. gap
  const BUFFER = 5;   // rows rendered above & below the viewport
  // Pure window math (no DOM) so it stays unit-checkable.
  function computeWindow(scrollTop, rowH, total, viewportH, buffer) {
    const first = Math.floor(scrollTop / rowH);
    const visible = Math.ceil(viewportH / rowH);
    const start = Math.max(0, first - buffer);
    const end = Math.min(total, first + visible + buffer);
    return { start, end };
  }

  // ── elements ──
  // v1.20.0 — WCAG 1.3.1: every interactive input owns an id +
  // accessible name. `aria-label` covers placeholder-only inputs
  // (no visible label sibling).
  const filterInput = c('input', {
    id: 'pipe-filter',
    'aria-label': t('pipe.filter', 'Filter URLs…'),
    className: 'input',
    placeholder: t('pipe.filter', 'Filter URLs…'),
    style: { maxWidth: '320px' },
  });
  const list = c('div', { id: 'pipeline-list', className: 'card', style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
  // v1.48.0 (WS2 #22) — the preview is a polite live region with an
  // accessible name; a fetch failure renders a distinct role=alert
  // block, not disguised as preview body text.
  const previewPane = c('div', {
    id: 'pipe-preview', className: 'card', style: { minHeight: '120px' },
    role: 'region', 'aria-live': 'polite',
    'aria-label': t('pipe.previewRegion', 'Job preview'),
  });
  const newUrl = c('input', {
    id: 'pipe-new-url',
    'aria-label': t('pipe.placeholder'),
    'aria-describedby': 'pipe-new-url-hint',
    className: 'input',
    placeholder: t('pipe.placeholder'),
  });
  const counter = c('strong');

  function shortHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); }
  }

  function renderPreview() {
    previewPane.innerHTML = '';
    if (!activeUrl) {
      // CAR-50 #4 (v1.247.0) — designed empty state (tracker pattern):
      // title + hint + CTA, not one bare sentence in a large box.
      previewPane.appendChild(c('div', { className: 'empty', style: { border: 'none' } }, [
        c('strong', null, t('pipe.previewEmptyTitle', 'Nothing previewed yet')),
        c('p', { style: { margin: '8px 0 0' } }, t('pipe.previewIdle', 'Pick a URL to preview, evaluate, or delete.')),
        c('a', { href: '#/evaluate', className: 'btn btn-primary btn-sm', style: { marginTop: '12px' } },
          t('pipe.previewEmptyCta', 'Evaluate a JD')),
      ]));
      return;
    }
    const head = c('div', { className: 'flex-between mb-3', style: { flexWrap: 'wrap', gap: '8px' } }, [
      c('div', { style: { minWidth: 0, flex: 1 } }, [
        c('strong', null, shortHost(activeUrl)),
        c('a', {
          href: activeUrl, target: '_blank', rel: 'noopener',
          style: { display: 'block', fontSize: '13px', color: 'var(--foggy)', wordBreak: 'break-all', marginTop: '4px' },
        }, activeUrl),
      ]),
      c('div', { className: 'flex gap-3' }, [
        c('button', {
          className: 'btn btn-primary btn-sm',
          onClick: () => Router.go('/evaluate?url=' + encodeURIComponent(activeUrl)),
        }, '▶ ' + t('pipe.evaluateBtn')),
        c('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => window.open(activeUrl, '_blank', 'noopener'),
        }, '↗ ' + t('pipe.openTab', 'Open')),
        c('button', {
          className: 'btn btn-ghost btn-sm',
          style: { color: 'var(--rausch)' },
          onClick: async (e) => {
            if (!(await UI.confirm(
              t('pipe.confirmDelTitle', 'Remove from pipeline?'),
              t('pipe.confirmDel'),
              { danger: true, confirmLabel: t('common.delete', 'Delete'), cancelLabel: t('common.cancel', 'Cancel') }))) return;
            // CAR-21 (v1.243.0) — an async click handler without a catch
            // failed silently (unhandled rejection, no toast). Surface it.
            try {
              await UI.withSpinner(e.currentTarget,
                () => API.del('/api/pipeline?url=' + encodeURIComponent(activeUrl)));
              UI.toast(t('pipe.deleted'));
              activeUrl = null;
              await refresh();
            } catch (err) {
              UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
            }
          },
        }, '✕ ' + t('common.delete', 'Delete')),
      ]),
    ]);
    previewPane.appendChild(head);

    if (previewLoading) {
      previewPane.appendChild(c('div', { className: 'loading' }, t('pipe.previewLoading', 'Loading preview…')));
      return;
    }
    if (previewError) {
      previewPane.appendChild(c('div', {
        className: 'empty', role: 'alert',
        style: { border: 'none', padding: '20px', color: 'var(--rausch)' },
      }, '✗ ' + t('pipe.previewError', 'Preview failed') + ': ' + previewError));
      return;
    }
    if (!previewBody) {
      previewPane.appendChild(c('div', { className: 'empty', style: { border: 'none', padding: '20px' } },
        t('pipe.previewUnavailable', 'No preview yet — open in tab to see the page.')));
      return;
    }
    previewPane.appendChild(c('pre', {
      className: 'console',
      style: { maxHeight: '320px', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '13px' },
    }, previewBody));
  }

  // CAR-21 (v1.243.0) — latest-wins. Clicking row B while row A's preview
  // was still loading let A's LATE response overwrite B's pane (previewBody
  // is shared state). Each selection claims a token; only the newest may
  // write preview state or render.
  let selectToken = 0;
  async function selectUrl(url) {
    const token = ++selectToken;
    activeUrl = url;
    previewBody = '';
    previewError = '';
    previewLoading = true;
    // Repaint the rows FIRST so the active highlight follows the click
    // (rows bake isActive in at paint time), then the preview pane.
    if (vVirtual) paintWindow(); else renderList();
    // renderList rebuilt the row the user just activated — restore focus
    // to it so keyboard users don't fall off the list (mouse clicks are
    // unaffected in practice: focus lands on the activated row).
    const again = Array.from(list.querySelectorAll('[data-url]'))
      .find((n) => n.getAttribute('data-url') === url);
    if (again) again.focus();
    renderPreview();
    try {
      const r = await API.get('/api/pipeline/preview?url=' + encodeURIComponent(url));
      if (token !== selectToken) return; // a newer selection superseded us
      previewBody = (r.text || '').slice(0, 4000);
    } catch (e) {
      if (token === selectToken) previewError = e.message || 'fetch failed';
    } finally {
      if (token === selectToken) {
        previewLoading = false;
        renderPreview();
      }
    }
  }

  function urlRow(url) {
    const isActive = url === activeUrl;
    return c('div', {
      className: 'flex-between pipeline-row',
      'data-url': url,
      // CAR-21 (v1.243.0) — the row used to be mouse-only: cursor:pointer +
      // an onClick buried on the inner content div, no role, no tabindex,
      // no key handler, so a keyboard user could not preview a URL at all.
      // The row is now a real button: Enter/Space activates it, and
      // aria-pressed announces the selected state.
      role: 'button',
      tabindex: '0',
      'aria-pressed': isActive ? 'true' : 'false',
      onClick: () => selectUrl(url),
      onKeyDown: (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        selectUrl(url);
      },
      style: {
        padding: '10px 14px',
        border: '1px solid ' + (isActive ? 'var(--hof)' : 'var(--slate)'),
        borderRadius: 'var(--radius)',
        background: isActive ? 'var(--beach)' : 'transparent',
        cursor: 'pointer',
      },
    }, [
      c('div', { style: { flex: 1, minWidth: 0 } }, [
        c('div', { style: { fontWeight: 600, fontSize: '14px' } }, shortHost(url)),
        // Keep an <a> with href so existing tests + accessibility tools
        // can locate the row by URL. stopPropagation prevents the row's
        // selectUrl handler from firing when the link is clicked
        // directly — middle-click / Cmd-click open in a new tab as
        // expected.
        c('a', {
          href: url,
          target: '_blank',
          rel: 'noopener',
          onClick: (e) => e.stopPropagation(),
          style: { display: 'block', fontSize: '12px', color: 'var(--foggy)', wordBreak: 'break-all', marginTop: '2px', textDecoration: 'none' },
        }, url),
      ]),
      // F-V54-B (v1.54.4) — these row actions were icon-only (▶ / ✕)
      // with only a `title`. `title` is not a reliable accessible name
      // (WCAG 4.1.2 Name, Role, Value), and with one pair per row a
      // screen-reader user heard N identical "button"s. Each now has an
      // explicit aria-label disambiguated by a truncated URL so the
      // accessibility tree reads e.g. "Delete: …/jobs/12345".
      c('div', { className: 'flex gap-1' }, [
        c('button', {
          className: 'btn btn-ghost btn-sm',
          title: t('pipe.evaluateBtn'),
          'aria-label': t('pipe.evaluateBtn') + ': ' + shortUrl(url),
          onClick: (e) => { e.stopPropagation(); Router.go('/evaluate?url=' + encodeURIComponent(url)); },
        }, '▶'),
        c('button', {
          className: 'btn btn-ghost btn-sm pipeline-row-delete',
          title: t('common.delete', 'Delete'),
          'aria-label': t('common.delete', 'Delete') + ': ' + shortUrl(url),
          onClick: async (e) => {
            e.stopPropagation();
            if (!(await UI.confirm(
              t('pipe.confirmDelTitle', 'Remove from pipeline?'),
              t('pipe.confirmDel'),
              { danger: true, confirmLabel: t('common.delete', 'Delete'), cancelLabel: t('common.cancel', 'Cancel') }))) return;
            // CAR-21 (v1.243.0) — wrapped: a failed delete / refresh used to
            // reject unhandled (silent failure).
            try {
              await UI.withSpinner(e.currentTarget,
                () => API.del('/api/pipeline?url=' + encodeURIComponent(url)));
              UI.toast(t('pipe.deleted'));
              if (activeUrl === url) { activeUrl = null; previewBody = ''; previewError = ''; }
              await refresh();
            } catch (err) {
              UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
            }
          },
        }, '✕'),
      ]),
    ]);
  }

  // Virtualization state (closure-scoped so the single scroll
  // listener always sees the current filtered set).
  let vFiltered = [];
  let vVirtual = false;
  let vInner = null;
  let vRaf = 0;

  function paintWindow() {
    if (!vVirtual || !vInner) return;
    const { start, end } = computeWindow(
      list.scrollTop, ROW_H, vFiltered.length, list.clientHeight || 600, BUFFER);
    vInner.textContent = '';
    for (let i = start; i < end; i++) {
      const row = urlRow(vFiltered[i]);
      row.style.position = 'absolute';
      row.style.left = '0';
      row.style.right = '0';
      row.style.top = (i * ROW_H) + 'px';
      row.style.height = ROW_H + 'px';
      vInner.appendChild(row);
    }
  }
  // One scroll listener for the element's lifetime; rAF-throttled.
  list.addEventListener('scroll', () => {
    if (!vVirtual) return;
    if (vRaf) return;
    vRaf = requestAnimationFrame(() => { vRaf = 0; paintWindow(); });
  });

  function renderList() {
    list.innerHTML = '';
    const q = filterQuery.trim().toLowerCase();
    const filtered = q ? allUrls.filter((u) => u.toLowerCase().includes(q)) : allUrls;
    vFiltered = filtered;
    counter.textContent = `${t('pipe.count', 'In queue')}: ${filtered.length}` +
      (q && filtered.length !== allUrls.length ? ` / ${allUrls.length}` : '');
    if (filtered.length === 0) {
      vVirtual = false;
      list.style.removeProperty('max-height');
      list.style.removeProperty('overflow');
      list.style.removeProperty('position');
      list.appendChild(c('div', {
        className: 'empty',
        style: { border: 'none', padding: '20px' },
      }, q ? t('pipe.noResults', 'No matches') : t('pipe.empty')));
      return;
    }
    if (filtered.length <= VIRTUALIZE_THRESHOLD) {
      // Original simple full render — unchanged for typical pipelines.
      vVirtual = false;
      vInner = null;
      list.style.removeProperty('max-height');
      list.style.removeProperty('overflow');
      list.style.removeProperty('position');
      filtered.forEach((u) => list.appendChild(urlRow(u)));
      return;
    }
    // Virtualized: fixed-height scroll viewport + a sized spacer that
    // preserves the real scrollbar; only the viewport ± BUFFER rows
    // are in the DOM at any time.
    vVirtual = true;
    list.style.position = 'relative';
    list.style.overflow = 'auto';
    list.style.maxHeight = '70vh';
    // `list` keeps its column-flex layout; without flex:0 0 auto the
    // spacer (a flex item, default flex-shrink:1) would be squashed to
    // the 70vh container and the scroll range would collapse — the
    // scrollbar must reflect the FULL virtual height, not the window.
    vInner = c('div', {
      style: {
        position: 'relative',
        flex: '0 0 auto',
        height: (filtered.length * ROW_H) + 'px',
      },
    });
    list.appendChild(vInner);
    list.scrollTop = 0;
    paintWindow();
  }

  async function refresh() {
    // CAR-21 (v1.243.0) — pipeline + tracker rows are re-read together so
    // the overview strip stays truthful after add/delete (it used to be
    // built once at mount and never refreshed).
    const [fresh, tr] = await Promise.all([
      API.get('/api/pipeline'),
      API.get('/api/tracker').catch(() => ({})),
    ]);
    allUrls = fresh.urls || [];
    trackerRows = (tr && tr.rows) || [];
    renderList();
    renderPreview();
    paintOverview();
  }

  filterInput.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    renderList();
  });

  // ── Pipeline overview strip — inbox count + a breakdown of the tracker by
  // the canonical stages, each chip linking to #/tracker. CAR-21 (v1.243.0):
  // the stage chips used to be a hard-coded English list built once at mount;
  // now the labels come from GET /api/tracker/stages (the same source the
  // tracker board uses) via window.TrackerStages, and paintOverview() runs on
  // every refresh(). Read-only; degrades to the inbox/tracked chips when the
  // tracker or the stages endpoint can't be read.
  let trackerRows = [];
  let STAGES = [];
  let ALIASES = {};
  const overview = c('div', { className: 'card mb-3', style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } });
  function ovChip(n, label, route) {
    const base = { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', background: 'var(--panel-2, #eef1f6)', fontSize: '13px', textDecoration: 'none', color: 'inherit' } };
    // v1.248.2 (QA) — the label wears --foggy-strong (not --foggy): the chip's
    // --elev surface put plain foggy at 4.31:1 in light theme; the AA variant
    // (app.css) clears 4.5:1 on every surface it can appear on.
    const kids = [c('strong', { style: { fontVariantNumeric: 'tabular-nums' } }, String(n)), c('span', { style: { color: 'var(--foggy-strong, #5f5f5f)' } }, label)];
    return route ? c('a', { href: '#' + route, ...base }, kids) : c('span', base, kids);
  }
  function paintOverview() {
    const TS = window.TrackerStages;
    const counts = (TS && STAGES.length) ? TS.stageCounts(trackerRows, STAGES, ALIASES) : {};
    overview.replaceChildren(
      c('strong', { style: { marginRight: '2px' } }, t('pipe.title', 'Pipeline') + ':'),
      ovChip(allUrls.length, t('pipe.ovInbox', 'in inbox'), '/pipeline'),
      ovChip(trackerRows.length, t('pipe.ovTracked', 'tracked'), '/tracker'),
      // Server-driven labels; only stages that actually have rows (same
      // non-zero rule as before, minus the hard-coded whitelist).
      ...STAGES.filter((s) => counts[s] > 0).map((s) => ovChip(counts[s], s, '/tracker')),
    );
  }

  // ── initial paint ──
  allUrls = (await API.get('/api/pipeline')).urls || [];
  renderList();
  renderPreview();
  const [tr0, sd0] = await Promise.all([
    API.get('/api/tracker').catch(() => ({})),
    API.get('/api/tracker/stages').catch(() => ({})),
  ]);
  trackerRows = (tr0 && tr0.rows) || [];
  STAGES = (sd0 && Array.isArray(sd0.stages)) ? sd0.stages : [];
  ALIASES = (sd0 && sd0.aliases) || {};
  paintOverview();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('pipe.title')),
        c('p', { className: 'page-subtitle' }, t('pipe.subtitle')),
      ]),
      c('div', { className: 'flex gap-3' }, [
        c('button', {
          className: 'btn btn-ghost',
          onClick: async () => {
            if (allUrls.length === 0) return UI.toast(t('pipe.empty'), 'error');
            if (!(await UI.confirm(
              t('pipe.evaluateAllTitle', 'Evaluate first queued URL?'),
              t('pipe.evaluateAllConfirm', 'Open the first queued URL on Evaluate?'),
              { danger: false, confirmLabel: t('common.confirm', 'Confirm'), cancelLabel: t('common.cancel', 'Cancel') }))) return;
            Router.go('/evaluate?url=' + encodeURIComponent(allUrls[0]));
          },
        }, '⚡ ' + t('pipe.evaluateAll', 'Evaluate first')),
        c('button', {
          className: 'btn btn-ghost',
          onClick: () => Router.go('/scan'),
        }, t('scan.title')),
      ]),
    ]),

    overview,

    c('div', { className: 'card mb-3' }, [
      c('h3', { style: { marginTop: 0 } }, t('pipe.add')),
      c('div', { className: 'flex gap-3' }, [
        newUrl,
        c('button', {
          className: 'btn btn-primary',
          onClick: async (e) => {
            const u = newUrl.value.trim();
            if (!u) return UI.toast(t('pipe.enterUrl'), 'error');
            try {
              // QA BUG-005 — the server already reports `deduped:true`
              // when the URL was already queued; surface that instead
              // of a misleading "Added to pipeline" green toast.
              const r = await UI.withSpinner(e.currentTarget, () => API.post('/api/pipeline', { url: u }));
              newUrl.value = '';
              if (r && r.deduped) UI.toast(t('pipe.dup', 'Already in the queue — skipped'), 'info');
              else UI.toast(t('pipe.added'), 'success');
              await refresh();
            } catch (err) {
              UI.toast(err.message || 'error', 'error');
            }
          },
        }, '+ ' + t('common.add')),
      ]),
      c('p', { id: 'pipe-new-url-hint', className: 'field-hint mt-3', style: { margin: '12px 0 0' } }, t('pipe.hint')),
    ]),

    // U-9 (v1.58.29) — give the counter ↔ filter row a named class
    // (.pipeline-controls) so the responsive rule can stack them on
    // narrow viewports. At ≤ 720 px the row used to push the filter
    // into a cramped position next to the counter; now they flow
    // vertically with the filter stretching full-width.
    c('div', { className: 'flex gap-3 mb-3 pipeline-controls', style: { alignItems: 'center', flexWrap: 'wrap' } },
      [counter, filterInput]),

    c('div', { className: 'grid-2', style: { gap: '16px' } }, [list, previewPane]),
  ]);
});

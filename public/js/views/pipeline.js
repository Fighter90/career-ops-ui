/* global Router, API, UI, I18n, PipelineView */
// TODO: split by concern — the v2 grouped view (CAR-116) grew this file
// past the 800-LOC hard target (the flat-view legacy block is pinned
// in place by the pipeline-view test contracts). A follow-up should
// extract the grouped/bulk/undo subsystem the way scan.js extracted
// scan/runner.js. The pure helpers already live in lib/pipeline-view.js.
// CAR-116 review round: the new pipe.* keys are fanned out to all 19
// locale dicts (the temporary coverage allowlist is gone).
Router.register('pipeline', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const PV = window.PipelineView || null;

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
  // CAR-116 — enriched entries + view state. `entries` is rebuilt from
  // allUrls + the enrichment join; the display filters (query +
  // hide-already-evaluated) run over it per render.
  let entries = [];
  let entryIndex = new Map();   // url → entry (O(1) row lookup at 30k)
  let trackedKeys = new Set();
  let viewMode = 'flat';        // flipped to 'grouped' at mount when PV loaded
  const expanded = new Set();   // group keys currently expanded
  const groupBudget = new Map(); // group key → rendered-row budget
  const selected = new Set();   // URLs picked for bulk actions
  let autoExpandDone = false;   // one-shot small-queue auto-expand
  const AUTO_EXPAND_MAX = 500;  // expand every group below this total
  const GROUPS_PER_PAGE = 30;   // group headers per page (pagination)
  const GROUP_WINDOW = 50;      // rows rendered per expanded group budget

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

  // ── CAR-116 · view toolbar (grouped/flat + hide-already-evaluated) ──
  const btnGrouped = c('button', {
    type: 'button',
    className: 'btn btn-sm v2-viewbtn',
    'aria-pressed': 'false',
    onClick: () => setViewMode('grouped'),
  }, t('pipe.viewGrouped', 'Grouped'));
  const btnFlat = c('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm v2-viewbtn',
    'aria-pressed': 'true',
    onClick: () => setViewMode('flat'),
  }, t('pipe.viewFlat', 'Compact list'));
  const hideTracked = c('input', {
    id: 'pipe-hide-tracked',
    type: 'checkbox',
    checked: '',
    onChange: () => {
      // The lens flip changes WHICH groups exist (a board's tracked rows
      // carry a company its fresh rows lack) — re-run the expansion
      // decision instead of leaving the new groups collapsed.
      expanded.clear();
      groupBudget.clear();
      autoExpandDone = false;
      pruneSelection(new Set(currentFiltered().map((e) => e.url)));
      renderAll();
    },
  });
  const hideTrackedLabel = c('label', {
    htmlFor: 'pipe-hide-tracked',
    className: 'v2-hide-tracked',
  }, [hideTracked, ' ' + t('pipe.hideTracked', 'Hide already evaluated')]);
  const selectAllBtn = c('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm',
    'aria-label': t('pipe.selectAllShown', 'Select all shown'),
    onClick: () => {
      for (const e of currentFiltered()) selected.add(e.url);
      renderAll();
    },
  }, '☑ ' + t('pipe.selectAllShown', 'Select all shown'));
  const toolbar = c('div', {
    className: 'v2-toolbar mb-3',
    role: 'group',
    'aria-label': t('pipe.title', 'Pipeline') + ' · ' + t('pipe.viewGrouped', 'Grouped'),
  }, [btnGrouped, btnFlat, hideTrackedLabel, selectAllBtn]);

  function setViewMode(mode) {
    viewMode = PV ? mode : 'flat';
    const grouped = viewMode === 'grouped';
    btnGrouped.className = 'btn btn-sm v2-viewbtn' + (grouped ? '' : ' btn-ghost');
    btnFlat.className = 'btn btn-sm v2-viewbtn' + (grouped ? ' btn-ghost' : '');
    btnGrouped.setAttribute('aria-pressed', grouped ? 'true' : 'false');
    btnFlat.setAttribute('aria-pressed', grouped ? 'false' : 'true');
    renderAll();
  }

  // ── CAR-116 · bulk selection + actions ──
  const selCount = c('strong', { style: { fontVariantNumeric: 'tabular-nums' } }, '0');
  const bulkProgress = c('span', { role: 'status', 'aria-live': 'polite', className: 'v2-bulk-progress' });
  const bulkBar = c('div', {
    className: 'v2-bulkbar mb-3',
    role: 'group',
    'aria-label': t('pipe.bulkRemove', 'Remove selected'),
    hidden: '',
  });
  let bulkCancelFlag = false;
  let bulkRunning = false; // CAR-116 review — no concurrent bulk runs

  function paintBulkBar() {
    const n = selected.size;
    selCount.textContent = String(n);
    bulkBar.hidden = n === 0;
    if (n === 0) { bulkProgress.textContent = ''; return; }
    bulkBar.replaceChildren(
      c('span', { className: 'v2-bulk-count' }, [
        selCount, ' ', t('pipe.selectedCount', 'selected'),
      ]),
      c('button', {
        type: 'button',
        className: 'btn btn-danger btn-sm',
        disabled: bulkRunning ? '' : null,
        onClick: () => { bulkRemove(); },
      }, '✕ ' + t('pipe.bulkRemove', 'Remove selected') + ` (${n})`),
      c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        onClick: () => {
          const picked = entries.filter((e) => selected.has(e.url));
          const top = picked.find((e) => e.role || e.company) || picked[0];
          if (top) Router.go('/evaluate?url=' + encodeURIComponent(top.url));
        },
      }, '▶ ' + t('pipe.evaluateSelected', 'Evaluate first selected')),
      c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        onClick: () => { selected.clear(); renderAll(); },
      }, t('pipe.clearSelection', 'Clear selection')),
      bulkProgress,
      c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm v2-bulk-cancel',
        onClick: () => { bulkCancelFlag = true; },
      }, t('pipe.bulkCancel', 'Cancel')),
    );
  }

  function setProgress(done, total) {
    bulkProgress.textContent = `${t('pipe.removing', 'Removing')} ${done}/${total}`;
  }

  // Sequential per-entry deletes through the SAME endpoint the row
  // button uses (API.del /api/pipeline?url=…). Cancellable between
  // steps; abandoned when the user leaves #/pipeline. Nothing here
  // submits applications — it only empties the queue.
  async function bulkRemove() {
    if (bulkRunning) return; // review: a second click never double-runs
    // CAR-116 review — the removal set is what is SELECTED and actually
    // SHOWN right now: a stale selection (filtered away, hidden by the
    // lens, or deleted elsewhere) must not inflate the confirm count
    // and must never delete invisible rows.
    const shown = new Set(currentFiltered().map((e) => e.url));
    const urls = Array.from(selected).filter((u) => shown.has(u));
    if (!urls.length) return;
    const ok = await UI.confirm(
      t('pipe.confirmDelTitle', 'Remove from pipeline?'),
      t('pipe.confirmDel', 'Delete URL from pipeline?') + ` (${urls.length})`,
      { danger: true, confirmLabel: t('common.delete', 'Delete'), cancelLabel: t('common.cancel', 'Cancel') });
    if (!ok) return;
    bulkCancelFlag = false;
    bulkRunning = true;
    try {
      const removed = [];
      for (let i = 0; i < urls.length; i++) {
        if (bulkCancelFlag || Router.current().name !== 'pipeline') break;
        setProgress(i, urls.length);
        if (await removeFromPipeline(urls[i])) removed.push(urls[i]);
      }
      setProgress(removed.length, urls.length);
      if (removed.length) {
        pushUndo(removed);
        await refresh(); // refresh() prunes the removed URLs from the selection
        showUndoBar(removed.length);
        focusUndoButton();
      } else {
        paintBulkBar();
      }
    } finally {
      bulkRunning = false;
      paintBulkBar(); // re-enable the disabled Remove button on every path
    }
  }

  // CAR-116 review — the selection only ever covers URLs the current
  // view can act on: drop entries a filter, the hide-tracked lens or an
  // external delete has removed, then repaint the bulk bar once.
  function pruneSelection(liveUrls) {
    if (!selected.size) return;
    for (const u of Array.from(selected)) {
      if (!liveUrls.has(u)) selected.delete(u);
    }
    paintBulkBar();
  }

  function toggleSelect(url, on) {
    if (on) selected.add(url);
    else selected.delete(url);
    paintBulkBar();
  }

  // CAR-116 a11y — the bulk-select checkbox name. Built through a helper
  // (not an inline shortUrl concat) so the two legacy row-action labels
  // stay the only `aria-label: … shortUrl(url)` patterns in this file.
  function selectLabel(u) {
    return t('pipe.selectOne', 'Select') + ': ' + shortUrl(u);
  }

  function rowActionLabel(kind, u) {
    const base = kind === 'evaluate'
      ? t('pipe.evaluateBtn', 'Evaluate')
      : t('common.delete', 'Delete');
    return base + ': ' + shortUrl(u);
  }

  // ── CAR-116 · undo (session-scoped, body-level bar) ──
  // The bar lives on document.body so a Router.render() re-mount (e.g.
  // the global-search quick-add) cannot swallow a pending undo.
  const undoQueue = PV ? PV.createUndoQueue(5) : null;
  let undoTimer = 0;
  // CAR-151 — url → the opaque restoreToken its DELETE returned (this
  // session only; the RAW line(s) stay server-side — the client never
  // carries content). undoLast() replays tokens through
  // POST /api/pipeline/restore so the checklist metadata
  // (company/title/location/notes) survives; a URL with no token — removed
  // by another surface, or after a server restart — falls back to the bare
  // re-add. Entries are pruned as the undo consumes them.
  const deletedLines = new Map();

  function pushUndo(urls) {
    if (undoQueue) undoQueue.push(urls);
  }

  function undoBar() {
    let bar = document.getElementById('pipeline-undo-bar');
    if (!bar) {
      bar = c('div', {
        id: 'pipeline-undo-bar',
        className: 'v2-undo-bar',
        role: 'status',
        'aria-live': 'polite',
      });
      document.body.appendChild(bar);
    }
    return bar;
  }

  function showUndoBar(n) {
    const bar = undoBar();
    bar.replaceChildren(
      c('span', { className: 'v2-undo-msg' },
        `${t('pipe.deleted', 'Deleted')}: ${n}`),
      c('button', {
        type: 'button',
        id: 'pipeline-undo-btn',
        className: 'btn btn-primary btn-sm',
        onClick: () => { undoLast(); },
      }, t('pipe.undo', 'Undo')),
      c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        onClick: () => { hideUndoBar(); },
      }, t('pipe.undoDismiss', 'Dismiss')),
    );
    bar.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { bar.hidden = true; }, 8000);
  }

  function hideUndoBar() {
    const bar = document.getElementById('pipeline-undo-bar');
    if (bar) bar.hidden = true;
    clearTimeout(undoTimer);
  }

  function focusUndoButton() {
    const btn = document.getElementById('pipeline-undo-btn');
    if (btn) btn.focus();
  }

  // CAR-151 — lossless undo. URLs deleted this session carry the opaque
  // restoreToken their DELETE returned (the raw line(s) live server-side),
  // so the checklist cells (company/title/location/notes) come back
  // exactly through POST /api/pipeline/restore; the server dedups on the
  // canonical URL key, which keeps the restore idempotent if the user
  // re-added some URLs by hand meanwhile. A URL with no token falls back
  // to the existing bare add path (POST /api/pipeline) — and so does a
  // token the server no longer knows (restart / store eviction) or a
  // restore call that failed outright: the undo may lose the METADATA in
  // those cases, never the URL itself.
  async function undoLast() {
    const batch = undoQueue ? undoQueue.pop() : null;
    hideUndoBar();
    if (!batch || !batch.length) return;
    const tokens = [];
    const tokenUrls = [];
    const bare = [];
    for (const u of batch) {
      const token = deletedLines.get(u);
      if (token) { tokens.push(token); tokenUrls.push(u); }
      else bare.push(u);
    }
    let restored = 0;
    if (tokens.length) {
      try {
        const r = await API.post('/api/pipeline/restore', { tokens });
        restored += (r && r.restored) || 0;
        // Tokens the server no longer knows (restart, eviction) — re-add
        // those URLs the plain way instead of dropping them.
        const unknown = (r && Array.isArray(r.unknown)) ? r.unknown : [];
        if (unknown.length) {
          const unknownSet = new Set(unknown);
          tokenUrls.forEach((u, i) => { if (unknownSet.has(tokens[i])) bare.push(u); });
        }
      } catch (err) {
        // The restore call itself failed — toast AND re-add the URLs bare,
        // so a broken restore can never silently lose them.
        UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
        bare.push(...tokenUrls);
      }
    }
    for (const u of bare) {
      try {
        await API.post('/api/pipeline', { url: u });
        restored += 1;
      } catch (err) {
        UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
      }
    }
    // The tokens were consumed by this undo (client-side entries are dead).
    for (const u of batch) deletedLines.delete(u);
    // CAR-116 review — only celebrate what actually came back.
    if (restored > 0) UI.toast(t('pipe.undone', 'Restored to the pipeline'), 'success');
    if (Router.current().name === 'pipeline') Router.render();
  }

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
        // FULL-R5 — only a real http(s) URL becomes a link target / window.open
        // argument (pipeline.md rows come from third-party feeds).
        UI.safeHref(activeUrl) ? c('a', {
          href: UI.safeHref(activeUrl), target: '_blank', rel: 'noopener',
          style: { display: 'block', fontSize: '13px', color: 'var(--foggy)', wordBreak: 'break-all', marginTop: '4px' },
        }, activeUrl) : c('span', { style: { display: 'block', fontSize: '13px', color: 'var(--foggy)', wordBreak: 'break-all', marginTop: '4px' } }, activeUrl),
      ]),
      c('div', { className: 'flex gap-3' }, [
        c('button', {
          className: 'btn btn-primary btn-sm',
          onClick: () => Router.go('/evaluate?url=' + encodeURIComponent(activeUrl)),
        }, '▶ ' + t('pipe.evaluateBtn')),
        c('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => { const u = UI.safeHref(activeUrl); if (u) window.open(u, '_blank', 'noopener'); },
        }, '↗ ' + t('pipe.openTab', 'Open')),
        c('button', {
          className: 'btn btn-ghost btn-sm',
          style: { color: 'var(--rausch-text)' },
          onClick: async (e) => {
            // CAR-116 review — confirmed single removal: the shared
            // remover swallows the error and returns a boolean, so the
            // undo bar only appears when the DELETE actually happened.
            const ok = await UI.confirm(
              t('pipe.confirmDelTitle', 'Remove from pipeline?'),
              t('pipe.confirmDel', 'Delete URL from pipeline?'),
              { danger: true, confirmLabel: t('common.delete', 'Delete'), cancelLabel: t('common.cancel', 'Cancel') });
            if (!ok) return;
            const removed = await UI.withSpinner(e.currentTarget,
              () => removeFromPipeline(activeUrl));
            if (!removed) return; // the remover already toasted the failure
            pushUndo([activeUrl]);
            activeUrl = null;
            showUndoBar(1);
            await refresh();
            focusUndoButton();
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
        style: { border: 'none', padding: '20px', color: 'var(--rausch-text)' },
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
    if (viewMode === 'grouped') renderGroups(); else if (vVirtual) paintWindow(); else renderList();
    // The repaint rebuilt the row the user just activated — restore focus
    // to it so keyboard users don't fall off the list (mouse clicks are
    // unaffected in practice: focus lands on the activated row).
    const scope = viewMode === 'grouped' ? groupsHost : list;
    const again = Array.from(scope.querySelectorAll('[data-url]'))
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

  // CAR-116 — the ONE delete call site. Row button, preview pane and the
  // bulk loop all funnel through here: a wrapped await, a failure toast,
  // and preview-state cleanup. Returns the restoreToken (CAR-151 — kept
  // in deletedLines for the lossless undo), true when the delete succeeded
  // without a token, or null when the DELETE failed. Call sites check
  // TRUTHINESS only.
  async function removeFromPipeline(url) {
    try {
      const r = await API.del('/api/pipeline?url=' + encodeURIComponent(url));
      if (activeUrl === url) { activeUrl = null; previewBody = ''; previewError = ''; }
      const token = (r && typeof r.restoreToken === 'string') ? r.restoreToken : '';
      if (token) deletedLines.set(url, token);
      else deletedLines.delete(url);
      return token || true;
    } catch (err) {
      UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
      return null;
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
        // CAR-93 — only the ROW itself reacts to Enter/Space. Keydowns from
        // the nested ▶/✕ buttons and the <a> bubble up to this handler, and
        // without this guard the row swallowed them (preventDefault +
        // selectUrl), so keyboard users could not evaluate, delete or open
        // from a row at all. (Nesting interactive elements inside
        // role=button is invalid ARIA; the inner controls predate the
        // row-level role and the DOM shape is load-bearing for the a11y +
        // interaction tests — the guard restores the nested controls'
        // keyboard reachability without restructuring the row.)
        if (e.target !== e.currentTarget) return;
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
        // expected. FULL-R5 — only a real http(s) URL becomes the href;
        // anything else stays plain text.
        (UI.safeHref(url) ? c('a', {
          href: UI.safeHref(url),
          target: '_blank',
          rel: 'noopener',
          onClick: (e) => e.stopPropagation(),
          style: { display: 'block', fontSize: '12px', color: 'var(--foggy)', wordBreak: 'break-all', marginTop: '2px', textDecoration: 'none' },
        }, url) : c('span', { onClick: (e) => e.stopPropagation(), style: { display: 'block', fontSize: '12px', color: 'var(--foggy)', wordBreak: 'break-all', marginTop: '2px' } }, url)),
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
            // CAR-116 review — confirmed + undoable: undo is queued only
            // when the shared remover reports success (it toasts failures).
            const ok = await UI.confirm(
              t('pipe.confirmDelTitle', 'Remove from pipeline?'),
              t('pipe.confirmDel', 'Delete URL from pipeline?'),
              { danger: true, confirmLabel: t('common.delete', 'Delete'), cancelLabel: t('common.cancel', 'Cancel') });
            if (!ok) return;
            const removed = await UI.withSpinner(e.currentTarget,
              () => removeFromPipeline(url));
            if (!removed) return;
            selected.delete(url);
            pushUndo([url]);
            showUndoBar(1);
            await refresh();
            focusUndoButton();
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
    const hideT = !!(PV && hideTracked.checked);
    const filtered = allUrls.filter((u) => {
      if (q && !u.toLowerCase().includes(q)) return false;
      if (hideT && trackedKeys.has(PV.normKey(u))) return false;
      return true;
    });
    vFiltered = filtered;
    counter.textContent = `${t('pipe.count', 'In queue')}: ${filtered.length}` +
      (filtered.length !== allUrls.length ? ` / ${allUrls.length}` : '');
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

  // ── CAR-116 · grouped view (enriched cards + collapse + bulk select) ──
  const groupsHost = c('div', { id: 'pipeline-groups', className: 'v2-groups' });
  const groupPager = UI.paginate({ pageSize: GROUPS_PER_PAGE, onChange: () => renderGroups() });

  function entryBy(url) {
    return entryIndex.get(url) || {
      url, key: url, host: shortHost(url), company: '', role: '',
      location: '', scoreNum: null, status: '', tracked: false,
      date: '', report: '',
    };
  }

  function groupBodyId(key) {
    // CAR-116 review — moved to the lib (PipelineView.groupBodyId,
    // FNV-1a): the local character-class sanitizer collapsed non-Latin
    // group keys to one shared id. Grouped mode only renders with the
    // lib present, so the direct call is safe.
    return PV.groupBodyId(key);
  }

  function toggleGroup(g) {
    const open = expanded.has(g.key);
    let refocusToggle = false;
    if (open) {
      // CAR-116 a11y — collapsing removes the body from the DOM; if
      // focus sat inside it, hand focus back to the group toggle so a
      // keyboard user is never dropped on <body>. The review round
      // moved the hand-off AFTER renderGroups(): the old code focused
      // the PRE-render toggle, which replaceChildren() then destroyed
      // (focus silently fell to <body>).
      const body = document.getElementById(groupBodyId(g.key));
      if (body && body.contains(document.activeElement)) refocusToggle = true;
      expanded.delete(g.key);
    } else {
      expanded.add(g.key);
      if (!groupBudget.has(g.key)) groupBudget.set(g.key, GROUP_WINDOW);
    }
    renderGroups();
    if (refocusToggle) {
      const btn = groupsHost.querySelector(
        `[aria-controls="${groupBodyId(g.key)}"]`);
      if (btn) btn.focus();
    }
  }

  // CAR-116 — enriched card for the grouped view. Keeps the legacy
  // `pipeline-row` class + row-as-button contract (role=button,
  // Enter/Space activates, nested controls keep their keydowns) so the
  // browser flows and the static contracts hold for BOTH views; the v2
  // additions (checkbox, role/company title, chips) layer on top.
  function entryCard(url) {
    const e = entryBy(url);
    const isActive = url === activeUrl;
    const box = c('input', {
      type: 'checkbox',
      className: 'v2-row-check',
      checked: selected.has(url) ? '' : null,
      'aria-label': selectLabel(url),
      // The click must not bubble to the row (role=button → selectUrl):
      // it would repaint the list mid-click AND open the preview as a
      // side effect of selecting.
      onClick: (ev) => ev.stopPropagation(),
      onChange: (ev) => toggleSelect(url, ev.target.checked),
    });
    const titleBits = [];
    if (e.role) titleBits.push(e.role);
    if (e.company) titleBits.push(e.company);
    const titleText = titleBits.join(' — ') || e.host || shortHost(url);
    const chips = [];
    if (e.scoreNum != null) {
      chips.push(c('span', { className: 'v2-chip v2-chip-score' }, '◎ ' + e.scoreNum.toFixed(1)));
    }
    if (e.tracked) {
      chips.push(c('span', { className: 'v2-chip v2-chip-tracked' },
        t('pipe.evaluatedBadge', 'Evaluated') + (e.status ? ' · ' + e.status : '')));
    }
    if (e.location) chips.push(c('span', { className: 'v2-chip' }, e.location));
    if (e.date) chips.push(c('span', { className: 'v2-chip v2-chip-date' }, e.date));
    return c('div', {
      className: 'flex-between pipeline-row v2-row',
      'data-url': url,
      role: 'button',
      tabindex: '0',
      'aria-pressed': isActive ? 'true' : 'false',
      onClick: () => selectUrl(url),
      onKeyDown: (ev) => {
        // CAR-93 — only the ROW itself reacts to Enter/Space; keydowns
        // from the nested checkbox / ▶ / ✕ / link must keep working.
        if (ev.target !== ev.currentTarget) return;
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        selectUrl(url);
      },
    }, [
      box,
      c('div', { className: 'v2-row-main' }, [
        c('div', { className: 'v2-row-title' }, titleText),
        // FULL-R5 — only a real http(s) URL becomes the href.
        (UI.safeHref(url) ? c('a', {
          href: UI.safeHref(url),
          target: '_blank',
          rel: 'noopener',
          onClick: (ev) => ev.stopPropagation(),
          className: 'v2-row-url',
        }, url) : c('span', { onClick: (ev) => ev.stopPropagation(), className: 'v2-row-url' }, url)),
        chips.length ? c('div', { className: 'v2-row-chips' }, chips) : null,
      ]),
      c('div', { className: 'flex gap-1' }, [
        c('button', {
          className: 'btn btn-ghost btn-sm',
          title: t('pipe.evaluateBtn', 'Evaluate'),
          'aria-label': rowActionLabel('evaluate', url),
          onClick: (ev) => { ev.stopPropagation(); Router.go('/evaluate?url=' + encodeURIComponent(url)); },
        }, '▶ ' + t('pipe.evaluateBtn', 'Evaluate')),
        c('button', {
          className: 'btn btn-ghost btn-sm pipeline-row-delete',
          title: t('common.delete', 'Delete'),
          'aria-label': rowActionLabel('delete', url),
          onClick: async (ev) => {
            ev.stopPropagation();
            // CAR-116 review — confirmed + undoable: undo is queued only
            // when the shared remover reports success (it toasts failures).
            const ok = await UI.confirm(
              t('pipe.confirmDelTitle', 'Remove from pipeline?'),
              t('pipe.confirmDel', 'Delete URL from pipeline?'),
              { danger: true, confirmLabel: t('common.delete', 'Delete'), cancelLabel: t('common.cancel', 'Cancel') });
            if (!ok) return;
            const removed = await UI.withSpinner(ev.currentTarget,
              () => removeFromPipeline(url));
            if (!removed) return;
            selected.delete(url);
            pushUndo([url]);
            showUndoBar(1);
            await refresh();
            focusUndoButton();
          },
        }, '✕ ' + t('common.delete', 'Delete')),
      ]),
    ]);
  }

  function groupBlock(g) {
    const open = expanded.has(g.key);
    const bodyId = groupBodyId(g.key);
    const allSel = g.entries.every((e) => selected.has(e.url));
    const someSel = g.entries.some((e) => selected.has(e.url));
    const box = c('input', {
      type: 'checkbox',
      checked: allSel ? '' : null,
      'aria-label': t('pipe.selectGroup', 'Select all in group') + ': ' + g.label,
      onClick: (ev) => ev.stopPropagation(),
      onChange: (ev) => {
        // CAR-116 review — mutate `selected` directly and repaint ONCE:
        // routing each entry through the per-row toggler rebuilt the
        // bulk bar once per entry (O(n) replaceChildren on a 500-row
        // group).
        for (const e of g.entries) {
          if (ev.target.checked) selected.add(e.url);
          else selected.delete(e.url);
        }
        paintBulkBar();
        renderGroups();
      },
    });
    if (someSel && !allSel) box.indeterminate = true;
    const head = c('div', { className: 'v2-group-head' }, [
      box,
      c('button', {
        type: 'button',
        className: 'v2-group-toggle',
        'aria-expanded': open ? 'true' : 'false',
        'aria-controls': bodyId,
        onClick: () => toggleGroup(g),
      }, [
        c('span', { className: 'v2-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
        c('strong', { className: 'v2-group-label' }, g.label),
        c('span', { className: 'v2-group-count' }, String(g.entries.length)),
      ]),
    ]);
    const block = c('section', { className: 'v2-group' }, [head]);
    if (open) {
      const budget = groupBudget.get(g.key) || GROUP_WINDOW;
      const shown = g.entries.slice(0, budget);
      const body = c('div', { id: bodyId, className: 'v2-group-body' },
        shown.map((e) => entryCard(e.url)));
      if (g.entries.length > shown.length) {
        body.appendChild(c('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm v2-show-more',
          onClick: () => {
            groupBudget.set(g.key, budget + GROUP_WINDOW);
            renderGroups();
          },
        }, '+ ' + t('pipe.showMore', 'Show more') + ` (${g.entries.length - shown.length})`));
      }
      block.appendChild(body);
    }
    return block;
  }

  function currentFiltered() {
    return PV.filterEntries(entries, filterQuery, { hideTracked: hideTracked.checked });
  }

  function renderGroups() {
    groupsHost.replaceChildren();
    const filtered = currentFiltered();
    counter.textContent = `${t('pipe.count', 'In queue')}: ${filtered.length}` +
      (filtered.length !== allUrls.length ? ` / ${allUrls.length}` : '');
    if (!filtered.length) {
      groupsHost.appendChild(c('div', {
        className: 'empty',
        style: { border: 'none', padding: '20px' },
      }, filterQuery.trim()
        ? t('pipe.noResults', 'No matches')
        : t('pipe.empty', 'Pipeline is empty. Add a URL below or run a scan.')));
      return;
    }
    const groups = PV.groupEntries(filtered);
    // One-shot small-queue auto-expand: the cards are visible without
    // an extra click; big queues (30k rows) start collapsed. Only the
    // FIRST render decides — an explicit collapse must stick.
    if (!autoExpandDone) {
      autoExpandDone = true;
      if (filtered.length <= AUTO_EXPAND_MAX) {
        for (const g of groups) {
          expanded.add(g.key);
          groupBudget.set(g.key, GROUP_WINDOW);
        }
      }
    }
    const page = groupPager.slice(groups);
    for (const g of page) groupsHost.appendChild(groupBlock(g));
    groupsHost.appendChild(groupPager.controls(page.length, groups.length));
  }

  function renderAll() {
    paintBulkBar();
    // Explicit display toggling (not the [hidden] attribute): the list
    // carries an inline flex layout and .v2-groups/.v2-bulkbar set an
    // author display:, which beats the UA [hidden] rule (the same
    // cascade trap overlays.css documents for its own components).
    const grouped = !!(PV && viewMode === 'grouped');
    list.style.display = grouped ? 'none' : 'flex';
    groupsHost.style.display = grouped ? 'flex' : 'none';
    if (grouped) renderGroups();
    else renderList();
    renderPreview();
  }

  async function refresh() {
    // CAR-21 (v1.243.0) — pipeline + tracker rows are re-read together so
    // the overview strip stays truthful after add/delete (it used to be
    // built once at mount and never refreshed).
    // CAR-93 — a failed /api/tracker read used to fall back to {} and
    // render as "0 tracked", indistinguishable from an empty tracker.
    // trackerLoadFailed makes the failure visible (the chip shows "—").
    const [fresh, tr] = await Promise.all([
      API.get('/api/pipeline'),
      API.get('/api/tracker').then(
        (r) => { trackerLoadFailed = false; return r; },
        () => { trackerLoadFailed = true; return {}; }),
    ]);
    allUrls = fresh.urls || [];
    trackerRows = (tr && tr.rows) || [];
    rebuildEntries();
    // CAR-116 review — URLs that left the queue (deleted here or in
    // another tab) must not survive in the selection as ghosts.
    pruneSelection(new Set(entries.map((e) => e.url)));
    renderAll();
    paintOverview();
  }

  // CAR-116 — rebuild the enriched entries from the cached enrichment
  // sources (tracker rows are fresh after refresh(); reports and the
  // checklist cells come from the mount fetch — deleting a queue URL
  // never changes them).
  function rebuildEntries() {
    if (!PV) { entries = []; entryIndex = new Map(); trackedKeys = new Set(); return; }
    const enrichment = PV.buildEnrichment({
      trackerRows,
      reports: mountReports,
      mapRows: mountMapRows,
    });
    entries = PV.enrichEntries(allUrls, enrichment);
    entryIndex = new Map(entries.map((e) => [e.url, e]));
    trackedKeys = new Set(entries.filter((e) => e.tracked).map((e) => e.key));
  }

  filterInput.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    pruneSelection(new Set(currentFiltered().map((en) => en.url)));
    if (viewMode === 'grouped') { groupPager.reset(); renderAll(); }
    else renderList();
  });

  // ── Pipeline overview strip — inbox count + a breakdown of the tracker by
  // the canonical stages, each chip linking to #/tracker. CAR-21 (v1.243.0):
  // the stage chips used to be a hard-coded English list built once at mount;
  // now the labels come from GET /api/tracker/stages (the same source the
  // tracker board uses) via window.TrackerStages, and paintOverview() runs on
  // every refresh(). Read-only; degrades to the inbox/tracked chips when the
  // tracker or the stages endpoint can't be read.
  let trackerRows = [];
  // CAR-93 — true when the last /api/tracker read failed; paintOverview()
  // shows "—" instead of a fake "0 tracked" (see refresh() above).
  let trackerLoadFailed = false;
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
    const counts = (TS && STAGES.length && !trackerLoadFailed) ? TS.stageCounts(trackerRows, STAGES, ALIASES) : {};
    overview.replaceChildren(
      c('strong', { style: { marginRight: '2px' } }, t('pipe.title', 'Pipeline') + ':'),
      ovChip(allUrls.length, t('pipe.ovInbox', 'in inbox'), '/pipeline'),
      // CAR-93 — a failed tracker read renders "—", never a fake "0".
      ovChip(trackerLoadFailed ? '—' : trackerRows.length, t('pipe.ovTracked', 'tracked'), '/tracker'),
      // Server-driven labels; only stages that actually have rows (same
      // non-zero rule as before, minus the hard-coded whitelist).
      ...STAGES.filter((s) => counts[s] > 0).map((s) => ovChip(counts[s], s, '/tracker')),
    );
  }

  // ── initial paint ──
  // CAR-116 — the enrichment sources ride the SAME mount fan-out, each
  // fail-soft: /api/reports (report headers) and /api/map/jobs (the
  // checklist cells the parent scanner already writes). Both are
  // existing endpoints; the view invents nothing.
  let mountReports = [];
  let mountMapRows = [];
  const [p0, tr0, sd0, rep0, map0] = await Promise.all([
    API.get('/api/pipeline'),
    API.get('/api/tracker').then(
      (r) => { trackerLoadFailed = false; return r; },
      () => { trackerLoadFailed = true; return {}; }),
    API.get('/api/tracker/stages').catch(() => ({})),
    API.get('/api/reports').catch(() => null),
    API.get('/api/map/jobs').catch(() => null),
  ]);
  allUrls = p0.urls || [];
  trackerRows = (tr0 && tr0.rows) || [];
  STAGES = (sd0 && Array.isArray(sd0.stages)) ? sd0.stages : [];
  ALIASES = (sd0 && sd0.aliases) || {};
  mountReports = (rep0 && Array.isArray(rep0.reports)) ? rep0.reports : [];
  mountMapRows = (map0 && Array.isArray(map0.pipeline)) ? map0.pipeline : [];
  rebuildEntries();
  setViewMode(PV ? 'grouped' : 'flat');
  renderPreview();
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

    toolbar,

    bulkBar,

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

    c('div', { className: 'grid-2', style: { gap: '16px' } }, [groupsHost, list, previewPane]),
  ]);
});

/* global Router, API, UI, I18n, HelpHint */
/**
 * #/batch — Batch evaluate (v1.13.0). SPA mirror of the CLI loop
 * documented at career-ops.org/docs/.../batch-evaluate-offers.
 *
 * Three panes:
 *   1. TSV editor for batch/batch-input.tsv (read/write)
 *   2. Run controls: parallel (1/2/3), --min-score, --dry-run, --retry
 *   3. Live SSE log from bash batch/batch-runner.sh
 *
 * After the runner finishes, a list of `batch/tracker-additions/` files
 * appears with a "Merge to tracker" button (POST /api/batch/merge).
 */

// CAR-94 (4) — module-scope single-flight + stream handle. Per-render closure
// state had two holes: a language-switch re-render RESET the running flag
// (a second paid batch-runner could start while the first was still
// streaming over the same TSV), and the EventSource handle was unreachable
// after navigation, so its handlers kept mutating a detached console and a
// stuck flag blocked nothing. Both live at module scope now; the hashchange
// guard below closes the stream when the SPA leaves #/batch.
let batchRunning = false;
let batchStream = null;

// CAR-124 review f5/f6 — the paste pipeline's pure halves live at module
// scope as function declarations (classic script → window-visible), so
// tests/car124-empty-states.test.mjs can drive them in a vm without a
// browser: parsePastedUrls takes ONLY the first whitespace-free token of
// each line (a pasted spreadsheet row like "https://a.com<TAB>Foo<TAB>Bar"
// must not leak its tabs into the url cell that Save writes to
// batch-input.tsv), validates the token with new URL() + http(s), and
// dedupes; nextBatchId scans the first TSV column for numeric ids so a
// header row, comments or non-contiguous ids (1,2,7) never collide.
// // CAR-124 i18n: the v2empty.* strings live in all 19 locale dicts
// (the ×19 fan-out landed; the CAR124_PENDING allowlist is gone).
function parsePastedUrls(text) {
  const seen = new Set();
  const out = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const tok = rawLine.trim().split(/\s+/)[0] || '';
    let u;
    try { u = new URL(tok); } catch { continue; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

function nextBatchId(existingRaw) {
  const ids = String(existingRaw || '').split(/\r?\n/)
    .map((line) => parseInt(line.split('\t')[0], 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  return Math.max(0, ...ids) + 1;
}

// #4746 — the run is the app's most expensive operation and had neither a
// spend confirmation nor a usage record. The pure halves below are
// module-scope function declarations (classic script → window-visible) so
// tests drive them in a vm: countBatchRows mirrors the server's parseTsv
// (blank + '#' comment lines skipped); estimateBatchCost folds the
// provider's own usage history (all-time per-call mean from GET /api/usage)
// into a per-evaluation token average, falling back to a documented 8000
// tokens when there is no history yet. The dollar figure is an ESTIMATE
// from the rough llm-pricing table — real in/out split with history, a
// blended in/out rate on the fallback — surfaced as an estimate, never billed.
function countBatchRows(text) {
  return String(text || '').split(/\r?\n/)
    .filter((line) => { const l = line.trim(); return l && !l.startsWith('#'); }).length;
}

// #4746 — no-history fallback: one evaluation ≈ 8000 tokens.
const BATCH_FALLBACK_TOKENS_PER_EVAL = 8000;

function estimateBatchCost(n, providerUsage, price) {
  const hasHistory = !!(providerUsage && providerUsage.calls > 0);
  const tokensPerEval = hasHistory
    ? Math.round(((providerUsage.in || 0) + (providerUsage.out || 0)) / providerUsage.calls)
    : BATCH_FALLBACK_TOKENS_PER_EVAL;
  let usd = null;
  if (price && typeof price.in === 'number' && typeof price.out === 'number') {
    if (hasHistory) {
      const avgIn = (providerUsage.in || 0) / providerUsage.calls;
      const avgOut = (providerUsage.out || 0) / providerUsage.calls;
      usd = (n * avgIn * price.in + n * avgOut * price.out) / 1e6;
    } else {
      const blended = (price.in + price.out) / 2;
      usd = (n * tokensPerEval * blended) / 1e6;
    }
  }
  return { n, tokensPerEval, usd };
}

Router.register('batch', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  let state;
  try {
    state = await API.get('/api/batch');
  } catch (e) {
    return c('div', null, [
      c('header', { className: 'page-header' },
        HelpHint.title(t('batch.title', 'Batch evaluate'), 'help.hint.batch')),
      c('div', { className: 'empty' }, (e && e.message) || 'failed to load'),
    ]);
  }

  // CAR-124 — first-run empty state. Until a TSV exists, the editor card is
  // preceded by an explanation + a decorative example row + the two real
  // first steps (paste a URL list, open the guide). The example is static,
  // aria-hidden sample data — it is never written to the file or sent
  // anywhere; the user's own paste/typing is the only editor input. The card
  // is created once and hides itself as soon as the editor holds content
  // (review f8: an empty state is a first-RUN state, not a permanent one).
  // // CAR-124 i18n: the v2empty.batch.* / v2empty.exampleTag strings live
  // in all 19 locale dicts (the ×19 fan-out landed; CAR124_PENDING is gone).
  const hasInput = (state.raw || '').trim() !== '';

  function buildBatchExample() {
    return c('div', { className: 'v2-empty-example', 'aria-hidden': 'true' }, [
      c('span', { className: 'v2-empty-example__tag' }, t('v2empty.exampleTag', 'Example')),
      c('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '12px',
          fontFamily: 'ui-monospace, monospace', fontSize: '12.5px',
          whiteSpace: 'nowrap', overflow: 'hidden',
        },
      }, [
        c('span', null, '1'),
        c('span', { style: { color: 'var(--accent, #4c8bf5)' } }, 'https://jobs.example.com/abc'),
        c('span', null, 'LinkedIn'),
        c('span', null, '—'),
      ]),
    ]);
  }

  // The card exists from the first render (so syncEmptyCard has a stable
  // handle); with a saved TSV it starts hidden — review f8.
  const emptyCard = c('div', { className: 'card mb-3' }, [
    buildBatchExample(),
    c('p', { style: { fontWeight: '600', margin: '12px 0 4px' } },
      t('v2empty.batch.emptyTitle', 'Start with a list of postings')),
    c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0' } },
      t('v2empty.batch.emptyBody', 'Paste a bare URL list below (or type rows), press Save, then Run — every posting is evaluated against your CV and profile in one pass.')),
    c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0 0' } },
      t('batch.inputHint', 'Tab-separated: id<TAB>url<TAB>source<TAB>notes (one row per JD)')),
    c('div', { className: 'flex gap-3 mt-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
      c('button', { className: 'btn', type: 'button', onClick: () => pasteUrlList() },
        '📋 ' + t('v2empty.batch.pasteList', 'Paste URL list')),
      c('span', { style: { color: 'var(--foggy)', fontSize: '13px' } }, [
        t('v2empty.batch.docsHint', 'Step-by-step: '),
        c('a', {
          href: 'https://career-ops.org/docs/introduction/guides/batch-evaluate-offers',
          style: { overflowWrap: 'anywhere' },
          target: '_blank', rel: 'noopener noreferrer',
        }, 'career-ops.org/docs/.../batch-evaluate-offers'),
      ]),
    ]),
  ]);
  emptyCard.style.display = hasInput ? 'none' : '';

  async function pasteUrlList() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      UI.toast(t('v2empty.batch.pasteFail', 'Clipboard unavailable — paste the list into the editor manually'), 'error');
      return;
    }
    // review f5 — only the first whitespace-free token of each line survives
    // (a pasted spreadsheet row "https://a.com<TAB>Foo<TAB>Bar" must not leak
    // its tabs into the url cell Save writes to batch-input.tsv), validated
    // http(s) via new URL() and deduped; anything already in the editor is
    // never re-added.
    const existing = textarea.value.replace(/\s+$/, '');
    const urls = parsePastedUrls(text).filter((u) => !existing.includes(u));
    if (!urls.length) {
      UI.toast(t('v2empty.batch.pasteNone', 'No new http(s) URLs found on the clipboard'), 'error');
      return;
    }
    const startId = nextBatchId(existing); // review f6 — max existing numeric id + 1 (header rows / comments / gaps like 1,2,7 never collide)
    const rows = urls.map((u, i) => `${startId + i}\t${u}\t\t`);
    textarea.value = (existing ? existing + '\n' : '') + rows.join('\n') + '\n';
    // review f7 — programmatic assignment fires no input event; announce the
    // change so the editor contract (and the empty-card sync below) sees it.
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    UI.toast(t('v2empty.batch.pasteAdded', 'Added {n} rows — press Save').replace('{n}', String(urls.length)), 'success');
  }

  // ── editor ──
  // v1.20.0 — WCAG 1.3.1 / 3.3.2: TSV textarea + run-control inputs
  // associated with hint paragraphs via aria-describedby.
  // F-V54-C (v1.54.5) — the TSV editor had a hint via aria-describedby
  // but NO accessible NAME (no <label>, no aria-label), so a screen
  // reader announced an unlabelled "edit text". aria-describedby is a
  // description, not a name. Add aria-label like the sibling
  // run-control inputs (WCAG 1.3.1 / 4.1.2).
  const textarea = c('textarea', {
    id: 'batch-tsv',
    'aria-label': t('batch.tsvAria', 'Batch TSV — one offer per line: id, url, source, notes (tab-separated)'),
    'aria-describedby': 'batch-tsv-hint',
    className: 'textarea',
    rows: 14,
    style: { minHeight: '320px', fontFamily: 'ui-monospace, monospace', fontSize: '13px' },
    placeholder: '# id\turl\tsource\tnotes\n1\thttps://jobs.example.com/abc\tLinkedIn\t',
  });
  textarea.value = state.raw || '';

  // CAR-124 review f8 — the empty-state card is a first-RUN state: hide it as
  // soon as the editor holds content (typing, a native Ctrl+V, or the
  // programmatic paste's dispatched input event) and after a successful
  // save. One named implementation shared by both trigger paths.
  function syncEmptyCard() {
    if (!emptyCard) return;
    emptyCard.style.display = textarea.value.trim() ? 'none' : '';
  }
  textarea.addEventListener('input', syncEmptyCard);

  // CAR-20 (v1.243.0) — the row count sat in a one-shot inline span fed
  // from the INITIAL state, so it went stale the moment the user saved a
  // new TSV (or a run/merge refreshed `state`). Dedicated renderer, fed
  // by every state refresh below.
  const rowsCountEl = c('span', { style: { color: 'var(--foggy)', fontSize: '13px', alignSelf: 'center' } }, '');
  function renderRowsCount() {
    rowsCountEl.textContent = ((state && state.rows) || []).length + ' ' + t('batch.rows', 'rows');
  }
  renderRowsCount();

  async function saveTsv(btn) {
    try {
      const r = await UI.withSpinner(btn, () =>
        API.put('/api/batch', { raw: textarea.value }));
      UI.toast(t('batch.saved', 'Saved') + ` · ${r.rows} ${t('batch.rows', 'rows')}`, 'success');
      state = await API.get('/api/batch');
      renderRowsCount();
      syncEmptyCard(); // review f8 — a saved (non-empty) file ends the empty state
    } catch (e) {
      UI.toast((e && e.message) || 'save failed', 'error');
    }
  }

  // ── run controls ──
  const parallelSel = c('select', {
    id: 'batch-parallel',
    'aria-label': t('batch.parallelAria', 'Concurrent worker count'),
    className: 'select',
  }, [
    c('option', { value: '1' }, '1 ' + t('batch.atATime', 'at a time')),
    c('option', { value: '2' }, '2 ' + t('batch.parallel', 'parallel')),
    c('option', { value: '3' }, '3 ' + t('batch.parallel', 'parallel')),
  ]);
  parallelSel.value = '1';
  const minScoreIn = c('input', {
    id: 'batch-min-score',
    'aria-label': t('batch.minScoreAria', 'Minimum score threshold (e.g. 4.0)'),
    className: 'input',
    placeholder: t('batch.minScorePh', 'min score (e.g. 4.0)'),
    style: { maxWidth: '160px' },
  });
  const dryRun = c('input', { type: 'checkbox', id: 'batch-dry-run' });
  const retry = c('input', { type: 'checkbox', id: 'batch-retry' });
  // v1.28.0 — surface --max-retries N (canonical docs flag, default 2).
  // Meaningful only when retry-failed is on; the runner ignores it
  // otherwise. Bounds 1..10 are arbitrary safety caps — server validates.
  const maxRetriesIn = c('input', {
    id: 'batch-max-retries',
    type: 'number',
    min: '1',
    max: '10',
    'aria-label': t('batch.maxRetriesAria', 'Maximum retry attempts per failed offer (1-10)'),
    className: 'input',
    placeholder: t('batch.maxRetriesPh', '(default 2)'),
    style: { maxWidth: '110px' },
    disabled: true,
  });
  retry.addEventListener('change', () => {
    maxRetriesIn.disabled = !retry.checked;
    if (!retry.checked) maxRetriesIn.value = '';
  });
  // v1.31.0 — batch-runner.sh gained a --model
  // (#504) + --start-from. Surface both for parity (same defensive
  // server-side validation as --max-retries).
  const modelIn = c('input', {
    id: 'batch-model',
    'aria-label': t('batch.modelAria', 'Claude model passed to batch-runner --model (optional)'),
    className: 'input',
    placeholder: t('batch.modelPh', '(Claude Max default)'),
    style: { maxWidth: '210px' },
  });
  const startFromIn = c('input', {
    id: 'batch-start-from',
    type: 'number',
    min: '1',
    'aria-label': t('batch.startFromAria', 'Skip offer IDs below this number (optional)'),
    className: 'input',
    placeholder: t('batch.startFromPh', '(from #1)'),
    style: { maxWidth: '110px' },
  });

  const consoleEl = c('pre', { className: 'console', style: { maxHeight: '480px', overflow: 'auto' } });

  // CAR-20 (v1.243.0) — runRunner had no in-flight guard and never kept
  // the EventSource handle: a second click (or a rerun mid-stream)
  // started a SECOND concurrent batch-runner over the same TSV, with
  // interleaved consoles and doubled tracker merges. Single-flight flag,
  // tracked stream, disabled Run button, one finish path.
  // CAR-94 (4) — the flag and the handle are module-scope now (see above).
  const runBtn = c('button', {
    className: 'btn btn-primary',
    onClick: () => runRunner(),
  }, '▶ ' + t('batch.runBtn', 'Run batch'));

  // #4746 — best-effort cost estimate for the confirm dialog: the active
  // provider (falling back to the usage history's biggest spender when no
  // provider is forced), that provider's all-time per-call usage average
  // and its pricing row. Any fetch failure degrades the text ("cost
  // unknown") — it must never block the run.
  async function buildCostEstimate(n) {
    let provider = null;
    let usage = null;
    let price = null;
    try {
      const [st, u] = await Promise.all([
        API.get('/api/status/providers'),
        API.get('/api/usage'),
      ]);
      const all = u && u.windows && u.windows.all && u.windows.all.providers;
      provider = (st && st.activeProvider) || (all && all.length && all[0].provider) || null;
      if (provider && all) {
        const e = all.find((p) => p.provider === provider);
        if (e) usage = { in: e.in, out: e.out, calls: e.calls };
      }
      if (provider && u && u.prices && u.prices[provider]) price = u.prices[provider];
    } catch { /* estimate stays best-effort */ }
    return { ...estimateBatchCost(n, usage, price), provider: provider || '—' };
  }

  async function runRunner() {
    if (batchRunning) return;
    // #4746 — a multi-row run bills N real evaluations and had no gate:
    // show the spend confirm for every N ≥ 2 run (a single row keeps the
    // old path). --dry-run makes zero model calls, so the estimate premise
    // is false and the gate is skipped there. Declining aborts cleanly.
    const rows = countBatchRows(textarea.value);
    if (rows >= 2 && !dryRun.checked) {
      const est = await buildCostEstimate(rows);
      const usdText = est.usd != null
        ? '$' + est.usd.toFixed(2)
        : t('batch.cost.usdUnknown', 'cost unknown');
      const ok = await UI.confirm(
        t('batch.cost.confirmTitle', 'Confirm paid batch run'),
        t('batch.cost.confirmBody', 'Approximately {n} evaluations ≈ {usd} (provider {provider}). Run?')
          .replace('{n}', String(est.n))
          .replace('{usd}', usdText)
          .replace('{provider}', est.provider),
        { danger: false, confirmLabel: t('batch.cost.confirmOk', 'Run batch') },
      );
      if (!ok) return;
    }
    const params = new URLSearchParams();
    if (dryRun.checked) params.set('dryRun', '1');
    if (parallelSel.value && parallelSel.value !== '1') params.set('parallel', parallelSel.value);
    if (minScoreIn.value.trim()) params.set('minScore', minScoreIn.value.trim());
    if (retry.checked) params.set('retry', '1');
    if (retry.checked && maxRetriesIn.value.trim()) params.set('maxRetries', maxRetriesIn.value.trim());
    if (modelIn.value.trim()) params.set('model', modelIn.value.trim());
    if (startFromIn.value.trim()) params.set('startFrom', startFromIn.value.trim());
    batchRunning = true;
    runBtn.disabled = true;
    consoleEl.textContent = '';
    UI.toast(t('batch.running', 'Running batch evaluator…'));
    const finishRunner = () => {
      batchRunning = false;
      batchStream = null;
      runBtn.disabled = false;
    };
    batchStream = API.stream('/api/stream/batch?' + params.toString(), async (event, data) => {
      if (event === 'log' && data.line) {
        consoleEl.appendChild(c('span',
          { className: data.stream === 'stderr' ? 'err' : '' }, data.line + '\n'));
        consoleEl.scrollTop = consoleEl.scrollHeight;
      } else if (event === 'done') {
        finishRunner();
        consoleEl.appendChild(c('span', { className: '' },
          `\n✓ done (exit ${data.code}) · additions: ${data.additions ?? 0}\n`));
        UI.toast(t('batch.done', 'Batch done') + ` · ${data.additions ?? 0} ` + t('batch.additions', 'additions'),
          data.code === 0 ? 'success' : 'error');
        // Refresh additions list
        try { state = await API.get('/api/batch'); } catch { /* keep the last good state */ }
        renderAdditions();
        renderRowsCount();
      } else if (event === 'error') {
        finishRunner();
        consoleEl.appendChild(c('span', { className: 'err' }, '\n✗ ' + ((data && data.message) || 'error') + '\n'));
        UI.toast((data && data.message) || 'error', 'error');
      }
    });
  }

  async function mergeToTracker(btn) {
    try {
      const r = await UI.withSpinner(btn, () => API.post('/api/batch/merge', { dryRun: false }));
      UI.toast(t('batch.merged', 'Merged into tracker') + ` (exit ${r.code})`,
        r.code === 0 ? 'success' : 'error');
      state = await API.get('/api/batch');
      renderAdditions();
      renderRowsCount();
    } catch (e) {
      UI.toast((e && e.message) || 'merge failed', 'error');
    }
  }

  // ── additions list ──
  const additionsHost = c('div');
  function renderAdditions() {
    additionsHost.innerHTML = '';
    const adds = (state && state.additions) || [];
    if (!adds.length) {
      additionsHost.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '13px' } },
        t('batch.noAdditions', 'No pending additions in batch/tracker-additions/ — run the batch evaluator first.')));
      return;
    }
    additionsHost.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '13px' } },
      adds.length + ' ' + t('batch.pendingAdditions', 'pending tracker additions:')));
    const list = c('ul');
    adds.forEach((f) => {
      list.appendChild(c('li', null, `${f.name} (${(f.size / 1024).toFixed(1)} KB)`));
    });
    additionsHost.appendChild(list);
    additionsHost.appendChild(c('button', {
      className: 'btn btn-primary mt-3',
      onClick: (e) => mergeToTracker(e.currentTarget),
    }, '⇩ ' + t('batch.merge', 'Merge into tracker')));
  }
  renderAdditions();

  // ── shell ──
  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('batch.title', 'Batch evaluate'), 'help.hint.batch'),
        // CAR-51 #3 (v1.247.0) — the docs link was a second, unstyled
        // paragraph of its own; it now rides inline in the subtitle and may
        // break at "/" instead of pushing the page wide.
        c('p', { className: 'page-subtitle' }, [
          t('batch.subtitle', 'Score 10+ JDs at once via batch/batch-runner.sh — see '),
          c('a', {
            href: 'https://career-ops.org/docs/introduction/guides/batch-evaluate-offers',
            style: { overflowWrap: 'anywhere' },
            target: '_blank', rel: 'noopener noreferrer',
          }, 'career-ops.org/docs/.../batch-evaluate-offers'),
        ]),
      ]),
    ]),
    // CAR-58 #4 (v1.247.0) — theme-aware .callout--warn, not inline light yellow.
    !state.runnerExists ? c('div', {
      className: 'card mb-3 callout callout--warn',
    }, [
      c('strong', null, '⚠ ' + t('batch.noRunnerTitle', 'batch/batch-runner.sh not found')),
      c('p', { style: { margin: '6px 0 0', fontSize: '14px' } },
        t('batch.noRunnerBody', 'The runner lives in the parent career-ops project. Ensure batch/batch-runner.sh exists and is executable (chmod +x).')),
    ]) : null,
    // CAR-124 — first-run empty state (visible only while no TSV exists;
    // syncEmptyCard hides it the moment the editor holds content).
    emptyCard,
    // Editor pane
    c('div', { className: 'card mb-3' }, [
      c('h2', { className: 'section-title' }, t('batch.inputTitle', 'batch/batch-input.tsv')),
      c('p', {
        // v1.20.1 (H-1) — id matches the textarea's aria-describedby
        // so screen readers actually voice this hint when the editor
        // is focused. The wire was promised in v1.20.0 but the id was
        // missing.
        id: 'batch-tsv-hint',
        style: { color: 'var(--foggy)', fontSize: '13px', margin: '4px 0 12px' },
      }, t('batch.inputHint', 'Tab-separated: id<TAB>url<TAB>source<TAB>notes (one row per JD)')),
      textarea,
      c('div', { className: 'flex gap-3 mt-3' }, [
        c('button', {
          className: 'btn btn-primary',
          onClick: (e) => saveTsv(e.currentTarget),
        }, '💾 ' + t('common.save', 'Save')),
        rowsCountEl,
      ]),
    ]),
    // Run controls
    c('div', { className: 'card mb-3' }, [
      c('h2', { className: 'section-title' }, t('batch.runTitle', 'Run')),
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', alignItems: 'flex-end' } }, [
        c('div', { className: 'field', style: { marginBottom: 0, minWidth: '180px' } }, [
          // v1.20.1 (H-2) — explicit htmlFor wires the label to the
          // select's id so screen readers announce "Parallel,
          // combobox" instead of just "combobox". WCAG 3.3.2.
          c('label', { htmlFor: 'batch-parallel' }, t('batch.parallelLbl', 'Parallel')),
          parallelSel,
        ]),
        c('div', { className: 'field', style: { marginBottom: 0 } }, [
          c('label', { htmlFor: 'batch-min-score' }, t('batch.minScoreLbl', 'Min score (optional)')),
          minScoreIn,
        ]),
        c('label', { className: 'flex', style: { gap: '8px', userSelect: 'none' } }, [
          dryRun, c('span', null, t('batch.dryRun', 'Dry run')),
        ]),
        c('label', { className: 'flex', style: { gap: '8px', userSelect: 'none' } }, [
          retry, c('span', null, t('batch.retry', 'Retry failed')),
        ]),
        c('div', { className: 'field', style: { marginBottom: 0 } }, [
          c('label', { htmlFor: 'batch-max-retries' }, t('batch.maxRetriesLbl', 'Max retries')),
          maxRetriesIn,
        ]),
        c('div', { className: 'field', style: { marginBottom: 0 } }, [
          c('label', { htmlFor: 'batch-model' }, t('batch.modelLbl', 'Model')),
          modelIn,
        ]),
        c('div', { className: 'field', style: { marginBottom: 0 } }, [
          c('label', { htmlFor: 'batch-start-from' }, t('batch.startFromLbl', 'Start from #')),
          startFromIn,
        ]),
        runBtn,
      ]),
    ]),
    consoleEl,
    // Additions
    c('div', { className: 'card mt-3' }, [
      c('h2', { className: 'section-title' }, t('batch.additionsTitle', 'Tracker additions')),
      additionsHost,
    ]),
  ]);
});

// CAR-94 (4) — leaving #/batch closes the tracked stream: its handlers would
// otherwise keep appending to a detached console forever, and a stream that
// outlives the view can neither be stopped from the new one nor release the
// module-scope single-flight flag. A re-entry then starts clean; closing via
// .close() fires no error frame (the detached handlers would not reach
// anything anyway), so no phantom ✗ lands anywhere.
window.addEventListener('hashchange', () => {
  if ((location.hash || '').startsWith('#/batch')) return;
  if (batchStream) {
    try { batchStream.close(); } catch { /* already closed */ }
    batchStream = null;
  }
  batchRunning = false;
});

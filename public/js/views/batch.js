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

  async function saveTsv(btn) {
    try {
      const r = await UI.withSpinner(btn, () =>
        API.put('/api/batch', { raw: textarea.value }));
      UI.toast(t('batch.saved', 'Saved') + ` · ${r.rows} ${t('batch.rows', 'rows')}`, 'success');
      state = await API.get('/api/batch');
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
  // v1.31.0 — parent career-ops 1.8.0 added batch-runner.sh --model
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

  function runRunner() {
    const params = new URLSearchParams();
    if (dryRun.checked) params.set('dryRun', '1');
    if (parallelSel.value && parallelSel.value !== '1') params.set('parallel', parallelSel.value);
    if (minScoreIn.value.trim()) params.set('minScore', minScoreIn.value.trim());
    if (retry.checked) params.set('retry', '1');
    if (retry.checked && maxRetriesIn.value.trim()) params.set('maxRetries', maxRetriesIn.value.trim());
    if (modelIn.value.trim()) params.set('model', modelIn.value.trim());
    if (startFromIn.value.trim()) params.set('startFrom', startFromIn.value.trim());
    consoleEl.textContent = '';
    UI.toast(t('batch.running', 'Running batch evaluator…'));
    API.stream('/api/stream/batch?' + params.toString(), async (event, data) => {
      if (event === 'log' && data.line) {
        consoleEl.appendChild(c('span',
          { className: data.stream === 'stderr' ? 'err' : '' }, data.line + '\n'));
        consoleEl.scrollTop = consoleEl.scrollHeight;
      } else if (event === 'done') {
        consoleEl.appendChild(c('span', { className: '' },
          `\n✓ done (exit ${data.code}) · additions: ${data.additions ?? 0}\n`));
        UI.toast(t('batch.done', 'Batch done') + ` · ${data.additions ?? 0} ` + t('batch.additions', 'additions'),
          data.code === 0 ? 'success' : 'error');
        // Refresh additions list
        state = await API.get('/api/batch');
        renderAdditions();
      } else if (event === 'error') {
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
        c('p', { className: 'page-subtitle' },
          t('batch.subtitle', 'Score 10+ JDs at once via batch/batch-runner.sh — see ') + ' '),
        c('p', { style: { fontSize: '13px', color: 'var(--foggy)' } }, [
          c('a', {
            href: 'https://career-ops.org/docs/introduction/guides/batch-evaluate-offers',
            target: '_blank', rel: 'noopener noreferrer',
          }, 'career-ops.org/docs/.../batch-evaluate-offers'),
        ]),
      ]),
    ]),
    !state.runnerExists ? c('div', {
      className: 'card mb-3',
      style: { background: '#fff8e6', borderColor: '#f0c674', color: '#8a6300' },
    }, [
      c('strong', null, '⚠ ' + t('batch.noRunnerTitle', 'batch/batch-runner.sh not found')),
      c('p', { style: { margin: '6px 0 0', fontSize: '14px' } },
        t('batch.noRunnerBody', 'The runner lives in the parent career-ops project. Ensure batch/batch-runner.sh exists and is executable (chmod +x).')),
    ]) : null,
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
        c('span', { style: { color: 'var(--foggy)', fontSize: '13px', alignSelf: 'center' } },
          (state.rows || []).length + ' ' + t('batch.rows', 'rows')),
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
        c('button', { className: 'btn btn-primary', onClick: runRunner },
          '▶ ' + t('batch.runBtn', 'Run batch')),
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

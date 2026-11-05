/* global Router, API, UI, I18n, HelpHint */
// v1.268.1 review — navigating away mid-evaluation used to leave the SSE
// drain (and the server-side provider spend — FULL-M5 threads the client
// disconnect into the provider call) running against a detached view. The
// route-change hook below aborts the CURRENT run's controller. One
// module-level registration with a single slot: armed on run start,
// disarmed when the run settles — never re-registered per render.
let abortRun = null;
Router.onRouteChange(() => abortRun && abortRun());

Router.register('evaluate', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const prefillUrl = params.get('url') || '';

  // v1.20.0 — WCAG 1.3.1 / 3.3.2: each form control owns an id so the
  // label can target it via htmlFor and hint text gets associated via
  // aria-describedby.
  const jdInput = c('textarea', {
    id: 'eval-jd',
    'aria-describedby': 'eval-jd-hint',
    className: 'textarea',
    rows: 16,
    placeholder: t('eval.placeholder'),
  });
  const saveJd = c('input', { type: 'checkbox', id: 'save-jd' });
  // WS2 #19 — the long LLM call was silent for screen readers; make
  // the result container a polite status region so "Evaluating…", the
  // verdict, and errors are all announced.
  const out = c('div', { id: 'eval-out', role: 'status', 'aria-live': 'polite' });

  if (prefillUrl) {
    jdInput.value = `URL: ${prefillUrl}\n\n[paste JD text here]`;
  }

  async function run() {
    const jd = jdInput.value.trim();
    // UX-D-F (v1.58.43) — empty submit used to fall through the
    // `<50` check with no specific message; the user got the "JD too
    // short" toast even though the real issue is "you typed nothing".
    // Distinguish the two so the toast actually tells the user what
    // to do.
    if (!jd) {
      UI.toast(t('eval.emptyJd', 'JD is required — paste the full job description'), 'error');
      jdInput.focus();
      return;
    }
    if (jd.length < 50) {
      UI.toast(t('eval.shortJd'), 'error');
      return;
    }
    // Owner UX batch — a ?url= hand-off prefills the field with the
    // template text; 50 chars of template sailed past the length gate and
    // burned an LLM call on a placeholder. Name the actual problem instead.
    if (jd.includes('[paste JD text here]')) {
      UI.toast(t('eval.pasteJd', 'This is the URL prefill template — paste the job description text below the URL'), 'error');
      jdInput.focus();
      return;
    }
    // v1.268.0 (CAR-230) — the evaluate endpoint streams SSE stage events
    // (scoring → rendering → assembling); the loading line follows the stage
    // and quotes the REAL latency (p50/p90 from the usage journal) instead
    // of any static minute-range copy.
    // CAR-244.1 — the p50/p90 come from the view-mount fetch (`latency`
    // above); no second /api/usage call per run.
    out.innerHTML = `<div class="loading">${t('eval.evaluating')}</div>`;
    let etaLine = null;
    if (latency) {
      etaLine = c('div', { className: 'field-hint', role: 'status' },
        t('eval.etaHint', 'Usual: {p50}s median · p90 {p90}s')
          .replace('{p50}', Math.round(latency.p50Ms / 1000))
          .replace('{p90}', Math.round(latency.p90Ms / 1000)));
      out.appendChild(etaLine);
    }
    const stageLabel = (name) => {
      if (name === 'scoring') return t('eval.stageScoring', 'Scoring the posting (canonical EN)…');
      if (name === 'rendering') return t('eval.stageRendering', 'Rendering the report…');
      if (name === 'assembling') return t('eval.stageAssembling', 'Assembling the report…');
      return t('eval.evaluating');
    };
    const setStage = (name, detail) => {
      if (etaLine) { etaLine.remove(); etaLine = null; }
      // v1.268.1 review — the stage `detail` is server-controlled data;
      // interpolating it through innerHTML handed the server a markup
      // channel. Build a text node instead (same visual output).
      out.replaceChildren(c('div', { className: 'loading' }, stageLabel(name) + (detail ? ' — ' + detail : '')));
    };
    // v1.268.1 review — one AbortController per run; the module-level
    // route-change hook (top of file) aborts it on navigation so the client
    // disconnect stops the server-side provider call.
    const ctrl = new AbortController();
    const stop = () => ctrl.abort();
    abortRun = stop;
    try {
      const r = await new Promise(async (resolve, reject) => {
        let settled = false;
        try {
          await API.postStream('/api/evaluate', { jd, save: saveJd.checked }, (ev, data) => {
            if (settled) return;
            if (ev === 'done') { settled = true; resolve(data); }
            else if (ev === 'stage') setStage(data.name, data.detail);
            else if (ev === 'error') { settled = true; reject(new Error(data.message || 'stream error')); }
          }, ctrl.signal);
        } catch { /* postStream resolves on every path; a throw must not hang either */ }
        if (!settled) {
          settled = true;
          // The stream ended WITHOUT a terminal frame (server restart
          // mid-run) used to leave this Promise unsettled forever: the
          // Generate button stayed disabled with no explanation. Same
          // contract as auto-pipeline — any non-aborted end lands in a
          // terminal state; a deliberate route-change abort is silent
          // (navigation is not an error).
          if (ctrl.signal.aborted) resolve(undefined);
          else reject(new Error(t('err.evaluate.noTerminal', 'The evaluation stream ended without a result — the server may have restarted mid-run.')));
        }
      });
      if (!r || (!r.markdown && r.mode !== 'manual')) {
        throw new Error(t('err.evaluate.failed', 'Evaluation failed — check a provider key on #/config, or run again.'));
      }
      renderResult(r);
    } catch (e) {
      out.innerHTML = '';
      // CAR-137 — the bare 'failed' fallback became a specific, actionable message.
      out.appendChild(c('div', { className: 'empty' }, t('common.error') + ': ' + ((e && e.message) || t('err.evaluate.failed', 'Evaluation failed — check a provider key on #/config, or run again.'))));
    } finally {
      // The run settled: disarm the slot unless a newer run re-armed it.
      if (abortRun === stop) abortRun = null;
    }
  }

  function renderResult(r) {
    out.innerHTML = '';
    if (r.mode === 'manual') {
      out.appendChild(c('div', { className: 'card' }, [
        c('div', { className: 'badge badge-warn mb-3' }, t('eval.manualMode')),
        c('p', null, r.message),
        c('p', { className: 'field-hint' }, t('eval.copyHint')),
        c('pre', { className: 'console' }, r.prompt),
        c('div', { className: 'flex gap-3 mt-3' }, [
          c('button', { className: 'btn btn-primary', onClick: async () => {
            // FULL-M6 (deep.js CAR-20 pattern) — writeText is async and can
            // reject (permission denied, non-secure context); the
            // fire-and-forget call still toasted "Copied" on failure.
            try { await navigator.clipboard.writeText(r.prompt); UI.toast(t('eval.copied'), 'success'); }
            catch { UI.toast(t('auto.copyFail', 'Copy failed — select the text and copy manually.'), 'error'); }
          }}, t('eval.copy')),
          c('button', {
            className: 'btn btn-ghost',
            onClick: (e) => window.PdfGenerate.run({
              kind: 'inline',
              markdown: r.prompt,
              title: 'JD evaluation prompt',
              slug: 'evaluate',
              button: e.currentTarget,
            }),
          }, '📄 ' + t('common.generatePdf', 'Generate PDF')),
        ]),
      ]));
    } else {
      // v1.223.0 — tone follows the OUTCOME, not a strict `code === 0`. The
      // in-process live providers (OpenRouter, DeepSeek, …) return NO `code`
      // (there is no subprocess), so `code === 0` was false and every successful
      // live eval was painted red. renderResult only runs on a 200 (failures throw
      // to the catch), so paint bad only when a subprocess actually exits non-zero.
      const failed = typeof r.code === 'number' && r.code !== 0;
      // CAR-21 (v1.243.0) — the server names problems in `warnings`
      // (evaluationWarnings — since v1.239.4 the FIRST entry names a report
      // cut off at the output-token limit). Dropping it painted a truncated
      // evaluation as if it were whole. Render the banner above the body;
      // the strings are server data — the one new line of copy is the
      // localized truncation notice that leads the band (v1.239.4 warnings
      // surface, BACKLOG views-2), so a bare "report not in ru" line no
      // longer reads as unexplained jargon.
      const warnings = Array.isArray(r.warnings) ? r.warnings : [];
      const cls = failed ? 'badge-bad' : 'badge-ok';
      // v1.218.0 — name whichever of the 18 providers actually ran (was a stale
      // anthropic-or-else-Gemini guess) + its brand monogram.
      const engineName = (window.ProviderStatus && window.ProviderStatus.label(r.mode)) || r.mode || 'LLM';
      const engineTile = (r.mode && r.mode !== 'manual' && window.ProviderLogo && typeof window.ProviderLogo.el === 'function')
        ? window.ProviderLogo.el(r.mode, 14) : null;
      // For live runs the markdown lives in either `markdown` (in-process
      // providers) or `stdout` (the Gemini subprocess). PDF button uses whichever
      // is non-empty.
      const liveMd = r.markdown || r.stdout || '';
      out.appendChild(c('div', { className: 'card' }, [
        c('div', { className: 'flex-between mb-3' }, [
          c('div', { className: 'flex gap-3' }, [
            c('div', { className: 'badge ' + cls, style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
              engineTile,
              engineName + (typeof r.code === 'number' ? ' · ' + t('eval.exit', 'exit') + ' ' + r.code : ''),
            ]),
            r.saved && c('div', { className: 'badge badge-info' },
              t('eval.savedAs', 'Saved') + ': ' + r.saved),
          ]),
          liveMd && c('button', {
            className: 'btn btn-primary',
            onClick: (e) => window.PdfGenerate.run({
              kind: 'inline',
              markdown: liveMd,
              title: `JD evaluation (${engineName})`,
              slug: 'evaluate',
              button: e.currentTarget,
            }),
          }, '📄 ' + t('common.generatePdf', 'Generate PDF')),
        ]),
        warnings.length ? c('div', {
          className: 'badge badge-warn',
          role: 'status',
          style: { display: 'block', marginBottom: '12px', whiteSpace: 'normal', lineHeight: '1.5', textAlign: 'start' },
        }, [
          c('div', { style: { margin: '2px 0', fontWeight: 600 } }, '⚠ ' + t('llm.truncatedNotice', 'Model output may be truncated — re-run if the report looks cut off')),
          ...warnings.map((w) => c('div', { style: { margin: '2px 0' } }, '· ' + w)),
        ]) : null,
        (r.markdown || r.stdout) && c('div', { className: 'md', html: UI.md(r.markdown || r.stdout) }),
        r.stderr && c('details', null, [
          c('summary', null, 'stderr'),
          c('pre', { className: 'console' }, r.stderr),
        ]),
      ]));
    }
  }

  // CAR-51 #1 (v1.247.0) — the ⏱ ETA + cost hint live in ONE meta line
  // under the view title (shared UI.pageMeta helper), not as orphans
  // wrapped after the action row.
  // CAR-244.1 — the static ETA key is GONE. The chip quotes
  // the REAL p50/p90 from /api/usage.llmLatency; when the journal has no
  // durations yet there is no number at all (no chip). One mount fetch,
  // reused by run() below — no duplicate call.
  let latency = null;
  try {
    const u = await API.get('/api/usage');
    latency = (u && u.llmLatency && u.llmLatency.p50Ms) ? u.llmLatency : null;
  } catch { /* the hint is best-effort; the run does not depend on it */ }
  const etaChip = latency ? c('span', { className: 'advisor-eta' }, '⏱ ' +
    t('eval.etaHint', 'Usual: {p50}s median · p90 {p90}s')
      .replace('{p50}', Math.round(latency.p50Ms / 1000))
      .replace('{p90}', Math.round(latency.p90Ms / 1000))) : null;
  const pageMeta = UI.pageMeta(t, etaChip, UI.providerCostHint(t));

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('eval.title'), 'help.hint.evaluate'),
        c('p', { className: 'page-subtitle' }, t('eval.subtitle')),
        pageMeta,
      ]),
    ]),

    c('div', { className: 'card' }, [
      c('div', { className: 'field' }, [
        c('label', { htmlFor: 'eval-jd' }, t('eval.jdLbl')),
        c('p', { id: 'eval-jd-hint', style: { color: 'var(--foggy)', fontSize: '13px', margin: '4px 0 8px' } },
          t('eval.jdHint', 'Paste the full job description. Minimum 50 characters after sanitization.')),
        jdInput,
      ]),
      c('label', { htmlFor: 'save-jd', className: 'flex', style: { gap: '8px', userSelect: 'none' } }, [
        saveJd, c('span', null, t('eval.saveJd')),
      ]),
      c('div', { className: 'flex gap-3 mt-3' }, [
        // WS2 #20 — spinner-wrap so the button disables + shows a busy
        // state during the long LLM call (was plain `onClick: run`,
        // allowing duplicate submissions).
        c('button', { className: 'btn btn-primary', onClick: (e) => UI.withSpinner(e.currentTarget, run) }, t('eval.btnEval')),
        c('button', { className: 'btn btn-ghost', onClick: () => { jdInput.value = ''; out.innerHTML = ''; } }, t('eval.btnClear')),
      ]),
    ]),

    c('div', { className: 'mt-5' }, out),
  ]);
});

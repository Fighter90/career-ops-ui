/* global Router, API, UI, I18n, HelpHint */
/**
 * #/auto — one-click AutoPipeline screen (WS5, v1.34.0).
 *
 * Promotes the v1.15 dashboard MODAL (`window.AutoPipeline.open()`)
 * into a dedicated, linkable page. Senior-UX intent:
 *   - One primary CTA. Paste a URL, press Enter or click → the whole
 *     pipeline runs (validate → fetch → evaluate → save report →
 *     append tracker) with live per-step feedback.
 *   - The stepper is an ordered list with `aria-current="step"` on the
 *     active row and a polite live-region announcing transitions, so
 *     it is comprehensible without sight.
 *   - On success every artifact is a deep-link (report → #/reports,
 *     tracker → #/tracker) so the user's next action is one click away.
 *   - No-API-key path collapses to a copy-the-prompt card (manual mode).
 *   - A failed step is marked, its message shown, and the CTA re-enabled
 *     so the user can correct the URL and retry without a reload.
 *
 * SSE transport mirrors public/js/lib/auto-pipeline.js — POST + manual
 * stream drain (the endpoint is POST; EventSource is GET-only). The
 * multi-line `data:` join is the v1.22.0 (L-4) correct behaviour.
 */
Router.register('auto', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');

  const STEPS = [
    { key: 'validate', i18nKey: 'auto.step.validate', label: 'Validating URL' },
    { key: 'fetch',    i18nKey: 'auto.step.fetch',    label: 'Fetching job description' },
    { key: 'evaluate', i18nKey: 'auto.step.evaluate', label: 'Evaluating against your CV' },
    { key: 'save_report', i18nKey: 'auto.step.report', label: 'Saving report' },
    { key: 'append_tracker', i18nKey: 'auto.step.tracker', label: 'Adding to tracker' },
  ];
  const stepState = STEPS.map(() => ({ status: 'pending', detail: '' }));

  const urlInput = c('input', {
    id: 'auto-url',
    className: 'input',
    type: 'url',
    placeholder: 'https://job-boards.greenhouse.io/anthropic/jobs/4567',
    style: { width: '100%' },
    value: params.get('url') || '',
  });
  const runBtn = c('button', { className: 'btn btn-primary', style: { whiteSpace: 'nowrap' } },
    '▶ ' + t('auto.run', 'Run full pipeline'));
  // v1.55.4 — UX-6: the docs promise auto-pipeline ≈ 1–2 min. Show
  // that ETA next to Run so the one-click promise is honest about
  // duration before the user commits (Feedback & system status).
  const etaHint = c('span', {
    className: 'auto-eta',
    title: t('auto.etaTitle', 'Typical end-to-end time per career-ops.org/docs'),
  }, '⏱ ' + t('auto.eta', '~1–2 min'));

  // Polite live region — screen readers announce each transition.
  const liveRegion = c('div', {
    'aria-live': 'polite', role: 'status',
    style: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' },
  });

  const stepperEl = c('ol', {
    className: 'auto-stepper',
    // v1.55.1 — F-V55-E / UX-1: visible on mount (was display:none) so
    // the documented 5-stage pipeline outline is discoverable BEFORE
    // the user clicks Run, not just after the first SSE event.
    'aria-label': t('auto.stepperAria', 'Auto-pipeline stages'),
    style: { listStyle: 'none', padding: 0, margin: '20px 0 0' },
  });
  const resultEl = c('div', { style: { display: 'none', marginTop: '20px' } });

  function renderStepper() {
    stepperEl.innerHTML = '';
    STEPS.forEach((step, i) => {
      const s = stepState[i];
      const icon = s.status === 'running' ? '◐'
        : s.status === 'done' ? '✓'
        : s.status === 'failed' ? '✗' : '○';
      const color = s.status === 'failed' ? 'var(--error, #c93030)'
        : s.status === 'done' ? 'var(--ok, #2e8b3e)' : 'inherit';
      const li = c('li', {
        style: {
          display: 'flex', gap: '12px', alignItems: 'baseline',
          padding: '10px 0', borderBottom: '1px solid var(--slate)',
          opacity: s.status === 'pending' ? 0.5 : 1,
        },
      }, [
        c('span', { style: { fontFamily: 'monospace', fontWeight: 600, color, minWidth: '1.5em' } }, icon),
        c('span', { style: { fontFamily: 'monospace', color: 'var(--foggy)', minWidth: '2.5em' } }, `${i + 1}/${STEPS.length}`),
        c('span', { style: { flex: '1' } }, t(step.i18nKey, step.label)),
        c('span', { style: { color: 'var(--foggy)', fontSize: '13px' } }, s.detail || ''),
      ]);
      if (s.status === 'running') li.setAttribute('aria-current', 'step');
      stepperEl.appendChild(li);
    });
  }

  // v1.55.1 — F-V55-E / UX-1 (S-4 reopened): render the 5 pending
  // steps on mount so the documented pipeline outline (validate →
  // fetch → evaluate → save report → add tracker) is visible BEFORE
  // the user clicks Run, not only after the first SSE event.
  renderStepper();

  function setStep(i, status, detail) {
    if (i == null || i < 0 || i >= STEPS.length) return;
    stepState[i].status = status;
    if (detail !== undefined) stepState[i].detail = detail;
    renderStepper();
    liveRegion.textContent =
      `${t('auto.stepWord', 'Step')} ${i + 1}/${STEPS.length}: ` +
      `${t(STEPS[i].i18nKey, STEPS[i].label)} — ${status}` +
      (detail ? ` (${detail})` : '');
  }

  function showResult(data) {
    resultEl.innerHTML = '';
    resultEl.style.display = '';
    if (data && data.mode === 'manual') {
      const ta = c('textarea', {
        className: 'textarea', rows: 12, readOnly: true,
        style: { width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: '13px' },
      });
      ta.value = data.prompt || '';
      resultEl.appendChild(c('div', { className: 'card' }, [
        c('h2', { className: 'section-title' }, t('auto.manualTitle', 'Manual mode — no API key')),
        c('p', { style: { color: 'var(--foggy)', fontSize: '14px' } },
          t('auto.manualHint', 'No live LLM call was made. Copy this prompt into Claude Code / Anthropic / Gemini.')),
        ta,
        c('button', {
          className: 'btn btn-primary mt-3',
          // WS2 #18 — execCommand('copy') is deprecated and silently
          // no-ops in some browsers (user thinks it copied). Prefer the
          // async Clipboard API; fall back to execCommand; toast on
          // genuine failure instead of a false "Copied".
          onClick: async () => {
            const ok = await (navigator.clipboard
              ? navigator.clipboard.writeText(ta.value).then(() => true, () => false)
              : Promise.resolve(false));
            if (ok) { UI.toast(t('auto.copied', 'Copied'), 'success'); return; }
            ta.select();
            const legacy = document.execCommand && document.execCommand('copy');
            UI.toast(legacy ? t('auto.copied', 'Copied')
              : t('auto.copyFail', 'Copy failed — select the text and copy manually.'),
              legacy ? 'success' : 'error');
          },
        }, '⧉ ' + t('auto.copyPrompt', 'Copy prompt')),
      ]));
      return;
    }
    const links = [];
    if (data && data.slug) {
      links.push(c('a', { className: 'btn btn-primary', href: '#/reports/' + data.slug },
        t('auto.viewReport', 'View report') + (data.score != null ? ` · ${data.score}/5` : '')));
    }
    links.push(c('a', { className: 'btn btn-ghost', href: '#/tracker' },
      t('auto.viewTracker', 'Open tracker')));
    resultEl.appendChild(c('div', { className: 'card' }, [
      c('h2', { className: 'section-title' }, '✓ ' + t('auto.doneTitle', 'Pipeline complete')),
      c('p', { style: { color: 'var(--foggy)', fontSize: '14px' } }, [
        data && data.company ? `${data.company}` : '',
        data && data.role ? ` — ${data.role}` : '',
        data && data.legitimacy ? ` · ${t('auto.legitimacy', 'Legitimacy')}: ${data.legitimacy}` : '',
      ].join('')),
      c('div', { className: 'flex gap-3 mt-3', style: { flexWrap: 'wrap' } }, links),
    ]));
  }

  let running = false;
  async function run() {
    const url = urlInput.value.trim();
    if (running) return;
    if (!url) { UI.toast(t('auto.urlRequired', 'Paste a job URL first'), 'error'); urlInput.focus(); return; }
    running = true;
    // WS2 #13 — a disabled button with the same label gave no pending
    // feedback for the multi-second pipeline. Swap to a busy state.
    runBtn.disabled = true; urlInput.disabled = true;
    runBtn.classList.add('is-loading');
    runBtn.setAttribute('aria-busy', 'true');
    runBtn.textContent = '⏳ ' + t('auto.running', 'Running…');
    stepState.forEach((s) => { s.status = 'pending'; s.detail = ''; });
    stepperEl.style.display = '';
    resultEl.style.display = 'none';
    renderStepper();

    try {
      const lang = (I18n && I18n.getLang && I18n.getLang()) || 'en';
      const resp = await fetch('/api/auto-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lang }),
      });
      if (!resp.ok || !resp.body) {
        // WS2 #14 — was a bare "HTTP 500" on the step with no toast and
        // an empty live-region. Surface an actionable message both ways.
        const msg = t('auto.httpFail', 'Server error (HTTP {n}). Check the server is running, then retry.')
          .replace('{n}', String(resp.status));
        setStep(0, 'failed', msg);
        UI.toast(msg, 'error');
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const p of parts) {
          const evMatch = p.match(/^event:\s*([\w-]+)/m);
          const dataLines = [];
          for (const line of p.split('\n')) {
            const m = line.match(/^data:\s?(.*)$/);
            if (m) dataLines.push(m[1]);
          }
          if (!evMatch || !dataLines.length) continue;
          let data; try { data = JSON.parse(dataLines.join('\n')); } catch { data = {}; }
          if (evMatch[1] === 'step') setStep(data.i, data.status, data.detail || '');
          else if (evMatch[1] === 'done') showResult(data);
          else if (evMatch[1] === 'error') {
            const idx = STEPS.findIndex((s) => s.key === data.step);
            if (idx >= 0) setStep(idx, 'failed', data.message || 'error');
            UI.toast(data.message || t('auto.failed', 'Pipeline failed'), 'error');
          }
        }
      }
    } catch (e) {
      UI.toast((e && e.message) || t('auto.failed', 'Pipeline failed'), 'error');
    } finally {
      running = false;
      runBtn.disabled = false; urlInput.disabled = false;
      runBtn.classList.remove('is-loading');
      runBtn.removeAttribute('aria-busy');
      runBtn.textContent = '▶ ' + t('auto.run', 'Run full pipeline');
    }
  }

  runBtn.addEventListener('click', run);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  const root = c('div', null, [
    // U-2 (v1.58.21) — split the `✨` decoration out of the H1 text. At
    // 1280-1600 px widths the leading emoji + 'Auto-pipeline a URL' /
    // its translations wrapped to a second line. Move the emoji to a
    // sibling `<span class="page-icon" aria-hidden="true">` so the H1
    // can flow on its own grid column and the emoji never participates
    // in line-wrap. The i18n value drops the leading emoji + space.
    c('header', { className: 'page-header page-header--icon' }, [
      c('span', { className: 'page-icon', 'aria-hidden': 'true' }, '✨'),
      HelpHint.title(t('auto.title', 'Auto-pipeline a URL'), 'help.hint.auto'),
      c('p', { className: 'page-subtitle' },
        t('auto.subtitle', 'Paste one job URL. One click runs the whole flow — validate, fetch, evaluate against your CV, save the report, add it to the tracker.')),
    ]),
    c('div', { className: 'card' }, [
      c('label', { htmlFor: 'auto-url', style: { fontWeight: 600, fontSize: '14px' } },
        t('auto.urlLabel', 'Job posting URL')),
      c('div', { className: 'flex gap-3 mt-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
        c('div', { style: { flex: '1 1 320px' } }, urlInput),
        runBtn,
        etaHint,
      ]),
      // v1.56.0 — UX-10: honest cost ballpark before the live run.
      UI.providerCostHint(t),
      liveRegion,
      stepperEl,
    ]),
    resultEl,
  ]);

  // Deep-linked with ?url=… and a key present → auto-start once.
  if (params.get('url') && params.get('go') === '1') setTimeout(run, 0);
  return root;
});

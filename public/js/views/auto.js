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
 * SSE transport mirrors public/js/lib/auto-pipeline.js — a POST + manual
 * stream drain, shipped as the shared API.postStream() (api.js, CAR-93: the
 * raw in-view fetch lost the API layer's lang header and error shaping, and
 * had no AbortController). The multi-line `data:` join is the v1.22.0
 * (L-4) correct behaviour.
 */
Router.register('auto', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');

  // CAR-124 — the sample URL the page itself advertises (same constant feeds
  // the placeholder and the "try an example" affordance). A deliberately
  // NON-real host (example.com is IETF-reserved) — review f3: a real company's
  // ATS with an invented id would fabricate a posting and burn a paid run.
  // Filling the input is all the affordance does — and only into an EMPTY
  // field (review f4: never overwrite the user's own URL, incl. ?url= deep
  // links); the run still waits for the explicit Run click (CAR-20).
  const EXAMPLE_URL = 'https://jobs.example.com/senior-backend-engineer/4567';

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
    placeholder: EXAMPLE_URL,
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

  // CAR-124 — first-run example + the practical notes the ticket asks for:
  // a "try this example" affordance that pre-fills an EMPTY URL input (no
  // run, never overwriting the user's own paste — review f4), the per-URL
  // timer restated next to the actions, and the pointer to App settings for
  // providers/cadence. Hidden once a run starts; skipped entirely for a
  // `?url=` deep link, where the field arrives filled and the example is
  // noise.
  // // CAR-124 i18n: the v2empty.* strings live in all 19 locale dicts
  // (the ×19 fan-out landed; the CAR124_PENDING allowlist is gone).
  const exampleBtn = c('button', {
    className: 'btn btn-ghost btn-sm', type: 'button',
    title: t('v2empty.auto.tryExampleTitle', 'Fill the field with an example URL — nothing runs until you press Run'),
    onClick: () => {
      if (urlInput.value.trim()) return; // review f4 — a filled field is never overwritten
      urlInput.value = EXAMPLE_URL;
      urlInput.focus();
    },
  }, t('v2empty.auto.tryExample', 'Try an example URL'));
  const emptyEl = params.get('url') // review f4 — deep links pre-fill the field; the example block is noise there
    ? c('div')
    : c('div', { className: 'v2-empty-example' }, [
      c('span', { className: 'v2-empty-example__tag' }, t('v2empty.exampleTag', 'Example')),
      c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
        c('code', { style: { fontSize: '12.5px', overflowWrap: 'anywhere' } }, EXAMPLE_URL),
        exampleBtn,
      ]),
      c('p', { style: { color: 'var(--foggy)', fontSize: '12.5px', margin: '10px 0 0' } },
        t('v2empty.auto.hint', 'One URL takes about {eta}. Nothing runs until you press Run — the button above only fills an empty field.')
          .replace('{eta}', t('auto.eta', '~1–2 min'))),
      c('p', { style: { color: 'var(--foggy)', fontSize: '12.5px', margin: '4px 0 0' } }, [
        t('v2empty.auto.configHint', 'Providers and the cadence timer are configured in '),
        c('a', { href: '#/config' }, t('nav.config', 'App settings')),
        '.',
      ]),
    ]);

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
    emptyEl.style.display = 'none'; // CAR-124 — the example yields to the real run
    resultEl.style.display = 'none';
    renderStepper();

    // CAR-93 — the drain used to be a raw `fetch` in the view (API-layer
    // invariant breach) with no AbortController: navigating away kept the
    // stream draining, so step/toast writes landed on whatever view was
    // showing next ("Pipeline failed" on #/tracker). And a stream that
    // ended WITHOUT a done/error frame reset the button silently — a
    // failed PAID run looked idle. Route through API.postStream, abort on
    // navigation, and toast whenever the stream ends non-terminally.
    let terminal = false;
    const ctrl = new AbortController();
    const onNavAway = () => ctrl.abort();
    window.addEventListener('hashchange', onNavAway, { once: true });
    try {
      const lang = (I18n && I18n.getLang && I18n.getLang()) || 'en';
      await API.postStream('/api/auto-pipeline', { url, lang }, (ev, data) => {
        if (ev === 'step') setStep(data.i, data.status, data.detail || '');
        else if (ev === 'done') { terminal = true; showResult(data); }
        else if (ev === 'error') {
          terminal = true;
          const idx = STEPS.findIndex((s) => s.key === data.step);
          if (idx >= 0) {
            setStep(idx, 'failed', data.message || 'error');
            UI.toast(data.message || t('auto.failed', 'Pipeline failed'), 'error');
          } else if (data.step === 0) {
            // Transport-level failure (HTTP error / network): flag the
            // first stage with the localized sentence, as before.
            const msg = data.status
              ? t('auto.httpFail', 'Server error (HTTP {n}). Check the server is running, then retry.').replace('{n}', String(data.status))
              : (data.message || t('auto.failed', 'Pipeline failed'));
            setStep(0, 'failed', msg);
            UI.toast(msg, 'error');
          } else {
            UI.toast(data.message || t('auto.failed', 'Pipeline failed'), 'error');
          }
        }
      }, ctrl.signal);
      if (!terminal && !ctrl.signal.aborted) {
        const msg = t('auto.failed', 'Pipeline failed');
        setStep(0, 'failed', msg);
        UI.toast(msg, 'error');
      }
    } catch (e) {
      UI.toast((e && e.message) || t('auto.failed', 'Pipeline failed'), 'error');
    } finally {
      window.removeEventListener('hashchange', onNavAway);
      running = false;
      runBtn.disabled = false; urlInput.disabled = false;
      runBtn.classList.remove('is-loading');
      runBtn.removeAttribute('aria-busy');
      runBtn.textContent = '▶ ' + t('auto.run', 'Run full pipeline');
    }
  }

  runBtn.addEventListener('click', run);
  urlInput.addEventListener('keydown', (e) => {
    // CAR-21 (v1.243.0) — IME composition Enter is text input, not a send;
    // firing run() here started a paid pipeline mid-composition.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') run();
  });

  const root = c('div', null, [
    // CAR-51 #2 (v1.247.0) — the sparkle decoration is gone: this was the app's
    // only decorated title, breaking the shared left-edge rhythm of the 31
    // other page titles. (U-2 v1.58.21 had already moved the glyph out of the
    // H1 text; the sibling span ends here for good.) The i18n values never
    // carried the emoji.
    // CAR-51 #1 (v1.247.0) — the ⏱ ETA + cost hint moved into ONE meta line
    // under the view title (UI.pageMeta), matching #/evaluate, #/deep and
    // the mode pages; the Run row keeps just the controls.
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('auto.title', 'Auto-pipeline a URL'), 'help.hint.auto'),
        c('p', { className: 'page-subtitle' },
          t('auto.subtitle', 'Paste one job URL. One click runs the whole flow — validate, fetch, evaluate against your CV, save the report, add it to the tracker.')),
        UI.pageMeta(t, etaHint, UI.providerCostHint(t)),
      ]),
    ]),
    c('div', { className: 'card' }, [
      c('label', { htmlFor: 'auto-url', style: { fontWeight: 600, fontSize: '14px' } },
        t('auto.urlLabel', 'Job posting URL')),
      c('div', { className: 'flex gap-3 mt-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
        c('div', { style: { flex: '1 1 320px' } }, urlInput),
        runBtn,
      ]),
      liveRegion,
      stepperEl,
      emptyEl,
    ]),
    resultEl,
  ]);

  // CAR-20 (v1.243.0) — deep links (`#/auto?url=…&go=1`) used to
  // AUTO-START the pipeline from the query string: a paid LLM run
  // (report + tracker write) with zero explicit consent, reachable by a
  // single mis-click on any crafted link. The URL stays pre-filled; the
  // visible Run button is now the only way to start. (docs/help/*/auto
  // described the auto-start — flagged for the docs hand-off.)
  return root;
});

/* global API, UI, I18n */
/**
 * G-007 (v1.15.0) — Auto-pipeline 1-click flow.
 *
 * Implements the canonical career-ops.org promise: paste a job URL,
 * get a full report + PDF + tracker row in 1–2 minutes WITHOUT
 * navigating across 3 pages. The orchestrator chains five existing
 * endpoints and renders a step-by-step modal timeline:
 *
 *   1. validate URL                 → client-side regex
 *   2. fetch JD                     → GET /api/pipeline/preview
 *   3. evaluate against CV          → POST /api/evaluate { jd, save: true }
 *   4. generate PDF                 → POST /api/stream/pdf/inline (SSE)
 *   5. add tracker row              → POST /api/tracker
 *
 * v1.15.0 limitations (documented as v1.16+ follow-ups):
 *   - Company / role are heuristically extracted from the JD title;
 *     for low-confidence matches the modal lets the user override
 *     before step 5.
 *   - No POST /api/reports primitive yet, so the report markdown
 *     is shown inline in the modal but NOT persisted to parent
 *     reports/. The PDF + tracker row are the durable artifacts.
 */
(function () {
  if (!window.UI || !window.API) {
    console.warn('[auto-pipeline] UI/API not loaded yet — deferring');
    return;
  }

  const STEPS = [
    { key: 'validate', i18nKey: 'auto.step.validate', label: 'Validating URL' },
    { key: 'fetch',    i18nKey: 'auto.step.fetch',    label: 'Fetching job description' },
    { key: 'evaluate', i18nKey: 'auto.step.evaluate', label: 'Evaluating against your CV' },
    { key: 'pdf',      i18nKey: 'auto.step.pdf',      label: 'Generating tailored PDF' },
    { key: 'tracker',  i18nKey: 'auto.step.tracker',  label: 'Adding to tracker' },
  ];

  // v1.16.0 — heuristic company/role/score/legitimacy extraction moved
  // server-side (server/lib/routes/auto-pipeline.mjs). Client only
  // renders what the SSE `done` event reports.

  // CAR-94 (6) — module-scope single-flight + abort handles. They must
  // outlive one modal instance: closing the modal used to leave the paid
  // run streaming (handlers wrote into detached DOM), and reopening let a
  // SECOND paid run start while the first was still in flight. The abort
  // also stops the spend server-side (the route threads the client
  // disconnect into the provider call).
  // FULL-R5 (review 5) — the run promise itself lives at module scope:
  // closing modal A aborts its run, but the flag cleared only in the async
  // finally, so the reopen's autoStart setTimeout(0) hit a silent return
  // and left the fresh modal inert. A start landing on an in-flight run
  // now awaits its settlement instead of silently dropping.
  // FULL-R5 review r2 (finding 1 [high]) — the queued start gets its OWN
  // module-scope AbortController BEFORE waiting, and the close hook aborts
  // it too: a queued start whose modal closes must never wake into a fresh
  // PAID run (silent spend, report, tracker row — the CAR-94.6 refusal
  // reversed through the back door).
  let currentAbort = null;   // the in-flight run's controller
  let pendingAbort = null;   // the queued start's controller (at most one)
  let runPromise = null;

  function urlIsValid(url) {
    if (typeof url !== 'string') return false;
    if (!/^https?:\/\//i.test(url)) return false;
    try {
      const u = new URL(url);
      // Reject loopback / private / javascript URLs (defense in depth;
      // server's isValidJobUrl is the real gate).
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      if (/^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(u.hostname)) return false;
      return true;
    } catch { return false; }
  }

  // v1.16.0 — open() accepts { prefillUrl, autoStart } so Cmd+K can
  // hand the user straight into the running pipeline. Server-side SSE
  // endpoint (POST /api/auto-pipeline) is the new transport — replaces
  // the v1.15 client-side chained-fetch orchestrator. The server emits
  // real-time progress during the slow Anthropic call (was a generic
  // 60s spinner in v1.15) and persists the report markdown to parent
  // reports/<slug>.md so the PDF source isn't lost on browser refresh.
  function open(opts) {
    opts = opts || {};
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);

    let state = { url: '', score: null, legitimacy: '', company: '', role: '', slug: '', reportPath: '', trackerNum: '' };
    const stepState = STEPS.map(() => ({ status: 'pending', detail: '', startedAt: null, finishedAt: null }));
    // FULL-R5 review r2 (finding 1) — whether THIS modal is still the one
    // the user sees. Opening another modal replaces this one (UI.modal
    // fires the previous onClose); a queued start whose modal is gone must
    // never run, and one that is superseded while still visible must say
    // so (finding 2) instead of sitting inert.
    let modalOpen = true;

    const urlInput = c('input', {
      className: 'input',
      placeholder: 'https://job-boards.greenhouse.io/anthropic/jobs/4567',
      'aria-label': t('auto.urlLabel', 'Job posting URL'),
      style: { width: '100%' },
      value: opts.prefillUrl || '',
    });

    const startBtn = c('button', {
      className: 'btn btn-primary',
      onClick: () => start(urlInput.value.trim()),
    }, '▶ ' + t('auto.run', 'Run auto-pipeline'));

    const timelineRoot = c('div', { style: { display: 'none', marginTop: '20px' } });
    const resultRoot   = c('div', { style: { display: 'none', marginTop: '20px' } });

    function renderTimeline() {
      timelineRoot.innerHTML = '';
      STEPS.forEach((step, i) => {
        const s = stepState[i];
        let icon = '[ ]';
        if (s.status === 'running') icon = '[…]';
        else if (s.status === 'done') icon = '[✓]';
        else if (s.status === 'failed') icon = '[✗]';
        const row = c('div', {
          style: {
            display: 'flex', gap: '12px', padding: '8px 0',
            borderBottom: '1px solid var(--slate)',
            opacity: s.status === 'pending' ? 0.5 : 1,
          },
        }, [
          c('span', { style: { fontFamily: 'monospace', fontWeight: 600, color: s.status === 'failed' ? 'var(--error, #c93030)' : s.status === 'done' ? 'var(--ok, #2e8b3e)' : 'inherit' } }, icon),
          c('span', { style: { flex: '0 0 auto', minWidth: '32px', fontFamily: 'monospace' } }, `${i + 1}/${STEPS.length}`),
          c('span', { style: { flex: '1' } }, t(step.i18nKey, step.label)),
          c('span', { style: { color: 'var(--foggy)', fontSize: '13px' } }, s.detail || ''),
        ]);
        timelineRoot.appendChild(row);
      });
    }

    function setStep(i, status, detail) {
      stepState[i].status = status;
      if (detail !== undefined) stepState[i].detail = detail;
      if (status === 'running') stepState[i].startedAt = Date.now();
      if (status === 'done' || status === 'failed') stepState[i].finishedAt = Date.now();
      renderTimeline();
    }

    // v1.16.0 — orchestration runs server-side via POST /api/auto-pipeline.
    // FULL-R5 (review 5) — the drain is the shared API.postStream transport
    // (Accept-Language header, one well-formed error contract, multi-line
    // `data:` join, AbortSignal), replacing this file's private SSE-parser
    // copy, and a start landing on an in-flight run WAITS for its
    // settlement instead of silently returning (the reopen race above).
    async function start(url) {
      if (runPromise) {
        // FULL-R5 review r2 (finding 1) — the queued start carries its OWN
        // AbortController BEFORE waiting, registered at module scope so the
        // close hook can cancel it. At most one queued start; a newer one
        // supersedes (aborts) the older waiter.
        if (pendingAbort) { try { pendingAbort.abort(); } catch { /* already aborted */ } }
        const queued = new AbortController();
        pendingAbort = queued;
        while (runPromise) {
          try { await runPromise; } catch { /* the owning start renders its own error */ }
        }
        if (pendingAbort === queued) pendingAbort = null;
        // FULL-R5 review r2 (finding 1) — a cancelled waiter never runs:
        // neither a closed modal (silent spend with nothing on screen) nor
        // a disconnected modal body may reach the paid endpoint.
        const modalConnected = modalBodyEl.isConnected !== false;
        if (queued.signal.aborted || !modalOpen || !modalConnected) {
          // FULL-R5 review r2 (finding 2) — superseded while still visible:
          // say so explicitly instead of stranding an inert modal.
          if (modalOpen && modalConnected) {
            timelineRoot.style.display = '';
            resultRoot.style.display = 'none';
            setStep(0, 'failed', t('auto.superseded', 'Superseded — a newer run was requested'));
          }
          return;
        }
      }
      currentAbort = new AbortController();
      const abort = currentAbort;
      const p = run(url, abort);
      runPromise = p;
      try {
        await p;
      } finally {
        if (runPromise === p) runPromise = null;
        if (currentAbort === abort) currentAbort = null;
      }
    }

    // One run against its own AbortController. Per-modal DOM (timeline,
    // buttons) is touched here; the single-flight bookkeeping stays in
    // start().
    async function run(url, abort) {
      timelineRoot.style.display = '';
      resultRoot.style.display = 'none';
      startBtn.disabled = true;
      urlInput.disabled = true;
      state.url = url;
      // Reset step UI
      stepState.forEach((s) => { s.status = 'pending'; s.detail = ''; });
      renderTimeline();

      if (!urlIsValid(url)) {
        setStep(0, 'running');
        setStep(0, 'failed', t('auto.invalidUrl', 'invalid URL'));
        startBtn.disabled = false; urlInput.disabled = false;
        return;
      }

      let terminal = false;
      const onEvent = (ev, data) => {
        // FULL-R5 review r2 (finding 6) — frames already buffered when the
        // modal closed must not paint into the detached DOM.
        if (abort.signal.aborted) return;
        switch (ev) {
          case 'start':
            // already rendered the empty timeline; nothing to do.
            break;
          case 'step':
            setStep(data.i, data.status, data.detail || '');
            break;
          case 'done':
            state.warnings = Array.isArray(data.warnings) ? data.warnings : [];
            state.score = data.score;
            state.legitimacy = data.legitimacy || '';
            state.company = data.company || '';
            state.role = data.role || '';
            state.slug = data.slug || '';
            state.reportPath = data.reportPath || '';
            state.trackerNum = data.trackerNum || '';
            terminal = true;
            renderResult();
            break;
          case 'error':
            terminal = true;
            // FULL-R5 review r2 (finding 7) — a transport-level non-OK
            // response (postStream's { step: 0, status } shape) keeps the
            // pre-migration step-0 «HTTP nnn» rendering; a stream error
            // FRAME (step + message, no status) renders the failure card.
            if (data && typeof data.status === 'number') {
              setStep(data.step || 0, 'failed', 'HTTP ' + data.status);
              break;
            }
            renderError(data.step, data.message);
            break;
        }
      };
      try {
        // CAR-94 (6) — modal close aborts the run: the signal stops the
        // drain AND the server-side spend (the route threads the client
        // disconnect into the provider call).
        await API.postStream('/api/auto-pipeline', { url }, onEvent, abort.signal);
        // CAR-94 (6) — a stream that ends WITHOUT a done/error frame used to
        // leave the timeline on "running" forever with a disabled button and
        // no explanation. Any non-aborted end must land in a terminal state.
        // CAR-137 — say WHY the stream ended without a result, not just "Error".
        if (!terminal && !abort.signal.aborted) renderError('network', t('err.auto.noTerminal', 'The pipeline stream ended without a result — the server may have restarted mid-run. Run the URL again.'));
      } catch (e) {
        // CAR-94 (6) — a deliberate modal-close abort paints nothing: the
        // modal is gone and a fresh one must open clean.
        if (!abort.signal.aborted) renderError('network', e.message || 'network error');
      } finally {
        startBtn.disabled = false; urlInput.disabled = false;
      }
    }

    function renderError(step, message) {
      resultRoot.innerHTML = '';
      resultRoot.style.display = '';
      resultRoot.appendChild(c('div', { className: 'card mt-3', style: { borderInlineStart: '3px solid var(--error, #c93030)' } }, [
        c('strong', null, '⚠ ' + t('auto.failed', 'Auto-pipeline failed') + ` (${step})`),
        c('p', { style: { margin: '8px 0 0', fontSize: '14px' } }, message),
      ]));
    }

    function renderResult() {
      resultRoot.innerHTML = '';
      resultRoot.style.display = '';
      resultRoot.appendChild(c('div', { className: 'card mt-3' }, [
        c('h3', null, '✨ ' + t('auto.done', 'Auto-pipeline complete')),
        c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', marginTop: '8px' } }, [
          state.company ? c('span', { className: 'tag' }, state.company) : null,
          state.role ? c('span', { className: 'tag' }, state.role) : null,
          state.score != null ? c('span', { className: 'tag' }, t('auto.score', 'Score') + ' ' + state.score) : null,
          state.legitimacy ? c('span', { className: 'tag' }, t('auto.legit', 'Legit') + ' ' + state.legitimacy) : null,
          state.trackerNum ? c('span', { className: 'tag' }, 'tracker #' + state.trackerNum) : null,
        ].filter(Boolean)),
        // warnings-surface (views-2 hand-off) — the server's done frame may
        // carry warnings (truncation, language, date corrections); the modal
        // renders the same band the page views do instead of dropping them.
        ...(state.warnings && state.warnings.length ? [c('div', { className: 'badge badge-warn mt-3', role: 'status', style: { display: 'block', textAlign: 'start' } }, [
          c('strong', null, '⚠ ' + t('llm.truncatedNotice', 'Model output may be truncated — re-run if the report looks cut off')),
          ...(state.warnings.length > 1 || !/^model output/i.test(state.warnings[0] || '')
            ? [c('div', { style: { marginTop: '4px', fontSize: '13px' } }, state.warnings.join(' · '))]
            : []),
        ])] : []),
        // v1.16.0 — server persists the report to parent reports/, so we
        // link straight to the canonical viewer instead of dumping the
        // markdown inline. PDF generation stays a one-click on the report
        // page (📄 button on /#/reports/<slug>).
        c('div', { className: 'flex gap-3 mt-3' }, [
          state.slug ? c('a', { href: '#/reports/' + state.slug, className: 'btn btn-primary btn-sm' },
            '📄 ' + t('auto.openReport', 'Open report')) : null,
          state.trackerNum ? c('a', { href: '#/tracker', className: 'btn btn-ghost btn-sm' },
            '≡ ' + t('auto.openTracker', 'Open tracker')) : null,
        ].filter(Boolean)),
      ]));
    }

    // CAR-94 (6) — the close hook (Esc / backdrop / ×) aborts the in-flight
    // run: the SSE fetch carries currentAbort's signal, so the request — and
    // the server-side spend — stop with the modal.
    // FULL-R5 review r2 (finding 1) — it aborts a QUEUED start's controller
    // too (pendingAbort): a queued run may not outlive its modal as a
    // silent paid spend. A start that lands while the abort unwinds still
    // awaits settlement (module-scope runPromise) — a FRESH, visible modal
    // opening after this close runs normally.
    const modalBodyEl = c('div', null, [
      c('p', { style: { color: 'var(--foggy)' } },
        t('auto.intro', "Paste a job URL — we'll fetch the JD, evaluate it against your CV, save a report, and add a row to your tracker.")),
      c('div', { className: 'flex gap-3 mt-3' }, [urlInput, startBtn]),
      timelineRoot,
      resultRoot,
    ]);
    UI.modal(t('auto.title', '✨ Auto-pipeline a URL'), modalBodyEl, () => {
      modalOpen = false;
      for (const ctl of [currentAbort, pendingAbort]) {
        if (ctl) {
          try { ctl.abort(); } catch { /* already closed */ }
        }
      }
    });

    // v1.16.0 — Cmd+K → URL → Enter sets autoStart so the modal opens
    // already running, no extra click. Defer to next tick so the modal
    // is in the DOM before we kick off the SSE.
    if (opts.autoStart && opts.prefillUrl) {
      setTimeout(() => start(opts.prefillUrl), 0);
    }
  }

  window.AutoPipeline = { open };
})();

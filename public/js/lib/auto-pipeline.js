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

    let modalRef = null;
    let state = { url: '', score: null, legitimacy: '', company: '', role: '', slug: '', reportPath: '', trackerNum: '' };
    const stepState = STEPS.map(() => ({ status: 'pending', detail: '', startedAt: null, finishedAt: null }));

    const urlInput = c('input', {
      className: 'input',
      placeholder: 'https://job-boards.greenhouse.io/anthropic/jobs/4567',
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

    // v1.16.0 — orchestration now runs server-side via POST /api/auto-pipeline
    // SSE. Client only drains the event stream and updates UI state.
    async function start(url) {
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

      try {
        const lang = (I18n && I18n.getLang && I18n.getLang()) || 'en';
        const resp = await fetch('/api/auto-pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, lang }),
        });
        if (!resp.ok || !resp.body) {
          setStep(0, 'failed', 'HTTP ' + resp.status);
          startBtn.disabled = false; urlInput.disabled = false;
          return;
        }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let terminal = false;
        // One SSE frame (block between blank lines) → state update. Extracted
        // so the end-of-stream flush below can process the final frame too.
        const handleFrame = (p) => {
          const evMatch = p.match(/^event:\s*([\w-]+)/m);
          // v1.22.0 (L-4) — per SSE spec, an event may carry multiple
          // `data:` lines; the consumer concatenates them with "\n".
          // Today the server sends single-line JSON, so the old
          // single-match worked — but it would silently drop the
          // 2nd+ line of any multi-line payload. Join all `data:`
          // lines for the event block before parsing.
          const dataLines = [];
          for (const line of p.split('\n')) {
            const m = line.match(/^data:\s?(.*)$/);
            if (m) dataLines.push(m[1]);
          }
          if (!evMatch || dataLines.length === 0) return;
          const dataRaw = dataLines.join('\n');
          let data; try { data = JSON.parse(dataRaw); } catch { data = {}; }
          switch (evMatch[1]) {
            case 'start':
              // already rendered the empty timeline; nothing to do.
              break;
            case 'step':
              setStep(data.i, data.status, data.detail || '');
              break;
            case 'done':
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
              renderError(data.step, data.message);
              break;
          }
        };
        while (!terminal) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n'); buf = parts.pop();
          for (const p of parts) handleFrame(p);
        }
        // Stream end: flush the decoder and the trailing buffer. A server
        // that writes the terminal frame without a trailing blank line (or
        // whose last chunk is split mid-JSON) used to leave that frame
        // unprocessed — the modal rendered NOTHING (no result, no error).
        buf += dec.decode();
        if (buf.trim()) handleFrame(buf);
      } catch (e) {
        renderError('network', e.message || 'network error');
      } finally {
        startBtn.disabled = false; urlInput.disabled = false;
      }
    }

    function renderError(step, message) {
      resultRoot.innerHTML = '';
      resultRoot.style.display = '';
      resultRoot.appendChild(c('div', { className: 'card mt-3', style: { borderLeft: '3px solid var(--error, #c93030)' } }, [
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

    modalRef = UI.modal(t('auto.title', '✨ Auto-pipeline a URL'), c('div', null, [
      c('p', { style: { color: 'var(--foggy)' } },
        t('auto.intro', "Paste a job URL — we'll fetch the JD, evaluate it against your CV, save a report, and add a row to your tracker.")),
      c('div', { className: 'flex gap-3 mt-3' }, [urlInput, startBtn]),
      timelineRoot,
      resultRoot,
    ]));

    // v1.16.0 — Cmd+K → URL → Enter sets autoStart so the modal opens
    // already running, no extra click. Defer to next tick so the modal
    // is in the DOM before we kick off the SSE.
    if (opts.autoStart && opts.prefillUrl) {
      setTimeout(() => start(opts.prefillUrl), 0);
    }
  }

  window.AutoPipeline = { open };
})();

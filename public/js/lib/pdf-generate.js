/* global window */
/**
 * Shared Generate-PDF helper used by #/cv, #/reports/:slug, #/evaluate,
 * #/deep, #/interview-prep. Streams events from the chosen SSE endpoint
 * into a modal log, snapshots the latest PDF in output/ before start,
 * and on `done` with code 0 triggers a browser download for the new file.
 *
 * Usage:
 *   PdfGenerate.run({ kind: 'report',  slug: 'q3-anthropic',  button: btn });
 *   PdfGenerate.run({ kind: 'deep',    name: 'anthropic-swe.md', button: btn });
 *   PdfGenerate.run({ kind: 'inline',  markdown: '...',       button: btn });
 *   PdfGenerate.run({ kind: 'cv',                              button: btn });
 *
 * All kinds end up at /api/stream/pdf/<kind>?... and then poll
 * /api/output/pdfs after `done` to detect the new file and trigger
 * <a download>. Behavior matches the v1.10.2 CV flow exactly.
 */
window.PdfGenerate = (function () {
  const t = (k, f) => (window.I18n && I18n.t ? I18n.t(k, f) : f);

  async function latestPdfName() {
    try {
      const r = await window.API.get('/api/output/pdfs');
      const files = (r && r.files) || [];
      return files.length ? files[0].name : null;
    } catch { return null; }
  }

  function triggerDownload(name) {
    const a = document.createElement('a');
    a.href = '/api/output/pdfs/' + encodeURIComponent(name);
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildEndpoint(opts) {
    if (opts.kind === 'cv') return { url: '/api/stream/pdf', method: 'GET' };
    if (opts.kind === 'report') {
      const slug = encodeURIComponent(opts.slug || '');
      return { url: `/api/stream/pdf/report?slug=${slug}`, method: 'GET' };
    }
    if (opts.kind === 'deep') {
      const name = encodeURIComponent(opts.name || '');
      return { url: `/api/stream/pdf/deep?name=${name}`, method: 'GET' };
    }
    if (opts.kind === 'inline') {
      return {
        url: '/api/stream/pdf/inline',
        method: 'POST',
        body: { markdown: opts.markdown, title: opts.title, slug: opts.slug },
      };
    }
    throw new Error('PdfGenerate: unknown kind ' + opts.kind);
  }

  // FULL-M6 — the hand-rolled POST-SSE drain (private fetch + manual frame
  // splitting, the last of the four copied SSE parsers) is gone: the
  // inline kind rides the shared API.postStream transport (FULL-R5), which
  // adds the Accept-Language header, the lang body key and the one-
  // well-formed-{message} error contract every other POST-SSE consumer
  // gets. A stream that ends without a terminal frame stays the caller's
  // to detect (postStream resolves normally — the fail() below covers it).

  async function run(opts) {
    const btn = opts.button;
    const UI = window.UI;
    const API = window.API;
    if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
    UI.toast(t('cv.pdfRunning', 'Generating PDF…'));
    const before = await latestPdfName();
    const lines = [];
    const c = UI.el;
    const console_ = c('pre', { className: 'console', style: { maxHeight: '320px', overflow: 'auto' } }, '');
    UI.modal(t('cv.pdfTitle', 'Generate PDF'), console_);

    // Single terminal state (v1.243.0): whichever of done/error/silent
    // stream end arrives first settles the run — exactly one toast and the
    // Generate button re-enabled. Before, an `error` frame followed by the
    // server's closing `done` (the empty-markdown / missing-cv.md branches
    // send BOTH), or EventSource's reconnect onerror on the GET kinds,
    // fired two error toasts — and a stream that died without a terminal
    // frame left the button disabled forever.
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
    };
    const fail = (message, consoleLine) => {
      if (settled) return;
      lines.push(consoleLine || ('✗ ' + message));
      console_.textContent = lines.join('\n');
      console_.scrollTop = console_.scrollHeight;
      UI.toast(message || 'error', 'error');
      finish();
    };

    const onEvent = async (event, data) => {
      if (event === 'log' && data && data.line) {
        lines.push(data.line);
        console_.textContent = lines.join('\n');
        console_.scrollTop = console_.scrollHeight;
      } else if (event === 'done') {
        // `code: null` means the runner was killed by a signal (timeout
        // kill, OOM) — a FAILURE, not a success: the old `?? 0` treated it
        // as exit 0 and toasted "PDF generated" over a broken run.
        const code = (data && typeof data.code === 'number') ? data.code : null;
        if (code === 0) {
          if (settled) return;
          settled = true;
          lines.push('✓ done (exit 0)');
          console_.textContent = lines.join('\n');
          if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
          UI.toast(t('cv.pdfDone', 'PDF generated'), 'success');
          const after = await latestPdfName();
          if (after && after !== before) triggerDownload(after);
        } else {
          // Reuse the shared generic key + the technical detail (no new
          // UI string): "Error — exit 2" / "Error — signal".
          const detail = code === null ? 'signal' : 'exit ' + code;
          fail(t('common.error', 'Error') + ' — ' + detail, '✗ done (' + detail + ')');
        }
      } else if (event === 'error') {
        const message = (data && data.message) || 'error';
        const hint = /ERR_MODULE_NOT_FOUND|playwright/i.test(message)
          ? '\n\n' + t('cv.pdfNeedsPlaywright',
            'Playwright is missing. Run in the parent project:\n  cd "$CAREER_OPS_ROOT" && npm install && npx playwright install chromium')
          : '';
        fail(message + hint, '✗ ' + message + hint);
      }
    };

    const ep = buildEndpoint(opts);
    try {
      if (ep.method === 'GET') {
        API.stream(ep.url, onEvent);
      } else {
        await API.postStream(ep.url, ep.body, onEvent);
        // Stream ended without a terminal done/error frame (server crash,
        // proxy cut): that is a failure too — never leave Generate disabled.
        fail('connection lost');
      }
    } catch (e) {
      fail((e && e.message) || 'connection lost');
    }
  }

  return { run, latestPdfName };
})();

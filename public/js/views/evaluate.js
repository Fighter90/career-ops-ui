/* global Router, API, UI, I18n, HelpHint */
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
    out.innerHTML = `<div class="loading">${t('eval.evaluating')}</div>`;
    try {
      const r = await API.post('/api/evaluate', { jd, save: saveJd.checked });
      renderResult(r);
    } catch (e) {
      out.innerHTML = '';
      out.appendChild(c('div', { className: 'empty' }, t('common.error') + ': ' + ((e && e.message) || 'failed')));
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
          c('button', { className: 'btn btn-primary', onClick: () => {
            navigator.clipboard.writeText(r.prompt);
            UI.toast(t('eval.copied'), 'success');
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
      const cls = r.code === 0 ? 'badge-ok' : 'badge-bad';
      const engineName = r.mode === 'anthropic' ? 'Anthropic' : 'Gemini';
      // For live runs the markdown lives in either `markdown` (Anthropic)
      // or `stdout` (Gemini). PDF button uses whichever is non-empty.
      const liveMd = r.markdown || r.stdout || '';
      out.appendChild(c('div', { className: 'card' }, [
        c('div', { className: 'flex-between mb-3' }, [
          c('div', { className: 'flex gap-3' }, [
            c('div', { className: 'badge ' + cls },
              engineName + ' · ' + t('eval.exit', 'exit') + ' ' + (r.code ?? 0)),
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
        (r.markdown || r.stdout) && c('div', { className: 'md', html: UI.md(r.markdown || r.stdout) }),
        r.stderr && c('details', null, [
          c('summary', null, 'stderr'),
          c('pre', { className: 'console' }, r.stderr),
        ]),
      ]));
    }
  }

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('eval.title'), 'help.hint.evaluate'),
        c('p', { className: 'page-subtitle' }, t('eval.subtitle')),
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
      // v1.56.0 — UX-10: honest cost ballpark before the live eval.
      UI.providerCostHint(t),
      // UX-D-J (v1.58.42) — advisor ETA chip parity with #/auto (UX-6).
      c('span', { className: 'advisor-eta' }, '⏱ ' + t('advisor.eta', '~30s')),
    ]),

    c('div', { className: 'mt-5' }, out),
  ]);
});

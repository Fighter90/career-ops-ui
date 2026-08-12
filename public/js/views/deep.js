/* global Router, API, UI, I18n, HelpHint */
Router.register('deep', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const company = c('input', { className: 'input', id: 'deep-company', placeholder: t('deep.companyExample') });
  const role = c('input', { className: 'input', id: 'deep-role', placeholder: t('deep.roleExample') });
  const out = c('div');
  const archive = c('div');
  let liveAvailable = false;
  let liveEngine = '';

  // v1.157.0 — "Run live" availability follows the SERVER's active provider, i.e.
  // ANY of the seven (Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub
  // Models / Hermes) honoring the auto order + LLM_PROVIDER — not just Anthropic
  // or Gemini. `/api/status/providers` (via window.ProviderStatus) is the single
  // source of truth the server's dispatch cascade also uses.
  {
    const ls = await window.ProviderStatus.live();
    liveAvailable = ls.available;
    liveEngine = ls.engine;
  }

  // UX-A6 (v1.58.52, NEW-M4-r1) — extracted from the inline render
  // loop so every saved-card across every path uses the same structure.
  // The 2026-05-19 verification regression observed a card with no
  // structural children — the title+date were concatenated as a single
  // text node (`software-engineer-generalyesterday`). Whatever code
  // path produced that card is now routed through this single helper,
  // which always emits the same `<span class="saved-card__title">` +
  // `<time class="saved-card__date" datetime=…>` shape. Spacing comes
  // from the flex gap on `.saved-card` (M-4 / v1.58.11), so the
  // children are required for the visual to work.
  function renderSavedCard(f) {
    const iso = new Date(f.mtime).toISOString();
    return c('button', {
      className: 'btn btn-ghost btn-sm saved-card',
      title: new Date(f.mtime).toLocaleString(),
      'data-slug': f.name.replace(/\.md$/, ''),
      onClick: async (e) => {
        const r = await UI.withSpinner(e.currentTarget, () => API.get('/api/interview-prep/' + encodeURIComponent(f.name)));
        showResult(f.name, r.markdown, { saved: f.name });
      },
    }, [
      c('span', { className: 'saved-card__title' }, f.name.replace(/\.md$/, '')),
      c('time', { className: 'saved-card__date', datetime: iso }, formatRelative(f.mtime)),
    ]);
  }

  function renderArchive(files) {
    archive.innerHTML = '';
    if (!files.length) {
      archive.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '13px' } }, t('deep.archiveEmpty', 'No saved deep-research files yet.')));
      return;
    }
    archive.appendChild(c('h3', { className: 'section-title' }, t('deep.archiveTitle', 'Saved research')));
    const list = c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } });
    for (const f of files) {
      list.appendChild(renderSavedCard(f));
    }
    archive.appendChild(list);
  }

  async function loadArchive() {
    try {
      const r = await API.get('/api/interview-prep');
      renderArchive(r.files || []);
    } catch {
      renderArchive([]);
    }
  }

  // I-2 (v1.58.17) — relative-time labels were hardcoded English
  // (`today` / `1d ago` / `Nd ago`) on every locale. Use the platform
  // Intl.RelativeTimeFormat with `numeric: 'auto'` so today/yesterday
  // are localized to the active SPA language (сегодня/вчера, 今日/昨日,
  // etc.). For dates older than a week we fall back to a localized
  // absolute date via Intl.DateTimeFormat.
  function formatRelative(iso) {
    const d = new Date(iso);
    const days = Math.round((d.getTime() - Date.now()) / 86400000); // negative = past
    const locale = (window.I18n && I18n.getLang && I18n.getLang()) || 'en';
    try {
      if (Math.abs(days) < 7) {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
      }
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
    } catch {
      // Defensive fallback for environments without Intl (very old browsers).
      if (days >= 0) return 'today';
      if (days === -1) return '1d ago';
      if (days > -30) return Math.abs(days) + 'd ago';
      return d.toLocaleDateString();
    }
  }

  function showResult(title, markdown, opts = {}) {
    out.innerHTML = '';
    const card = c('div', { className: 'card' });
    const header = c('div', { className: 'flex-between mb-3' }, [
      c('strong', null, title),
      c('div', { className: 'flex gap-3' }, [
        // UX-D-L (v1.58.44) — explicit close affordance on the opened
        // brief. Pre-fix the only way to dismiss the inline brief body
        // was to scroll away or navigate; an X button matches the
        // modal-close pattern (api.js UI.modal × button) and lives on
        // the keyboard path (Tab to it, Enter / Space to dismiss).
        c('button', {
          className: 'btn btn-ghost btn-sm',
          'aria-label': t('deep.closeBrief', 'Close brief'),
          title: t('deep.closeBrief', 'Close brief'),
          onClick: () => { out.innerHTML = ''; },
        }, '×'),
        c('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => {
            navigator.clipboard.writeText(markdown);
            UI.toast(t('eval.copied', 'Copied'), 'success');
          },
        }, '📋 ' + t('eval.copy', 'Copy')),
        c('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => {
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (opts.saved || (title || 'deep') + '.md').replace(/[^\w.-]/g, '_');
            a.click();
            URL.revokeObjectURL(a.href);
          },
        }, '⬇ ' + t('deep.download', 'Download .md')),
        opts.saved ? c('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => {
            window.open('/api/interview-prep/' + encodeURIComponent(opts.saved), '_blank');
          },
        }, '↗ ' + t('deep.openTab', 'Open in tab')) : null,
        c('button', {
          className: 'btn btn-primary btn-sm',
          onClick: (e) => {
            if (opts.saved) {
              // We have a persisted interview-prep file — use the dedicated
              // endpoint so the PDF metadata reflects the real filename.
              window.PdfGenerate.run({ kind: 'deep', name: opts.saved, button: e.currentTarget });
            } else {
              window.PdfGenerate.run({
                kind: 'inline', markdown, title, slug: 'deep', button: e.currentTarget,
              });
            }
          },
        }, '📄 ' + t('common.generatePdf', 'Generate PDF')),
      ]),
    ]);
    // UX-A1 (v1.58.54) — defensive structure check: the canonical
    // Deep-research brief promised in career-ops.org/docs has 6 H2
    // sections (Company snapshot / Engineering culture / Recent news
    // / Glassdoor / Interview process / Negotiation leverage). The
    // root prompt-layer fix lives in the parent project (C-1, blocked)
    // — until it lands, when the saved brief is meta-narration with
    // fewer than 3 of these sections we surface a non-blocking warning
    // explaining what the brief should look like, with a link to the
    // canonical reference. Defensive only — never rewrites the brief.
    function looksLikeStructuredBrief(md) {
      const expected = ['Company snapshot', 'Engineering culture', 'Recent news',
                        'Glassdoor', 'Interview process', 'Negotiation leverage'];
      const found = expected.filter((h) => new RegExp('^##\\s+' + h, 'mi').test(md));
      return found.length >= 3;
    }
    const briefWarning = !looksLikeStructuredBrief(markdown || '')
      ? c('div', { className: 'brief-warning', role: 'status' }, [
          c('strong', null, t('deep.briefUnstructured.title',
            "This brief doesn't match the canonical 6-section structure")),
          c('p', null, t('deep.briefUnstructured.body',
            'Re-run with Run live, or check `modes/deep.md` in your parent project to enforce the final-form output.')),
          c('a', {
            href: 'https://career-ops.org/docs/introduction/guides/scan-job-portals',
            target: '_blank', rel: 'noopener noreferrer',
          }, t('deep.docsLink', 'Read the deep-research reference')),
        ])
      : null;
    const body = c('div', { className: 'card md', html: UI.md(markdown || '') });
    if (briefWarning) card.appendChild(briefWarning);
    card.append(header, body);
    out.appendChild(card);
  }

  function showPrompt(prompt, message) {
    out.innerHTML = '';
    out.appendChild(c('div', { className: 'card' }, [
      c('p', { style: { color: 'var(--foggy)' } }, message || ''),
      c('pre', { className: 'console' }, prompt),
      c('div', { className: 'flex gap-3 mt-3' }, [
        c('button', { className: 'btn btn-primary', onClick: () => {
          navigator.clipboard.writeText(prompt);
          UI.toast(t('eval.copied', 'Copied'), 'success');
        }}, '📋 ' + t('eval.copy', 'Copy prompt')),
        // Re-submits the same form with run:true so users who hit
        // "Generate prompt" first can still get the LLM result inline
        // without retyping. Surfaces a clear error toast when no API
        // key is set.
        c('button', {
          className: 'btn btn-ghost',
          onClick: async (e) => {
            if (!liveAvailable) {
              UI.toast(t('deep.needKey', 'Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first'), 'error');
              return;
            }
            await runLive(e.currentTarget);
          },
        }, '⚡ ' + t('deep.showResult', 'Show result')),
      ]),
      // v1.56.0 — UX-10: honest cost ballpark before the live run.
      UI.providerCostHint(t),
      // UX-D-J (v1.58.42) — advisor ETA chip parity with #/auto (UX-6).
      c('span', { className: 'advisor-eta' }, '⏱ ' + t('advisor.eta', '~30s')),
    ]));
  }

  async function runLive(btn) {
    if (!company.value.trim()) return UI.toast(t('deep.enterCompany'), 'error');
    out.innerHTML = `<div class="loading">${t('deep.generating')}</div>`;
    try {
      const r = await UI.withSpinner(btn, () => API.post('/api/deep', {
        company: company.value.trim(),
        role: role.value.trim() || undefined,
        run: true,
      }));
      if (r.markdown) {
        showResult(`${company.value.trim()}${role.value.trim() ? ' — ' + role.value.trim() : ''}`, r.markdown, { saved: r.saved });
        loadArchive();
      } else {
        showPrompt(r.prompt, t('deep.geminiNoOutput', 'Gemini returned no output. Showing the prompt — paste it into Claude Code instead.'));
      }
    } catch (e) {
      out.innerHTML = '';
      out.appendChild(c('div', { className: 'empty' }, e.message));
    }
  }

  async function runManual(btn) {
    if (!company.value.trim()) return UI.toast(t('deep.enterCompany'), 'error');
    out.innerHTML = `<div class="loading">${t('deep.generating')}</div>`;
    try {
      const r = await UI.withSpinner(btn, () => API.post('/api/deep', {
        company: company.value.trim(),
        role: role.value.trim() || undefined,
      }));
      showPrompt(r.prompt, r.message);
    } catch (e) {
      out.innerHTML = '';
      out.appendChild(c('div', { className: 'empty' }, e.message));
    }
  }

  await loadArchive();

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('deep.title'), 'help.hint.deep'),
        c('p', { className: 'page-subtitle' }, t('deep.subtitle')),
      ]),
    ]),
    c('div', { className: 'card' }, [
      c('div', { className: 'row' }, [
        c('div', { className: 'field' }, [c('label', { htmlFor: 'deep-company' }, t('deep.companyLbl')), company]),
        c('div', { className: 'field' }, [c('label', { htmlFor: 'deep-role' }, t('deep.roleLbl')), role]),
      ]),
      c('div', { className: 'flex gap-3' }, [
        liveAvailable
          ? c('button', {
              className: 'btn btn-primary',
              title: liveEngine, // engine name kept as hover tooltip; the label stays clean
              onClick: (e) => runLive(e.currentTarget),
            }, '⚡ ' + t('deep.runLive', 'Run live'))
          : null,
        c('button', { className: 'btn btn-ghost', onClick: (e) => runManual(e.currentTarget) }, liveAvailable ? t('deep.copyPrompt', 'Copy prompt') : t('deep.run')),
      ]),
      liveAvailable
        ? null
        : c('p', { style: { color: 'var(--foggy)', fontSize: '13px', marginTop: '8px' } },
          t('deep.tipManual', 'Tip: set ANTHROPIC_API_KEY (or GEMINI_API_KEY) in .env to run research live in the browser. Without it, the prompt is generated for you to paste into Claude Code.')),
    ]),

    c('div', { className: 'mt-5' }, archive),
    c('div', { className: 'mt-5' }, out),
  ]);
});

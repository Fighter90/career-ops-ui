/* global Router, API, UI, I18n */
/**
 * Generic factory for the seven modes that share the same UX shape:
 *   form fields → POST /api/mode/:slug → Markdown output with Copy /
 *   Download / Open-in-tab. Pattern follows /#/deep but driven by config.
 *
 * Each mode declares:
 *   slug      — matches modes/{slug}.md and the URL hash
 *   titleKey  — i18n key for the page title
 *   subtitle  — i18n key for the subtitle
 *   fields    — array of { name, type, i18n: { label, placeholder }, required? }
 *
 * Adding a new mode is one config entry + one i18n block, no per-mode
 * view file required.
 */
(function () {
  // v1.22.0 (M-1) — each field carries a `hint` key that maps to a
  // per-field hint paragraph i18n entry. The hint <p> is associated
  // to the control via aria-describedby so screen readers voice the
  // intent when the user focuses the input. The README walkthroughs
  // still own the long-form prose; these strings are the bite-sized
  // version that fits inline.
  const MODES = [
    {
      slug: 'project',
      titleKey: 'project.title',
      subtitleKey: 'project.subtitle',
      fields: [
        { name: 'idea',        type: 'textarea', i18n: { label: 'project.ideaLbl', placeholder: 'project.ideaPh', hint: 'project.ideaHint' }, required: true, rows: 6 },
        { name: 'targetRole',  type: 'input',    i18n: { label: 'project.roleLbl', placeholder: 'project.rolePh', hint: 'project.roleHint' } },
      ],
    },
    {
      slug: 'training',
      titleKey: 'training.title',
      subtitleKey: 'training.subtitle',
      fields: [
        { name: 'course',  type: 'input',    i18n: { label: 'training.courseLbl', placeholder: 'training.coursePh', hint: 'training.courseHint' }, required: true },
        { name: 'goals',   type: 'textarea', i18n: { label: 'training.goalsLbl', placeholder: 'training.goalsPh', hint: 'training.goalsHint' }, rows: 4 },
      ],
    },
    {
      slug: 'followup',
      titleKey: 'followup.title',
      subtitleKey: 'followup.subtitle',
      fields: [
        { name: 'company', type: 'input',    i18n: { label: 'followup.companyLbl', placeholder: 'followup.companyPh', hint: 'followup.companyHint' }, required: true },
        { name: 'role',    type: 'input',    i18n: { label: 'followup.roleLbl', placeholder: 'followup.rolePh', hint: 'followup.roleHint' }, required: true },
        { name: 'lastContact', type: 'input', i18n: { label: 'followup.lastLbl', placeholder: 'followup.lastPh', hint: 'followup.lastHint' },
          // QA BUG-001 — the hint promises "ISO date (YYYY-MM-DD)" and it
          // drives the cadence math in the prompt; a junk value used to
          // sail through to the LLM (and burn a credit). Optional field,
          // but if filled it must be a real ISO date.
          pattern: '^\\d{4}-\\d{2}-\\d{2}$', patternMsgKey: 'followup.lastErr',
          patternMsgFallback: 'Last contact must be an ISO date: YYYY-MM-DD (e.g. 2026-05-19).' },
        { name: 'notes',   type: 'textarea', i18n: { label: 'followup.notesLbl', placeholder: 'followup.notesPh', hint: 'followup.notesHint' }, rows: 4 },
      ],
    },
    {
      // G-011 (v1.15.0): the canonical /#/batch is now the v1.13.0 TSV SPA
      // (server/lib/routes/batch.mjs + public/js/views/batch.js). The
      // legacy mode-prompt builder stays accessible at /#/batch-prompt for
      // any deep-linked bookmarks; a deprecation banner is rendered on top.
      // Scheduled for removal in v1.17.0.
      //
      // v1.17.0 — `serverSlug` decouples the route slug ('batch-prompt')
      // from the server-side mode file name ('batch'). modes/batch.md
      // exists in the parent; modes/batch-prompt.md does not.
      slug: 'batch-prompt',
      serverSlug: 'batch',
      titleKey: 'batch.title',
      subtitleKey: 'batch.subtitle',
      deprecation: 'batch-prompt.deprecated',
      fields: [
        { name: 'urls',    type: 'textarea', i18n: { label: 'batch.urlsLbl', placeholder: 'batch.urlsPh', hint: 'batch.urlsHint' }, required: true, rows: 8 },
        { name: 'workers', type: 'input',    i18n: { label: 'batch.workersLbl', placeholder: 'batch.workersPh', hint: 'batch.workersHint' } },
      ],
    },
    {
      slug: 'contacto',
      titleKey: 'contacto.title',
      subtitleKey: 'contacto.subtitle',
      fields: [
        { name: 'recipient', type: 'input',    i18n: { label: 'contacto.recipientLbl', placeholder: 'contacto.recipientPh', hint: 'contacto.recipientHint' }, required: true },
        { name: 'company',   type: 'input',    i18n: { label: 'contacto.companyLbl', placeholder: 'contacto.companyPh', hint: 'contacto.companyHint' }, required: true },
        { name: 'role',      type: 'input',    i18n: { label: 'contacto.roleLbl', placeholder: 'contacto.rolePh', hint: 'contacto.roleHint' } },
        { name: 'context',   type: 'textarea', i18n: { label: 'contacto.contextLbl', placeholder: 'contacto.contextPh', hint: 'contacto.contextHint' }, rows: 5 },
      ],
    },
    {
      // I18N-EXPAND / parent-feature port (v1.70.0) — cover-letter mode
      // (parent modes/cover.md, shipped career-ops v1.10.0 + greeting in
      // v1.11.0). Single-shot generic mode: JD + company/role + optional
      // salutation → tailored letter from cv.md / _profile.md.
      slug: 'cover',
      titleKey: 'cover.title',
      subtitleKey: 'cover.subtitle',
      fields: [
        { name: 'jd',       type: 'textarea', i18n: { label: 'cover.jdLbl', placeholder: 'cover.jdPh', hint: 'cover.jdHint' }, required: true, rows: 8 },
        { name: 'company',  type: 'input',    i18n: { label: 'cover.companyLbl', placeholder: 'cover.companyPh', hint: 'cover.companyHint' }, required: true },
        { name: 'role',     type: 'input',    i18n: { label: 'cover.roleLbl', placeholder: 'cover.rolePh', hint: 'cover.roleHint' } },
        { name: 'greeting', type: 'input',    i18n: { label: 'cover.greetingLbl', placeholder: 'cover.greetingPh', hint: 'cover.greetingHint' } },
      ],
    },
    {
      slug: 'interview-prep',
      titleKey: 'interviewPrep.title',
      subtitleKey: 'interviewPrep.subtitle',
      fields: [
        { name: 'company', type: 'input',    i18n: { label: 'interviewPrep.companyLbl', placeholder: 'interviewPrep.companyPh', hint: 'interviewPrep.companyHint' }, required: true },
        { name: 'role',    type: 'input',    i18n: { label: 'interviewPrep.roleLbl', placeholder: 'interviewPrep.rolePh', hint: 'interviewPrep.roleHint' }, required: true },
        { name: 'stage',   type: 'input',    i18n: { label: 'interviewPrep.stageLbl', placeholder: 'interviewPrep.stagePh', hint: 'interviewPrep.stageHint' } },
      ],
    },
    {
      slug: 'patterns',
      titleKey: 'patterns.title',
      subtitleKey: 'patterns.subtitle',
      fields: [
        { name: 'window', type: 'input',    i18n: { label: 'patterns.windowLbl', placeholder: 'patterns.windowPh', hint: 'patterns.windowHint' } },
        { name: 'focus',  type: 'textarea', i18n: { label: 'patterns.focusLbl', placeholder: 'patterns.focusPh', hint: 'patterns.focusHint' }, rows: 4 },
      ],
    },
  ];

  for (const cfg of MODES) {
    Router.register(cfg.slug, () => buildModeView(cfg));
  }

  function buildModeView(cfg) {
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);
    const fields = {};
    let liveAvailable = false;
    let liveEngine = '';

    // Probe Anthropic OR Gemini availability without blocking initial render.
    // When a key is available, we flip "▶ Run" to be the PRIMARY button
    // (executes via API, returns Markdown to the browser) and demote the
    // prompt-only flow to a ghost button. The user's expectation on
    // /#/contacto, /#/interview-prep, /#/project, etc. is "do the thing",
    // not "give me a prompt to paste somewhere else".
    API.get('/api/health').then((h) => {
      const anth = h.checks?.find((x) => x.name === 'ANTHROPIC_API_KEY')?.ok === true;
      const gem = h.checks?.find((x) => x.name === 'GEMINI_API_KEY')?.ok === true;
      if (anth) { liveAvailable = true; liveEngine = 'Anthropic'; }
      else if (gem) { liveAvailable = true; liveEngine = 'Gemini'; }
      if (liveAvailable) {
        // Promote runLive → primary, demote manualBtn → ghost.
        runLiveBtn.style.display = '';
        runLiveBtn.classList.remove('btn-ghost');
        runLiveBtn.classList.add('btn-primary');
        // Engine name (Anthropic / Gemini) is intentionally hidden — the
        // user just wants "run it", not to think about which provider
        // is wired up. The current engine still surfaces on /#/health
        // for power users.
        runLiveBtn.textContent = '⚡ ' + t('mode.runLive', 'Run live');
        runLiveBtn.title = liveEngine; // hover tooltip keeps the info accessible
        manualBtn.classList.remove('btn-primary');
        manualBtn.classList.add('btn-ghost');
        manualBtn.textContent = t('mode.runManual', 'Generate prompt');
        // Re-order so Run live appears first in the row.
        if (runLiveBtn.parentNode) runLiveBtn.parentNode.insertBefore(runLiveBtn, manualBtn);
        liveAnnounce.textContent = t('mode.liveReadyAnnounce',
          'Live evaluation is now available — the primary button runs it directly.');
      }
    }).catch(() => {});

    function field(spec) {
      // v1.20.0 — WCAG 1.3.1 / 3.3.2: each control gets a stable id so the
      // label can target it via htmlFor. Per-mode prefix keeps ids unique
      // when more than one mode view is in the DOM (Router only mounts one
      // at a time, but defence-in-depth here is cheap).
      // v1.22.0 (M-1) — if the field spec carries `i18n.hint`, render an
      // inline hint paragraph + wire aria-describedby. The hint key is
      // looked up at render time so locale switches refresh both the
      // label and the hint without a re-render.
      const inputId = `mode-${cfg.slug}-${spec.name}`;
      const hintId = spec.i18n.hint ? `${inputId}-hint` : null;
      // U-3 (v1.58.23) — followup.lastContact's placeholder was the
      // frozen ISO date `2026-04-21`. A static placeholder rots: the
      // user reads it as "this is the field's expected format AND a
      // realistic recent value". As time passes the date drifts into
      // the distant past and the example loses its example-ness.
      // Compute today − 14 days for that specific field so the
      // placeholder remains a plausible "last contact" example.
      let placeholder = t(spec.i18n.placeholder, spec.i18n.placeholder);
      if (cfg.slug === 'followup' && spec.name === 'lastContact') {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        placeholder = d.toISOString().slice(0, 10);
      }
      const opts = {
        id: inputId,
        className: spec.type === 'textarea' ? 'textarea' : 'input',
        placeholder,
      };
      if (hintId) opts['aria-describedby'] = hintId;
      if (spec.type === 'textarea') opts.rows = spec.rows || 4;
      const el = c(spec.type, opts);
      fields[spec.name] = el;
      const children = [
        c('label', { htmlFor: inputId }, t(spec.i18n.label, spec.i18n.label)),
        el,
      ];
      if (hintId) {
        children.push(c('p', {
          id: hintId,
          className: 'field-hint',
          style: { color: 'var(--foggy)', fontSize: '13px', margin: '4px 0 0' },
        }, t(spec.i18n.hint, '')));
      }
      return c('div', { className: 'field' }, children);
    }

    const out = c('div');

    function payload() {
      const body = {};
      for (const spec of cfg.fields) body[spec.name] = (fields[spec.name].value || '').trim();
      return body;
    }

    function validate() {
      for (const spec of cfg.fields) {
        const val = fields[spec.name].value.trim();
        if (spec.required && !val) {
          UI.toast(t('mode.required', 'Please fill the required fields'), 'error');
          fields[spec.name].focus();
          return false;
        }
        // QA BUG-001 — optional-but-must-be-well-formed fields (e.g. the
        // followup ISO date). Only enforced when the user typed something.
        if (spec.pattern && val && !new RegExp(spec.pattern).test(val)) {
          UI.toast(t(spec.patternMsgKey, spec.patternMsgFallback || 'Invalid format'), 'error');
          fields[spec.name].focus();
          return false;
        }
      }
      return true;
    }

    function showResult(title, markdown, slug) {
      out.innerHTML = '';
      const card = c('div', { className: 'card' });
      const actions = [
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
            a.download = `${slug}-${Date.now()}.md`;
            a.click();
            URL.revokeObjectURL(a.href);
          },
        }, '⬇ ' + t('mode.download', 'Download .md')),
      ];
      // Generate-PDF on interview-prep + cover results: both are markdown,
      // rendered through the shared inline markdown→PDF pipeline.
      if ((slug === 'interview-prep' || slug === 'cover') && window.PdfGenerate) {
        actions.push(c('button', {
          className: 'btn btn-primary btn-sm',
          onClick: (e) => {
            window.PdfGenerate.run({
              kind: 'inline', markdown, title, slug, button: e.currentTarget,
            });
          },
        }, '📄 ' + t('common.generatePdf', 'Generate PDF')));
      }
      const header = c('div', { className: 'flex-between mb-3' }, [
        c('strong', null, title),
        c('div', { className: 'flex gap-3' }, actions),
      ]);
      const body = c('div', { className: 'card md', html: UI.md(markdown || '') });
      card.append(header, body);
      out.appendChild(card);
    }

    function showPrompt(prompt, message, slug) {
      out.innerHTML = '';
      // U-8 (v1.58.28) — the generated prompt was rendered inline as an
      // open <pre> block; for the 7 generic mode pages (Project /
      // Training / Patterns / Followup / Interview prep / …) the block
      // routinely runs 1200+ px and pushed the Copy + Run-live buttons
      // far below the fold. Wrap in <details class="prompt-block">
      // collapsed by default so the next-action buttons stay visible.
      // The summary shows the line count so the user knows the prompt
      // exists and how big it is without expanding.
      const lineCount = (prompt || '').split('\n').length;
      const details = c('details', { className: 'prompt-block' }, [
        c('summary', null, t('prompt.show', 'Show prompt') + ` (${lineCount} ${t('prompt.lines', 'lines')})`),
        c('pre', { className: 'console', style: { maxHeight: '60vh', overflow: 'auto' } }, prompt),
      ]);
      out.appendChild(c('div', { className: 'card' }, [
        c('p', { style: { color: 'var(--foggy)' } }, message || ''),
        details,
        c('div', { className: 'flex gap-3 mt-3' }, [
          c('button', {
            className: 'btn btn-primary',
            onClick: () => {
              navigator.clipboard.writeText(prompt);
              UI.toast(t('eval.copied', 'Copied'), 'success');
            },
          }, '📋 ' + t('eval.copy', 'Copy prompt')),
          // Re-submits with run:true so the user can hit it after
          // "Generate prompt" without retyping. Errors out cleanly
          // when no API key is wired up.
          c('button', {
            className: 'btn btn-ghost',
            onClick: async (e) => {
              if (!liveAvailable) {
                UI.toast(t('deep.needKey', 'Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first'), 'error');
                return;
              }
              await submit(e.currentTarget, true);
            },
          }, '⚡ ' + t('deep.showResult', 'Show result')),
        ]),
      ]));
    }

    async function submit(btn, run) {
      if (!validate()) return;
      out.innerHTML = `<div class="loading">${t('mode.generating', 'Generating…')}</div>`;
      try {
        // v1.17.0 — serverSlug (if set) decouples the route hash from the
        // parent modes/<slug>.md filename. Used for /#/batch-prompt →
        // modes/batch.md.
        const apiSlug = cfg.serverSlug || cfg.slug;
        const r = await UI.withSpinner(btn, () => API.post('/api/mode/' + apiSlug, { ...payload(), run }));
        const titleStr = `${t(cfg.titleKey)} — ${new Date().toLocaleString()}`;
        if (r.markdown) {
          showResult(titleStr, r.markdown, cfg.slug);
        } else {
          showPrompt(r.prompt, r.message, cfg.slug);
        }
      } catch (e) {
        out.innerHTML = '';
        out.appendChild(c('div', { className: 'empty' }, e.message || String(e)));
      }
    }

    const manualBtn = c('button', {
      className: 'btn btn-primary',
      onClick: (e) => submit(e.currentTarget, false),
    }, '▶ ' + t('mode.runManual', 'Generate prompt'));

    const runLiveBtn = c('button', {
      className: 'btn btn-ghost',
      style: { display: 'none' },
      onClick: (e) => submit(e.currentTarget, true),
    }, '⚡ ' + t('mode.runLive', 'Run live'));

    // WS2 #40 — the async health probe relabels/reorders the primary
    // button under the user; a keyboard user who already focused it
    // sees it change silently. Announce the change politely.
    const liveAnnounce = c('div', {
      role: 'status', 'aria-live': 'polite', className: 'visually-hidden',
    });

    // G-011: surface a deprecation banner on /#/batch-prompt so anyone
    // hitting the legacy mode-prompt route from an old bookmark sees
    // the migration target.
    const deprecationBanner = cfg.deprecation
      ? c('div', { className: 'card', style: { borderLeft: '3px solid var(--warn)', marginBottom: '16px' } }, [
          c('strong', null, '⚠ '),
          c('span', null, t(cfg.deprecation,
            'This route is deprecated. The canonical Batch evaluate page is now at #/batch (TSV editor + parallel runner). This legacy prompt-builder will be removed in v1.17.0.')),
          c('div', { className: 'mt-2' }, [
            c('a', { href: '#/batch', className: 'btn btn-primary btn-sm' },
              '↗ ' + t('batch-prompt.goCanonical', 'Open #/batch')),
          ]),
        ])
      : null;

    return c('div', null, [
      liveAnnounce,
      deprecationBanner,
      c('header', { className: 'page-header' }, [
        c('div', null, [
          c('h1', { className: 'page-title' }, t(cfg.titleKey)),
          c('p', { className: 'page-subtitle' }, t(cfg.subtitleKey)),
        ]),
      ]),
      c('div', { className: 'card' }, [
        ...cfg.fields.map(field),
        c('div', { className: 'flex gap-3' }, [manualBtn, runLiveBtn]),
        // v1.56.0 — UX-10: honest cost ballpark before the live run.
        UI.providerCostHint(t),
      // UX-D-J (v1.58.42) — advisor ETA chip parity with #/auto (UX-6).
      c('span', { className: 'advisor-eta' }, '⏱ ' + t('advisor.eta', '~30s')),
      ]),
      c('div', { className: 'mt-5' }, out),
    ]);
  }
})();

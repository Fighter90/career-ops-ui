/* global Router, API, UI, I18n, ReportExport, HelpHint */
/**
 * #/career-plan — AI career development plan (v1.95.0, Epic 26).
 *
 * Generates a concrete, personalized plan from the user's own CV + profile
 * (+ two-pager + memory) via POST /api/career-plan/generate: self-diagnosis,
 * SMART/OKR/WOOP goals, alternative trajectories, a hard/soft skill plan, a
 * month-by-month roadmap, tracking, and pitfalls. Save it to the user layer
 * (config/career-plan.md) with PUT, and export it to Markdown / PDF / clipboard.
 * The plan is forward-looking guidance grounded in the user's materials — it
 * never fabricates facts about their history.
 */
// CAR-20 (v1.243.0) — the generated/edited plan used to vanish on any
// in-place re-render (language switch → Router.render(); the guard
// flows have no hashchange on this route): the view refetched and
// rebuilt the editor from disk, losing the user's edits. The unsaved
// buffer lives at module scope (same discipline as cv.js's
// cvDirtyBuffer) and is restored into the editor on the next render.
let planBuffer = null;
Router.register('career-plan', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(HelpHint.title(t('plan.title', 'Career plan'), 'help.hint.careerPlan'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('plan.subtitle', 'A concrete development plan built from your own CV and profile — goals, a month-by-month roadmap, skills, and pitfalls. Generate it, edit it, save it, export it.')));

  // Load any saved plan. CAR-20 (v1.243.0) — a failed GET used to be
  // swallowed into `saved = ''`, i.e. an empty editor with Save armed:
  // one click overwrote config/career-plan.md with blanks. The failure
  // is surfaced, and Save stays gated until content actually loads.
  let planLoaded = false;
  let planLoadError = null;
  let saved = '';
  try {
    ({ markdown: saved } = await API.get('/api/career-plan'));
    saved = saved || '';
    planLoaded = true;
  } catch (e) {
    planLoadError = (e && e.message) || String(e);
  }
  if (!planLoaded) {
    root.appendChild(c('div', { className: 'empty' }, [
      c('p', { style: { color: 'var(--danger, #d9534f)' } }, planLoadError),
    ]));
  }

  // ── controls ──
  const horizon = c('select', { className: 'lang-select', 'aria-label': t('plan.horizon', 'Horizon') }, [
    c('option', { value: '6' }, t('plan.horizon6', '6 months')),
    c('option', { value: '12', selected: 'selected' }, t('plan.horizon12', '12 months')),
    c('option', { value: '24' }, t('plan.horizon24', '24 months')),
  ]);
  const focus = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'plan.focusPh', 'data-i18n-aria-label': 'plan.focusPh', style: { minWidth: '260px' } });
  focus.setAttribute('aria-label', t('plan.focusPh', 'Optional emphasis'));
  focus.placeholder = t('plan.focusPh', 'Optional emphasis — e.g. move into management, go remote, switch to Go…');
  const genBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('plan.generate', 'Generate plan'));

  root.appendChild(c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', margin: '16px 0' } }, [
    c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [t('plan.horizon', 'Horizon'), horizon]),
    c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)', flex: '1 1 260px' } }, [t('plan.focus', 'Focus (optional)'), focus]),
    genBtn,
    // P4-ETA (v1.170.0) — honest duration hint next to a long AI generation
    // (career-plan ~40 s observed), mirroring the #/auto ETA pattern.
    c('span', { className: 'eta-hint', title: t('common.etaTitle', 'Typical generation time') },
      '⏱ ' + t('common.eta', '~{n}s').replace('{n}', '40')),
  ]));

  // ── editable plan + actions ──
  const editor = c('textarea', { className: 'input', rows: '22', 'data-i18n-placeholder': 'plan.editorPh', style: { width: '100%', fontFamily: 'inherit' } });
  editor.placeholder = t('plan.editorPh', 'Your plan will appear here. Generate one, or write your own — then Save.');
  // CAR-20 — re-seed from the module buffer when one exists (restores
  // the user's unsaved plan across re-renders).
  editor.value = planBuffer != null ? planBuffer : saved;
  editor.addEventListener('input', () => {
    planBuffer = editor.value === saved ? null : editor.value;
  });

  // CAR-20 — Save is armed only once the plan actually loaded (or an
  // unsaved buffer exists from a previous render — that content is
  // known-good user text, not a failed read).
  const saveBtn = c('button', {
    className: 'btn btn-primary', type: 'button',
    disabled: !planLoaded && planBuffer == null,
  }, t('plan.save', 'Save plan'));
  const previewBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('plan.preview', 'Preview'));
  const preview = c('div');

  const title = () => t('plan.title', 'Career plan');
  const exportBar = ReportExport.actionsBar(() => editor.value, title, t);
  // CAR-54 #2 (v1.247.0) — the export row used to look enabled over an EMPTY
  // plan (exporting blanks) and competed with the Save/Preview row above it.
  // It merges into that one actions row, and its buttons stay disabled while
  // the plan has no content.
  function syncExportEnabled() {
    const has = Boolean(editor.value.trim());
    exportBar.querySelectorAll('button').forEach((b) => { b.disabled = !has; });
  }
  editor.addEventListener('input', syncExportEnabled);
  syncExportEnabled();

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '0 0 12px' } }, [
    editor,
    c('div', { className: 'plan-actions', style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' } },
      [saveBtn, previewBtn, exportBar]),
  ]));
  root.appendChild(preview);
  root.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '10px 0 0' } },
    t('plan.privacyNote', 'Saved to your parent project’s user layer (config/career-plan.md) — never overwritten by updates, and only ever sent inside the LLM prompts you run.')));

  genBtn.addEventListener('click', async () => {
    genBtn.disabled = true;
    const prev = genBtn.textContent;
    genBtn.textContent = t('plan.generating', 'Generating…');
    try {
      const res = await API.post('/api/career-plan/generate', { run: true, horizon: horizon.value, focus: focus.value, lang: (I18n.getLang && I18n.getLang()) || 'en' });
      if (res && res.markdown) {
        editor.value = res.markdown;
        // CAR-20 — a generated plan is unsaved: track it in the module
        // buffer so a re-render (language switch) keeps it.
        planBuffer = res.markdown;
        // CAR-54 #2 — the plan now has content; arm the export row.
        syncExportEnabled();
        // Show the plan as READABLE formatted text immediately (no raw tags) —
        // the textarea below stays available for editing. Preview toggles it.
        preview.textContent = '';
        preview.appendChild(c('div', { className: 'card md', html: UI.md(res.markdown), style: { padding: '16px', marginTop: '4px' } }));
        // Guard: scrollIntoView on a detached node is a silent no-op, but only
        // scroll when actually laid out (view still mounted) to avoid surprises.
        if (preview.isConnected) preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
        UI.toast(t('plan.generated', 'Plan generated — review, edit, then Save'), 'success');
      } else if (res && res.prompt) {
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
            (res.message) || t('export.manual', 'No API key set — copy this prompt into any LLM, then paste the result back.')),
          c('textarea', { className: 'input', rows: '18', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]);
        UI.modal(t('plan.generate', 'Generate plan'), body);
      }
    } catch (err) {
      UI.toast((err && err.message) || t('plan.generateFailed', 'Could not generate the plan'), 'error');
    } finally { genBtn.disabled = false; genBtn.textContent = prev; }
  });

  saveBtn.addEventListener('click', async () => {
    // CAR-20 (v1.243.0) — never save over the file with content we could
    // not verify (a failed read must not become a blank overwrite).
    if (!planLoaded) {
      UI.toast(planLoadError || t('common.error', 'Error'), 'error');
      return;
    }
    saveBtn.disabled = true;
    try {
      await API.put('/api/career-plan', { markdown: editor.value });
      saved = editor.value; // the new baseline
      planBuffer = null;
      UI.toast(t('plan.saved', 'Career plan saved'), 'success');
    } catch (err) {
      UI.toast((err && err.message) || t('plan.saveFailed', 'Could not save the plan'), 'error');
    } finally { saveBtn.disabled = false; }
  });

  previewBtn.addEventListener('click', () => {
    if (preview.firstChild) { preview.textContent = ''; return; }
    preview.appendChild(c('div', { className: 'card md', html: UI.md(editor.value || ''), style: { padding: '16px', marginTop: '4px' } }));
  });

  return root;
});

/* global Router, API, UI, I18n, ReportExport */
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
Router.register('career-plan', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('plan.title', 'Career plan')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('plan.subtitle', 'A concrete development plan built from your own CV and profile — goals, a month-by-month roadmap, skills, and pitfalls. Generate it, edit it, save it, export it.')));

  // Load any saved plan (empty-safe).
  let saved = '';
  try { ({ markdown: saved } = await API.get('/api/career-plan')); } catch { saved = ''; }
  saved = saved || '';

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

  root.appendChild(c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', margin: '0 0 16px' } }, [
    c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [t('plan.horizon', 'Horizon'), horizon]),
    c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)', flex: '1 1 260px' } }, [t('plan.focus', 'Focus (optional)'), focus]),
    genBtn,
  ]));

  // ── editable plan + actions ──
  const editor = c('textarea', { className: 'input', rows: '22', 'data-i18n-placeholder': 'plan.editorPh', style: { width: '100%', fontFamily: 'inherit' } });
  editor.placeholder = t('plan.editorPh', 'Your plan will appear here. Generate one, or write your own — then Save.');
  editor.value = saved;

  const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('plan.save', 'Save plan'));
  const previewBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('plan.preview', 'Preview'));
  const preview = c('div');

  const title = () => t('plan.title', 'Career plan');
  const exportBar = ReportExport.actionsBar(() => editor.value, title, t);

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '0 0 12px' } }, [
    editor,
    c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' } }, [saveBtn, previewBtn]),
    exportBar,
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
    saveBtn.disabled = true;
    try {
      await API.put('/api/career-plan', { markdown: editor.value });
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

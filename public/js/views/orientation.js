/* global Router, API, UI, I18n, ReportExport */
/**
 * #/orientation — Career orientation profile (v1.96.0, Epic 27).
 *
 * Generates an AI career-orientation profile from the user's own CV + profile
 * (+ two-pager + memory) via POST /api/orientation/generate: best-fit career
 * vectors, a career-type leaning, recommended roles, professional strengths,
 * working-style tendencies, and development moves. It is an AI reflection of how
 * the CV reads — NOT a psychometric test — and it never fabricates measured
 * scores. Export the profile to Markdown / PDF / clipboard.
 */
Router.register('orientation', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('orient.title', 'Career orientation')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('orient.subtitle', 'Which directions fit you — inferred from your own CV and profile: best-fit career vectors, recommended roles, strengths, and how your CV reads. A reflection, not a psychometric test.')));

  const genBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('orient.generate', 'Generate profile'));
  root.appendChild(c('div', { style: { margin: '0 0 16px' } }, genBtn));

  const out = c('div');
  root.appendChild(out);
  root.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '12px 0 0' } },
    t('orient.note', 'This reads your CV, profile, two-pager, and memory note — it never invents facts and never reports measured test scores. Nothing is saved; export it if you want to keep it.')));

  let currentMd = '';
  genBtn.addEventListener('click', async () => {
    genBtn.disabled = true;
    out.textContent = '';
    out.appendChild(c('div', { className: 'loading' }, t('orient.running', 'Generating your profile…')));
    try {
      const res = await API.post('/api/orientation/generate', { run: true, lang: (I18n.getLang && I18n.getLang()) || 'en' });
      out.textContent = '';
      if (res && res.markdown) {
        currentMd = res.markdown;
        out.appendChild(c('div', { className: 'card md', html: UI.md(res.markdown), style: { padding: '16px' } }));
        out.appendChild(ReportExport.actionsBar(() => currentMd, () => t('orient.title', 'Career orientation'), t));
      } else if (res && res.prompt) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)', margin: '0 0 8px' } },
          (res.message) || t('export.manual', 'No API key set — copy this prompt into any LLM, then paste the result back.')));
        out.appendChild(c('textarea', { className: 'input', rows: '18', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt));
      }
    } catch (err) {
      out.textContent = '';
      out.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } }, (err && err.message) || t('orient.failed', 'Could not generate the profile')));
    } finally { genBtn.disabled = false; }
  });

  return root;
});

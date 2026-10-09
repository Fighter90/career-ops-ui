/* global Router, API, UI, I18n, ReportExport, HelpHint */
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

  // CAR-54 #1 (v1.247.0) — designed empty state (tracker pattern: title +
  // hint + CTA) instead of a blank page under the CTA. The Generate button
  // lives inside the box until a result replaces it.
  const genBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('orient.generate', 'Generate profile'));
  const out = c('div');
  const emptyState = c('div', { className: 'empty', style: { margin: '16px 0 0' } }, [
    c('strong', null, t('orient.emptyTitle', 'No orientation profile yet')),
    c('p', { style: { margin: '8px 0 0' } },
      t('orient.emptyHint', 'Generate one to see which career vectors, roles, and strengths your own CV and profile point to.')),
    c('div', { style: { marginTop: '12px' } }, [genBtn]),
  ]);

  // CAR-51 #1 (v1.247.0) — the ⏱ ETA rides the shared meta line under the
  // view title, same as #/evaluate, #/deep and the mode pages.
  const root = c('div');
  root.appendChild(HelpHint.title(t('orient.title', 'Career orientation'), 'help.hint.orientation'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('orient.subtitle', 'Which directions fit you — inferred from your own CV and profile: best-fit career vectors, recommended roles, strengths, and how your CV reads. A reflection, not a psychometric test.')));
  root.appendChild(UI.pageMeta(t,
    c('span', { className: 'eta-hint', title: t('common.etaTitle', 'Typical generation time') },
      '⏱ ' + t('common.eta', '~{n}s').replace('{n}', '30'))));
  root.appendChild(emptyState);
  root.appendChild(out);
  root.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '12px 0 0' } },
    t('orient.note', 'This reads your CV, profile, two-pager, and memory note — it never invents facts and never reports measured test scores. Nothing is saved; export it if you want to keep it.')));

  let currentMd = '';
  genBtn.addEventListener('click', async () => {
    genBtn.disabled = true;
    emptyState.replaceChildren(c('div', { className: 'loading' }, t('orient.running', 'Generating your profile…')));
    try {
      const res = await API.post('/api/orientation/generate', { run: true, lang: (I18n.getLang && I18n.getLang()) || 'en' });
      emptyState.replaceChildren();
      emptyState.hidden = true; // a result (or its error) replaces the box
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

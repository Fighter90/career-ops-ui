/* global Router, API, UI, I18n */
/**
 * #/memory — Memory layer (v1.93.0, Epic 24).
 *
 * An editable "remember this about me" note. It is saved to the user layer
 * (config/memory.md) and inlined into every AI request via bundleProjectContext,
 * so it steers evaluate / mock interview / networking / CV Studio across all
 * providers. Steering + preferences only — never new factual claims (those live
 * in the CV / profile / two-pager). A "suggest from my data" helper drafts
 * behavioural bullets from the tracker for the user to review.
 */
Router.register('memory', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('mem.title', 'Memory')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('mem.subtitle', 'A short note the assistant keeps in mind on every task — your preferences and how you like to work. It never becomes a source of new facts about you.')));

  let markdown = '';
  try { ({ markdown } = await API.get('/api/memory')); } catch { markdown = ''; }

  // aria-label mirrors the localized placeholder (placeholder alone is not
  // a reliable accessible name once the field has content) — no new keys.
  const ta = c('textarea', { className: 'input', rows: '14', 'data-i18n-placeholder': 'mem.ph', 'data-i18n-aria-label': 'mem.title', style: { width: '100%', fontFamily: 'inherit' } });
  ta.setAttribute('aria-label', t('mem.title', 'Memory'));
  ta.placeholder = t('mem.ph', 'e.g.\n- Prefer remote, Series A–B product companies.\n- Answer tersely, senior tone, no filler.\n- No on-call roles; comp floor $140k.');
  ta.value = markdown || '';

  const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('mem.save', 'Save memory'));
  const suggestBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('mem.suggest', '✨ Suggest from my data'));

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await API.put('/api/memory', { markdown: ta.value });
      UI.toast(t('mem.saved', 'Memory saved — it now steers every AI request'), 'success');
    } catch (err) {
      UI.toast((err && err.message) || t('mem.saveFailed', 'Could not save the memory note'), 'error');
    } finally { saveBtn.disabled = false; }
  });

  suggestBtn.addEventListener('click', async () => {
    suggestBtn.disabled = true;
    try {
      const { prompt } = await API.post('/api/memory/suggest', { lang: (I18n.getLang && I18n.getLang()) || 'en' });
      const body = c('div', null, [
        c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
          t('mem.suggestHelp', 'Run this in any LLM, review the behavioural bullets it proposes, then paste an edited version into your memory note above. It reads your tracker — it never invents facts.')),
        c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, prompt),
      ]);
      UI.modal(t('mem.suggest', '✨ Suggest from my data'), body);
    } catch (err) {
      UI.toast((err && err.message) || t('mem.suggestFailed', 'Could not build a suggestion'), 'error');
    } finally { suggestBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '12px 0' } }, [
    ta,
    c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' } }, [saveBtn, suggestBtn]),
  ]));
  root.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0' } },
    t('mem.privacyNote', 'Stored in your parent project’s user layer (config/memory.md) — never overwritten by updates, and only ever sent inside the LLM prompts you run.')));

  return root;
});

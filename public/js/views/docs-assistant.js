/* global Router, API, UI, I18n */
/**
 * #/docs-assistant — "Ask the docs" (v1.102.0).
 *
 * A grounded chat over the app's own in-app help guide (docs/help/<lang>.md).
 * You ask a how-to question; the server retrieves the most relevant help
 * sections in your current language and answers ONLY from them (or says the
 * guide doesn't cover it). It never reads your CV/profile/tracker — it's about
 * how to use the app, not about you. Live with an LLM key; no key → a
 * copy-paste prompt. CSP-safe: UI.el + addEventListener, UI.md render boundary.
 */
Router.register('docs-assistant', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('docs.title', 'Ask the docs')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('docs.subtitle', 'Ask how to use anything in the app. Answers come only from the in-app help guide in your language — nothing about your CV or job search is read.')));

  const log = c('div', { className: 'chat-log', style: { display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 0 16px' } });
  root.appendChild(log);

  // Suggested starter questions (localized; each just prefills + sends).
  const starters = [
    t('docs.q1', 'How do I scan job portals?'),
    t('docs.q2', 'How does the two-pager fit score work?'),
    t('docs.q3', 'How do I export a report to PDF?'),
  ];
  const chips = c('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 12px' } },
    starters.map((q) => {
      const b = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, q);
      b.addEventListener('click', () => { input.value = q; send(); });
      return b;
    }));
  root.appendChild(chips);

  const input = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'docs.ph', 'aria-label': t('docs.title', 'Ask the docs') });
  input.placeholder = t('docs.ph', 'Ask a question about using the app…');
  const askBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('docs.ask', 'Ask'));
  const bar = c('div', { style: { display: 'flex', gap: '8px' } }, [
    c('div', { style: { flex: '1' } }, input), askBtn,
  ]);
  root.appendChild(bar);

  function bubble(kind, node) {
    const mine = kind === 'me';
    return c('div', { style: { alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', background: mine ? 'var(--accent, #4c8bf5)' : 'var(--panel-2, #eef1f6)', color: mine ? '#fff' : 'inherit', borderRadius: '12px', padding: '10px 14px' } }, node);
  }

  async function send() {
    const question = input.value.trim();
    if (question.length < 3) { UI.toast(t('docs.needQ', 'Type a question first'), 'error'); return; }
    input.value = '';
    log.appendChild(bubble('me', c('span', null, question)));
    askBtn.disabled = true;
    const pending = bubble('bot', c('span', { className: 'loading', style: { color: 'var(--foggy)' } }, t('docs.thinking', 'Searching the guide…')));
    log.appendChild(pending);
    pending.scrollIntoView({ block: 'end' });
    try {
      const res = await API.post('/api/docs-assistant/ask', { question, run: true });
      pending.remove();
      if (res.answer) {
        const parts = [c('div', { className: 'md', html: UI.md(res.answer) })];
        if (Array.isArray(res.sections) && res.sections.length) {
          parts.push(c('div', { style: { marginTop: '8px', fontSize: '11px', color: 'var(--foggy)' } },
            `${t('docs.fromSections', 'From')}: ${res.sections.join(' · ')}`));
        }
        log.appendChild(bubble('bot', c('div', null, parts)));
      } else if (res.prompt) {
        // No key: hand over the grounded prompt to run anywhere.
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('docs.manualHelp', 'No LLM key is set. Copy this prompt (it already contains the relevant help sections) into any assistant to get your answer.')),
          c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]);
        UI.modal(t('docs.title', 'Ask the docs'), body);
        log.appendChild(bubble('bot', c('span', { style: { color: 'var(--foggy)' } }, t('docs.manualBubble', 'No API key set — I opened a ready-to-run prompt you can paste into any assistant.'))));
      }
    } catch (err) {
      pending.remove();
      log.appendChild(bubble('bot', c('span', { style: { color: 'var(--danger, #d9534f)' } }, (err && err.message) || t('docs.failed', 'Could not answer that'))));
    } finally {
      askBtn.disabled = false;
      log.lastChild && log.lastChild.scrollIntoView({ block: 'end' });
    }
  }

  askBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });

  return root;
});

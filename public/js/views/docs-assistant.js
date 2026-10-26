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
 *
 * CAR-119 — the page renders through the shared LlmPageKit template:
 * two-column input|chat, and every answer runs under a progress/ETA/Cancel
 * run panel (AbortSignal-wired) instead of a static "Searching…" bubble.
 * No tracker autofill (a question is free text); the chat is not persisted →
 * no history drawer.
 * // CAR-119 i18n: no new dictionary keys — the kit's `llm2.*` strings ship
 * as I18n.t EN fallbacks inside public/js/lib/llm-page-kit.js.
 */
Router.register('docs-assistant', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('docs.title', 'Ask the docs')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('docs.subtitle', 'Ask how to use anything in the app. Answers come only from the in-app help guide in your language — nothing about your CV or job search is read.')));

  const log = c('div', { className: 'chat-log', style: { display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 0 16px' } });
  // CAR-119 — run/progress host for the ask POST.
  const runHost = c('div');

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
  // CAR-119 — the shared AI-page template: input (sticky) | chat,
  // "Input / Result" tabs below 1280 px.
  const page = window.LlmPageKit.layout({
    form: c('div', null, [chips, bar]),
    result: c('div', null, [runHost, log]),
  });
  root.appendChild(page.root);

  function bubble(kind, node) {
    const mine = kind === 'me';
    return c('div', { style: { alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', background: mine ? 'var(--accent, #4c8bf5)' : 'var(--panel-2, #eef1f6)', color: mine ? '#fff' : 'inherit', borderRadius: '12px', padding: '10px 14px' } }, node);
  }

  async function send() {
    // CAR-21 (v1.243.0) — re-entry guard: a second Enter (or a chip click)
    // while a question was already in flight queued a duplicate request
    // and interleaved the bubbles. askBtn.disabled is the in-flight flag.
    if (askBtn.disabled) return;
    const question = input.value.trim();
    if (question.length < 3) { UI.toast(t('docs.needQ', 'Type a question first'), 'error'); return; }
    input.value = '';
    log.appendChild(bubble('me', c('span', null, question)));
    askBtn.disabled = true;
    // CAR-119 — the shared run panel (live elapsed/ETA + Cancel) replaces
    // the static "Searching the guide…" bubble.
    const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 20, onBegin: () => page.show('result') }).mount(runHost);
    try {
      const res = await window.LlmPageKit.run({
        run: runCtrl,
        // CAR-119 review #4 — the error lands as a chat bubble (the chat's
        // own surface); the kit stays silent.
        failPaint: false,
        request: (signal) => window.LlmPageKit.postJSON('/api/docs-assistant/ask', { question, run: true }, signal),
      });
      if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
      if (res && res.answer) {
        const parts = [c('div', { className: 'md', html: UI.md(res.answer) })];
        if (Array.isArray(res.sections) && res.sections.length) {
          parts.push(c('div', { style: { marginTop: '8px', fontSize: '11px', color: 'var(--foggy)' } },
            `${t('docs.fromSections', 'From')}: ${res.sections.join(' · ')}`));
        }
        log.appendChild(bubble('bot', c('div', null, parts)));
      } else if (res && res.prompt) {
        // No key: hand over the grounded prompt to run anywhere.
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('docs.manualHelp', 'No LLM key is set. Copy this prompt (it already contains the relevant help sections) into any assistant to get your answer.')),
          c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]);
        UI.modal(t('docs.title', 'Ask the docs'), body);
        log.appendChild(bubble('bot', c('span', { style: { color: 'var(--foggy)' } }, t('docs.manualBubble', 'No API key set — I opened a ready-to-run prompt you can paste into any assistant.'))));
      }
    } catch (err) {
      log.appendChild(bubble('bot', c('span', { style: { color: 'var(--danger, #d9534f)' } }, (err && err.message) || t('docs.failed', 'Could not answer that'))));
    } finally {
      askBtn.disabled = false;
      log.lastChild && log.lastChild.scrollIntoView({ block: 'end' });
    }
  }

  askBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    // CAR-21 (v1.243.0) — IME composition Enter is text input, not a send.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  });

  return root;
});

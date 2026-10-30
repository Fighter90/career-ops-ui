/* global Router, API, UI, I18n, HelpHint */
/**
 * #/memory — Memory layer (v1.93.0, Epic 24).
 *
 * An editable "remember this about me" note. It is saved to the user layer
 * (config/memory.md) and inlined into every AI request via bundleProjectContext,
 * so it steers evaluate / mock interview / networking / CV Studio across all
 * providers. Steering + preferences only — never new factual claims (those live
 * in the CV / profile / two-pager). A "suggest from my data" helper drafts
 * behavioural bullets from the tracker for the user to review.
 *
 * CAR-119 — the page renders through the shared LlmPageKit template:
 * two-column form|result, and the ✨ suggestion renders into the result
 * column (with a copy action) under a progress/ETA/Cancel run panel instead
 * of a modal. No company/role fields → no tracker autofill; the note is a
 * single document (PUT), not a session store → no history drawer.
 * // CAR-119 i18n: no new dictionary keys — the kit's `llm2.*` strings ship
 * as I18n.t EN fallbacks inside public/js/lib/llm-page-kit.js.
 */
Router.register('memory', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(HelpHint.title(t('mem.title', 'Memory'), 'help.hint.memory'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('mem.subtitle', 'A short note the assistant keeps in mind on every task — your preferences and how you like to work. It never becomes a source of new facts about you.')));

  // CAR-21 (v1.243.0) — LOAD FIRST, fail closed. A failed GET used to be
  // swallowed into `markdown = ''`: the view then rendered an EMPTY editor
  // with Save armed, and one click overwrote the saved note with ''. On a
  // load failure we surface the error (role=alert) and return WITHOUT
  // mounting the editor — Save cannot overwrite what never loaded (same
  // fail-closed shape #/config uses). An empty note is a legitimate
  // successful load (first run), so the gate is the promise outcome, not
  // the string.
  let markdown = '';
  try {
    ({ markdown } = await API.get('/api/memory'));
  } catch (err) {
    root.appendChild(c('div', {
      className: 'empty', role: 'alert', style: { border: 'none' },
    }, (err && err.message) || t('common.error', 'Error')));
    return root;
  }

  // aria-label mirrors the localized placeholder (placeholder alone is not
  // a reliable accessible name once the field has content) — no new keys.
  const ta = c('textarea', { className: 'input', rows: '14', 'data-i18n-placeholder': 'mem.ph', 'data-i18n-aria-label': 'mem.title', style: { width: '100%', fontFamily: 'inherit' } });
  ta.setAttribute('aria-label', t('mem.title', 'Memory'));
  ta.placeholder = t('mem.ph', 'e.g.\n- Prefer remote, Series A–B product companies.\n- Answer tersely, senior tone, no filler.\n- No on-call roles; comp floor $140k.');
  ta.value = markdown || '';

  const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('mem.save', 'Save memory'));
  const suggestBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('mem.suggest', '✨ Suggest from my data'));
  // CAR-119 — run/progress host + the suggestion output lands in the
  // result column (the old modal is replaced by the template's result pane).
  const runHost = c('div');
  const suggestionOut = c('div');

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
    // CAR-119 — shared run panel; the prompt result renders into the result
    // column instead of a modal.
    const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 15, onBegin: () => page.show('result') }).mount(runHost);
    suggestionOut.textContent = '';
    try {
      // Review #1 — assign-then-guard-then-read: run() resolves UNDEFINED on
      // cancel; destructuring before the guard threw a phantom TypeError.
      const res = await window.LlmPageKit.run({
        run: runCtrl,
        failText: t('mem.suggestFailed', 'Could not build a suggestion'),
        request: (signal) => window.LlmPageKit.postJSON('/api/memory/suggest', {}, signal),
      });
      if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
      const prompt = res && res.prompt;
      const dump = c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, prompt);
      A11yDump.label(dump, t('a11y.readonlyOutput', 'Generated result — read only'));
      suggestionOut.appendChild(c('div', { className: 'card', style: { padding: '16px' } }, [
        c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
          t('mem.suggestHelp', 'Run this in any LLM, review the behavioural bullets it proposes, then paste an edited version into your memory note above. It reads your tracker — it never invents facts.')),
        dump,
        c('div', { style: { marginTop: '10px' } }, [
          c('button', {
            className: 'btn btn-ghost btn-sm', type: 'button',
            onClick: async (e) => {
              try { await navigator.clipboard.writeText(prompt || ''); UI.toast(t('eval.copied', 'Copied'), 'success'); }
              catch { UI.toast(t('auto.copyFail', 'Copy failed — select the text and copy manually.'), 'error'); e.currentTarget.blur(); }
            },
          }, '📋 ' + t('eval.copy', 'Copy')),
        ]),
      ]));
    } catch {
      // CAR-119 review #4 — the kit's fail panel announces the failure.
    } finally { suggestBtn.disabled = false; }
  });

  const page = window.LlmPageKit.layout({
    form: c('div', null, [
      c('div', { className: 'card', style: { padding: '16px', margin: '12px 0' } }, [
        ta,
        c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' } }, [saveBtn, suggestBtn]),
      ]),
      c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0' } },
        t('mem.privacyNote', 'Stored in your parent project’s user layer (config/memory.md) — never overwritten by updates, and only ever sent inside the LLM prompts you run.')),
    ]),
    result: c('div', null, [runHost, suggestionOut]),
  });
  root.appendChild(page.root);

  return root;
});

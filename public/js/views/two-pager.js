/* global Router, API, UI, I18n, HelpHint */
/**
 * #/two-pager — Candidate market fit: the two-pager (v1.89.0, Epic 14).
 *
 * A guided builder for the "Mnookin two-pager" (from *Never Search Alone*):
 * who I am, what I love, my must-haves, what I hate, my deal-breakers, my
 * non-negotiables, and my target environment. It is USER career-framing
 * content — persisted to the parent's user layer (`config/two-pager.yml`) via
 * PUT /api/two-pager and inlined into every evaluation prompt server-side.
 *
 * Two assists:
 *   • "AI fill assistant" (POST /api/two-pager/draft) returns a ready-to-run
 *     Mnookin prompt with the user's CV + profile inlined. We show it in a
 *     modal to copy/paste into any provider — no fabricated content, no
 *     silent live call.
 *   • The saved two-pager powers a "fit-to-what-you-want" badge on scan cards
 *     (see scan.js + window.FitScore).
 */
Router.register('two-pager', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(HelpHint.title(t('twoPager.title', 'Your two-pager'), 'help.hint.twoPager'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('twoPager.subtitle', 'What YOU actually want from your next role. Feeds every evaluation and powers a fit-to-what-you-want score on each posting.')));

  // Load the saved two-pager (empty-safe).
  let data;
  try { ({ twoPager: data } = await API.get('/api/two-pager')); }
  catch { data = null; }
  data = data || { who_i_am: '', loves: [], must_haves: [], hates: [], deal_breakers: [], non_negotiables: [], target_environment: '' };

  // ── free-text blocks ──
  const whoField = textareaField('twoPager.whoLabel', 'Who I am',
    'twoPager.whoPh', 'A few first-person sentences: your track record, what you optimize for, the shape of role you thrive in.',
    data.who_i_am, 5);
  const envField = textareaField('twoPager.envLabel', 'Target environment',
    'twoPager.envPh', 'The company size, stage, and culture you want (e.g. "Series A–B product company, remote-first, small autonomous teams").',
    data.target_environment, 3);

  function textareaField(labelKey, labelFb, phKey, phFb, value, rows) {
    const ta = c('textarea', { className: 'input', rows: String(rows), 'data-i18n-placeholder': phKey });
    ta.placeholder = t(phKey, phFb);
    ta.value = value || '';
    const wrap = c('label', { className: 'field', style: { display: 'block', margin: '0 0 18px' } }, [
      c('span', { className: 'field-label', style: { display: 'block', fontWeight: '600', margin: '0 0 6px' } }, t(labelKey, labelFb)),
      ta,
    ]);
    return { wrap, get: () => ta.value, set: (v) => { ta.value = v || ''; } };
  }

  // ── tag-list editors (loves / must_haves / hates / deal_breakers / non_negotiables) ──
  const lists = [
    { key: 'loves', labelKey: 'twoPager.loves', labelFb: 'What I love', hintKey: 'twoPager.lovesHint', hintFb: 'Energizers — remote, ownership, greenfield, mentoring…', tone: 'pos' },
    { key: 'must_haves', labelKey: 'twoPager.mustHaves', labelFb: 'Must-haves', hintKey: 'twoPager.mustHavesHint', hintFb: 'Required — comp floor, a country, a stack…', tone: 'pos' },
    { key: 'hates', labelKey: 'twoPager.hates', labelFb: 'What I hate', hintKey: 'twoPager.hatesHint', hintFb: 'Drainers — on-call, endless meetings, legacy-only…', tone: 'neg' },
    { key: 'deal_breakers', labelKey: 'twoPager.dealBreakers', labelFb: 'Deal-breakers', hintKey: 'twoPager.dealBreakersHint', hintFb: 'Hard nos — onsite only, no sponsorship, sub-$X…', tone: 'neg' },
    { key: 'non_negotiables', labelKey: 'twoPager.nonNegotiables', labelFb: 'Non-negotiables', hintKey: 'twoPager.nonNegotiablesHint', hintFb: 'Boundaries — location, remote, comp floor…', tone: 'pos' },
  ];

  const editors = {};
  const getters = {};
  const grid = c('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '0 0 18px' } });
  for (const spec of lists) {
    const editor = tagEditor(Array.isArray(data[spec.key]) ? data[spec.key] : [], spec, t, c);
    editors[spec.key] = editor;
    getters[spec.key] = editor.get;
    grid.appendChild(editor.node);
  }

  root.appendChild(whoField.wrap);
  root.appendChild(grid);
  root.appendChild(envField.wrap);

  // ── actions ──
  const draftBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('twoPager.aiFill', '✨ AI fill assistant'));
  const previewBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('twoPager.preview', '👁 Preview & export'));
  const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('twoPager.save', 'Save two-pager'));
  // P4-ETA (v1.170.0) — honest duration hint next to the ✨ AI-fill generation.
  const draftEta = c('span', { className: 'eta-hint', title: t('common.etaTitle', 'Typical generation time') },
    '⏱ ' + t('common.eta', '~{n}s').replace('{n}', '20'));
  const actions = c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 8px' } }, [saveBtn, draftBtn, draftEta, previewBtn]);
  root.appendChild(actions);
  root.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 24px' } },
    t('twoPager.privacyNote', 'Stored in your parent project’s user layer (config/two-pager.yml) — never sent anywhere except the LLM prompts you run.')));

  function collect() {
    return {
      who_i_am: whoField.get(),
      target_environment: envField.get(),
      loves: getters.loves(),
      must_haves: getters.must_haves(),
      hates: getters.hates(),
      deal_breakers: getters.deal_breakers(),
      non_negotiables: getters.non_negotiables(),
    };
  }

  // Render the current fields as a formatted two-pager document (for preview + export).
  function buildMarkdown() {
    const d = collect();
    const lines = ['# ' + t('twoPager.title', 'Your two-pager'), ''];
    if (d.who_i_am && d.who_i_am.trim()) lines.push('## ' + t('twoPager.whoLabel', 'Who I am'), d.who_i_am.trim(), '');
    const sec = (label, arr) => {
      if (Array.isArray(arr) && arr.length) { lines.push('## ' + label); arr.forEach((x) => lines.push('- ' + x)); lines.push(''); }
    };
    sec(t('twoPager.loves', 'What I love'), d.loves);
    sec(t('twoPager.mustHaves', 'Must-haves'), d.must_haves);
    sec(t('twoPager.hates', 'What I hate'), d.hates);
    sec(t('twoPager.dealBreakers', 'Deal-breakers'), d.deal_breakers);
    sec(t('twoPager.nonNegotiables', 'Non-negotiables'), d.non_negotiables);
    if (d.target_environment && d.target_environment.trim()) lines.push('## ' + t('twoPager.envLabel', 'Target environment'), d.target_environment.trim(), '');
    return lines.join('\n');
  }

  previewBtn.addEventListener('click', () => {
    const md = buildMarkdown();
    const body = c('div', null, [
      c('div', { className: 'card md', html: UI.md(md), style: { padding: '16px', maxHeight: '50vh', overflow: 'auto' } }),
      window.ReportExport ? ReportExport.actionsBar(() => buildMarkdown(), () => t('twoPager.title', 'Your two-pager'), t) : null,
    ]);
    UI.modal(t('twoPager.preview', 'Preview & export'), body);
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await API.put('/api/two-pager', collect());
      UI.toast(t('twoPager.saved', 'Two-pager saved'), 'success');
    } catch (err) {
      UI.toast((err && err.message) || t('twoPager.saveFailed', 'Could not save the two-pager'), 'error');
    } finally { saveBtn.disabled = false; }
  });

  // Apply a live-generated (or pasted) two-pager onto the form editors.
  function applyFields(f) {
    if (!f || typeof f !== 'object') return;
    if ('who_i_am' in f) whoField.set(f.who_i_am);
    if ('target_environment' in f) envField.set(f.target_environment);
    for (const spec of lists) {
      const ed = editors[spec.key];
      if (ed && Array.isArray(f[spec.key])) ed.set(f[spec.key]);
    }
  }

  function showManualPrompt(prompt) {
    const body = c('div', null, [
      c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
        t('twoPager.aiFillHelp', 'Run this in any LLM, then paste the YAML fields back into the form above. It uses only your CV and profile — nothing is invented.')),
      c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, prompt),
    ]);
    UI.modal(t('twoPager.aiFill', '✨ AI fill assistant'), body);
  }

  draftBtn.addEventListener('click', async () => {
    draftBtn.disabled = true;
    draftBtn.textContent = t('twoPager.aiFilling', '✨ Filling…');
    try {
      // Ask the server to run it live; it falls back to a manual prompt when no
      // provider is configured. Auto-fill only ever populates editable fields —
      // the user still reviews and clicks Save.
      const res = await API.post('/api/two-pager/draft', { run: true, lang: (I18n.getLang && I18n.getLang()) || 'en' });
      if (res && res.fields) {
        applyFields(res.fields);
        UI.toast(t('twoPager.aiFilled', 'Fields drafted from your CV — review, then Save'), 'success');
      } else if (res && res.prompt) {
        showManualPrompt(res.prompt);
      }
    } catch (err) {
      UI.toast((err && err.message) || t('twoPager.aiFillFailed', 'Could not draft the two-pager'), 'error');
    } finally {
      draftBtn.disabled = false;
      draftBtn.textContent = t('twoPager.aiFill', '✨ AI fill assistant');
    }
  });

  return root;
});

/**
 * A small chip-list editor: type + Enter (or comma) to add a tag, click × to
 * remove. Returns { node, get } where get() yields the current string[].
 * CSP-safe: all handlers via addEventListener, no inline markup from input.
 */
function tagEditor(initial, spec, t, c) {
  const chips = c('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 8px' } });
  const items = [];
  const toneColor = spec.tone === 'neg' ? 'var(--danger, #d9534f)' : 'var(--accent, #4c8bf5)';

  function addChip(text) {
    const value = String(text || '').trim();
    if (!value || items.includes(value)) return;
    items.push(value);
    const chip = c('span', {
      className: 'chip',
      style: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '12px', fontSize: '13px', background: 'var(--panel-2, #eef1f6)', border: `1px solid ${toneColor}` },
    }, [
      c('span', null, value),
      c('button', {
        type: 'button', className: 'chip-x', 'aria-label': t('twoPager.removeTag', 'Remove'),
        style: { border: 'none', background: 'none', cursor: 'pointer', color: 'var(--foggy)', fontSize: '15px', lineHeight: '1', padding: '0' },
      }, '×'),
    ]);
    chip.querySelector('.chip-x').addEventListener('click', () => {
      const i = items.indexOf(value);
      if (i > -1) items.splice(i, 1);
      chip.remove();
    });
    chips.appendChild(chip);
  }

  const input = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'twoPager.addTagPh', 'data-i18n-aria-label': 'twoPager.addTagPh' });
  input.placeholder = t('twoPager.addTagPh', 'Type and press Enter…');
  input.setAttribute('aria-label', input.placeholder);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input.value);
      input.value = '';
    }
  });
  input.addEventListener('blur', () => { if (input.value.trim()) { addChip(input.value); input.value = ''; } });

  (Array.isArray(initial) ? initial : []).forEach(addChip);

  const node = c('div', { className: 'card', style: { padding: '14px' } }, [
    c('div', { style: { fontWeight: '600', margin: '0 0 2px' } }, t(spec.labelKey, spec.labelFb)),
    c('div', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 10px' } }, t(spec.hintKey, spec.hintFb)),
    chips,
    input,
  ]);

  function set(newItems) {
    items.length = 0;
    while (chips.firstChild) chips.removeChild(chips.firstChild);
    (Array.isArray(newItems) ? newItems : []).forEach(addChip);
  }

  return { node, get: () => items.slice(), set };
}

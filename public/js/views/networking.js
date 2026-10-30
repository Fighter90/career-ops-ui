/* global Router, API, UI, I18n, HelpHint */
/**
 * #/networking — Networking & deep company research (v1.91.0, Epic 16).
 *
 * Given a company (+ optional role / JD) it builds a networking plan: a company
 * dossier, who-to-contact personas with LinkedIn search strings, the warmest
 * realistic intro path, and tailored outreach drafts — grounded server-side in
 * the user's CV / profile / two-pager. Runs live with a provider key, or hands
 * back a copy-paste prompt. Finished plans save to the user layer (networking/).
 *
 * CAR-119 — the page renders through the shared LlmPageKit template:
 * two-column form|result, a progress/ETA/Cancel run panel over the plan POST,
 * tracker autofill for company/role, and the saved-plans list as a kit
 * history drawer (same endpoints, card UI + confirm-gated delete).
 * // CAR-119 i18n: no new dictionary keys — the kit's `llm2.*` strings ship
 * as I18n.t EN fallbacks inside public/js/lib/llm-page-kit.js.
 */
Router.register('networking', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(HelpHint.title(t('net.title', 'Networking & research'), 'help.hint.networking'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('net.subtitle', 'Turn a company into a plan: who to contact, the warmest way in, and outreach drafts — grounded in your CV and two-pager.')));

  // aria-labels mirror the localized placeholders (a placeholder is not a
  // reliable accessible name once the field has content) — no new keys.
  const companyInput = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'net.companyPh', 'data-i18n-aria-label': 'net.companyPh' });
  companyInput.placeholder = t('net.companyPh', 'Company (required)');
  companyInput.setAttribute('aria-label', companyInput.placeholder);
  const roleInput = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'net.rolePh', 'data-i18n-aria-label': 'net.rolePh' });
  roleInput.placeholder = t('net.rolePh', 'Role (optional)');
  roleInput.setAttribute('aria-label', roleInput.placeholder);
  const jdInput = c('textarea', { className: 'input', rows: '3', 'data-i18n-placeholder': 'net.jdPh', 'data-i18n-aria-label': 'net.jdPh' });
  jdInput.placeholder = t('net.jdPh', 'Paste the job description (optional) — sharpens the fit hooks.');
  jdInput.setAttribute('aria-label', jdInput.placeholder);

  const buildBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('net.build', 'Build plan'));
  // CAR-119 — run/progress host + tracker autofill (company/role fields).
  const runHost = c('div');
  const picker = window.LlmPageKit.jobPicker({
    map: { company: 'company', role: 'role' },
    fields: { company: companyInput, role: roleInput },
  });
  const setup = c('div', { className: 'card', style: { padding: '16px', margin: '12px 0 18px', display: 'grid', gap: '10px' } }, [
    field(t('net.companyLabel', 'Company'), companyInput),
    field(t('net.roleLabel', 'Role'), roleInput),
    field(t('net.jdLabel', 'Job description'), jdInput),
    c('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' } }, [
      buildBtn,
      // P4-ETA (v1.170.0) — honest duration hint for a long AI generation.
      c('span', { className: 'eta-hint', title: t('common.etaTitle', 'Typical generation time') },
        '⏱ ' + t('common.eta', '~{n}s').replace('{n}', '30')),
    ]),
  ]);
  const output = c('div', { style: { margin: '0 0 18px' } });
  const page = window.LlmPageKit.layout({
    form: c('div', null, [picker, setup]),
    result: c('div', null, [runHost, output]),
  });
  root.appendChild(page.root);

  function field(label, el) {
    return c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [label, el]);
  }

  let current = { company: '', role: '', markdown: '' };

  buildBtn.addEventListener('click', async () => {
    const company = companyInput.value.trim();
    if (!company) { UI.toast(t('net.needCompany', 'Enter a company first'), 'error'); return; }
    current = { company, role: roleInput.value.trim(), markdown: '' };
    output.textContent = '';
    buildBtn.disabled = true;
    // CAR-119 — the shared run panel replaces the static "Researching…" line:
    // synchronous paint, live elapsed/ETA, Cancel aborts the POST.
    const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 30, onBegin: () => page.show('result') }).mount(runHost);
    try {
      const res = await window.LlmPageKit.run({
        run: runCtrl,
        failText: t('net.buildFailed', 'Could not build the plan'),
        intro: t('net.building', 'Researching and drafting…'),
        request: (signal) => window.LlmPageKit.postJSON('/api/networking/plan',
          { company, role: current.role, jd: jdInput.value.trim(), run: true }, signal),
      });
      if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
      if (res && res.markdown) {
        current.markdown = res.markdown;
        renderPlan(res.markdown);
      } else {
        showManualPrompt(res && res.prompt);
      }
    } catch {
      // CAR-119 review #4 — the kit's llm2run--fail panel (role=alert, right
      // above the output) is the single announcement; the toast is gone.
    } finally { buildBtn.disabled = false; }
  });

  function renderPlan(markdown) {
    const saveBtn = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('net.save', 'Save plan'));
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const { name } = await API.post('/api/networking/save', { company: current.company, role: current.role, plan: markdown });
        UI.toast(t('net.saved', 'Plan saved') + ' · ' + name, 'success');
        refreshPlans();
      } catch (err) {
        UI.toast((err && err.message) || t('net.saveFailed', 'Could not save the plan'), 'error');
      } finally { saveBtn.disabled = false; }
    });
    output.appendChild(c('div', { className: 'card', style: { padding: '16px' } }, [
      c('div', { className: 'md', html: UI.md(markdown) }),
      c('div', { style: { marginTop: '12px' } }, saveBtn),
    ]));
  }

  function showManualPrompt(prompt) {
    const dump = c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, prompt);
    A11yDump.label(dump, t('a11y.readonlyOutput', 'Generated result — read only'));
    const body = c('div', null, [
      c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
        t('net.manualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the plan back here or save it from there.')),
      dump,
    ]);
    UI.modal(t('net.manualTitle', 'Run this plan manually'), body);
  }

  // ── saved plans ──
  // CAR-119 — the hand-rolled list became the kit's history drawer (same
  // endpoints; the drawer's labels reuse this view's already-translated
  // strings, so no dictionary change).
  const saved = window.LlmPageKit.historyDrawer({
    title: t('net.savedTitle', 'Saved plans'),
    labels: {
      view: t('net.view', 'View'),
      del: t('net.delete', 'Delete'),
      confirm: t('net.confirmDelete', 'Delete this saved plan?'),
      empty: t('net.savedEmpty', 'No saved plans yet — build one and click “Save plan”.'),
    },
    load: async () => {
      // review #12 — errors propagate to the drawer's role=alert state;
      // swallowing here would read a failure as "nothing saved yet".
      const { plans } = await API.get('/api/networking/plans');
      return plans || [];
    },
    onView: async (s) => {
      try {
        const { markdown } = await API.get(`/api/networking/plans/${encodeURIComponent(s.name)}`);
        UI.modal(s.name, c('div', { className: 'md', html: UI.md(markdown) }));
      } catch (err) { UI.toast((err && err.message) || t('common.error', 'Error'), 'error'); }
    },
    onDelete: async (s) => {
      await API.del(`/api/networking/plans/${encodeURIComponent(s.name)}`);
    },
  });
  root.appendChild(saved.el);
  // renderPlan refreshes the drawer after a successful save (the old
  // loadPlans() call site).
  const refreshPlans = saved.refresh;
  await refreshPlans();

  return root;
});

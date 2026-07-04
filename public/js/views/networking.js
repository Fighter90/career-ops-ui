/* global Router, API, UI, I18n */
/**
 * #/networking — Networking & deep company research (v1.91.0, Epic 16).
 *
 * Given a company (+ optional role / JD) it builds a networking plan: a company
 * dossier, who-to-contact personas with LinkedIn search strings, the warmest
 * realistic intro path, and tailored outreach drafts — grounded server-side in
 * the user's CV / profile / two-pager. Runs live with a provider key, or hands
 * back a copy-paste prompt. Finished plans save to the user layer (networking/).
 */
Router.register('networking', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('net.title', 'Networking & research')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('net.subtitle', 'Turn a company into a plan: who to contact, the warmest way in, and outreach drafts — grounded in your CV and two-pager.')));

  const companyInput = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'net.companyPh' });
  companyInput.placeholder = t('net.companyPh', 'Company (required)');
  const roleInput = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'net.rolePh' });
  roleInput.placeholder = t('net.rolePh', 'Role (optional)');
  const jdInput = c('textarea', { className: 'input', rows: '3', 'data-i18n-placeholder': 'net.jdPh' });
  jdInput.placeholder = t('net.jdPh', 'Paste the job description (optional) — sharpens the fit hooks.');

  const buildBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('net.build', 'Build plan'));
  const setup = c('div', { className: 'card', style: { padding: '16px', margin: '12px 0 18px', display: 'grid', gap: '10px' } }, [
    field(t('net.companyLabel', 'Company'), companyInput),
    field(t('net.roleLabel', 'Role'), roleInput),
    field(t('net.jdLabel', 'Job description'), jdInput),
    c('div', null, buildBtn),
  ]);
  root.appendChild(setup);

  function field(label, el) {
    return c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [label, el]);
  }

  const output = c('div', { style: { margin: '0 0 18px' } });
  root.appendChild(output);

  let current = { company: '', role: '', markdown: '' };

  buildBtn.addEventListener('click', async () => {
    const company = companyInput.value.trim();
    if (!company) { UI.toast(t('net.needCompany', 'Enter a company first'), 'error'); return; }
    current = { company, role: roleInput.value.trim(), markdown: '' };
    output.textContent = '';
    buildBtn.disabled = true;
    const pending = c('div', { className: 'loading', style: { color: 'var(--foggy)' } }, t('net.building', 'Researching and drafting…'));
    output.appendChild(pending);
    try {
      const res = await API.post('/api/networking/plan', { company, role: current.role, jd: jdInput.value.trim(), run: true });
      pending.remove();
      if (res.markdown) {
        current.markdown = res.markdown;
        renderPlan(res.markdown);
      } else {
        showManualPrompt(res.prompt);
      }
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('net.buildFailed', 'Could not build the plan'), 'error');
    } finally { buildBtn.disabled = false; }
  });

  function renderPlan(markdown) {
    const saveBtn = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('net.save', 'Save plan'));
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const { name } = await API.post('/api/networking/save', { company: current.company, role: current.role, plan: markdown });
        UI.toast(t('net.saved', 'Plan saved') + ' · ' + name, 'success');
        loadPlans();
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
    const body = c('div', null, [
      c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
        t('net.manualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the plan back here or save it from there.')),
      c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, prompt),
    ]);
    UI.modal(t('net.manualTitle', 'Run this plan manually'), body);
  }

  // ── saved plans ──
  const savedWrap = c('div');
  root.appendChild(c('h2', { style: { fontSize: '15px', margin: '18px 0 8px' } }, t('net.savedTitle', 'Saved plans')));
  root.appendChild(savedWrap);

  async function loadPlans() {
    savedWrap.textContent = '';
    let plans = [];
    try { ({ plans } = await API.get('/api/networking/plans')); } catch { plans = []; }
    if (!plans || !plans.length) {
      savedWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } }, t('net.savedEmpty', 'No saved plans yet — build one and click “Save plan”.')));
      return;
    }
    const list = c('ul', { style: { listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '6px' } },
      plans.map((s) => {
        const open = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('net.view', 'View'));
        open.addEventListener('click', async () => {
          try {
            const { markdown } = await API.get(`/api/networking/plans/${encodeURIComponent(s.name)}`);
            UI.modal(s.name, c('div', { className: 'md', html: UI.md(markdown) }));
          } catch (err) { UI.toast((err && err.message) || 'Error', 'error'); }
        });
        const del = c('button', { className: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': t('net.delete', 'Delete') }, '🗑');
        del.addEventListener('click', async () => {
          if (!(await UI.confirm(t('net.confirmDelete', 'Delete this saved plan?')))) return;
          try { await API.del(`/api/networking/plans/${encodeURIComponent(s.name)}`); loadPlans(); }
          catch (err) { UI.toast((err && err.message) || 'Error', 'error'); }
        });
        return c('li', { className: 'card', style: { padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' } }, [
          c('span', { style: { fontSize: '13px' } }, s.name),
          c('span', { style: { display: 'flex', gap: '6px' } }, [open, del]),
        ]);
      }));
    savedWrap.appendChild(list);
  }
  await loadPlans();

  return root;
});

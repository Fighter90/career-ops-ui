/* global Router, API, UI, I18n */
/**
 * #/assessments — Skills self-assessment log.
 *
 * Record a skills-assessment event (company + platform + skill + optional
 * score % and note) and review past entries. The WRITE relays to the parent's
 * assessment-log.mjs, which appends one row to the append-only user-layer
 * data/assessments.tsv; the list is a read-only relay of the same script's
 * JSON. Honest empty / unavailable states; no LLM, no other writes.
 *
 * CSP-safe: DOM built with UI.el + addEventListener + textContent only — no
 * innerHTML, no inline handlers.
 */
Router.register('assessments', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('asmt.title', 'Skills self-assessment log')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('asmt.subtitle', 'Log a skills assessment you took — the platform, the skill, and how you scored — and track them over time.')));

  // Placeholder-as-label inputs (aria-label mirrors the localized placeholder,
  // which is not a reliable accessible name once the field has content).
  function input(phKey, phFallback, opts) {
    const el = c('input', {
      type: (opts && opts.type) || 'text',
      className: 'input',
      'data-i18n-placeholder': phKey,
      'data-i18n-aria-label': phKey,
    });
    el.placeholder = t(phKey, phFallback);
    el.setAttribute('aria-label', el.placeholder);
    if (opts && opts.type === 'number') { el.min = '0'; el.max = '100'; el.step = '1'; }
    return el;
  }

  const companyInput = input('asmt.companyPh', 'Company (required)');
  const platformInput = input('asmt.platformPh', 'Platform, e.g. HackerRank, eSkill (required)');
  const subjectInput = input('asmt.subjectPh', 'Skill / subject, e.g. JavaScript (required)');
  const scoreInput = input('asmt.scorePh', 'Your score % — optional, 0–100', { type: 'number' });
  const staleInput = input('asmt.stalePh', 'Note — optional (e.g. outdated test content)');

  const saveBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('asmt.save', 'Log assessment'));

  const form = c('div', { className: 'card', style: { padding: '16px', margin: '12px 0 18px', display: 'grid', gap: '10px' } }, [
    companyInput, platformInput, subjectInput, scoreInput, staleInput,
    c('div', {}, saveBtn),
  ]);
  root.appendChild(form);

  root.appendChild(c('h2', { style: { fontSize: '15px', margin: '18px 0 8px' } }, t('asmt.listTitle', 'Logged assessments')));
  const listWrap = c('div');
  root.appendChild(listWrap);

  saveBtn.addEventListener('click', async () => {
    const company = companyInput.value.trim();
    const platform = platformInput.value.trim();
    const subject = subjectInput.value.trim();
    if (!company || !platform || !subject) {
      UI.toast(t('asmt.needFields', 'Company, platform and skill are required'), 'error');
      return;
    }
    saveBtn.disabled = true;
    const original = saveBtn.textContent;
    saveBtn.textContent = t('asmt.saving', 'Saving…');
    try {
      await API.post('/api/assessments', {
        company,
        platform,
        subject,
        score: scoreInput.value.trim(),
        stale: staleInput.value.trim(),
      });
      UI.toast(t('asmt.saved', 'Assessment logged'), 'success');
      companyInput.value = '';
      platformInput.value = '';
      subjectInput.value = '';
      scoreInput.value = '';
      staleInput.value = '';
      await loadList();
    } catch (err) {
      UI.toast((err && err.message) || t('asmt.saveFailed', 'Could not log the assessment'), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  function renderRow(a) {
    if (!a) return null; // skip a malformed element rather than drop the whole list
    const head = c('div', { style: { display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' } }, [
      c('strong', {}, String(a.company || '—')),
      c('span', { style: { color: 'var(--foggy)', fontSize: '12px' } }, String(a.date || '')),
    ]);
    const mid = c('div', { style: { fontSize: '13px' } },
      `${String(a.platform || '')} · ${String(a.subject || '')}`);
    const meta = c('div', { style: { fontSize: '12px', color: 'var(--foggy)', marginTop: '2px' } });
    const bits = [];
    if (a.score != null) bits.push(`${a.score}%`);
    if (a.threshold != null) bits.push(`/ ${a.threshold}%`);
    if (bits.length) meta.appendChild(document.createTextNode(bits.join(' ')));
    if (a.staleNote) {
      meta.appendChild(c('span', { className: 'badge badge-warn', style: { marginLeft: bits.length ? '8px' : '0' } },
        `${t('asmt.stale', 'stale')}: ${String(a.staleNote)}`));
    }
    return c('li', { className: 'card', style: { padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' } },
      [head, mid, meta]);
  }

  async function loadList() {
    listWrap.textContent = '';
    listWrap.appendChild(c('div', { className: 'loading' }, t('asmt.loading', 'Loading…')));
    let res;
    try {
      res = await API.get('/api/assessments');
    } catch (err) {
      listWrap.textContent = '';
      listWrap.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } },
        (err && err.message) || t('asmt.saveFailed', 'Could not load the log')));
      return;
    }
    listWrap.textContent = '';
    if (!res || res.available === false) {
      listWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } },
        t('asmt.unavailable', 'The assessment log is unavailable here — the parent career-ops assessment-log script was not found.')));
      return;
    }
    const rows = Array.isArray(res.assessments) ? res.assessments : [];
    if (!rows.length) {
      listWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } },
        t('asmt.listEmpty', 'No assessments logged yet — record one above.')));
      return;
    }
    const total = (res.quality && res.quality.total != null) ? res.quality.total : rows.length;
    listWrap.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' } },
      t('asmt.total', '{n} logged').replace('{n}', String(total))));
    // Newest first — the log is append-only, so reverse the read order.
    const list = c('ul', { style: { listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '6px' } },
      rows.slice().reverse().map(renderRow));
    listWrap.appendChild(list);
  }

  await loadList();
  return root;
});

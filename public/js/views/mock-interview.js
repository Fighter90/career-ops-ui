/* global Router, API, UI, I18n */
/**
 * #/mock-interview — Mock Interview 2.0 (v1.90.0, Epic 15).
 *
 * Turn-by-turn conversational rehearsal. The user sets a target role (+ optional
 * company / JD), the interviewer opens with a question, and each answer gets
 * per-answer feedback (STAR+R gaps), a score, and a follow-up. All grounded in
 * the user's CV / profile / two-pager / story bank server-side. With a provider
 * key it runs live; without one it hands back a copy-paste prompt (honest — no
 * fabricated answers). Finished transcripts can be saved to the user layer.
 */
Router.register('mock-interview', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('mock.title', 'Mock interview')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('mock.subtitle', 'Rehearse turn by turn against a real role. Every answer gets STAR+R feedback, a score, and a follow-up — grounded in your CV, two-pager, and story bank.')));

  // ── setup bar ──
  const roleInput = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'mock.rolePh' });
  roleInput.placeholder = t('mock.rolePh', 'Target role (e.g. Senior Backend Engineer)');
  const companyInput = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'mock.companyPh' });
  companyInput.placeholder = t('mock.companyPh', 'Company (optional)');
  const jdInput = c('textarea', { className: 'input', rows: '3', 'data-i18n-placeholder': 'mock.jdPh' });
  jdInput.placeholder = t('mock.jdPh', 'Paste the job description (optional) — sharpens the questions.');

  const startBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('mock.start', 'Start interview'));
  const setup = c('div', { className: 'card', style: { padding: '16px', margin: '12px 0 20px', display: 'grid', gap: '10px' } }, [
    field(t('mock.roleLabel', 'Role'), roleInput),
    field(t('mock.companyLabel', 'Company'), companyInput),
    field(t('mock.jdLabel', 'Job description'), jdInput),
    c('div', null, startBtn),
  ]);
  root.appendChild(setup);

  function field(label, el) {
    return c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [label, el]);
  }

  // ── conversation ──
  const convo = c('div', { style: { display: 'none', margin: '0 0 16px' } });
  const thread = c('div', { role: 'log', 'aria-live': 'polite', style: { display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 0 14px' } });
  const answerBox = c('textarea', { className: 'input', rows: '4', 'data-i18n-placeholder': 'mock.answerPh' });
  answerBox.placeholder = t('mock.answerPh', 'Type your answer, then Send…');
  const sendBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('mock.send', 'Send answer'));
  const saveBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('mock.save', 'Save transcript'));
  const restartBtn = c('button', { className: 'btn btn-ghost', type: 'button' }, t('mock.restart', 'New interview'));
  const convoActions = c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0 0' } }, [sendBtn, saveBtn, restartBtn]);
  convo.append(thread, field(t('mock.yourAnswer', 'Your answer'), answerBox), convoActions);
  root.appendChild(convo);

  // history = [{ speaker, text }]; mirrors the server contract.
  const history = [];
  let session = { role: '', company: '', jd: '' };

  function bubble(speaker, markdown) {
    const mine = speaker === 'candidate';
    const who = mine ? t('mock.you', 'You') : t('mock.interviewer', 'Interviewer');
    return c('div', {
      className: 'card',
      style: {
        padding: '12px 14px', maxWidth: '90%', alignSelf: mine ? 'flex-end' : 'flex-start',
        background: mine ? 'var(--panel-2, #eef1f6)' : 'var(--panel, #fff)',
        borderLeft: mine ? 'none' : '3px solid var(--accent, #4c8bf5)',
      },
    }, [
      c('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--foggy)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, who),
      c('div', { className: 'md', html: UI.md(markdown) }),
    ]);
  }

  async function requestTurn() {
    sendBtn.disabled = true; startBtn.disabled = true;
    const pending = c('div', { className: 'loading', style: { alignSelf: 'flex-start', color: 'var(--foggy)' } }, t('mock.thinking', 'Interviewer is thinking…'));
    thread.appendChild(pending);
    try {
      const res = await API.post('/api/mock-interview/turn', { role: session.role, company: session.company, jd: session.jd, history, run: true, lang: (I18n.getLang && I18n.getLang()) || 'en' });
      pending.remove();
      if (res.markdown) {
        history.push({ speaker: 'interviewer', text: res.markdown });
        thread.appendChild(bubble('interviewer', res.markdown));
      } else {
        // No provider key → show the copy-paste prompt honestly in a modal.
        showManualPrompt(res.prompt);
      }
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('mock.turnFailed', 'Could not get the next turn'), 'error');
    } finally {
      sendBtn.disabled = false; startBtn.disabled = false;
      thread.scrollIntoView({ block: 'end' });
    }
  }

  function showManualPrompt(prompt) {
    const body = c('div', null, [
      c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
        t('mock.manualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the interviewer’s reply back in as your next answer prompt.')),
      c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, prompt),
    ]);
    UI.modal(t('mock.manualTitle', 'Run this turn manually'), body);
  }

  startBtn.addEventListener('click', () => {
    const role = roleInput.value.trim();
    const jd = jdInput.value.trim();
    if (!role && !jd) { UI.toast(t('mock.needRole', 'Enter a role or paste a job description first'), 'error'); return; }
    session = { role, company: companyInput.value.trim(), jd };
    history.length = 0;
    thread.textContent = '';
    setup.style.display = 'none';
    convo.style.display = 'block';
    requestTurn();
  });

  sendBtn.addEventListener('click', () => {
    const text = answerBox.value.trim();
    if (!text) return;
    history.push({ speaker: 'candidate', text });
    thread.appendChild(bubble('candidate', text));
    answerBox.value = '';
    requestTurn();
  });

  restartBtn.addEventListener('click', () => {
    convo.style.display = 'none';
    setup.style.display = 'grid';
    startBtn.disabled = false;
  });

  saveBtn.addEventListener('click', async () => {
    if (!history.length) { UI.toast(t('mock.nothingToSave', 'Nothing to save yet'), 'error'); return; }
    const transcript = history
      .map((h) => `**${h.speaker === 'candidate' ? t('mock.you', 'You') : t('mock.interviewer', 'Interviewer')}:**\n\n${h.text}`)
      .join('\n\n---\n\n');
    saveBtn.disabled = true;
    try {
      const { name } = await API.post('/api/mock-interview/save', { role: session.role, company: session.company, transcript });
      UI.toast(t('mock.saved', 'Transcript saved') + ' · ' + name, 'success');
      loadSessions();
    } catch (err) {
      UI.toast((err && err.message) || t('mock.saveFailed', 'Could not save the transcript'), 'error');
    } finally { saveBtn.disabled = false; }
  });

  // ── saved sessions ──
  const savedWrap = c('div');
  root.appendChild(c('h2', { style: { fontSize: '15px', margin: '18px 0 8px' } }, t('mock.savedTitle', 'Saved sessions')));
  root.appendChild(savedWrap);

  async function loadSessions() {
    savedWrap.textContent = '';
    let sessions = [];
    try { ({ sessions } = await API.get('/api/mock-interview/sessions')); } catch { sessions = []; }
    if (!sessions || !sessions.length) {
      savedWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } }, t('mock.savedEmpty', 'No saved sessions yet — finish an interview and click “Save transcript”.')));
      return;
    }
    const list = c('ul', { style: { listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '6px' } },
      sessions.map((s) => {
        const open = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('mock.view', 'View'));
        open.addEventListener('click', async () => {
          try {
            const { markdown } = await API.get(`/api/mock-interview/sessions/${encodeURIComponent(s.name)}`);
            UI.modal(s.name, c('div', { className: 'md', html: UI.md(markdown) }));
          } catch (err) { UI.toast((err && err.message) || 'Error', 'error'); }
        });
        const del = c('button', { className: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': t('mock.delete', 'Delete') }, '🗑');
        del.addEventListener('click', async () => {
          if (!(await UI.confirm(t('mock.delete', 'Delete'), t('mock.confirmDelete', 'Delete this saved session?'), { danger: true }))) return;
          try { await API.del(`/api/mock-interview/sessions/${encodeURIComponent(s.name)}`); loadSessions(); }
          catch (err) { UI.toast((err && err.message) || 'Error', 'error'); }
        });
        return c('li', { className: 'card', style: { padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' } }, [
          c('span', { style: { fontSize: '13px' } }, s.name),
          c('span', { style: { display: 'flex', gap: '6px' } }, [open, del]),
        ]);
      }));
    savedWrap.appendChild(list);
  }
  await loadSessions();

  return root;
});

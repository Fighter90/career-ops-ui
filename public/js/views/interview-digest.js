/* global Router, API, UI, I18n, HelpHint */
/**
 * #/interview-digest — Weekly interview digest (v1.133.0).
 *
 * Read-only view over GET /api/interview/weekly-digest, which shells out to the
 * parent's zero-LLM weekly-digest.mjs — a mechanical roll-up of
 * interview-prep/sessions/*.md: which companies and rounds you interviewed with
 * this week, recurring competencies, and best-effort open gaps. USER-triggered
 * (the Load button). Honest empty/unavailable states; no writes, no LLM.
 */
Router.register('interview-digest', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(HelpHint.title(t('digest.title', 'Weekly interview digest'), 'help.hint.digest'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('digest.subtitle', 'A mechanical roll-up of your interview sessions this week — which companies and rounds, recurring competencies, and open gaps. Zero-LLM; reads your interview-prep session notes.')));

  const btn = c('button', { className: 'btn btn-primary', type: 'button' }, t('digest.load', 'Load this week'));
  root.appendChild(c('div', { style: { margin: '16px 0' } }, btn));

  const out = c('div');
  root.appendChild(out);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    out.textContent = '';
    out.appendChild(c('div', { className: 'loading' }, t('digest.loading', 'Rolling up your week…')));
    try {
      const res = await API.get('/api/interview/weekly-digest');
      out.textContent = '';
      if (!res || res.available === false) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('digest.unavailable', 'The weekly digest is unavailable here — the parent career-ops weekly-digest script was not found.')));
        return;
      }
      const m = res.metadata || {};
      const range = m.range || {};
      out.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' } },
        `${range.from || ''} → ${range.to || ''}`));

      const companies = Array.isArray(res.companies) ? res.companies : [];
      if (!companies.length) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('digest.empty', 'No interview sessions recorded in this range.')));
        return;
      }
      out.appendChild(c('p', {},
        `${m.sessionsInRange || 0} ${t('digest.sessions', 'sessions')} · ${m.companiesInRange || 0} ${t('digest.companies', 'companies')}`));

      const list = c('div', { className: 'card', style: { padding: '12px' } });
      for (const co of companies) {
        if (!co) continue; // skip a malformed element rather than drop the whole list
        const line = c('div', { style: { margin: '0 0 6px' } });
        line.appendChild(c('strong', {}, String(co.company || '—')));
        line.appendChild(document.createTextNode(` — ${String(co.role || '')}`));
        const rounds = Array.isArray(co.rounds) ? co.rounds.join(', ') : '';
        if (rounds) {
          line.appendChild(c('span', { style: { color: 'var(--foggy)' } },
            `  (${t('digest.rounds', 'rounds')}: ${rounds})`));
        }
        list.appendChild(line);
      }
      out.appendChild(list);

      const recur = Array.isArray(res.recurringCompetencies) ? res.recurringCompetencies : [];
      if (recur.length) {
        out.appendChild(c('h3', { style: { margin: '16px 0 6px' } }, t('digest.competencies', 'Recurring competencies')));
        const cl = c('div');
        for (const rc of recur) {
          if (!rc) continue;
          cl.appendChild(c('span', { className: 'badge badge-info', style: { marginRight: '6px' } },
            `${String(rc.tag || '')} (${rc.count || 0}×)`));
        }
        out.appendChild(cl);
      }

      const gaps = Array.isArray(res.recurringGaps) ? res.recurringGaps : [];
      if (gaps.length) {
        out.appendChild(c('h3', { style: { margin: '16px 0 6px' } }, t('digest.gaps', 'Open gaps')));
        const gl = c('ul');
        for (const g of gaps) {
          if (!g) continue;
          const n = Array.isArray(g.gaps) ? g.gaps.length : 0;
          gl.appendChild(c('li', {}, `${String(g.company || '')}: ${n} 🔴`));
        }
        out.appendChild(gl);
      }
    } catch (err) {
      out.textContent = '';
      out.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } },
        (err && err.message) || t('digest.failed', 'Could not load the digest')));
    } finally {
      btn.disabled = false;
    }
  });

  return root;
});

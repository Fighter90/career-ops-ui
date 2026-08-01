/* global Router, API, UI, I18n */
/**
 * #/funded — Funded-company discovery (v1.133.0, parent parity #2117).
 *
 * Read-only view over GET /api/company-funded, which shells out to the parent's
 * company-funded.mjs (review-first discovery from public, host-pinned RSS/JSON
 * feeds — TechCrunch / PR Newswire / The Guardian / Hacker News). USER-triggered
 * (the Discover button), never auto-loaded, because the relay makes live feed
 * fetches. Renders a ranked candidate list for MANUAL review; honest
 * empty/unavailable states. No writes, no LLM.
 */
Router.register('funded', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('funded.title', 'Funded companies')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('funded.subtitle', 'Recently funded companies to review as fresh targets — discovered from public funding news (TechCrunch, PR Newswire, The Guardian, Hacker News). A starting list for manual review, never an endorsement.')));

  const btn = c('button', { className: 'btn btn-primary', type: 'button' }, t('funded.discover', 'Discover'));
  root.appendChild(c('div', { style: { margin: '0 0 16px' } }, btn));

  const out = c('div');
  root.appendChild(out);
  root.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '12px 0 0' } },
    t('funded.note', 'Reads public funding feeds live — nothing is saved. Always verify a company independently before acting.')));

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    out.textContent = '';
    out.appendChild(c('div', { className: 'loading' }, t('funded.loading', 'Scanning funding feeds…')));
    try {
      const res = await API.get('/api/company-funded');
      out.textContent = '';
      if (!res || res.available === false) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('funded.unavailable', 'Discovery is unavailable here — the parent career-ops company-funded script was not found.')));
        return;
      }
      const cands = Array.isArray(res.candidates) ? res.candidates : [];
      if (!cands.length) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('funded.empty', 'No funded companies surfaced in this pass.')));
        return;
      }
      const sources = Array.isArray(res.sources) ? res.sources.join(', ') : '';
      out.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' } },
        `${cands.length} · ${sources}`));

      const table = c('table', { className: 'table' });
      table.appendChild(c('thead', {}, c('tr', {},
        c('th', {}, t('funded.company', 'Company')),
        c('th', {}, t('funded.signal', 'Funding signal')),
        c('th', {}, t('funded.source', 'Source')),
        c('th', {}, t('funded.date', 'Date')),
      )));
      const tbody = c('tbody');
      for (const cand of cands) {
        if (!cand) continue; // relay data originates from external feeds — skip a malformed row rather than drop the whole table
        const name = String(cand.company || '—');
        const url = (typeof cand.url === 'string' && /^https?:\/\//i.test(cand.url)) ? cand.url : '';
        const nameCell = url
          ? c('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, name)
          : name;
        const signal = String(cand.signal || (cand.funding && cand.funding.status) || cand.text || '—').slice(0, 200);
        const source = String(cand.source || '—');
        const date = String((cand.observedDate && cand.observedDate.value) || '—');
        tbody.appendChild(c('tr', {},
          c('td', {}, nameCell),
          c('td', {}, signal),
          c('td', {}, source),
          c('td', {}, date),
        ));
      }
      table.appendChild(tbody);
      out.appendChild(c('div', { style: { overflowX: 'auto' } }, table));
    } catch (err) {
      out.textContent = '';
      out.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } },
        (err && err.message) || t('funded.failed', 'Could not run discovery')));
    } finally {
      btn.disabled = false;
    }
  });

  return root;
});

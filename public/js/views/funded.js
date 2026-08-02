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
      // The parent company-funded.mjs emits the ranked list under `companies`
      // (each { company, amount, round, funding: { status, confidence,
      // sources: [{ source, title, url, observed_date, date_precision }] },
      // discovery_score, suggested_action }).
      const companies = Array.isArray(res.companies) ? res.companies : [];
      if (!companies.length) {
        out.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('funded.empty', 'No funded companies surfaced in this pass.')));
        // Surface the per-source diagnostics so an empty pass is legible — a
        // compact "source: status (fetched/funding-like)" line per feed makes a
        // quiet news day distinguishable from a blocked/errored feed. Only the
        // source name + status come from the parent (values, not translatable
        // UI copy), so no new i18n keys are needed. Read-only, informational.
        const diags = Array.isArray(res.diagnostics) ? res.diagnostics : [];
        for (const d of diags) {
          if (!d) continue;
          const blocked = d.blocked || (Array.isArray(d.errors) && d.errors.length) || d.status !== 'ok';
          out.appendChild(c('p', {
            style: { color: blocked ? 'var(--danger, #d9534f)' : 'var(--foggy)', fontSize: '12px', margin: '2px 0 0' },
          }, `${String(d.source || '?')}: ${String(d.status || '?')} (${d.fetched_items || 0}/${d.funding_like_items || 0})`));
        }
        return;
      }
      const sources = Array.isArray(res.sources) ? res.sources.join(', ') : '';
      out.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' } },
        `${companies.length} · ${sources}`));

      const table = c('table', { className: 'table' });
      table.appendChild(c('thead', {}, c('tr', {}, [
        c('th', {}, t('funded.company', 'Company')),
        c('th', {}, t('funded.signal', 'Funding signal')),
        c('th', {}, t('funded.source', 'Source')),
        c('th', {}, t('funded.date', 'Date')),
      ])));
      const tbody = c('tbody');
      for (const co of companies) {
        if (!co) continue; // relay data originates from external feeds — skip a malformed row rather than drop the whole table
        const name = String(co.company || '—');
        const ev = (co.funding && Array.isArray(co.funding.sources) && co.funding.sources[0]) || {};
        const url = (typeof ev.url === 'string' && /^https?:\/\//i.test(ev.url)) ? ev.url : '';
        const nameCell = url
          ? c('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, name)
          : name;
        // Funding signal: round + amount when present (e.g. "seed · $10M"),
        // otherwise the coarse funding status.
        const bits = [];
        if (co.round) bits.push(String(co.round));
        if (co.amount) bits.push(String(co.amount));
        const signal = (bits.length ? bits.join(' · ') : String((co.funding && co.funding.status) || '—')).slice(0, 200);
        const source = String(ev.source || '—');
        const date = String(ev.observed_date || '—');
        tbody.appendChild(c('tr', {}, [
          c('td', {}, nameCell),
          c('td', {}, signal),
          c('td', {}, source),
          c('td', {}, date),
        ]));
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

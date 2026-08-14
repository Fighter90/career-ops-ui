/* global Router, API, UI, I18n, HelpHint */
/**
 * #/funded — Funded-company discovery (v1.133.0).
 *
 * Read-only view over GET /api/company-funded, which shells out to the parent's
 * company-funded.mjs (review-first discovery from public, host-pinned RSS/JSON
 * feeds — TechCrunch / PR Newswire / The Guardian / Hacker News). USER-triggered
 * (the Discover button), never auto-loaded, because the relay makes live feed
 * fetches. Renders a ranked candidate list for MANUAL review; honest
 * empty/unavailable states. No writes, no LLM.
 */
/** Parse a free-text funding amount ("$10M", "€1.5B", "500K") to a magnitude in
 *  base units for charting. Currency is ignored (relative size only); returns 0
 *  when nothing parseable is present. Exported-ish via closure use only. */
function parseAmount(s) {
  if (typeof s !== 'string') return 0;
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*(b|bn|billion|m|mn|million|k|thousand)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return 0;
  const u = (m[2] || '').toLowerCase();
  const mult = /^b/.test(u) ? 1e9 : /^m/.test(u) ? 1e6 : (u === 'k' || u === 'thousand') ? 1e3 : 1;
  return n * mult;
}

Router.register('funded', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const chip = (text, color, bg) => c('span', {
    style: { fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '999px', color, background: bg, whiteSpace: 'nowrap' },
  }, text);

  const root = c('div');
  root.appendChild(HelpHint.title(t('funded.title', 'Funded companies'), 'help.hint.funded'));
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
      out.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 12px' } },
        `${companies.length} · ${sources}`));

      const rows = companies.filter(Boolean);

      // v1.140.x — funding-amount visualization: parse the (free-text) amount to a
      // magnitude and chart the top companies. Only companies with a parseable
      // amount take part; a mostly-unparseable pass simply omits the chart.
      const withAmt = rows.map((co) => ({ co, amt: parseAmount(co.amount) })).filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt);
      if (withAmt.length >= 2) {
        const max = withAmt[0].amt;
        const bars = withAmt.slice(0, 12).map(({ co, amt }) => c('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' } }, [
          c('span', { style: { flex: '0 0 40%', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: String(co.company || '') }, String(co.company || '—')),
          c('span', { style: { flex: '1', height: '14px', background: 'var(--panel-2, rgba(0,0,0,.06))', borderRadius: '7px', overflow: 'hidden' } },
            c('span', { style: { display: 'block', height: '100%', width: Math.max(3, Math.round((amt / max) * 100)) + '%', background: 'var(--rausch)', borderRadius: '7px' } })),
          c('span', { style: { flex: '0 0 auto', fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: 'var(--foggy)' } }, String(co.amount || '')),
        ]));
        out.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '0 0 16px' } }, [
          c('h2', { style: { fontSize: '15px', margin: '0 0 10px' } }, t('funded.byAmount', 'Top by disclosed funding amount')),
          c('div', null, bars),
        ]));
      }

      // Enriched cards — logo (derived from the company name; letter-avatar
      // fallback), round badge, amount, discovery score, and the parent's
      // suggested action, plus the funding-news source link + date.
      const grid = c('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' } });
      for (const co of rows) {
        const name = String(co.company || '—');
        const ev = (co.funding && Array.isArray(co.funding.sources) && co.funding.sources[0]) || {};
        const url = (typeof ev.url === 'string' && /^https?:\/\//i.test(ev.url)) ? ev.url : '';
        const logo = window.CompanyLogo ? (window.CompanyLogo.badge('', name) || window.CompanyLogo.avatar(name)) : null;
        const nameEl = url
          ? c('a', { href: url, target: '_blank', rel: 'noopener noreferrer', style: { fontWeight: '700', fontSize: '14px' } }, name)
          : c('span', { style: { fontWeight: '700', fontSize: '14px' } }, name);
        const head = c('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px' } },
          [logo, nameEl].filter(Boolean));
        const chips = [];
        if (co.round) chips.push(chip(String(co.round), 'var(--rausch-text)', 'rgba(255,56,92,.14)'));
        if (co.amount) chips.push(chip(String(co.amount), 'var(--ink)', 'var(--panel-2, rgba(0,0,0,.06))'));
        const score = Number(co.discovery_score);
        if (isFinite(score) && score > 0) chips.push(chip(`${t('funded.score', 'Score')} ${Math.round(score)}`, 'var(--kazan-text)', 'rgba(6,101,7,.12)'));
        const chipRow = c('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 8px' } }, chips);
        const parts = [head, chipRow];
        if (co.suggested_action) {
          parts.push(c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 6px' } },
            `${t('funded.action', 'Suggested action')}: ${String(co.suggested_action).slice(0, 160)}`));
        }
        parts.push(c('p', { style: { fontSize: '11px', color: 'var(--foggy)', margin: '0' } },
          `${String(ev.source || (co.funding && co.funding.status) || '—')}${ev.observed_date ? ' · ' + String(ev.observed_date) : ''}`));
        grid.appendChild(c('div', { className: 'card', style: { padding: '14px' } }, parts));
      }
      out.appendChild(grid);
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

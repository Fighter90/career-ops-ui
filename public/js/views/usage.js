/* global Router, API, UI, I18n */
/**
 * #/usage — LLM usage & estimated cost (v1.105.0).
 *
 * Reads GET /api/usage (rollups of the data/llm-usage.jsonl log that live
 * provider calls append to) and shows per-provider token totals + an ESTIMATED
 * USD cost over 24h / 7d / 30d / all-time. The dollar figure comes from the
 * editable price table (server/lib/llm-pricing.mjs) — approximate, not billed.
 */
Router.register('usage', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const nf = new Intl.NumberFormat();
  const money = (n) => '$' + (Number(n) || 0).toFixed(Number(n) < 1 ? 4 : 2);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('usage.title', 'AI usage & cost')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('usage.subtitle', 'Tokens spent on live AI generations, per provider. The USD figure is an estimate from an editable price table — not a bill.')));

  let data;
  try { data = await API.get('/api/usage'); } catch { data = null; }
  if (!data || !data.windows) {
    root.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } }, t('usage.failed', 'Could not load usage.')));
    return root;
  }

  if (!data.totalCalls) {
    root.appendChild(c('div', { className: 'empty' },
      c('p', null, t('usage.empty', 'No AI generations recorded yet. Run an evaluation, report, or chat with a provider key set, and usage will appear here.'))));
    return root;
  }

  const WINDOWS = [
    { key: '24h', label: t('usage.w24h', 'Last 24h') },
    { key: '7d', label: t('usage.w7d', 'Last 7 days') },
    { key: '30d', label: t('usage.w30d', 'Last 30 days') },
    { key: 'all', label: t('usage.wall', 'All time') },
  ];
  let active = '7d';

  const tabs = c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '0 0 14px' } });
  const panel = c('div');

  function renderPanel() {
    const w = data.windows[active] || { providers: [], totalIn: 0, totalOut: 0, totalUsd: 0, calls: 0 };
    panel.textContent = '';
    if (!w.providers.length) {
      panel.appendChild(c('p', { style: { color: 'var(--foggy)' } }, t('usage.emptyWindow', 'No generations in this window.')));
      return;
    }
    const head = c('tr', null, [t('usage.colProvider', 'Provider'), t('usage.colCalls', 'Calls'), t('usage.colIn', 'Input tokens'), t('usage.colOut', 'Output tokens'), t('usage.colCost', 'Est. cost')]
      .map((h, i) => c('th', { style: i ? { textAlign: 'right' } : null }, h)));
    const rows = w.providers.map((p) => c('tr', null, [
      // v1.216.0 — brand monogram + friendly label beside each provider.
      c('td', null, c('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } }, [
        (window.ProviderLogo && typeof window.ProviderLogo.el === 'function') ? window.ProviderLogo.el(p.provider, 16) : null,
        c('span', { className: 'tag' }, (window.ProviderLogo && typeof window.ProviderLogo.label === 'function') ? window.ProviderLogo.label(p.provider) : p.provider),
      ])),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, nf.format(p.calls)),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, nf.format(p.in)),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, nf.format(p.out)),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '600' } }, money(p.usd)),
    ]));
    const total = c('tr', { style: { borderTop: '2px solid var(--line, #e5e8ef)', fontWeight: '700' } }, [
      c('td', null, t('usage.total', 'Total')),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, nf.format(w.calls)),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, nf.format(w.totalIn)),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, nf.format(w.totalOut)),
      c('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, money(w.totalUsd)),
    ]);
    panel.appendChild(c('div', { className: 'table-wrap' }, c('table', { className: 'tbl' }, [c('thead', null, head), c('tbody', null, [...rows, total])])));
    panel.appendChild(c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '10px 0 0' } },
      t('usage.estNote', 'Cost is estimated from approximate per-provider list prices in server/lib/llm-pricing.mjs — edit them to match your plan. Tokens are exact; dollars are not billed.')));
  }

  function setActive(key) {
    active = key;
    for (const b of tabs.children) {
      const on = b.dataset.k === key;
      b.classList.toggle('btn-primary', on);
      b.classList.toggle('btn-ghost', !on);
    }
    renderPanel();
  }
  for (const w of WINDOWS) {
    const b = c('button', { className: 'btn btn-sm', type: 'button' }, w.label);
    b.dataset.k = w.key;
    b.addEventListener('click', () => setActive(w.key));
    tabs.appendChild(b);
  }
  root.appendChild(tabs);
  root.appendChild(panel);
  setActive(active);
  return root;
});

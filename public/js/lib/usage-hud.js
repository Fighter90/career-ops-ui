/* global API, UI, I18n */
/**
 * usage-hud.js (v1.114.0) — a compact "USAGE" meter pinned to the bottom-LEFT
 * corner (bottom-right in RTL) on EVERY page.
 *
 * A gauge-headed card showing token usage across time windows (24h / 7d / 30d),
 * each as `<tokens> · <share%>` with a green progress bar (share of all-time),
 * plus an estimated-cost footer. Data is the read-only `GET /api/usage` rollup
 * of `data/llm-usage.jsonl` (local only) — the same source as the `#/usage`
 * page. Cost is an ESTIMATE; manual-mode runs cost nothing and are not recorded.
 *
 * Collapsible (header toggles; state persists in localStorage). CSP-safe: no
 * inline handlers, DOM via `UI.el`, the only innerHTML is a compile-time
 * constant gauge SVG. Static labels carry data-i18n* so `applyI18n()`
 * re-localizes them. Sits opposite the Ask-the-docs launcher, never colliding.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var GAUGE_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M12 13a5 5 0 0 1 5-5"/><circle cx="12" cy="13" r="9"/><path d="M12 13l3.5-3.5"/></svg>';
  var STORE = 'coUsageHudCollapsed';
  var WINDOWS = ['24h', '7d', '30d'];

  function t(k, f) { return (window.I18n && I18n.t) ? I18n.t(k, f) : f; }
  function el() { return (window.UI && UI.el) ? UI.el.apply(UI, arguments) : null; }

  var host, headBtn, bodyWrap, rowsBox, footer, lastData = null, loading = false, collapsed = false;

  var money = function (v) { var n = Number(v) || 0; return n === 0 ? '$0.00' : (n < 0.01 ? '<$0.01' : '$' + n.toFixed(2)); };
  var nf = function (v) {
    var n = Number(v) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(Math.round(n));
  };
  function winOf(data, key) { return (data && data.windows && data.windows[key]) || { totalIn: 0, totalOut: 0, totalUsd: 0, calls: 0 }; }
  function tok(w) { return (w.totalIn || 0) + (w.totalOut || 0); }

  function render() {
    if (!rowsBox) return;
    rowsBox.textContent = '';
    footer.textContent = '';
    var data = lastData;
    if (!data || !data.totalCalls) {
      rowsBox.appendChild(el('div', { className: 'usage-hud__empty', 'data-i18n': 'hud.empty' },
        t('hud.empty', 'No AI usage yet. Live runs with an API key are counted here.')));
      return;
    }
    // The windows are cumulative (24h ⊆ 7d ⊆ 30d), so 30d is the widest shown —
    // scale each bar against it. Show the real token count + estimated cost per
    // window (NOT a "share %", which reads as 100% for everyone whose usage is
    // all recent). Equal rows simply mean all your usage falls inside 24h.
    var maxTok = tok(winOf(data, '30d')) || tok(winOf(data, 'all')) || 1;
    WINDOWS.forEach(function (key) {
      var w = winOf(data, key);
      var wt = tok(w);
      var pct = Math.max(wt > 0 ? 4 : 0, Math.min(100, Math.round((wt / maxTok) * 100)));
      var barFill = el('span', { className: 'usage-hud__barfill', style: { width: pct + '%' } });
      rowsBox.appendChild(el('div', { className: 'usage-hud__meter' }, [
        el('div', { className: 'usage-hud__meterhead' }, [
          el('span', { className: 'usage-hud__win' }, key),
          el('span', { className: 'usage-hud__val' }, nf(wt) + ' · ' + money(w.totalUsd)),
        ]),
        el('span', { className: 'usage-hud__bar' }, barFill),
      ]));
    });
    var cost = winOf(data, '24h').totalUsd;
    footer.appendChild(el('span', { 'data-i18n': 'hud.estimate' }, t('hud.estimate', 'Est. 24h cost')));
    footer.appendChild(el('span', { className: 'usage-hud__footcost' }, money(cost)));
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try { lastData = await API.get('/api/usage'); } catch (e) { /* keep last */ }
    loading = false;
    render();
    syncSidebarPad();
  }

  // Reserve space at the bottom of the sidebar equal to the HUD's height so the
  // nav + version footer always scroll clear ABOVE the pinned HUD — it sits
  // under the menu and never covers it (the user's requirement).
  function syncSidebarPad() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || !host) return;
    var h = host.offsetHeight || 0;
    sidebar.style.paddingBottom = h ? (h + 8) + 'px' : '';
  }

  function setCollapsed(v) {
    collapsed = v;
    host.classList.toggle('usage-hud--collapsed', v);
    bodyWrap.hidden = v;
    headBtn.setAttribute('aria-expanded', v ? 'false' : 'true');
    try { localStorage.setItem(STORE, v ? '1' : '0'); } catch (e) { /* ignore */ }
    syncSidebarPad();
  }

  function build() {
    if (!window.UI || !UI.el || document.getElementById('usage-hud')) return;
    try { collapsed = localStorage.getItem(STORE) === '1'; } catch (e) { collapsed = false; }

    var icon = el('span', { className: 'usage-hud__ic', 'aria-hidden': 'true' });
    icon.innerHTML = GAUGE_SVG;
    var chev = el('span', { className: 'usage-hud__chev', 'aria-hidden': 'true' }, '⌄');
    headBtn = el('button', {
      className: 'usage-hud__head', type: 'button', 'aria-expanded': collapsed ? 'false' : 'true',
      'aria-controls': 'usage-hud-body',
    }, [icon, el('span', { className: 'usage-hud__title', 'data-i18n': 'hud.title' }, t('hud.title', 'Usage')), chev]);
    headBtn.addEventListener('click', function () { setCollapsed(!collapsed); });

    rowsBox = el('div', { className: 'usage-hud__rows' });
    footer = el('div', { className: 'usage-hud__footer' });
    bodyWrap = el('div', { id: 'usage-hud-body', className: 'usage-hud__bodywrap' }, [rowsBox, footer]);

    host = el('div', { id: 'usage-hud', className: 'usage-hud' }, [headBtn, bodyWrap]);
    // Pinned to the viewport's bottom-left corner (bottom-right in RTL) via
    // `position: fixed` in CSS, so it's always visible independent of sidebar
    // scroll — the user asked for it fixed to the bottom.
    document.body.appendChild(host);

    setCollapsed(collapsed);
    window.addEventListener('hashchange', refresh);
    window.addEventListener('resize', syncSidebarPad);
    // Real-time: re-poll the cheap read-only GET on a short interval, and again
    // whenever the tab regains focus (so a run in another tab shows up promptly).
    setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    syncSidebarPad();
    refresh();
  }

  function init() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.UsageHud = { refresh: refresh, _build: build };
})();

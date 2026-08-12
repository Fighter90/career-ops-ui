/* global window */
/**
 * config/tab-controller.js — the /#/config tab-bar controller (P-15 file-size
 * split, v1.155.0). ARIA tablist keyboard navigation + panel swapping, extracted
 * verbatim from views/config.js. Factory takes (c = UI.el, panelHost) and returns
 * { tabBtn, activate }; the TABS registry + keyboard handler stay internal.
 * Loaded via <script src> BEFORE views/config.js.
 */
(function () {
  window.createConfigTabController = function (c, panelHost) {
    const TABS = []; // { btn, panel, label, key, loader }

    function tabBtn(label, panel, key, loader) {
      const btn = c('button', {
        className: 'tab-btn',
        id: 'cfg-tab-' + key,
        role: 'tab',
        'aria-selected': 'false',
        'aria-controls': 'cfg-tabpanel',
        tabindex: '-1',
        type: 'button',
        onClick: () => activate(label),
        onKeydown: onTabKey,
      }, label);
      TABS.push({ btn, panel, label, key, loader });
      return btn;
    }

    function activate(label) {
      const tab = TABS.find((x) => x.label === label) || TABS[0];
      panelHost.innerHTML = '';
      panelHost.appendChild(tab.panel);
      panelHost.setAttribute('aria-labelledby', tab.btn.id);
      for (const x of TABS) {
        const on = x === tab;
        x.btn.classList.toggle('is-active', on);
        x.btn.setAttribute('aria-selected', on ? 'true' : 'false');
        x.btn.tabIndex = on ? 0 : -1;
      }
      if (tab.loader) tab.loader();
    }

    function onTabKey(e) {
      const i = TABS.findIndex((x) => x.btn === e.currentTarget);
      if (i < 0) return;
      let n = i;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = TABS.length - 1;
      else return;
      e.preventDefault();
      activate(TABS[n].label);
      TABS[n].btn.focus();
    }

    return { tabBtn, activate };
  };
})();

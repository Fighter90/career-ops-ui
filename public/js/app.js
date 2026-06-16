/* global Router, API, UI, I18n */

// ── i18n bootstrap: render lang switcher + apply translations on every change ──
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const fallback = el.textContent;
    el.textContent = I18n.t(key, fallback);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = I18n.t(key, el.placeholder);
  });
  // I-1 (v1.58.15) — `data-i18n-aria-label` mirrors the placeholder
  // pattern so the global search input (and any future control) gets
  // its aria-label localized on every language change. Pre-fix the
  // top-bar search hardcoded the English aria-label across all 8
  // locales; screen-reader users were stuck with English regardless
  // of the SPA's UI language.
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', I18n.t(key, el.getAttribute('aria-label') || ''));
  });
  // MINOR-001 (v1.61.1) — `data-i18n-title` mirrors the aria-label
  // pattern so a control's tooltip localizes on boot + every language
  // change. Introduced for the theme toggle, whose title="Toggle theme"
  // was hardcoded English across all 9 locales (v1.61.0 fr sign-off).
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    el.title = I18n.t(key, el.title || '');
  });
}

// I18N-EXPAND (v1.70.0) — a flag-prefixed <select> replaces the old wrapping
// row of per-language buttons. With 12 locales the button row wrapped to
// three lines in the sidebar; a native select scales, is keyboard- and
// screen-reader-friendly out of the box, and stays CSP-safe (change handler
// via addEventListener, no inline JS). Flags are emoji in the option text —
// they degrade to region letters where the platform lacks flag glyphs, so
// the language label is always the load-bearing identifier.
function renderLangSwitcher() {
  const host = document.getElementById('lang-switcher');
  if (!host) return;
  host.innerHTML = '';
  const current = I18n.getLang();
  const sel = document.createElement('select');
  sel.className = 'lang-select';
  sel.id = 'lang-select';
  sel.setAttribute('aria-label', I18n.t('top.langLabel', 'Language'));
  for (const l of I18n.getLangs()) {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = `${l.flag ? l.flag + ' ' : ''}${l.label}`;
    if (l.code === current) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => I18n.setLang(sel.value));
  host.appendChild(sel);
}

I18n.onChange(() => {
  applyI18n();
  renderLangSwitcher();
  // re-render the current view so per-view translations apply
  if (window.Router) Router.render();
});

(async function init() {
  // load version + health (silent on warnings; only toast on real failures)
  try {
    const h = await API.get('/api/health');
    document.getElementById('footer-version').textContent = 'v' + h.version;
    // h.ok=false ONLY when a REQUIRED check fails. Optional misses (no GEMINI_API_KEY) just lower h.ok? — no, server now keeps ok=true for optional misses.
    if (!h.ok) {
      const failed = h.checks.filter((c) => c.required && !c.ok).map((c) => c.name);
      UI.toast(I18n.t('app.setupIssue', 'Setup issue: ') + failed.join(', '), 'error');
    }
    // Don't toast warnings — visible badge in Health page is enough.
  } catch (err) {
    document.getElementById('footer-version').textContent = 'offline';
    // Network banner is shown by api.js — no extra toast needed
  }

  // v1.55.3 (UX-2) — surface the 4-provider OR contract. Cold-start
  // (0 keys) → red banner explaining ⚡ Run-live is in manual-prompt
  // mode + a deep link to the API-keys tab. ≥1 key → a subtle chip
  // naming the provider the OR-router will use. CSP-safe: DOM nodes +
  // addEventListener only, never innerHTML with response data.
  const PROVIDER_NAME = {
    anthropic: 'Anthropic', gemini: 'Gemini', openai: 'OpenAI', qwen: 'Qwen',
  };
  async function renderOnboardingBanner() {
    const host = document.getElementById('onboarding-banner');
    if (!host) return;
    let st;
    try {
      st = await API.get('/api/status/providers');
    } catch {
      host.hidden = true; // status unknown → say nothing (fail-soft)
      return;
    }
    host.textContent = '';
    host.classList.remove('onboarding-warn', 'onboarding-ok');
    if (!st || !Array.isArray(st.keysConfigured) || st.keysConfigured.length === 0) {
      host.classList.add('onboarding-warn');
      const msg = document.createElement('span');
      msg.textContent = I18n.t(
        'onboarding.noKey.title',
        'No LLM key set — “⚡ Run live” is in manual-prompt mode.');
      const cta = document.createElement('a');
      cta.href = '#/config?tab=api-keys';
      cta.className = 'btn btn-sm btn-dark';
      cta.textContent = I18n.t('onboarding.noKey.cta', 'Set up a key →');
      host.append(msg, ' ', cta);
      host.hidden = false;
    } else {
      host.classList.add('onboarding-ok');
      const name = PROVIDER_NAME[st.activeProvider] || st.activeProvider || '';
      const label = I18n.t('onboarding.activeProvider', 'Live eval');
      const chip = document.createElement('span');
      chip.textContent = label + ': ' + name +
        (st.activeModel ? ' (' + st.activeModel + ')' : '');
      host.append(chip);
      host.hidden = false;
    }
  }
  renderOnboardingBanner();
  // Re-evaluate when the user returns from the config tab (keys may
  // have just been saved) and on locale change so copy stays localized.
  window.addEventListener('hashchange', () => {
    if (!String(window.location.hash || '').includes('/config')) renderOnboardingBanner();
  });
  I18n.onChange(renderOnboardingBanner);

  // initial route
  if (!window.location.hash) window.location.hash = '#/dashboard';
  // i18n first paint
  renderLangSwitcher();
  applyI18n();
  Router.render();

  // top-bar buttons
  document.getElementById('btn-doctor').addEventListener('click', async (e) => {
    UI.toast(I18n.t('app.runDoctor', 'Running doctor.mjs…'));
    try {
      const r = await UI.withSpinner(e.currentTarget, () => API.post('/api/run/doctor'));
      // BUG-008-tb (v1.58.6) — modal title must equal the visible button
      // label. Pre-v1.58.6 the top-bar passed the hardcoded English
      // 'doctor' regardless of locale; the Health-page entry already
      // uses t('health.runDoctor'). Both entries now follow the
      // ledger BUG-008 invariant: modal-title == localized button label.
      UI.modal(I18n.t('top.doctor', 'Doctor'), UI.el('pre', { className: 'console' }, (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '')));
    } catch (err) {
      // err may be undefined / null when a Promise rejects without an Error
      // payload (rare but possible during teardown). Guard the property read.
      UI.toast((err && err.message) || 'doctor failed', 'error');
    }
  });
  document.getElementById('btn-quick-scan').addEventListener('click', () => Router.go('/scan'));
  // M-9 (v1.58.14) — connection-banner Refresh used to call
  // location.reload() silently; v1.58.3 MASTER regression: "click
  // Refresh → silence. User can't tell if anything happened." Now we:
  //   1. show a transient "Refreshing…" toast,
  //   2. set sessionStorage['refreshedToast'] so the *next* page can
  //      surface a success toast (the current toast is swallowed by
  //      the page navigation),
  //   3. disable the button to swallow rapid double-clicks (no
  //      stacking),
  //   4. reload after a short delay so the user sees the in-flight
  //      toast before the navigation.
  const refreshBtn = document.getElementById('conn-refresh-btn');
  refreshBtn?.addEventListener('click', () => {
    if (refreshBtn.disabled) return;
    refreshBtn.disabled = true;
    UI.toast(I18n.t('common.refreshing', 'Refreshing…'));
    try { sessionStorage.setItem('refreshedToast', '1'); } catch { /* private mode */ }
    setTimeout(() => location.reload(), 200);
  });
  // M-9 (v1.58.14) — surface the "Refreshed" success toast on the
  // *next* page load, since the toast emitted before location.reload
  // is destroyed with the page. sessionStorage clears on tab close, so
  // the flag never survives past a single refresh cycle.
  try {
    if (sessionStorage.getItem('refreshedToast')) {
      sessionStorage.removeItem('refreshedToast');
      // Defer slightly so the toast root exists and the layout has
      // settled — Router.render() runs synchronously from hashchange.
      setTimeout(() => UI.toast(I18n.t('common.refreshed', 'Refreshed'), 'success'), 200);
    }
  } catch { /* private mode — ignore */ }

  // v1.12.0 — Theme toggle. Click cycles light → dark → light and persists.
  // The icon swaps to ☀ in dark mode so the affordance reads correctly.
  function readEffectiveTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch {}
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = t === 'dark' ? '☀' : '🌙';
  }
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = readEffectiveTheme() === 'dark' ? '☀' : '🌙';
    themeBtn.addEventListener('click', () => {
      applyTheme(readEffectiveTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // global search
  const search = document.getElementById('global-search');
  // v1.56.4 — UX-N2: surface the Cmd/Ctrl+K shortcut visibly so
  // sighted users discover it. The keybinding itself is wired further
  // down; the badge is aria-hidden (aria-label already covers AT).
  const kbdHint = document.querySelector('.kbd-shortcut');
  // I-6 (v1.58.20) — footer hint must show ⌘K on Mac, Ctrl+K elsewhere
  // (was the EN-only literal "CTRL+K — search" on every locale and
  // every platform). Same detection used for the top-bar badge.
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  if (kbdHint) {
    kbdHint.textContent = isMac ? kbdHint.dataset.mac : kbdHint.dataset.other;
  }
  function applyFooterHotkey() {
    const hint = document.querySelector('.sidebar-footer .hint[data-i18n="top.langhint"]');
    if (!hint) return;
    const hotkey = isMac ? '⌘K' : 'Ctrl+K';
    // After applyI18n() the text is e.g. '{hotkey} — поиск'. Swap the
    // {hotkey} token with the platform-specific combo so the footer
    // matches the OS the user is on and the localized verb stays.
    hint.textContent = hint.textContent.replace(/\{hotkey\}/g, hotkey);
  }
  applyFooterHotkey();
  I18n.onChange(applyFooterHotkey);

  // v1.58.34 — Notifications drawer. Builds on top of U-13's
  // UI.getToastHistory() + UI.onToast() (v1.58.33). The drawer slides
  // in from the right and lists every toast captured this session
  // (cap 50, oldest dropped). A red dot on the bell tracks UNREAD
  // entries; opening the drawer marks all read. No persistence — the
  // journal is volatile (per-tab, per-session).
  (function notifDrawer() {
    const bell = document.getElementById('notif-bell');
    const drawer = document.getElementById('notif-drawer');
    const list = document.getElementById('notif-list');
    const empty = document.getElementById('notif-empty');
    const badge = document.getElementById('notif-badge');
    const closeBtn = document.getElementById('notif-close');
    // UX-A12 (v1.58.60) — Clear all button in the drawer head.
    const clearAllBtn = document.getElementById('notif-clear-all');
    if (!bell || !drawer || !list || !badge || !closeBtn) return;
    let unread = 0;
    // v1.58.36 (M-1) — scope the Esc keydown listener to the open
    // state (attach on open, detach on close). The previous
    // implementation registered a global keydown listener at boot
    // that fired on every keystroke worldwide; mirroring the modal
    // pattern (api.js _modalKeydown) tightens the contract and
    // survives any future double-init.
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    const open = () => {
      drawer.hidden = false;
      bell.setAttribute('aria-expanded', 'true');
      render();
      unread = 0; updateBadge();
      document.addEventListener('keydown', onEsc);
      // Focus the close button so keyboard users land somewhere
      // dismissable; per ARIA APG drawer pattern.
      setTimeout(() => closeBtn.focus(), 0);
    };
    const close = () => {
      drawer.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onEsc);
      // v1.58.36 (L-4) — preventScroll keeps the page from jumping
      // to the top if the topbar has scrolled out of view on tiny
      // viewports. WAI-ARIA APG recommendation.
      bell.focus({ preventScroll: true });
    };
    function updateBadge() {
      if (unread > 0) {
        badge.textContent = String(unread);
        badge.hidden = false;
        // v1.58.36 (M-3) — announce unread count to screen readers
        // via aria-label since the visible digit alone is purely
        // visual. The aria-live region in the parent button polls
        // for accessibility-tree updates.
        badge.setAttribute('aria-label',
          (window.I18n && I18n.t && I18n.t('notif.unread', '{n} unread'))
            ? (I18n.t('notif.unread', '{n} unread').replace('{n}', String(unread)))
            : (unread + ' unread'));
      } else {
        badge.hidden = true;
        badge.removeAttribute('aria-label');
      }
    }
    function render() {
      const items = UI.getToastHistory().slice().reverse(); // newest first
      list.innerHTML = '';
      empty.hidden = items.length > 0;
      // UX-A12 (v1.58.60) — Clear all hidden when list is empty.
      if (clearAllBtn) clearAllBtn.hidden = items.length === 0;
      // v1.58.36 (L-5) — defensive locale fallback. If I18n hasn't
      // booted (test harness or very early render), `getLang()`
      // would throw inside the render loop and break the drawer.
      // Mirrors api.js:264 (toast summary) pattern.
      const locale = (window.I18n && I18n.getLang && I18n.getLang()) || 'en';
      for (const it of items) {
        const li = document.createElement('li');
        li.className = 'notif-item notif-item--' + (it.type || 'info');
        const time = document.createElement('time');
        const d = new Date(it.ts);
        time.dateTime = d.toISOString();
        time.textContent = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const msg = document.createElement('p');
        msg.className = 'notif-item__msg';
        msg.textContent = it.message;
        li.appendChild(time);
        li.appendChild(msg);
        if (it.detail) {
          const code = document.createElement('code');
          code.className = 'notif-item__detail';
          code.textContent = it.detail;
          li.appendChild(code);
        }
        // UX-A12 (v1.58.60) — per-entry dismiss button. Uses the entry's
        // `ts` (set by api.js toast() with millisecond resolution) as
        // the stable identity key. UI.dismissToastHistory() splices the
        // history array and dispatches a sentinel that triggers the
        // subscriber → re-render path; we don't need to manage the
        // DOM mutation here.
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'notif-item__dismiss';
        const dismissLabel = (window.I18n && I18n.t && I18n.t('notif.dismiss', 'Dismiss')) || 'Dismiss';
        dismiss.setAttribute('aria-label', dismissLabel);
        dismiss.textContent = '×';
        dismiss.dataset.ts = String(it.ts);
        dismiss.addEventListener('click', (e) => {
          e.stopPropagation();
          UI.dismissToastHistory(it.ts);
        });
        li.appendChild(dismiss);
        list.appendChild(li);
      }
    }
    bell.addEventListener('click', () => (drawer.hidden ? open() : close()));
    closeBtn.addEventListener('click', close);
    // UX-A12 (v1.58.60) — Clear all wiring. Subscriber re-renders the
    // empty list automatically; we also reset the unread counter so
    // the bell stops pulsing after the user has explicitly purged.
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        UI.clearToastHistory();
        unread = 0; updateBadge();
      });
    }
    // v1.58.36 (M-1) — global Esc listener moved into open()/close()
    // above so the handler is only live while the drawer is open
    // (no longer fires on every keystroke worldwide).
    // New toasts arrive via UI.onToast — re-render if open, otherwise
    // bump the unread badge so the bell signals there's something new.
    // UX-A12 (v1.58.60) — the subscriber also fires for the Clear-all
    // (`{cleared: true}`) and per-entry dismiss (`{dismissed: ts}`)
    // sentinels; those are user-initiated purges, not new toasts, so
    // they must NOT bump the unread counter — just re-render when open.
    UI.onToast((entry) => {
      const isPurge = entry && (entry.cleared || entry.dismissed != null);
      if (!drawer.hidden) {
        render();
      } else if (!isPurge) {
        unread = Math.min(99, unread + 1); updateBadge();
      } else if (entry && entry.cleared) {
        // Bell badge must reflect the post-purge empty journal even
        // while the drawer is closed.
        unread = 0; updateBadge();
      }
    });
  })();

  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = search.value.trim();
      if (!q) return;
      // v1.16.0 — URL paste UX:
      //   • Enter         → ✨ auto-pipeline (full flow per career-ops.org/docs)
      //   • Shift+Enter   → quick add-to-pipeline only (legacy behavior)
      // Pasting non-URLs jumps to the tracker (search) — unchanged.
      if (q.startsWith('http')) {
        if (e.shiftKey) {
          API.post('/api/pipeline', { url: q }).then(() => {
            UI.toast(I18n.t('pipe.added', 'Added to pipeline'), 'success');
            search.value = '';
            if (Router.current().name === 'pipeline') Router.render();
          }).catch((err) => UI.toast((err && err.message) || 'add failed', 'error'));
        } else if (window.AutoPipeline) {
          search.value = '';
          window.AutoPipeline.open({ prefillUrl: q, autoStart: true });
        } else {
          // Fallback when auto-pipeline.js failed to load.
          API.post('/api/pipeline', { url: q }).then(() => {
            UI.toast(I18n.t('pipe.added', 'Added to pipeline'), 'success');
            search.value = '';
            if (Router.current().name === 'pipeline') Router.render();
          }).catch((err) => UI.toast((err && err.message) || 'add failed', 'error'));
        }
      } else {
        Router.go('/tracker');
      }
    }
  });

  // ctrl+k
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      search.focus();
    }
    if (e.key === 'Escape') {
      const m = document.getElementById('modal');
      if (!m.hidden) UI.closeModal();
    }
  });

  // FIX-M4 — clear the global search input on every route change so
  // typed queries don't bleed into the next page. We skip the clear
  // when the user is actively typing (focus is in the input) — that
  // keeps Ctrl+K → type → Enter → navigate flows uninterrupted.
  window.addEventListener('hashchange', () => {
    if (document.activeElement !== search) search.value = '';
  });

  // modal close handlers
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined) UI.closeModal();
  });

  // ── mobile sidebar drawer ──
  // Hamburger button toggles `body.sidebar-open`; CSS rules in
  // app.css (media query <900 px) translate the sidebar in/out.
  // Backdrop and any nav-item click also close it so the user lands
  // on the new page with the sidebar tucked away.
  const toggle = document.getElementById('sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');
  // v1.17.0 — keep aria-expanded in sync so screen readers know the
  // mobile drawer state.
  function syncSidebarAria() {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', document.body.classList.contains('sidebar-open') ? 'true' : 'false');
  }
  function closeSidebar() { document.body.classList.remove('sidebar-open'); syncSidebarAria(); }
  function openSidebar()  { document.body.classList.add('sidebar-open'); syncSidebarAria(); }
  if (toggle) toggle.addEventListener('click', () => {
    if (document.body.classList.contains('sidebar-open')) closeSidebar();
    else openSidebar();
  });
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  document.querySelectorAll('.sidebar a').forEach((a) =>
    a.addEventListener('click', closeSidebar));
  window.addEventListener('hashchange', closeSidebar);
})();

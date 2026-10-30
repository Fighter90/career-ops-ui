/* global Router, I18n */
/* CAR-122 — sidebar v2: collapsible groups, favorites, recents, Cmd+K palette.
 *
 * The static <nav> in index.html stays the single source of structural truth:
 * this lib DERIVES its route/group registry from the DOM at boot (zero drift),
 * then layers on:
 *   1. collapsible groups — persisted in localStorage `career-ops-ui:nav-v2`;
 *      a group the user never touched explicitly follows the active route
 *      (open while its section is current), an explicit choice always wins;
 *   2. favorites — a star button per nav item pins it into a Favorites group
 *      at the top (reorder with ↑/↓ buttons, fully keyboard-operable);
 *   3. recents — the last 5 visited sections, surfaced under Favorites;
 *   4. the command palette — Cmd/Ctrl+K (or the sidebar launch button) opens
 *      a fuzzy filter over every route + two actions; ARIA combobox/listbox
 *      inside a modal dialog with a focus trap.
 *
 * Contract with app.js's legacy Cmd/Ctrl+K binding (search.focus): THIS file
 * loads before app.js, so the document-level listener registered here runs
 * first and calls stopImmediatePropagation() when it consumes the chord —
 * the palette is the main entry; app.js's binding stays as a fallback for
 * the (unsupported) no-nav-v2 case and its pinned source-shape tests.
 *
 * CSP-safe by construction: createElement/textContent/setAttribute only —
 * raw HTML assignment is never used, nor inline handlers, nor third-party
 * deps. The pure core (state machine + fuzzy matcher + palette assembly)
 * is exported on window.NavV2 and unit-tested in tests/nav-v2.test.mjs.
 */
(function () {
  'use strict';

  // The pure core lives in nav-v2-core.js (≤800-LOC split); destructure
  // it so every internal call site below stays unchanged, and re-export
  // the union on window.NavV2 — the public API is unaffected.
  const {
    defaultState, serializeState, loadState, isGroupOpen, toggleGroup,
    pin, unpin, moveFav, trackVisit, pruneState, fuzzyFilter,
    buildPaletteItems, formatEvalUrl, looksLikeUrl,
  } = window.NavV2Core;
  const STORE_KEY = 'career-ops-ui:nav-v2';
  const PALETTE_MAX = 30; // DOM budget: never paint more options than this
  // ─────────────────────────── wiring ───────────────────────────

  let state = defaultState();
  let registry = [];      // [{id, href, group, titleKey, fallback, groupKey, groupFallback}]
  let groupEls = new Map(); // groupId → {section, toggle, items}
  let dynamicMount = null;
  let favSection = null;
  let recentSection = null;
  let palette = null;     // {root, input, list, empty, overlay}
  let paletteItems = [];
  let activeIdx = 0;
  let lastFocus = null;

  function t(key, fallback) {
    return (window.I18n && typeof I18n.t === 'function') ? I18n.t(key, fallback) : fallback;
  }

  function readStore() {
    try { return window.localStorage.getItem(STORE_KEY); } catch { return null; }
  }
  function writeStore() {
    try { window.localStorage.setItem(STORE_KEY, serializeState(state)); } catch { /* private mode */ }
  }

  /** Build the route registry from the static nav DOM (zero drift).
   *  Group labels (for the palette's right-hand hint) come from each
   *  section's toggle span data-i18n + its current text as fallback. */
  function collectRegistry(navEl) {
    const groups = {};
    navEl.querySelectorAll('section[data-nav-group]').forEach((section) => {
      const label = section.querySelector('.nav-v2-toggle [data-i18n]');
      groups[section.dataset.navGroup] = {
        key: label ? label.getAttribute('data-i18n') : null,
        fallback: label ? label.textContent : section.dataset.navGroup,
      };
    });
    const items = [];
    navEl.querySelectorAll('.nav-item[data-route]').forEach((a) => {
      const section = a.closest('section[data-nav-group]');
      const g = section ? groups[section.dataset.navGroup] : null;
      const label = a.querySelector('[data-i18n]');
      items.push({
        id: a.dataset.route,
        href: a.getAttribute('href'),
        group: section ? section.dataset.navGroup : null,
        titleKey: label ? label.getAttribute('data-i18n') : null,
        fallback: label ? label.textContent : (a.textContent || '').trim(),
        groupKey: g ? g.key : null,
        groupFallback: g ? g.fallback : null,
      });
    });
    return items;
  }

  function registryById(id) {
    for (const r of registry) if (r.id === id) return r;
    return null;
  }

  function activeRouteId() {
    // Resolve through the router when it is up: it owns the alias table
    // (#/settings → profile, #/outreach → contacto), and the auto-open
    // must follow the RESOLVED route or the aliased hash leaves the
    // item's group closed. Registry-miss (404 hashes) → null.
    if (window.Router && typeof Router.current === 'function') {
      try {
        const { name, rawName } = Router.current();
        if (name && registryById(name)) return name;
        if (rawName && registryById(rawName)) return rawName;
        return null;
      } catch { /* not booted yet — fall through to the hash */ }
    }
    const hash = window.location.hash || '';
    if (!hash.startsWith('#/')) return null;
    // Path + query shapes: '#/reports/12' → 'reports', '#/scan?x=1' →
    // 'scan' — a parameterised sub-route must resolve to its owning
    // section, not null.
    const name = hash.slice(2).split(/[?/]/)[0].replace(/\/+$/, '');
    return registryById(name) ? name : null;
  }

  function activeGroupId() {
    const id = activeRouteId();
    const r = id && registryById(id);
    return r ? r.group : null;
  }

  // ── 1. group open/close ──

  function applyGroupStates() {
    const active = activeGroupId();
    groupEls.forEach((els, id) => {
      const open = isGroupOpen(state, id, active);
      els.items.hidden = !open;
      els.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ── 2 + 3. favorites / recents groups (dynamic) ──

  function rowLink(r) {
    const a = document.createElement('a');
    a.className = 'nav-v2-row-link';
    a.setAttribute('href', r.href);
    const ico = document.createElement('span');
    ico.className = 'nav-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = '◆';
    const label = document.createElement('span');
    if (r.titleKey) label.setAttribute('data-i18n', r.titleKey);
    label.textContent = t(r.titleKey, r.fallback);
    a.appendChild(ico);
    a.appendChild(label);
    a.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open'); // mobile drawer parity
      syncDrawerAria();
    });
    return a;
  }

  function iconBtn(cls, labelKey, labelFallback, glyph) {
    const b = document.createElement('button');
    b.className = 'nav-v2-mini ' + cls;
    b.type = 'button';
    b.setAttribute('data-i18n-aria-label', labelKey);
    b.setAttribute('aria-label', t(labelKey, labelFallback));
    b.title = t(labelKey, labelFallback);
    b.textContent = glyph;
    return b;
  }

  function syncDrawerAria() {
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', document.body.classList.contains('sidebar-open') ? 'true' : 'false');
  }

  /** One favorites row: link + ↑ ↓ × controls (all keyboard-operable). */
  function favRow(r, index, total) {
    const row = document.createElement('div');
    row.className = 'nav-v2-row nav-v2-fav-row';
    row.appendChild(rowLink(r));
    if (total > 1) {
      const up = iconBtn('nav-v2-up', 'nav.v2.moveUp', 'Move up', '↑');
      up.addEventListener('click', () => { state = moveFav(state, r.id, -1); afterFavChange(); });
      const down = iconBtn('nav-v2-down', 'nav.v2.moveDown', 'Move down', '↓');
      down.addEventListener('click', () => { state = moveFav(state, r.id, +1); afterFavChange(); });
      row.appendChild(up);
      row.appendChild(down);
    }
    const rm = iconBtn('nav-v2-star nav-v2-unpin', 'nav.v2.unpin', 'Remove from favorites', '✕');
    rm.setAttribute('aria-pressed', 'true');
    rm.addEventListener('click', () => { state = unpin(state, r.id); afterFavChange(); });
    row.appendChild(rm);
    row.dataset.navFav = r.id;
    row.dataset.navIndex = String(index);
    return row;
  }

  function recentRow(r) {
    const row = document.createElement('div');
    row.className = 'nav-v2-row nav-v2-recent-row';
    row.appendChild(rowLink(r));
    return row;
  }

  /** The dynamic groups mount once; rows re-render on state change. */
  function buildDynamicGroups(navEl) {
    dynamicMount = document.createElement('div');
    dynamicMount.id = 'nav-v2-dynamic';
    const firstSection = navEl.querySelector('section[data-nav-group]');
    navEl.insertBefore(dynamicMount, firstSection);

    favSection = document.createElement('section');
    favSection.className = 'nav-v2-group nav-v2-favs';
    favSection.setAttribute('data-nav-group', '__favs');
    const favToggle = document.createElement('button');
    favToggle.className = 'nav-v2-toggle';
    favToggle.type = 'button';
    favToggle.setAttribute('aria-expanded', 'true');
    favToggle.setAttribute('aria-controls', 'nav-v2-items-__favs');
    const favChev = document.createElement('span');
    favChev.className = 'nav-v2-chev';
    favChev.setAttribute('aria-hidden', 'true');
    favChev.textContent = '▸';
    const favLabel = document.createElement('span');
    favLabel.setAttribute('data-i18n', 'nav.group.favorites');
    favLabel.textContent = t('nav.group.favorites', 'Favorites');
    favToggle.appendChild(favChev);
    favToggle.appendChild(favLabel);
    favToggle.addEventListener('click', () => {
      const open = favToggle.getAttribute('aria-expanded') === 'true';
      favToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      favItems.hidden = open;
    });
    const favItems = document.createElement('div');
    favItems.className = 'nav-v2-items';
    favItems.id = 'nav-v2-items-__favs';
    favSection.appendChild(favToggle);
    favSection.appendChild(favItems);

    recentSection = document.createElement('section');
    recentSection.className = 'nav-v2-group nav-v2-recents';
    recentSection.setAttribute('data-nav-group', '__recents');
    const recToggle = document.createElement('button');
    recToggle.className = 'nav-v2-toggle';
    recToggle.type = 'button';
    recToggle.setAttribute('aria-expanded', 'true');
    recToggle.setAttribute('aria-controls', 'nav-v2-items-__recents');
    const recChev = document.createElement('span');
    recChev.className = 'nav-v2-chev';
    recChev.setAttribute('aria-hidden', 'true');
    recChev.textContent = '▸';
    const recLabel = document.createElement('span');
    recLabel.setAttribute('data-i18n', 'nav.v2.recent');
    recLabel.textContent = t('nav.v2.recent', 'Recent');
    recToggle.appendChild(recChev);
    recToggle.appendChild(recLabel);
    // Owner UX batch — the group header explains itself (why the current
    // page never shows up in the list) and carries a Clear action.
    recToggle.setAttribute('title', t('nav.v2.recentHint', 'Your 5 most recently visited sections; the current page is not shown'));
    recToggle.setAttribute('aria-label', t('nav.v2.recentHint', 'Your 5 most recently visited sections; the current page is not shown'));
    recToggle.setAttribute('data-i18n-title', 'nav.v2.recentHint');
    recToggle.setAttribute('data-i18n-aria-label', 'nav.v2.recentHint');
    recToggle.addEventListener('click', () => {
      const open = recToggle.getAttribute('aria-expanded') === 'true';
      recToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      recItems.hidden = open;
    });
    // Clear (modeled on the notifications drawer's clear-all): empties the
    // recents list for good — the section re-hides itself on the re-render
    // (an empty recent array makes the `.every(currentId)` hidden check true).
    const recClear = document.createElement('button');
    recClear.className = 'nav-v2-clear';
    recClear.type = 'button';
    recClear.setAttribute('data-i18n', 'nav.v2.clearRecent');
    recClear.textContent = t('nav.v2.clearRecent', 'Clear');
    recClear.addEventListener('click', () => {
      state = Object.assign({}, state, { recent: [] });
      writeStore();
      renderDynamicGroups();
    });
    const recItems = document.createElement('div');
    recItems.className = 'nav-v2-items';
    recItems.id = 'nav-v2-items-__recents';
    const recHead = document.createElement('div');
    recHead.className = 'nav-v2-group-head';
    recHead.appendChild(recToggle);
    recHead.appendChild(recClear);
    recentSection.appendChild(recHead);
    recentSection.appendChild(recItems);

    dynamicMount.appendChild(favSection);
    dynamicMount.appendChild(recentSection);
  }

  function renderDynamicGroups() {
    // keyboard users: re-rendering must not strand or jump focus. Capture
    // WHERE focus was BEFORE the rows are cleared — after unpinning the
    // focused row the element is gone, and `document.activeElement` has
    // already fallen back to body, so containment checks on it are dead.
    const prev = document.activeElement;
    const prevInFav = !!(prev && favSection && favSection.contains(prev));
    const prevRow = (prev && prev.closest) ? prev.closest('[data-nav-fav]') : null;
    const prevId = prevRow ? prevRow.getAttribute('data-nav-fav') : null;
    const prevIndex = prevRow ? Number(prevRow.getAttribute('data-nav-index')) : -1;

    const favItems = favSection.querySelector('.nav-v2-items');
    favItems.textContent = '';
    favSection.hidden = state.favs.length === 0;
    state.favs.forEach((id, i) => {
      const r = registryById(id);
      if (r) favItems.appendChild(favRow(r, i, state.favs.length));
    });
    const recItems = recentSection.querySelector('.nav-v2-items');
    recItems.textContent = '';
    // "Recent" means where you have BEEN: the route on screen is filtered
    // out of the display (it stays in the store), so a fresh dashboard
    // ships with the group hidden instead of listing itself.
    const currentId = activeRouteId();
    recentSection.hidden = state.recent.every((id) => id === currentId);
    state.recent.forEach((id) => {
      if (id === currentId) return;
      const r = registryById(id);
      if (r) recItems.appendChild(recentRow(r));
    });

    // 1) the same row survived (↑/↓ reorder, star press) → restore there
    if (prevId && state.favs.indexOf(prevId) !== -1) {
      const again = favItems.querySelector('[data-nav-fav="' + prevId + '"] a, [data-nav-fav="' + prevId + '"] button');
      if (again) { again.focus(); return; }
    }
    // 2) the focused row was UNPINNED: land on the row that took its
    //    position (the next favorite slid up), else the last row, else
    //    the route's static star when it is on screen. Never strand the
    //    user on body while a valid target exists.
    if (prevInFav && prevId && state.favs.indexOf(prevId) === -1) {
      const rows = favItems.querySelectorAll('[data-nav-fav]');
      const target = rows.length ? rows[Math.min(prevIndex, rows.length - 1)] : null;
      if (target) {
        const c = target.querySelector('a, button');
        if (c) { c.focus(); return; }
      }
      const star = document.querySelector('.nav-v2-row[data-route-row="' + prevId + '"] .nav-v2-star');
      if (star && star.offsetParent !== null) { star.focus(); return; }
      return; // no valid target (last favorite gone, its group closed)
    }
    // 3) focus was elsewhere → leave it alone
    if (prev && !favSection.contains(prev) && !recentSection.contains(prev)) return;
    const firstBtn = (state.favs.length ? favSection : recentSection).querySelector('a, button');
    if (firstBtn) firstBtn.focus();
  }

  function afterFavChange() {
    writeStore();
    renderDynamicGroups();
    applyGroupStates();
    syncStars();
  }

  // ── star buttons on the static group items ──

  function syncStars() {
    document.querySelectorAll('.nav-v2-row[data-route-row] .nav-v2-star').forEach((b) => {
      const id = b.closest('.nav-v2-row').dataset.routeRow;
      const pinned = state.favs.indexOf(id) !== -1;
      b.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      b.classList.toggle('is-pinned', pinned);
      const lbl = t(pinned ? 'nav.v2.unpin' : 'nav.v2.pin', pinned ? 'Remove from favorites' : 'Pin to favorites');
      b.setAttribute('aria-label', lbl);
      b.title = lbl;
    });
  }

  function wrapStaticItems(navEl) {
    navEl.querySelectorAll('section[data-nav-group] .nav-item').forEach((a) => {
      if (a.parentElement && a.parentElement.classList.contains('nav-v2-row')) return; // idempotent
      const row = document.createElement('div');
      row.className = 'nav-v2-row';
      row.dataset.routeRow = a.dataset.route;
      const star = document.createElement('button');
      star.className = 'nav-v2-mini nav-v2-star';
      star.type = 'button';
      star.setAttribute('aria-pressed', 'false');
      star.textContent = '★';
      star.addEventListener('click', () => {
        const id = row.dataset.routeRow;
        state = (state.favs.indexOf(id) === -1) ? pin(state, id) : unpin(state, id);
        afterFavChange();
      });
      a.replaceWith(row);
      row.appendChild(a);
      row.appendChild(star);
    });
  }

  // ── 4. the command palette ──

  function paletteActions() {
    const actions = [];
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      actions.push({
        id: 'action-theme',
        title: t('top.themeToggle', 'Toggle theme'),
        keywords: ['theme', 'dark', 'light', 'тема'],
        run: () => themeBtn.click(), // app.js owns the toggle logic — reuse it
      });
    }
    const search = document.getElementById('global-search');
    if (search) {
      actions.push({
        id: 'action-search',
        title: t('top.search.label', 'Search companies, roles, or URLs'),
        keywords: ['search', 'find', 'поиск'],
        run: () => { try { search.focus(); } catch { /* detached */ } },
      });
    }
    return actions;
  }
  function urlAction(query) {
    const url = query.trim();
    return {
      id: 'action-url',
      kind: 'action', // pushed raw around buildPaletteItems — carry the kind
      title: formatEvalUrl(t('nav.v2.evalUrl', 'Auto-pipeline: {url}'), url),
      keywords: ['url', 'evaluate', 'pipeline'],
      run: () => {
        if (window.Router && typeof Router.go === 'function') Router.go('/auto?url=' + encodeURIComponent(url));
        else window.location.hash = '#/auto?url=' + encodeURIComponent(url);
      },
    };
  }

  function ensurePalette() {
    if (palette) return;
    const overlay = document.createElement('div');
    overlay.className = 'nav-v2-overlay';
    overlay.hidden = true;

    const root = document.createElement('div');
    root.className = 'nav-v2-palette';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', t('nav.v2.palette', 'Command menu'));

    const input = document.createElement('input');
    input.className = 'nav-v2-input';
    input.type = 'text';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'nav-v2-palette-list');
    input.setAttribute('aria-autocomplete', 'list');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('placeholder', t('nav.v2.paletteLabel', 'Jump to…'));

    const list = document.createElement('ul');
    list.className = 'nav-v2-palette-list';
    list.id = 'nav-v2-palette-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', t('nav.v2.palette', 'Command menu'));

    const empty = document.createElement('div');
    empty.className = 'nav-v2-empty';
    empty.hidden = true;
    empty.textContent = t('nav.v2.noResults', 'Nothing found');

    const hint = document.createElement('div');
    hint.className = 'nav-v2-palette-hint';
    hint.textContent = t('nav.v2.hint', '↑↓ navigate · Enter open · Esc close');

    root.appendChild(input);
    root.appendChild(list);
    root.appendChild(empty);
    root.appendChild(hint);
    overlay.appendChild(root);
    document.body.appendChild(overlay);

    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closePalette(); });

    input.addEventListener('input', () => renderOptions(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(+1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); chooseActive(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
      else if (e.key === 'Tab') { e.preventDefault(); } // single-focusable dialog → trap
    });

    palette = { overlay, root, input, list, empty, hint };
  }

  function visibleOptions(query) {
    const base = buildPaletteItems(registry, paletteActions(), state, t);
    const items = fuzzyFilter(query, base);
    if (looksLikeUrl(query)) items.unshift(urlAction(query));
    return items.slice(0, PALETTE_MAX);
  }

  function renderOptions(query) {
    if (!palette) return;
    paletteItems = visibleOptions(query);
    palette.list.textContent = '';
    palette.empty.hidden = paletteItems.length > 0;
    activeIdx = 0;
    paletteItems.forEach((item, i) => {
      const li = document.createElement('li');
      li.id = 'nav-v2-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      li.className = 'nav-v2-opt' + (i === 0 ? ' is-active' : '');
      if (item.kind === 'action') li.classList.add('nav-v2-opt-action');
      const mark = document.createElement('span');
      mark.className = 'nav-v2-opt-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = item.fav ? '★' : (item.kind === 'action' ? '⚡' : (item.recent ? '↺' : '◇'));
      const label = document.createElement('span');
      label.className = 'nav-v2-opt-title';
      label.textContent = item.title;
      li.appendChild(mark);
      li.appendChild(label);
      if (item.kind === 'route' && item.groupKey) {
        const grp = document.createElement('span');
        grp.className = 'nav-v2-opt-group';
        grp.textContent = t(item.groupKey, item.groupFallback || item.group || '');
        li.appendChild(grp);
      }
      li.addEventListener('click', () => { activeIdx = i; chooseActive(); });
      li.addEventListener('mousemove', () => setActive(i));
      // machine-readable target for tests (and any future hint UI): the
      // exact hash this option navigates to
      li.setAttribute('data-href', item.href || '');
      palette.list.appendChild(li);
    });
    syncActive();
  }

  function setActive(i) {
    if (!paletteItems.length) return;
    activeIdx = Math.max(0, Math.min(i, paletteItems.length - 1));
    syncActive();
  }

  function moveActive(delta) {
    if (!paletteItems.length) return;
    setActive((activeIdx + delta + paletteItems.length) % paletteItems.length);
  }

  function syncActive() {
    if (!palette) return;
    Array.from(palette.list.children).forEach((li, i) => {
      const on = i === activeIdx;
      li.classList.toggle('is-active', on);
      li.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        palette.input.setAttribute('aria-activedescendant', li.id);
        if (typeof li.scrollIntoView === 'function') li.scrollIntoView({ block: 'nearest' });
      }
    });
    if (!paletteItems.length) palette.input.removeAttribute('aria-activedescendant');
  }

  function chooseActive() {
    const item = paletteItems[activeIdx];
    if (!item) return;
    closePalette();
    if (typeof item.run === 'function') { // actions dispatch on capability
      try { item.run(); } catch (err) { console.error(err); }
      return;
    }
    if (!item.href) return;
    if (window.Router && typeof Router.go === 'function') {
      Router.go(item.href.replace(/^#\//, '/'));
    } else {
      window.location.hash = item.href;
    }
  }

  function openPalette() {
    ensurePalette();
    lastFocus = document.activeElement;
    palette.overlay.hidden = false;
    palette.input.value = '';
    palette.input.setAttribute('aria-expanded', 'true');
    renderOptions('');
    try { palette.input.focus(); } catch { /* detached */ }
  }

  function closePalette() {
    if (!palette || palette.overlay.hidden) return;
    palette.overlay.hidden = true;
    const f = lastFocus;
    lastFocus = null;
    if (f && typeof f.focus === 'function') {
      try { f.focus({ preventScroll: true }); } catch { try { f.focus(); } catch { /* detached */ } }
    }
  }

  function isPaletteOpen() {
    return !!(palette && !palette.overlay.hidden);
  }

  /** Re-sync the palette's static chrome (built once at first open) after
   *  a language switch. The dynamic option labels rebuild per render. */
  function syncPaletteChrome() {
    if (!palette) return;
    const label = t('nav.v2.palette', 'Command menu');
    palette.root.setAttribute('aria-label', label);
    palette.list.setAttribute('aria-label', label);
    palette.input.setAttribute('placeholder', t('nav.v2.paletteLabel', 'Jump to…'));
    palette.empty.textContent = t('nav.v2.noResults', 'Nothing found');
    palette.hint.textContent = t('nav.v2.hint', '↑↓ navigate · Enter open · Esc close');
  }

  /** Document-level chord handler. Registered BEFORE app.js's legacy
   *  binding (script order), so stopImmediatePropagation() makes the
   *  palette the main Cmd/Ctrl+K entry. */
  function onGlobalKeydown(e) {
    // e.code is layout-independent: on a Russian (or any non-QWERTY)
    // keyboard the chord arrives as key='л' code='KeyK', so an e.key-only
    // match left Ctrl+K dead for those users (prod-QA CAR-172).
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (isPaletteOpen()) closePalette();
      else openPalette();
    }
  }

  // ── hashchange: track recents + auto-open the active group ──

  function onHashChange() {
    const id = activeRouteId();
    if (id) {
      const next = trackVisit(state, id);
      if (next !== state) { state = next; writeStore(); renderDynamicGroups(); }
    }
    applyGroupStates();
  }

  // ── boot ──

  function init() {
    const navEl = document.querySelector('.nav');
    if (!navEl || navEl.dataset.navV2 === 'on') return;
    navEl.dataset.navV2 = 'on';

    state = loadState(readStore());
    registry = collectRegistry(navEl);
    // Drop favorites/recents ids that no longer resolve (renamed or
    // removed routes) so they cannot keep an empty Favorites header
    // visible or consume cap slots forever.
    const pruned = pruneState(state, registryById);
    if (pruned !== state) { state = pruned; writeStore(); }

    groupEls = new Map();
    navEl.querySelectorAll('section[data-nav-group]').forEach((section) => {
      const id = section.dataset.navGroup;
      const toggle = section.querySelector('.nav-v2-toggle');
      const items = section.querySelector('.nav-v2-items');
      if (!toggle || !items) return;
      toggle.addEventListener('click', () => {
        state = toggleGroup(state, id, isGroupOpen(state, id, activeGroupId()));
        writeStore();
        applyGroupStates();
      });
      groupEls.set(id, { section, toggle, items });
    });

    wrapStaticItems(navEl);
    buildDynamicGroups(navEl);
    renderDynamicGroups();
    applyGroupStates();
    syncStars();

    const launch = document.getElementById('nav-v2-launch');
    if (launch) {
      launch.addEventListener('click', openPalette);
      const kbd = launch.querySelector('.nav-v2-kbd');
      if (kbd) kbd.textContent = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘K' : 'Ctrl K';
    }

    document.addEventListener('keydown', onGlobalKeydown);
    window.addEventListener('hashchange', onHashChange);
    onHashChange(); // first paint: track the landing route + auto-open its group
    // router.js executes AFTER this lib, so the boot call above resolved
    // the landing hash without the alias table — and no hashchange event
    // ever fires for the initial load. Re-resolve once the window is fully
    // loaded (all classic scripts, Router included, have run).
    window.addEventListener('load', onHashChange);
    // Language switch: the DOM data-i18n labels re-apply themselves, but
    // the star aria-labels/titles and the palette chrome are built in JS —
    // re-sync them (and any open option list, for the localized group
    // labels) through the i18n subscriber hook.
    if (window.I18n && typeof I18n.onChange === 'function') {
      I18n.onChange(() => {
        syncStars();
        syncPaletteChrome();
        if (isPaletteOpen()) renderOptions(palette.input.value);
      });
    }
  }

  // ── exports (the union of the pure core + the wiring handles) ──
  window.NavV2 = Object.assign({}, window.NavV2Core, {
    init, openPalette, closePalette, isPaletteOpen,
  });

  if (typeof document !== 'undefined' && document.querySelector('.nav')) init();
})();

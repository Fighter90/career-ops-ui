/* global window */
/* CAR-122 — nav-v2 PURE CORE: the persisted-state machine, favorites
 * and recents mutators, the fuzzy matcher, the localized palette-item
 * assembly and the URL-action title formatter. No DOM access — unit-
 * tested directly in tests/nav-v2.test.mjs via the new Function pattern.
 * Split from nav-v2.js by the ≤800-LOC file-size contract; the wiring
 * half consumes window.NavV2Core and re-exports everything on
 * window.NavV2 so the public surface is unchanged. */
(function () {
  'use strict';

  // ─────────────────────────── pure core ───────────────────────────
  // State shape: { collapsed: {groupId: 'open'|'closed'}, favs: [routeId],
  //                recent: [routeId] }. Absent group key = "auto" (follows
  //                the active route). All mutators are value-style: they
  //                return a NEW state and never touch their input.
  const RECENT_CAP = 5;
  const FAV_CAP = 12;

  // The seven static group ids — the literal allowlist that makes the
  // persisted state structurally safe: `loadState` iterates THIS array and
  // looks each id up in the parsed JSON, so a remote string never becomes
  // a property name (the v1.233.2 KNOWN_KEYS pattern; CodeQL: no
  // remote-property-injection sink). Drift-locked to the index.html
  // `data-nav-group` sections by tests/nav-v2.test.mjs.
  const STATIC_GROUP_IDS = [
    'sourcing', 'decision', 'application', 'networking',
    'analytics', 'growth', 'setup',
  ];

  function defaultState() {
    return { collapsed: {}, favs: [], recent: [] };
  }

  function serializeState(state) {
    return JSON.stringify({
      collapsed: state.collapsed || {},
      favs: (state.favs || []).slice(0, FAV_CAP),
      recent: (state.recent || []).slice(0, RECENT_CAP),
    });
  }

  function loadState(raw) {
    const base = defaultState();
    if (typeof raw !== 'string' || !raw) return base;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return base; }
    if (!parsed || typeof parsed !== 'object') return base;
    // Structural safety: the ONLY property names ever written are the
    // literals in STATIC_GROUP_IDS — anything else in the persisted blob
    // (including __proto__/constructor/prototype shapes) is ignored.
    const parsedCollapsed = (parsed.collapsed && typeof parsed.collapsed === 'object')
      ? parsed.collapsed
      : {};
    const collapsed = {};
    for (const gid of STATIC_GROUP_IDS) {
      const v = parsedCollapsed[gid];
      if (v === 'open' || v === 'closed') collapsed[gid] = v;
    }
    const strArr = (v, cap) => (Array.isArray(v)
      ? v.filter((x) => typeof x === 'string' && x).slice(0, cap)
      : []);
    return { collapsed, favs: strArr(parsed.favs, FAV_CAP), recent: strArr(parsed.recent, RECENT_CAP) };
  }

  /** A group is open when: the user pinned it open ('open'), OR the user
   *  never touched it and it owns the active route, OR touched-'closed'
   *  is absent and… never. Explicit always beats auto. */
  function isGroupOpen(state, groupId, activeGroupId) {
    const v = state.collapsed[groupId];
    if (v === 'open') return true;
    if (v === 'closed') return false;
    return groupId === activeGroupId;
  }

  /** Toggle: `effectiveOpen` is the group's VISIBLE state (the wiring
   *  passes isGroupOpen(state, id, activeGroupId) so closing an
   *  auto-opened active group pins it closed). Defaults to the
   *  no-active-context reading. */
  function toggleGroup(state, groupId, effectiveOpen) {
    if (STATIC_GROUP_IDS.indexOf(groupId) === -1) return state; // literal allowlist
    const open = (effectiveOpen === undefined)
      ? isGroupOpen(state, groupId, null)
      : !!effectiveOpen;
    const collapsed = Object.assign({}, state.collapsed);
    collapsed[groupId] = open ? 'closed' : 'open';
    return Object.assign({}, state, { collapsed });
  }

  function pin(state, id) {
    if (state.favs.indexOf(id) !== -1 || state.favs.length >= FAV_CAP) return state;
    return Object.assign({}, state, { favs: state.favs.concat(id) });
  }

  function unpin(state, id) {
    if (state.favs.indexOf(id) === -1) return state;
    return Object.assign({}, state, { favs: state.favs.filter((f) => f !== id) });
  }

  function moveFav(state, id, delta) {
    const i = state.favs.indexOf(id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= state.favs.length) return state;
    const favs = state.favs.slice();
    favs.splice(j, 0, favs.splice(i, 1)[0]);
    return Object.assign({}, state, { favs });
  }

  function trackVisit(state, id) {
    if (state.recent[0] === id) return state; // re-visit of the current head: no write, no re-render
    const recent = state.recent.filter((r) => r !== id);
    recent.unshift(id);
    return Object.assign({}, state, { recent: recent.slice(0, RECENT_CAP) });
  }

  /** Drop favorites/recents ids that no longer resolve in the registry
   *  (renamed or removed routes would otherwise keep an empty Favorites
   *  header visible and burn cap slots forever). Returns the SAME state
   *  when nothing was stale. `byId` is the registry lookup. */
  function pruneState(state, byId) {
    const favs = state.favs.filter((id) => !!byId(id));
    const recent = state.recent.filter((id) => !!byId(id));
    if (favs.length === state.favs.length && recent.length === state.recent.length) return state;
    return Object.assign({}, state, { favs, recent });
  }

  /** Subsequence match with a light score. Returns {score} or null.
   *  Signals: consecutive runs (the strongest discriminator), word starts
   *  (space - / _ .), camelCase humps (checked on the ORIGINAL casing),
   *  first-letter prefix. Chars are lowered ONE AT A TIME — a whole-string
   *  toLowerCase() can change length (İ → 2 code units) and would
   *  misalign the indexes, putting hump bonuses on the wrong characters
   *  (tr/az locales). */
  function fuzzyMatch(query, text) {
    if (!query) return { score: 0 };
    const q = String(query).toLowerCase();
    const chars = Array.from(String(text));
    let qi = 0;
    let score = 0;
    let run = 0;
    for (let ti = 0; ti < chars.length && qi < q.length; ti++) {
      const ch = chars[ti];
      const lc = ch.toLowerCase();
      const c = lc.length === 1 ? lc : lc[0]; // keep the 1:1 index alignment
      if (c !== q[qi]) { run = 0; continue; }
      run += 1;
      score += 8 + run * 8;
      if (ti === 0) score += 12;
      else {
        const prev = chars[ti - 1];
        if (prev === ' ' || prev === '-' || prev === '/' || prev === '_' || prev === '.') score += 10;
        else if (ch !== lc) score += 6;
      }
      qi += 1;
    }
    if (qi < q.length) return null;
    return { score };
  }

  /** Filter + rank. Empty query → input order (a copy). Title is the primary
   *  signal; group label and keywords count at 0.6×. Ties keep input order. */
  function fuzzyFilter(query, items) {
    if (!query) return items.slice();
    const scored = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let best = fuzzyMatch(query, it.title);
      best = best ? { score: best.score } : null;
      const extras = [it.group].concat(it.keywords || []);
      for (const extra of extras) {
        if (!extra) continue;
        const m = fuzzyMatch(query, extra);
        if (m && (!best || m.score * 0.6 > best.score)) best = { score: m.score * 0.6 };
      }
      if (best) scored.push({ i, score: best.score });
    }
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    return scored.map((s) => items[s.i]);
  }

  /** Palette order: favorites (★) → recents → actions → everything else.
   *  `group` carries the LOCALIZED label (via t(groupKey)) so the fuzzy
   *  filter matches translated group names, not the ASCII id. */
  function buildPaletteItems(routes, actions, state, t) {
    const byId = new Map(routes.map((r) => [r.id, r]));
    const items = [];
    const seen = new Set();
    const pushRoute = (r, extra) => {
      if (!r || seen.has(r.id)) return;
      seen.add(r.id);
      items.push(Object.assign({}, r, {
        kind: 'route',
        title: t(r.titleKey, r.fallback),
        group: r.groupKey ? t(r.groupKey, r.groupFallback) : (r.group || ''),
      }, extra || {}));
    };
    for (const id of state.favs) pushRoute(byId.get(id), { fav: true });
    for (const id of state.recent) pushRoute(byId.get(id), { recent: true });
    for (const a of actions) items.push(Object.assign({ kind: 'action' }, a));
    for (const r of routes) pushRoute(r);
    return items;
  }



  /** A pasted URL becomes a first-class action (auto-pipeline pre-fill). */
  function looksLikeUrl(q) {
    return /^https?:\/\/\S+$/i.test((q || '').trim());
  }

  /** `{url}` substitution that treats the URL as LITERAL text: the string
   *  form of .replace interprets $&, $`, $' and $$ in the replacement, so
   *  a URL like https://x/?q=$& would mangle the title. */
  function formatEvalUrl(template, url) {
    return String(template).replace('{url}', () => url);
  }

  window.NavV2Core = {
    defaultState, serializeState, loadState, isGroupOpen, toggleGroup,
    pin, unpin, moveFav, trackVisit, pruneState, fuzzyMatch, fuzzyFilter,
    buildPaletteItems, formatEvalUrl, looksLikeUrl,
    STATIC_GROUP_IDS, RECENT_CAP, FAV_CAP,
  };
})();

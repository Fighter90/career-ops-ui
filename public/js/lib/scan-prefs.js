/* global window, localStorage */
/**
 * scan-prefs.js — client-side persistence for the #/scan view (v1.80.0).
 *
 * Two independent stores in localStorage, each defensively validated on read so
 * a corrupt / hand-edited / cross-version value can never throw or poison the
 * UI — it silently resets to empty:
 *
 *   • Saved searches — named snapshots of the results-filter set
 *     (`career-ops-ui:scan:saved-searches` → [{ name, filters }]).
 *   • Favorites — starred job URLs
 *     (`career-ops-ui:scan:favorites` → [url, …]).
 *
 * Pure of the DOM, so it is unit-testable with a fake localStorage. Exposed as
 * `window.ScanPrefs`. Idea (saved searches + favorites) from
 * bracketouverte/job-crawler; reimplemented for the SPA, no code lifted.
 */
(function () {
  const SS_KEY = 'career-ops-ui:scan:saved-searches';
  const FAV_KEY = 'career-ops-ui:scan:favorites';

  function store() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
  }
  function readJson(key, fallback) {
    const s = store();
    if (!s) return fallback;
    try {
      const v = JSON.parse(s.getItem(key));
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function writeJson(key, val) {
    const s = store();
    if (!s) return false;
    try { s.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  }

  // Keep only JSON-scalar / string-array fields — never functions or nested
  // objects — so a saved search round-trips cleanly and can't smuggle junk.
  function sanitizeFilters(f) {
    const out = {};
    if (!f || typeof f !== 'object') return out;
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
      else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string');
    }
    return out;
  }

  const validSearch = (x) => x && typeof x === 'object'
    && typeof x.name === 'string' && x.name.trim() !== ''
    && x.filters && typeof x.filters === 'object' && !Array.isArray(x.filters);

  function listSearches() {
    const arr = readJson(SS_KEY, []);
    if (!Array.isArray(arr)) return [];
    // de-dupe by name (last wins), drop invalid entries.
    const byName = new Map();
    for (const s of arr) if (validSearch(s)) byName.set(s.name, { name: s.name, filters: sanitizeFilters(s.filters) });
    return [...byName.values()];
  }
  function saveSearch(name, filters) {
    const nm = String(name || '').trim();
    if (!nm) return listSearches();
    const arr = listSearches().filter((s) => s.name !== nm);
    arr.push({ name: nm, filters: sanitizeFilters(filters) });
    arr.sort((a, b) => a.name.localeCompare(b.name));
    writeJson(SS_KEY, arr);
    return arr;
  }
  function getSearch(name) {
    return listSearches().find((s) => s.name === String(name)) || null;
  }
  function removeSearch(name) {
    const arr = listSearches().filter((s) => s.name !== String(name));
    writeJson(SS_KEY, arr);
    return arr;
  }

  function listFavorites() {
    const arr = readJson(FAV_KEY, []);
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter((u) => typeof u === 'string' && u !== ''))];
  }
  function isFavorite(url) { return typeof url === 'string' && listFavorites().includes(url); }
  function toggleFavorite(url) {
    if (typeof url !== 'string' || !url) return listFavorites();
    let arr = listFavorites();
    arr = arr.includes(url) ? arr.filter((u) => u !== url) : [...arr, url];
    writeJson(FAV_KEY, arr);
    return arr;
  }
  function clearFavorites() { writeJson(FAV_KEY, []); return []; }

  window.ScanPrefs = {
    sanitizeFilters,
    listSearches, saveSearch, getSearch, removeSearch,
    listFavorites, isFavorite, toggleFavorite, clearFavorites,
    _keys: { SS_KEY, FAV_KEY },
  };
})();

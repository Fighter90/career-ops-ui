/* global window, localStorage */
(function () {
  'use strict';
  const MAP_KEY = 'career-ops-ui:map-prefs:v1';
  const COMMUTE_KEY = 'career-ops-ui:commute-prefs:v1';
  const SCORE_VALUES = new Set([3, 3.8, 4.2]);

  const mapDefaults = () => ({
    scoreMin: null,
    showUnevaluated: true,
    q: '',
    layers: { scan: true, pipeline: true, tracker: true },
  });
  const commuteDefaults = () => ({ maxMinutes: null, showUnknown: true });

  function store() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
  }
  function read(key) {
    try { return JSON.parse(store()?.getItem(key) || 'null'); } catch { return null; }
  }
  function write(key, value) {
    try { store()?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function loadMap() {
    const raw = read(MAP_KEY);
    const out = mapDefaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    if (raw.scoreMin == null || SCORE_VALUES.has(Number(raw.scoreMin))) out.scoreMin = raw.scoreMin == null ? null : Number(raw.scoreMin);
    if (typeof raw.showUnevaluated === 'boolean') out.showUnevaluated = raw.showUnevaluated;
    // v1.250.0 — the map search query persists with the rest of the filters.
    if (typeof raw.q === 'string') out.q = raw.q.slice(0, 120);
    if (raw.layers && typeof raw.layers === 'object') {
      for (const layer of Object.keys(out.layers)) if (typeof raw.layers[layer] === 'boolean') out.layers[layer] = raw.layers[layer];
    }
    return out;
  }
  function loadCommute() {
    const raw = read(COMMUTE_KEY);
    const out = commuteDefaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const max = Number(raw.maxMinutes);
    if (raw.maxMinutes == null || (Number.isFinite(max) && max > 0 && max <= 1440)) out.maxMinutes = raw.maxMinutes == null ? null : max;
    if (typeof raw.showUnknown === 'boolean') out.showUnknown = raw.showUnknown;
    return out;
  }
  function saveMap(value) { return write(MAP_KEY, loadMapValue(value)); }
  function loadMapValue(raw) {
    const out = mapDefaults();
    if (!raw || typeof raw !== 'object') return out;
    if (raw.scoreMin == null || SCORE_VALUES.has(Number(raw.scoreMin))) out.scoreMin = raw.scoreMin == null ? null : Number(raw.scoreMin);
    if (typeof raw.showUnevaluated === 'boolean') out.showUnevaluated = raw.showUnevaluated;
    if (typeof raw.q === 'string') out.q = raw.q.slice(0, 120);
    if (raw.layers && typeof raw.layers === 'object') {
      for (const layer of Object.keys(out.layers)) if (typeof raw.layers[layer] === 'boolean') out.layers[layer] = raw.layers[layer];
    }
    return out;
  }
  function saveCommute(raw) {
    const out = commuteDefaults();
    const max = Number(raw?.maxMinutes);
    if (raw?.maxMinutes == null || (Number.isFinite(max) && max > 0 && max <= 1440)) out.maxMinutes = raw?.maxMinutes == null ? null : max;
    if (typeof raw?.showUnknown === 'boolean') out.showUnknown = raw.showUnknown;
    return write(COMMUTE_KEY, out);
  }
  function reset() {
    write(MAP_KEY, mapDefaults());
    write(COMMUTE_KEY, commuteDefaults());
  }

  window.MapPrefs = { loadMap, saveMap, loadCommute, saveCommute, reset, _keys: { MAP_KEY, COMMUTE_KEY } };
})();

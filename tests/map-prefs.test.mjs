import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve('public/js/lib/map-prefs.js'), 'utf8');

function load(seed = {}, expose = true) {
  const data = { ...seed };
  const localStorage = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
  const window = {};
  const ctx = expose ? { window, localStorage, JSON } : { window, JSON };
  vm.runInNewContext(SRC, ctx);
  return { api: window.MapPrefs, data };
}

test('inclusive defaults and defensive validation', () => {
  const { api } = load({
    'career-ops-ui:map-prefs:v1': '{bad',
    'career-ops-ui:commute-prefs:v1': JSON.stringify({ maxMinutes: -5, showUnknown: 'yes' }),
  });
  assert.deepEqual(JSON.parse(JSON.stringify(api.loadMap())), {
    scoreMin: null, showUnevaluated: true, q: '', layers: { scan: true, pipeline: true, tracker: true },
  });
  assert.deepEqual({ ...api.loadCommute() }, { maxMinutes: null, showUnknown: true });
});
test('map and shared commute preferences persist independently and reset', () => {
  const { api } = load();
  api.saveMap({ scoreMin: 3.8, showUnevaluated: false, q: 'acme', layers: { scan: false, pipeline: true, tracker: true } });
  api.saveCommute({ maxMinutes: 45, showUnknown: false });
  assert.equal(api.loadMap().scoreMin, 3.8);
  assert.equal(api.loadMap().q, 'acme');
  assert.equal(api.loadMap().layers.scan, false);
  assert.deepEqual({ ...api.loadCommute() }, { maxMinutes: 45, showUnknown: false });
  api.reset();
  assert.equal(api.loadMap().scoreMin, null);
  assert.equal(api.loadCommute().showUnknown, true);
});

test('unavailable localStorage is a safe no-op', () => {
  const { api } = load({}, false);
  assert.doesNotThrow(() => api.saveMap({ scoreMin: 4.2 }));
  assert.equal(api.loadMap().scoreMin, null);
});

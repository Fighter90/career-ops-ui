/**
 * v1.243.0 (views-3) — settings + two-pager fixes:
 *
 *   - settings.js: the canonical-archetypes fallback never ran because
 *     `summary.archetypes` is [] — truthy — so the `||` chain never fell
 *     through and the Archetypes section rendered empty despite a populated
 *     profile.target_roles.archetypes. The real pickArchetypes() is run
 *     against the shapes the server actually serves.
 *   - two-pager.js: a failed GET /api/two-pager rendered a blank form
 *     indistinguishable from "no two-pager yet"; clicking Save then
 *     overwrote config/two-pager.yml with all-empty fields. The failed-load
 *     guard must disable Save until a deliberate edit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const SETTINGS = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'settings.js'), 'utf8');
const TWO_PAGER = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'two-pager.js'), 'utf8');

function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

function pick() {
  const ctx = vm.createContext({});
  vm.runInContext(sliceFn(SETTINGS, 'function pickArchetypes'), ctx);
  return vm.runInContext('pickArchetypes', ctx);
}

test('settings: an empty summary.archetypes falls through to the canonical profile list', () => {
  const pickArchetypes = pick();
  const profile = { target_roles: { archetypes: [{ name: 'Applied AI Engineer', fit: 'high' }] } };

  // The defect shape: the server summary carries the KEY with an empty array.
  assert.equal(pickArchetypes({ archetypes: [] }, profile).length, 1,
    'the canonical profile archetypes must be used when the summary list is empty');
  assert.deepEqual(pickArchetypes({ archetypes: [] }, profile), [{ name: 'Applied AI Engineer', fit: 'high' }]);

  // A populated summary still wins over the profile.
  const populated = [{ name: 'Data Engineering' }];
  assert.deepEqual(pickArchetypes({ archetypes: populated }, profile), populated);

  // Both empty → empty (nothing invented), and null-safe. Spread into a
  // host array: the fallback [] is created inside the vm realm, and
  // assert/strict compares prototypes.
  assert.deepEqual([...pickArchetypes({ archetypes: [] }, { target_roles: { archetypes: [] } })], []);
  assert.deepEqual([...pickArchetypes({}, {})], []);
  assert.deepEqual([...pickArchetypes(null, null)], []);
});

test('settings wiring: the view picks archetypes through the helper, not the `||` chain', () => {
  assert.match(SETTINGS, /const archetypes = pickArchetypes\(summary, profile\);/);
  assert.doesNotMatch(SETTINGS, /summary\.archetypes \|\| \(profile\.target_roles\?\.archetypes\)/,
    'the truthy-[] `||` fallback must be gone');
});

test('two-pager: a failed load disables Save until a deliberate edit', () => {
  // The failure is captured (not swallowed into the empty shape)…
  assert.match(TWO_PAGER, /const loadErr = load\.error \|\| null;/);
  assert.match(TWO_PAGER, /\.catch\(\(e\) => \(\{ error: e \}\)\);/);
  // …Save is disabled up front, with the server's message as its tooltip…
  assert.match(TWO_PAGER, /if \(loadErr\) \{\s*\n\s*saveBtn\.disabled = true;\s*\n\s*saveBtn\.title = \(loadErr && loadErr\.message\)/);
  // …the failure is VISIBLE (role=alert banner), not looking like "no data"…
  assert.match(TWO_PAGER, /role: 'alert'/);
  assert.match(TWO_PAGER, /t\('common\.error', 'Error'\)/,
    'the banner reuses the existing common.error key — no new UI copy');
  // …and a deliberate edit (input events bubble to root) re-enables Save.
  assert.match(TWO_PAGER, /root\.addEventListener\('input', \(\) => \{ saveBtn\.disabled = false; \}\);/);
  // An AI fill is also a deliberate act that fills on-screen content.
  assert.match(TWO_PAGER, /if \(loadErr\) saveBtn\.disabled = false;/);
});

test('two-pager: a successful load never arms the guard', () => {
  // The discriminated result keeps the two-path shape: `load.error` is
  // undefined on success, so `loadErr` stays null.
  assert.match(TWO_PAGER, /\.then\(\(\{ twoPager \}\) => \(\{ twoPager \}\)\)/);
  assert.match(TWO_PAGER, /let data = load\.twoPager \|\| \{/);
});

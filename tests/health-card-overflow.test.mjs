/**
 * v1.69.1 — #/health check-card overflow guard.
 *
 * Long check names/values (e.g. "PROFILE CUSTOMIZED · still on template …",
 * "PLAYWRIGHT (PARENT NODE_MODULES)") collided with the right-hand Fix button
 * + status badge and spilled out of the card, because the generic
 * `.flex-between` children default to `min-width: auto` and never shrink.
 * The fix tags the row `.health-check-row` and scopes wrap/shrink CSS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppCss } from './helpers/css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('health.js tags the check row with .health-check-row', () => {
  const view = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'health.js'), 'utf8');
  assert.match(view, /flex-between health-check-row/, 'health card row must carry the scoped class');
});

test('app.css constrains the health row so it cannot overflow', () => {
  const css = loadAppCss();
  assert.match(css, /\.health-check-row\b/, 'missing .health-check-row rule');
  // The left content must be allowed to shrink (min-width:0) and the action
  // group must keep its size — that pair is what stops the collision.
  assert.match(css, /\.health-check-row > :first-child\s*\{[^}]*min-width:\s*0/, 'left content needs min-width:0');
  assert.match(css, /\.health-check-row > :last-child\s*\{[^}]*flex:\s*0 0 auto/, 'action group must not shrink');
});

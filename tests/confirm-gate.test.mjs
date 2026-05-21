/**
 * v1.44.0 (WS2 UX-audit #4 + #9) — focus-trapped UI.confirm() gating
 * the destructive parent-file overwrites. UI is browser-only (touches
 * window/document) so this asserts the wiring statically (same style as
 * router.test.mjs); live behaviour is Playwright-verified per ship.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const API = readFileSync(R('public', 'js', 'api.js'), 'utf8');
const CONFIG = readFileSync(R('public', 'js', 'views', 'config.js'), 'utf8');
const TRACKER = readFileSync(R('public', 'js', 'views', 'tracker.js'), 'utf8');
const DICT = legacyDictText();

test('UI exports confirm()', () => {
  assert.match(API, /return\s*\{[^}]*\bconfirm\b[^}]*\}/s);
  assert.match(API, /function confirm\(title, message, opts = \{\}\)/);
});

test('confirm() resolves a Promise<boolean> on every dismissal path', () => {
  // _onClose fires from closeModal() (Esc / backdrop / × / Cancel),
  // resolving false; only the OK button resolves true.
  assert.match(API, /let _onClose = null;/);
  assert.match(API, /if \(_onClose\) \{ const cb = _onClose; _onClose = null; cb\(\); \}/);
  assert.match(API, /modal\(title, body, \(\) => finish\(false\)\)/);
  assert.match(API, /onClick: \(\) => \{ finish\(true\); closeModal\(\); \}/);
});

test('confirm() defaults focus to Cancel (safe choice for destructive op)', () => {
  assert.match(API, /cancelBtn\.focus\(\)/);
});

test('modal() accepts an onClose callback (back-compat: optional)', () => {
  assert.match(API, /function modal\(title, html, onClose\)/);
  assert.match(API, /_onClose = typeof onClose === 'function' \? onClose : null;/);
});

test('config.js #4: raw profile + modes saves are confirm-gated before PUT', () => {
  // The await UI.confirm(...) must sit BEFORE the API.put in both raws.
  const prof = CONFIG.slice(CONFIG.indexOf('async function saveProfileRaw'));
  assert.ok(/await UI\.confirm\([\s\S]*?\)\)\) \{\s*return;\s*\}[\s\S]*API\.put\('\/api\/profile'/.test(prof),
    'saveProfileRaw must confirm before PUT /api/profile');
  const modes = CONFIG.slice(CONFIG.indexOf('async function saveModesRaw'));
  assert.ok(/await UI\.confirm\([\s\S]*?\)\)\) \{\s*return;\s*\}[\s\S]*API\.put\('\/api\/modes\/_profile'/.test(modes),
    'saveModesRaw must confirm before PUT /api/modes/_profile');
});

test('tracker.js #9: runFix is confirm-gated before the POST', () => {
  const fix = TRACKER.slice(TRACKER.indexOf('async function runFix'));
  assert.ok(/await UI\.confirm\([\s\S]*?\)\)\) \{\s*return;\s*\}[\s\S]*API\.post\(path\)/.test(fix),
    'runFix must confirm before API.post(path)');
});

test('no native confirm() left on the destructive paths', () => {
  // The audit explicitly forbids window.confirm() (auto-dismissed in
  // embeds, not focus-trapped). Anchor on (start|non-ident|non-dot) so a
  // bare `confirm(` at line start is also caught, while `UI.confirm(` is
  // first stripped.
  const stripped = CONFIG.replace(/UI\.confirm\(/g, '');
  assert.ok(!/(?:^|[^.\w])confirm\(/m.test(stripped), 'config.js uses only UI.confirm');
  assert.ok(!/(?:^|[^.\w])confirm\(/m.test(TRACKER.replace(/UI\.confirm\(/g, '')),
    'tracker.js uses no native confirm');
});

test('modal(): a stale _onClose is settled when a new modal opens (no Promise leak)', () => {
  // If a second modal opens over an unresolved confirm, the old hook
  // must fire (resolve false) instead of being silently dropped.
  assert.match(API, /if \(_onClose\) \{ const stale = _onClose; _onClose = null; stale\(\); \}/);
});

test('i18n: all 8 confirm-dialog keys present with the {op} placeholder intact', () => {
  for (const k of [
    'common.confirm', 'config.rawConfirmTitle', 'config.rawConfirmOk',
    'config.profileRawConfirmBody', 'config.modesRawConfirmBody',
    'track.fixConfirmTitle', 'track.fixConfirmBody', 'track.fixConfirmOk',
  ]) {
    assert.ok(DICT.includes(`'${k}'`), `missing i18n key ${k}`);
  }
  // {op} must survive translation (runtime-substituted).
  const line = DICT.split('\n').find((l) => l.includes("'track.fixConfirmBody'"));
  assert.ok(line && (line.match(/\{op\}/g) || []).length >= 8,
    'track.fixConfirmBody must keep {op} in every locale');
});

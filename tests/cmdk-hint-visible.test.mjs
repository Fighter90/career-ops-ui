/**
 * v1.56.4 — UX-N2 introduced a visible <kbd> badge in the search pill.
 * v1.78.1 — the badge now reads **Enter** (the action that actually submits
 * the search: a non-URL query → #/scan pre-filled; a URL → auto-pipeline),
 * because browser-reserved Cmd/Ctrl+K is unreliable across platforms. The
 * Cmd/Ctrl+K focus keybinding is kept as a bonus, but the user-facing hint is
 * Enter. The badge stays aria-hidden (the input aria-label conveys it to AT).
 *
 * index.html / app.js / app.css are browser-only → asserted statically.
 * CI-isolated: no server, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(resolve(__d, '..', 'public', 'index.html'), 'utf8');
const APP = readFileSync(resolve(__d, '..', 'public', 'js', 'app.js'), 'utf8');
const CSS = readFileSync(resolve(__d, '..', 'public', 'css', 'app.css'), 'utf8');
const CSS_FLAT = CSS.replace(/\s+/g, ' ');

test('index.html: a .kbd-shortcut badge lives in the search pill', () => {
  const bar = HTML.match(/<div class="searchbar"[\s\S]*?<\/div>/);
  assert.ok(bar, '.searchbar block must exist');
  assert.match(bar[0], /id="global-search"/, 'sanity: it is the global-search pill');
  assert.match(
    bar[0],
    /<kbd[^>]*class="kbd-shortcut"[^>]*>Enter<\/kbd>/,
    'the <kbd class="kbd-shortcut"> badge must read "Enter" and sit inside .searchbar',
  );
});

test('index.html: badge is aria-hidden and reads Enter on both platforms', () => {
  const kbd = HTML.match(/<kbd[^>]*class="kbd-shortcut"[^>]*>/)[0];
  assert.match(kbd, /aria-hidden="true"/,
    'aria-label already announces the action — the badge must not double-announce');
  assert.match(kbd, /data-mac="Enter"/, 'data-mac must read Enter (v1.78.1)');
  assert.match(kbd, /data-other="Enter"/, 'data-other must read Enter (v1.78.1)');
});

test('app.js: platform-aware setter fills the badge from dataset', () => {
  assert.match(APP, /\.kbd-shortcut/, 'app.js must select the kbd badge');
  assert.match(APP, /navigator\.(platform|userAgent)/,
    'platform detection (Mac vs other) required');
  assert.match(APP, /dataset\.mac|dataset\.other/,
    'badge text must come from the data-mac / data-other variants');
});

test('app.js: the existing Cmd/Ctrl+K keybinding is intact (no regression)', () => {
  assert.match(
    APP,
    /\(\s*e\.ctrlKey\s*\|\|\s*e\.metaKey\s*\)\s*&&\s*e\.key === 'k'/,
    'Ctrl/Cmd+K handler must remain',
  );
  assert.match(APP, /search\.focus\(\)/, 'Cmd/Ctrl+K must still focus the search input');
});

test('app.css: .kbd-shortcut is styled and NOT display:none (visible)', () => {
  const m = CSS_FLAT.match(/\.kbd-shortcut \{[^}]*\}/);
  assert.ok(m, '.kbd-shortcut rule must exist');
  assert.doesNotMatch(m[0], /display:\s*none/,
    'the badge must be visible (the whole point of UX-N2)');
});

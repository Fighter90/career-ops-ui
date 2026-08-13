/**
 * v1.180.0 — the #/reports list is a TABLE, not a card grid.
 *
 * The old 4-card grid let a long "Score not detected" chip squeeze the title
 * column to near-zero; the card title's `overflowWrap: anywhere` then broke the
 * report name one character per line ("вёрстка поехала"). The list is now a
 * `table.tbl.reports-tbl` inside a `.reports-scroll` overflow-x container, so
 * every field has its own column and the wrap scrolls on narrow viewports.
 *
 * reports.js is browser-only (uses `c()`, `Router`, `UI`) → asserted statically,
 * the same approach as reports-unparsed-chip / document-title-per-route.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'reports.js'), 'utf8');
const CSS = readFileSync(resolve(ROOT, 'public', 'css', 'components.css'), 'utf8');

test('the list view renders a table, not the old card grid', () => {
  assert.match(SRC, /className:\s*'tbl reports-tbl'/, 'list is a table.tbl.reports-tbl');
  assert.match(SRC, /className:\s*'reports-scroll'/, 'table lives in a .reports-scroll wrapper');
  // The broken per-character-wrap hack is gone.
  assert.doesNotMatch(SRC, /card-row/, 'no card-row grid remains in the list view');
  assert.doesNotMatch(SRC, /overflowWrap:\s*'anywhere'/, 'the card overflowWrap hack is removed');
});

test('every row is a keyboard-operable link into the report', () => {
  assert.match(SRC, /c\(\s*'tr'/, 'rows are <tr> elements');
  assert.match(SRC, /role:\s*'link'/, 'row is role=link');
  assert.match(SRC, /tabindex:\s*'0'/, 'row is focusable');
  assert.match(SRC, /e\.key === 'Enter' \|\| e\.key === ' '/, 'Enter/Space activates the row');
  assert.match(SRC, /Router\.go\('\/reports\/'\s*\+\s*rep\.slug\)/, 'row opens the report');
});

test('the four column headers use localized keys (report/date/legitimacy/score)', () => {
  assert.match(SRC, /t\(\s*'rep\.colReport'/, 'Report column header is localized');
  assert.match(SRC, /t\(\s*'track\.col\.date'/, 'Date header reuses the tracker key');
  assert.match(SRC, /t\(\s*'track\.col\.legitimacy'/, 'Legitimacy header reuses the tracker key');
  assert.match(SRC, /t\(\s*'rep\.score'/, 'Score header is localized');
});

test('.reports-scroll is a horizontal-scroll container (CONVENTIONS: wide content scrolls)', () => {
  assert.match(CSS, /\.reports-scroll\s*\{[^}]*overflow-x:\s*auto/s, '.reports-scroll scrolls horizontally');
  assert.match(CSS, /\.reports-tbl\s+td\.report-title-cell\s*\{[^}]*overflow-wrap:\s*anywhere/s,
    'the title cell wraps at any point INSIDE its own column (never blows out the table)');
});

test('rep.colReport exists in all 17 locales', () => {
  const D = loadAssembledDict();
  assert.ok(D['rep.colReport'], 'rep.colReport is a real key');
  for (const lang of I18N_LANGS) {
    assert.ok(D['rep.colReport'][lang] && D['rep.colReport'][lang].trim(),
      `rep.colReport present for ${lang}`);
  }
});

/**
 * v1.199.0 — `.table-wrap` (the shared wrapper for the scan, tracker, stats,
 * usage, dashboard, activity and mode-page tables) scrolls horizontally instead
 * of clipping.
 *
 * It was `overflow: hidden`, so a table with `white-space: nowrap` columns wider
 * than the viewport got CUT OFF with no scrollbar (the reported scan-table "она
 * вся не вмещается" bug). Now `overflow-x: auto` gives a horizontal scrollbar on
 * demand; any non-visible overflow still clips to the rounded border, so the
 * corners stay. Mirrors the `.reports-scroll` guard (reports-table.test.mjs) and
 * the CONVENTIONS rule: wide content scrolls inside its own container, never the
 * page body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(resolve(ROOT, 'public', 'css', 'components.css'), 'utf8');

test('.table-wrap is a horizontal-scroll container (overflow-x: auto)', () => {
  assert.match(CSS, /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/s,
    '.table-wrap scrolls horizontally instead of clipping');
});

test('.table-wrap no longer clips wide tables with overflow: hidden', () => {
  assert.doesNotMatch(CSS, /\.table-wrap\s*\{[^}]*overflow:\s*hidden/s,
    'the old clip-instead-of-scroll rule is gone');
});

/**
 * FIX-6 (v1.164.0) — the top-bar global-search placeholder overflowed its box
 * in every locale (`scrollWidth > clientWidth`, nowrap): the "…or URL" half —
 * the part that teaches the paste-a-URL auto-pipeline flow — was never visible.
 *
 * The copy is now short ("Search or paste a URL" and locale equivalents) so it
 * fits even when the searchbar flex-shrinks on a busy top bar. These canaries
 * cap the length and keep the URL affordance; the live pixel fit is exercised
 * by the Playwright locale sweep. CI-isolated: dict + index.html, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const D = loadAssembledDict();

test('FIX-6: top.search is short (≤24 chars) and keeps the URL affordance in every locale', () => {
  const ph = D['top.search'];
  assert.ok(ph, 'top.search exists');
  for (const lang of I18N_LANGS) {
    const v = ph[lang] || '';
    assert.ok([...v].length <= 24, `${lang}: placeholder ≤24 chars, got ${[...v].length} ("${v}")`);
    assert.match(v, /URL|رابط|링크/i, `${lang}: placeholder must still teach the paste-a-URL flow ("${v}")`);
    // the old verbose enumeration ("company, role or URL…") is gone
    assert.doesNotMatch(v, /company.*role|role.*URL…/i, `${lang}: dropped the verbose enumeration`);
  }
});

test('FIX-6: index.html hardcoded placeholder fallback is the short form', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /placeholder="Search or paste a URL"/, 'short fallback present');
  assert.doesNotMatch(html, /placeholder="Find a company, role or URL…"/, 'verbose fallback gone');
});

/**
 * FIX-7 (v1.165.0) — the "Two-pager" product term must be used consistently
 * within each locale. Pre-fix the Arabic sidebar showed Latin "Two-pager"
 * while the page `<h1>` (`twoPager.title`) was fully localized
 * ("الصفحتان الخاصتان بك") — the only Latin string in an otherwise mirrored
 * RTL nav.
 *
 * Enforced decision: per locale, the nav label and the page title agree on the
 * term — either BOTH keep the Latin "two-pager" product noun, or BOTH use the
 * localized form. This canary fails if a locale ever splits them again.
 *
 * CI-isolated: reads the assembled dict via the vm helper; no server/network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const D = loadAssembledDict();
const LATIN = /two-?pager/i; // the Latin product noun (any case/hyphenation)

test('FIX-7: nav.twoPager and twoPager.title agree on the term in every locale', () => {
  const nav = D['nav.twoPager'];
  const title = D['twoPager.title'];
  assert.ok(nav && title, 'both keys exist');
  for (const lang of I18N_LANGS) {
    const navLatin = LATIN.test(nav[lang] || '');
    const titleLatin = LATIN.test(title[lang] || '');
    assert.equal(
      navLatin,
      titleLatin,
      `${lang}: nav "${nav[lang]}" and title "${title[lang]}" must both keep Latin "Two-pager" or both localize it`,
    );
  }
});

test('FIX-7: the Arabic nav label is localized (not the lone Latin word)', () => {
  assert.doesNotMatch(D['nav.twoPager'].ar, LATIN, 'ar nav.twoPager must be localized');
});

/**
 * v1.134.1 — the #/scan facet filter chips must be keyboard-operable (WCAG
 * 2.1.1). They are `<span class="chip">` (not native buttons), so the source
 * must give them button semantics + Enter/Space activation, or keyboard users
 * can't reach or toggle the stack/level/dynamic filters. Source-static guard on
 * the chip builder in the extracted results subsystem (scan-results.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScanSrc } from './helpers/scan-src.mjs';

test('scan facet chips carry button semantics + keyboard activation', () => {
  const src = loadScanSrc();
  // role="button" + focusable + keydown handler present on the chip elements.
  assert.match(src, /role:\s*'button'/, 'chips must set role="button"');
  assert.match(src, /tabindex:\s*'0'/, 'chips must be focusable (tabindex 0)');
  assert.match(src, /onKeydown:\s*\(e\)\s*=>\s*\{[^}]*e\.key === 'Enter'[^}]*e\.key === ' '/,
    'chips must activate on Enter/Space via an onKeydown handler');
  // The stateful toggle chip announces its pressed state.
  assert.match(src, /'aria-pressed':\s*String\(isOn\)/, 'toggle chip must expose aria-pressed');
});

test('scan results header + trust tooltip route through t() (no hardcoded English)', () => {
  const src = loadScanSrc();
  // The v1.134.1 i18n-gap closure: the relocation column header and the trust
  // badge tooltip were bare English literals; they must now be keys.
  assert.match(src, /t\('scan\.col\.reloc'/, "reloc column header must use t('scan.col.reloc')");
  assert.match(src, /t\('scan\.trustTip'/, "trust tooltip must use t('scan.trustTip')");
  assert.doesNotMatch(src, /'Trust '/, 'the bare "Trust " literal must be gone');
});

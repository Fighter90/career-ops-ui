/**
 * v1.50.0 (WS2 UX-audit #12/#27/#28) — help screen navigation a11y:
 * single <h1> (article h1s stripped), labelled TOC landmark with a
 * filter input, focus-moves-to-section on TOC click, and a back-to-top
 * control with listener cleanup on route change. Browser-only view →
 * static assertions (router.test.mjs style).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const HELP = readFileSync(R('public', 'js', 'views', 'help.js'), 'utf8');
const DICT = legacyDictText();

test('#28: article <h1>s are stripped so the page has exactly one h1', () => {
  assert.match(HELP, /scratch\.querySelectorAll\('h1'\)\.forEach\(\(h\) => h\.remove\(\)\)/);
  // the single remaining h1 is the page-header page-title
  assert.match(HELP, /c\('h1',\s*\{ className: 'page-title' \},\s*t\('help\.title'/);
});

test('#27: TOC <nav> is a labelled landmark', () => {
  // nav has the help-toc class and, within its attr block, an
  // aria-label bound to help.toc (a comment line may sit between them).
  assert.match(HELP, /c\('nav',\s*\{[\s\S]*?className: 'card help-toc'/);
  const navAttrs = HELP.slice(HELP.indexOf("c('nav'"), HELP.indexOf("c('nav'") + 400);
  assert.match(navAttrs, /'aria-label':\s*t\('help\.toc'/);
});

test('#27: TOC click moves focus to the section heading (tabindex=-1)', () => {
  assert.match(HELP, /target\.setAttribute\('tabindex',\s*'-1'\);\s*\n?\s*target\.focus\(\{ preventScroll: true \}\)/);
});

test('#12: a filter input narrows the TOC by heading text', () => {
  assert.match(HELP, /const tocSearch = c\('input'/);
  assert.match(HELP, /'aria-label':\s*t\('help\.tocFilter'/);
  assert.match(HELP, /a\.dataset\.tocText = plain\.toLowerCase\(\)/);
  // v1.56.0 — UX-11 restructured onInput (collects a `visible` array
  // for the 1-match auto-scroll) but the narrow-by-heading-text
  // invariant is unchanged: still `!q || dataset.tocText.includes(q)`
  // gating each link's display.
  assert.match(HELP, /const show = !q \|\| a\.dataset\.tocText\.includes\(q\)/);
  assert.match(HELP, /a\.style\.display = show \? 'block' : 'none'/);
});

test('#12: back-to-top button — fixed, focus-returns to h1, listener cleaned up', () => {
  assert.match(HELP, /const backTop = c\('button'/);
  // S-7 (v1.54.6): canonical `back-to-top` selector class present
  // alongside the existing `help-back-top` CSS hook, so a tightened
  // selector can't flake.
  assert.match(HELP, /className:\s*'btn btn-primary help-back-top back-to-top'/);
  assert.match(HELP, /'aria-label':\s*t\('help\.backToTop'/);
  assert.match(HELP, /window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(HELP, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
  assert.match(HELP, /window\.removeEventListener\('scroll', onScroll\)/);
  assert.match(HELP, /location\.hash\.startsWith\('#\/help'\)/);
});

test('i18n: help.tocFilter + help.backToTop present with all 8 locales', () => {
  for (const k of ['help.tocFilter', 'help.backToTop']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `missing i18n key ${k}`);
    for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
      assert.ok(line.includes(loc + ':'), `${k} missing locale ${loc}`);
    }
  }
});

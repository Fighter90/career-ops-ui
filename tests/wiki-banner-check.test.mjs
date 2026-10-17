/**
 * wiki-banner-check gate — the v1.252.0 regression's lesson (FIX-PROMPT
 * v1.252.1 §1): the wiki Home*.md "Current release:" banner stayed at an old
 * version through several releases because nothing mechanical compared it to
 * package.json. The live half of the gate (cloning the wiki) runs in the
 * release train via `node scripts/wiki-banner-check.mjs --tests N`; this file
 * pins the checker's contract offline against fixtures — including the
 * TRANSLATED banners the localized Home pages carry («Текущий релиз»,
 * «Aktuel udgivelse»), which the first gate draft missed entirely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWikiBanners, registryCounters } from '../scripts/wiki-banner-check.mjs';

// EN shape
const GOOD_EN = (v, a, r, l, t) =>
  `# Home\n\n> Current release: **v${v}** · Node ≥ 18 · Express 4 + vanilla-JS SPA · ${a} scanner adapters · ${r} route modules · ${l} UI locales (SPA + landing) · ${t} unit tests.`;
// RU shape (translated label + translated counter words)
const GOOD_RU = (v, a, r, l, t) =>
  `# Главная\n\n> Текущий релиз: **v${v}** · Node ≥ 18 · Express 4 + SPA на ванильном JS · ${a} адаптеров сканера · ${r} модуль маршрутов · ${l} локалей интерфейса · ${t} юнит-тест.`;
// DA shape
const GOOD_DA = (v, a, r, l, t) =>
  `# Hjem\n\n> Aktuel udgivelse: **v${v}** · Node ≥ 18 · Express 4 + vanilla-JS SPA · ${a} scanner-adaptere · ${r} rutemoduler · ${l} sprog i grænsefladen · ${t} enhedstests.`;

const EXPECTED = { version: '1.252.1', unitTests: 5261, adapters: 105, routes: 39, locales: 18 };

test('a banner that matches every expected counter passes — EN, RU and DA shapes alike', () => {
  const pages = [
    { file: 'Home.md', text: GOOD_EN('1.252.1', 105, 39, 18, 5261) },
    { file: 'Home-(Русский).md', text: GOOD_RU('1.252.1', 105, 39, 18, 5261) },
    { file: 'Home-(Dansk).md', text: GOOD_DA('1.252.1', 105, 39, 18, 5261) },
  ];
  assert.deepEqual(checkWikiBanners(pages, EXPECTED), []);
});

test('a stale version, count or shape is reported per file — in any language', () => {
  const pages = [
    { file: 'Home.md', text: GOOD_EN('1.251.0', 105, 39, 18, 5261) },
    { file: 'Home-(Русский).md', text: GOOD_RU('1.252.1', 109, 39, 18, 5261) },
    { file: 'Home-(Dansk).md', text: GOOD_DA('1.252.1', 105, 39, 18, 5261).replace('39', '41') },
    { file: 'Home-(日本語).md', text: 'some other page without a banner' },
  ];
  const problems = checkWikiBanners(pages, EXPECTED);
  assert.equal(problems.length, 4, 'one problem per broken page');
  assert.match(problems[0], /Home\.md: banner version 1\.251\.0 != package\.json 1\.252\.1/);
  assert.match(problems[1], /Home-\(Русский\)\.md: scanner adapters 109 != registry 105/);
  assert.match(problems[2], /Home-\(Dansk\)\.md: route modules 41 != registry 39/);
  assert.match(problems[3], /Home-\(日本語\)\.md: banner line not found/);
});

test('the localized stale count (5177) is caught, not just the EN one (5245)', () => {
  const problems = checkWikiBanners(
    [{ file: 'Home-(Українська).md', text: GOOD_RU('1.252.1', 105, 39, 18, 5177).replace('юнит-тест', 'юніт-тестів') }],
    EXPECTED,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unit tests 5177 != expected 5261/);
});

test('an empty wiki checkout is a problem, not a silent pass', () => {
  const problems = checkWikiBanners([], EXPECTED);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no Home\*\.md pages/);
});

test('registryCounters reads live repo counters (routes dir + CHANGELOG locales)', () => {
  const { routes, locales } = registryCounters();
  assert.ok(routes >= 39, `route modules counted from server/lib/routes: ${routes}`);
  assert.equal(locales, 18, '18 UI locales = 17 CHANGELOG.{loc}.md + EN');
});

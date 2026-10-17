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

const EXPECTED = { version: '1.252.1', unitTests: 5262, adapters: 105, routes: 39, locales: 18 };

test('a banner that matches every expected counter passes — EN, RU, DA, ZH (full-width colon) and JA (word-before-counter) shapes alike', () => {
  const pages = [
    { file: 'Home.md', text: GOOD_EN('1.252.1', 105, 39, 18, 5262) },
    { file: 'Home-(Русский).md', text: GOOD_RU('1.252.1', 105, 39, 18, 5262) },
    { file: 'Home-(Dansk).md', text: GOOD_DA('1.252.1', 105, 39, 18, 5262) },
    { file: 'Home-(简体中文).md', text: GOOD_ZH('1.252.1', 105, 39, 18, 5262) },
    { file: 'Home-(日本語).md', text: GOOD_JA('1.252.1', 105, 39, 18, 5262) },
  ];
  assert.deepEqual(checkWikiBanners(pages, EXPECTED), []);
});

test('a stale version, count or shape is reported per file — in any language', () => {
  const pages = [
    { file: 'Home.md', text: GOOD_EN('1.251.0', 105, 39, 18, 5262) },
    { file: 'Home-(Русский).md', text: GOOD_RU('1.252.1', 109, 39, 18, 5262) },
    { file: 'Home-(Dansk).md', text: GOOD_DA('1.252.1', 105, 39, 18, 5262).replace('39', '41') },
    { file: 'Home-(日本語).md', text: GOOD_JA('1.252.1', 109, 39, 18, 5177) },
  ];
  const problems = checkWikiBanners(pages, EXPECTED);
  assert.equal(problems.length, 5, 'one problem per finding (the JA page misses two counters at once)');
  assert.match(problems[0], /Home\.md: banner version 1\.251\.0 != package\.json 1\.252\.1/);
  assert.match(problems[1], /Home-\(Русский\)\.md: scanner adapters 109 != registry 105/);
  assert.match(problems[2], /Home-\(Dansk\)\.md: route modules 41 != registry 39/);
  assert.match(problems[3], /Home-\(日本語\)\.md: scanner adapters 109 != registry 105/);
  assert.match(problems[4], /Home-\(日本語\)\.md: unit tests 5177 != expected 5262/);
});

test('the localized stale count (5177) is caught, not just the EN one (5245)', () => {
  const problems = checkWikiBanners(
    [{ file: 'Home-(Українська).md', text: GOOD_RU('1.252.1', 105, 39, 18, 5177).replace('юнит-тест', 'юніт-тестів') }],
    EXPECTED,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unit tests 5177 != expected 5262/);
});

test('an empty wiki checkout is a problem, not a silent pass', () => {
  const problems = checkWikiBanners([], EXPECTED);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no Home\*\.md pages/);
});


// CJK shapes: full-width colon (zh) and word-BEFORE-counter (ja/ko)
const GOOD_ZH = (v, a, r, l, t) =>
  `# 主页\n\n> 当前版本：**v${v}** · Node ≥ 18 · Express 4 + 原生 JS SPA · ${a} 个扫描适配器 · ${r} 个路由模块 · ${l} 种界面语言 · ${t} 个单元测试。`;
const GOOD_JA = (v, a, r, l, t) =>
  `# ホーム\n\n> 最新リリース: **v${v}** · Node ≥ 18 · Express 4 + バニラ JS SPA · スキャナーアダプター ${a} 個 · ルートモジュール ${r} 個 · UI ロケール ${l} 言語 · ユニットテスト ${t} 件。`;



test('registryCounters reads live repo counters (routes dir + CHANGELOG locales)', () => {
  const { routes, locales } = registryCounters();
  assert.ok(routes >= 39, `route modules counted from server/lib/routes: ${routes}`);
  assert.equal(locales, 18, '18 UI locales = 17 CHANGELOG.{loc}.md + EN');
});

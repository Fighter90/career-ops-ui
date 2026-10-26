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
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const EXPECTED = { version: '1.253.0', unitTests: 5504, adapters: 120, routes: 39, locales: 18 };

test('a banner that matches every expected counter passes — EN, RU, DA, ZH (full-width colon) and JA (word-before-counter) shapes alike', () => {
  const pages = [
    { file: 'Home.md', text: GOOD_EN('1.253.0', 120, 39, 18, 5504) },
    { file: 'Home-(Русский).md', text: GOOD_RU('1.253.0', 120, 39, 18, 5504) },
    { file: 'Home-(Dansk).md', text: GOOD_DA('1.253.0', 120, 39, 18, 5504) },
    { file: 'Home-(简体中文).md', text: GOOD_ZH('1.253.0', 120, 39, 18, 5504) },
    { file: 'Home-(日本語).md', text: GOOD_JA('1.253.0', 120, 39, 18, 5504) },
  ];
  assert.deepEqual(checkWikiBanners(pages, EXPECTED), []);
});

test('a stale version, count or shape is reported per file — in any language', () => {
  const pages = [
    { file: 'Home.md', text: GOOD_EN('1.251.0', 120, 39, 18, 5504) },
    { file: 'Home-(Русский).md', text: GOOD_RU('1.253.0', 109, 39, 18, 5504) },
    { file: 'Home-(Dansk).md', text: GOOD_DA('1.253.0', 120, 39, 18, 5504).replace('39', '41') },
    { file: 'Home-(日本語).md', text: GOOD_JA('1.253.0', 109, 39, 18, 5176) },
  ];
  const problems = checkWikiBanners(pages, EXPECTED);
  assert.equal(problems.length, 5, 'one problem per finding (the JA page misses two counters at once)');
  assert.match(problems[0], /Home\.md: banner version 1\.251\.0 != package\.json 1\.253\.0/);
  assert.match(problems[1], /Home-\(Русский\)\.md: scanner adapters 109 != registry 120/);
  assert.match(problems[2], /Home-\(Dansk\)\.md: route modules 41 != registry 39/);
  assert.match(problems[3], /Home-\(日本語\)\.md: scanner adapters 109 != registry 120/);
  assert.match(problems[4], /Home-\(日本語\)\.md: unit tests 5176 != expected 5504/);
});

test('the localized stale count (5176) is caught, not just the EN one (5245)', () => {
  const problems = checkWikiBanners(
    [{ file: 'Home-(Українська).md', text: GOOD_RU('1.253.0', 120, 39, 18, 5176).replace('юнит-тест', 'юніт-тестів') }],
    EXPECTED,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unit tests 5176 != expected 5504/);
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
  assert.equal(locales, 19, '19 UI locales = 18 CHANGELOG.{loc}.md + EN');
});

// --- FULL-R3: the clone-prep half must never delete an existing directory ---
// The live clone half is driven as a subprocess against temp dirs. A fake `git`
// shim goes first on PATH so the red shape (and the allowed empty-dir clone)
// never touches the network and always terminates deterministically.

const SCRIPT = fileURLToPath(new URL('../scripts/wiki-banner-check.mjs', import.meta.url));

function fakeGitShim(t) {
  const dir = mkdtempSync(join(tmpdir(), 'fullr3-fakegit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const shim = join(dir, 'git');
  // `git clone -q <url> <dest>` — record the call, create an EMPTY dest (no
  // Home.md), so the script's post-clone page read is deterministic.
  writeFileSync(shim, '#!/bin/sh\ncase "$1" in\n  clone) mkdir -p "$4" 2>/dev/null || true ;;\nesac\necho "FAKE-GIT $*"\n');
  chmodSync(shim, 0o755);
  return dir;
}

function runScript(t, args) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fakeGitShim(t)}:${process.env.PATH}` },
  });
  return { status, stdout, stderr, combined: `${stdout}${stderr}` };
}

test('FULL-R3: a --wiki path that already exists with content is REFUSED — the sentinel file survives and nothing was cloned', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fullr3-sentinel-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sentinel = join(dir, 'precious.txt');
  writeFileSync(sentinel, 'irreplaceable user data');
  const { status, combined, stdout } = runScript(t, ['--wiki', dir]);
  assert.equal(existsSync(sentinel), true, 'the sentinel must survive — the script deleted the --wiki directory');
  assert.match(combined, /already exists and is not empty/, 'a clear refusal must be printed');
  assert.match(combined, /nothing was deleted/);
  assert.ok(status !== 0, `the refusal must exit non-zero (got ${status})`);
  assert.doesNotMatch(stdout, /FAKE-GIT clone/, 'no git clone may be attempted once the path is refused');
});

test('FULL-R3: an existing EMPTY directory stays an acceptable clone target — clone is attempted, no refusal', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fullr3-empty-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { status, combined } = runScript(t, ['--wiki', dir]);
  assert.doesNotMatch(combined, /already exists and is not empty/, 'an empty directory must not be refused');
  assert.match(combined, /FAKE-GIT clone/, 'the clone was attempted into the empty directory');
  assert.ok(existsSync(dir), 'the directory still exists after the run');
  assert.ok(status !== 0, 'no Home*.md pages in the shimmed checkout → the gate reports a problem');
});

test('FULL-R3: --check-only against a missing checkout still exits 2 without touching the filesystem', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fullr3-checkonly-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sentinel = join(dir, 'precious.txt');
  writeFileSync(sentinel, 'irreplaceable user data');
  const { status, combined } = runScript(t, ['--wiki', dir, '--check-only']);
  assert.match(combined, /--check-only forbids cloning/);
  assert.equal(existsSync(sentinel), true, 'the sentinel must survive');
  assert.equal(status, 2);
});

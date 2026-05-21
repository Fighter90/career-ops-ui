/**
 * Regression guard for the career-ops.org/docs integration shipped in
 * v1.11.0 / v1.11.1 / v1.11.2. The integration is doc-only and the
 * existing test suite didn't notice if a sed/edit later wiped the
 * canonical URLs from a bundle. These tests close that gap.
 *
 * Three asserts:
 *   1. Every help bundle (8 locales) references all 5 canonical guides.
 *   2. Every README (8 locales) references the canonical career-ops.org
 *      front page + at least 3 of the 5 sub-guides.
 *   3. The #/reports view source contains the score-thresholds card
 *      (rep.thresholdsTitle key) and an outbound link to one of the
 *      canonical guides.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CANONICAL_URLS = [
  'https://career-ops.org/docs/introduction/what-is-career-ops',
  'https://career-ops.org/docs/introduction/guides/scan-job-portals',
  'https://career-ops.org/docs/introduction/guides/apply-for-a-job',
  'https://career-ops.org/docs/introduction/guides/batch-evaluate-offers',
  'https://career-ops.org/docs/introduction/guides/set-up-playwright',
];

const HELP_BUNDLES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW'];
const README_FILES = [
  'README.md', 'README.es.md', 'README.pt-BR.md', 'README.ko-KR.md',
  'README.ja.md', 'README.ru.md', 'README.zh-CN.md', 'README.zh-TW.md',
];

test('every help bundle references all 5 canonical career-ops.org guides', () => {
  for (const lang of HELP_BUNDLES) {
    const path = resolve(ROOT, 'docs', 'help', `${lang}.md`);
    const text = readFileSync(path, 'utf8');
    for (const url of CANONICAL_URLS) {
      assert.ok(
        text.includes(url),
        `docs/help/${lang}.md missing canonical URL: ${url}`,
      );
    }
  }
});

test('every help bundle keeps the 17-H2 parity contract', () => {
  // Belt-and-suspenders next to tests/help-ui.test.mjs::section-parity.
  // If a future edit splits a section we want the regression here too.
  // v1.29.0 — bar lifted 16 → 17 by adding §17 "How to add a new
  // job-portal source" across all 8 locales.
  let baseline = null;
  for (const lang of HELP_BUNDLES) {
    const path = resolve(ROOT, 'docs', 'help', `${lang}.md`);
    const lines = readFileSync(path, 'utf8').split('\n');
    const h2 = lines.filter((l) => l.startsWith('## ')).length;
    if (baseline === null) baseline = h2;
    assert.equal(h2, baseline, `${lang}.md has ${h2} H2 sections, expected ${baseline}`);
  }
  assert.equal(baseline, 18, `expected 18 H2 sections in every bundle, got ${baseline}`);
});

test('every README references the canonical front page + ≥3 sub-guides', () => {
  for (const name of README_FILES) {
    const text = readFileSync(resolve(ROOT, name), 'utf8');
    assert.ok(
      text.includes('https://career-ops.org/docs'),
      `${name} missing https://career-ops.org/docs reference`,
    );
    const subGuideHits = CANONICAL_URLS.slice(1).filter((u) => text.includes(u)).length;
    assert.ok(
      subGuideHits >= 3,
      `${name} references ${subGuideHits} sub-guide(s); expected ≥ 3`,
    );
  }
});

test('#/reports view source contains the score-thresholds card scaffold', () => {
  const view = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'reports.js'), 'utf8');
  assert.match(view, /rep\.thresholdsTitle/, 'reports.js must reference rep.thresholdsTitle i18n key');
  assert.match(view, /career-ops\.org\/docs/, 'reports.js must link out to career-ops.org/docs');
  // Each of the four rubric rows must be present so the table can't be silently truncated.
  for (const key of ['rep.thr45', 'rep.thr40', 'rep.thr35', 'rep.thrLow']) {
    assert.ok(view.includes(key), `reports.js missing i18n key ${key}`);
  }
});

test('v1.28.0 — every help-bundle + README lists OpenCode + Qwen CLI (canonical upstream)', () => {
  // v1.28.0 (Issue #1) — career-ops.org/docs Quick Start canonical AI-assistant
  // list is Claude Code / Codex / OpenCode / Qwen CLI. Pre-v1.28 we drifted to
  // Claude Code / Codex / Cursor / Gemini CLI / GitHub Copilot CLI. This canary
  // keeps the alignment from regressing.
  for (const lang of HELP_BUNDLES) {
    const text = readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
    assert.ok(text.includes('OpenCode'), `docs/help/${lang}.md missing "OpenCode" — AI-list drift`);
    assert.ok(text.includes('Qwen CLI'), `docs/help/${lang}.md missing "Qwen CLI" — AI-list drift`);
  }
  for (const name of README_FILES) {
    const text = readFileSync(resolve(ROOT, name), 'utf8');
    assert.ok(text.includes('OpenCode'), `${name} missing "OpenCode" — AI-list drift`);
    assert.ok(text.includes('Qwen CLI'), `${name} missing "Qwen CLI" — AI-list drift`);
  }
});

test('v1.28.0 — no help-bundle or README still names the pre-v1.28 broader list in the intro', () => {
  // The exact pre-v1.28 phrase was "Cursor, Gemini CLI, GitHub Copilot CLI"
  // (Latin/Cyrillic delimiter) or "Cursor、Gemini CLI、GitHub Copilot CLI" (CJK).
  // README's "Multi-CLI" feature bullet still legitimately names Cursor +
  // Gemini CLI (as web-ui shim targets, not as career-ops CLI surface), so we
  // assert on the exact 3-CLI tail that ONLY appeared in the deprecated intro.
  const STALE_LATIN = /Cursor,\s*Gemini CLI,\s*GitHub Copilot CLI/;
  const STALE_CJK   = /Cursor、\s*Gemini CLI、\s*GitHub Copilot CLI/;
  for (const lang of HELP_BUNDLES) {
    const text = readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
    assert.doesNotMatch(text, STALE_LATIN, `docs/help/${lang}.md still has stale Latin AI-list`);
    assert.doesNotMatch(text, STALE_CJK, `docs/help/${lang}.md still has stale CJK AI-list`);
  }
  for (const name of README_FILES) {
    const text = readFileSync(resolve(ROOT, name), 'utf8');
    assert.doesNotMatch(text, STALE_LATIN, `${name} still has stale Latin AI-list`);
    assert.doesNotMatch(text, STALE_CJK, `${name} still has stale CJK AI-list`);
  }
});

test('i18n bundle includes every new key from v1.11.x with all 8 locales', () => {
  // v1.60.0 (I18N-SPLIT) — the dictionary is assembled from per-locale
  // tables. Load the REAL merged DICT and assert each key carries every
  // locale, rather than grepping a single megaline (no longer exists).
  const DICT = loadAssembledDict();
  const NEW_KEYS = [
    'rep.thresholdsTitle', 'rep.thrAction', 'rep.thr45', 'rep.thr40',
    'rep.thr35', 'rep.thrLow', 'rep.thresholdsSource',
    'apply.playwrightHint', 'apply.docsLink', 'common.generatePdf',
  ];
  for (const key of NEW_KEYS) {
    const row = DICT[key];
    assert.ok(row, `i18n missing key ${key}`);
    const entry = row['@alias'] ? DICT[row['@alias']] : row;
    for (const lc of I18N_LANGS) {
      assert.ok(entry[lc] && String(entry[lc]).trim(),
        `i18n key ${key} missing locale ${lc}`);
    }
  }
});

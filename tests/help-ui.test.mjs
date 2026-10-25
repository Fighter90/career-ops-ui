/**
 * Help-page UI integration tests.
 *
 * tests/help.test.mjs already covers the GET /api/help/:lang endpoint
 * (markdown shape, locale coverage, fallback, path-traversal). Here we
 * lock in the UI side: sidebar carries a /#/help link, the view file
 * registers the route and renders via UI.md, the i18n keys are wired
 * up in all 8 locales, and the SPA shell ships the help script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS, loadI18n } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─────────────── view file ───────────────

test('public/js/views/help.js exists and registers `help` route', () => {
  const path = resolve(ROOT, 'public', 'js', 'views', 'help.js');
  assert.ok(existsSync(path), 'help.js missing');
  const src = readFileSync(path, 'utf8');
  // Route registration
  assert.match(src, /Router\.register\(\s*['"]help['"]/);
  // Loads from server endpoint
  assert.match(src, /\/api\/help\//);
  // Renders via XSS-safe UI.md
  assert.match(src, /UI\.md\(/);
});

test('view html: helper is XSS-safe (UI.md, not innerHTML on raw)', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'help.js'), 'utf8');
  // No raw innerHTML = body.markdown style code path
  assert.ok(!/innerHTML\s*=\s*[a-zA-Z]+\.markdown/.test(src),
    'help view assigns raw markdown to innerHTML — XSS risk');
});

// ─────────────── index.html sidebar ───────────────

test('public/index.html includes the Help sidebar entry + help.js script tag', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /href=["']#\/help["']/);
  assert.match(html, /data-route=["']help["']/);
  assert.match(html, /data-i18n=["']nav\.help["']/);
  assert.match(html, /<script[^>]+\/js\/views\/help\.js/);
});

// ─────────────── i18n coverage ───────────────

const REQUIRED_LANGS = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
const REQUIRED_KEYS = ['nav.help', 'help.title', 'help.subtitle', 'help.toc'];

test('i18n: nav.help / help.* keys present in every supported locale', () => {
  // v1.60.0 (I18N-SPLIT) — DICT is assembled from per-locale tables.
  // helpers/i18n-vm.mjs replays the browser load order in a vm so this
  // test sees the same merged, alias-aware DICT the browser does.
  const D = loadI18n()._DICT;
  for (const k of REQUIRED_KEYS) {
    assert.ok(D[k], `missing key: ${k}`);
    // v1.59.13 — nav.help is now an @alias to help.title. Resolve one
    // alias hop before asserting the per-locale strings exist.
    const entry = D[k]['@alias'] ? D[D[k]['@alias']] : D[k];
    assert.ok(entry, `${k} aliases a missing target`);
    for (const lang of REQUIRED_LANGS) {
      assert.ok(entry[lang] && entry[lang].trim(),
        `${k}.${lang} is empty or missing`);
    }
  }
});

// ─────────────── help docs themselves ───────────────

test('docs/help/{lang}.md exists for every supported locale', () => {
  const helpDir = resolve(ROOT, 'docs', 'help');
  // We accept either ko-KR.md or ko.md to mirror i18n's two naming conventions.
  for (const lang of ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi']) {
    assert.ok(existsSync(resolve(helpDir, `${lang}.md`)),
      `docs/help/${lang}.md missing`);
  }
});

test('every help doc covers the same 31 sections (all 17 gated locales — §31 v1.154.0)', () => {
  // Full user-journey coverage: from initial setup + API keys to
  // applying for jobs and preparing for interviews. v1.9.2 expanded
  // from 14 → 16 sections (added App settings & API keys, Interview
  // preparation; renamed Setup hints → Troubleshooting).
  // v1.29.0 — 16 → 17 (added "How to add a new job-portal source" — v1.29.0); 17 → 18 (added §18 "Notifications" — v1.58.35)
  // alongside the 3 new RU adapters: Trudvsem / GetMatch / GeekJob).
  // v1.60.0 — 18 → 19 (added §19 "Localizing the app into your language").
  // v1.120.0 — 28 → 29 (§29 "The CareerOps Manifesto"); v1.147.0 — 29 → 30 (§30 "Hermes & Telegram").
  // v1.154.0 — 30 → 31 (§31 "Running the whole stack in the cloud").
  // §33 "Job map" (`#/map`) — 32 → 33.
  const helpDir = resolve(ROOT, 'docs', 'help');
  const SECTION_COUNT = 33;
  const ALL_LOCALES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const lang of ALL_LOCALES) {
    const fname = `${lang}.md`;
    const text = readFileSync(resolve(helpDir, fname), 'utf8');
    const headings = (text.match(/^## /gm) || []).length;
    assert.equal(headings, SECTION_COUNT,
      `${fname}: expected ${SECTION_COUNT} ## headings, got ${headings}`);
  }
});

test('every help locale has substantive content (P-8 floor)', () => {
  // P-8 — guard against locale stubs that only translate headings while
  // dropping the body. Each locale must be at least 30% of en.md's
  // length. Compact translations naturally hit ~40-50%; a stub would
  // be in single-digit %.
  const helpDir = resolve(ROOT, 'docs', 'help');
  const en = readFileSync(resolve(helpDir, 'en.md'), 'utf8');
  const FLOOR = en.length * 0.3;
  const ALL_LOCALES = ['es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const lang of ALL_LOCALES) {
    const text = readFileSync(resolve(helpDir, `${lang}.md`), 'utf8');
    assert.ok(text.length >= FLOOR,
      `${lang}.md: ${text.length} bytes < floor ${FLOOR.toFixed(0)} (30% of en.md=${en.length}). Likely a stub — backfill needed.`);
  }
});

test('help doc references all the modes pages by slug', () => {
  // Ensures the user can find every #/foo page documented somewhere
  // in their locale's help.
  const en = readFileSync(resolve(ROOT, 'docs', 'help', 'en.md'), 'utf8');
  for (const slug of [
    '#/cv', '#/scan', '#/pipeline', '#/evaluate', '#/deep', '#/apply',
    '#/tracker', '#/reports', '#/activity', '#/health', '#/settings',
    '#/project', '#/training', '#/followup', '#/batch', '#/contacto',
    '#/interview-prep', '#/patterns',
  ]) {
    assert.ok(en.includes(slug), `EN help missing route: ${slug}`);
  }
});

// ─────────────── "Show result" wiring ───────────────

test('mode-page.js has the Show result button (deep.showResult key)', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'mode-page.js'), 'utf8');
  assert.match(src, /deep\.showResult/);
  // Should call submit(…, true) so prompt → run flow works.
  assert.match(src, /submit\(\s*[a-zA-Z.]+\s*,\s*true\s*\)/);
});

test('deep.js has the Show result button + needKey toast guard', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'deep.js'), 'utf8');
  assert.match(src, /deep\.showResult/);
  assert.match(src, /deep\.needKey/);
});

// ─────────────── CAR-107: bundles quote the UI's own button labels ───────────────

// The three most-cited button citations in the localized bundles, mapped to the
// dict key whose label the UI actually renders for that button:
//   • the #/evaluate primary action   → `⚡ ` + mode.runLive        (mode-page.js:156)
//   • the report/CV PDF export button → `📄 ` + common.generatePdf  (deep.js / evaluate.js)
//   • the settings Save button        → `💾 ` + common.save         (config.js)
// `locales` = the bundles that carried the ENGLISH citation before the CAR-107
// sweep (ar phrases the evaluation walkthrough differently; da abbreviates the
// setup walk and the settings section) — for those the dict label must appear.
const CAR107_SLOTS = [
  { key: 'mode.runLive', en: '**⚡ Run live**',
    locales: ['es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'de', 'it', 'tr', 'hi', 'ta', 'vi'] },
  { key: 'common.generatePdf', en: '**📄 Generate PDF**',
    locales: ['es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'de', 'it', 'tr', 'hi', 'ta', 'vi', 'ar'] },
  { key: 'common.save', en: '**Save**',
    locales: ['es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'de', 'it', 'tr', 'hi', 'ta', 'vi'] },
];

test('CAR-107: localized bundles quote the localized button label, not the English one', () => {
  const D = loadAssembledDict();
  const helpDir = resolve(ROOT, 'docs', 'help');
  for (const lang of I18N_LANGS.filter((l) => l !== 'en')) {
    const text = readFileSync(resolve(helpDir, `${lang === 'ko' ? 'ko-KR' : lang}.md`), 'utf8');
    for (const { key, en, locales } of CAR107_SLOTS) {
      // The exact English citation is gone from EVERY localized bundle…
      assert.ok(!text.includes(en),
        `${lang}.md cites the English button label ${en} — the UI renders the localized one (CAR-107)`);
      // …and where the bundle cites the button at all, it names it by its UI label.
      if (locales.includes(lang)) {
        const label = D[key] && D[key][lang];
        assert.ok(label && label.trim(), `dict ${key} empty for ${lang}`);
        assert.ok(text.includes(label),
          `${lang}.md cites the ${key} button but never its UI label "${label}" (CAR-107)`);
      }
    }
  }
});

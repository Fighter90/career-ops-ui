/**
 * Untranslated sweep (v1.261.2 follow-up): every non-en locale value that is
 * byte-identical to the en value AND carries >=3 consecutive Latin words is
 * either translated here or named in the closed ALLOWLIST below.
 *
 * Two guards:
 *  1. PAIRS — the specific (locale, key) defects found by the sweep must now
 *     differ from en (red before the fix, green after). Cyrillic locales must
 *     carry Cyrillic (same rule as tests/i18n-untranslated.test.mjs).
 *  2. The sweep itself re-runs the detector over the assembled dict and
 *     asserts the survivors are exactly the ALLOWLIST — closed set, so a
 *     future en-identical prose value fails until it is translated or
 *     explicitly allowed with a reason.
 *
 * Legitimacy classes that never reach the allowlist (filtered by the
 * detector itself): URLs, file paths, format hints (YYYY-MM-DD),
 * {placeholder}-only templates (track.moveLine), values with <3 Latin words
 * (numbers / single tech terms / provider names).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();
const NON_EN = I18N_LANGS.filter((l) => l !== 'en');
const CYRILLIC = /[\u0400-\u04FF]/;

// Detector: >=3 consecutive Latin words (allowing intra-word hyphens and
// punctuation between words). Byte-identical + this shape = untranslated prose.
// Legitimacy classes never reach the leak list: {placeholder}-only templates
// and date-format hints (track.moveLine, followup.lastPh) carry no words after
// stripping; URLs and bare file paths (pipe.placeholder, dash.quick.profileSub,
// batch.inputTitle, footer.patternsUrl) are not prose.
const stripTokens = (v) => v.replace(/\{[^}]*\}/g, ' ').replace(/\b(?:YYYY|YY|MM|DD|HH|mm|ss)\b/g, ' ');
const THREE_LATIN_WORDS = /(?:\b[A-Za-z][A-Za-z-]*\b[^A-Za-z\n]*){3,}/;
const isUntranslatedProse = (v) =>
  !/^https?:\/\//.test(v)
  && !(/^[A-Za-z0-9._/-]+$/.test(v) && v.includes('/'))
  && THREE_LATIN_WORDS.test(stripTokens(v));

// ─── 1. The defects this sweep fixed ───
// Each translation reuses the locale's OWN vocabulary for the same phrase
// elsewhere in the dict (noted per row).
const PAIRS = [
  // Example job-title placeholders — these locales translate the same title
  // in cover.rolePh («напр. Старший бэкенд-разработчик», "ej. Ingeniero
  // Backend Senior", «예: 시니어 백엔드 엔지니어», «如：高级后端工程师», …), so
  // the bare standalone *rolePh keys must not stay English there.
  ...['project.rolePh', 'followup.rolePh', 'contacto.rolePh', 'interviewPrep.rolePh'].flatMap((key) => [
    ['es', key], ['pt-BR', key], ['ko', key], ['ja', key], ['ru', key], ['uk', key],
    ['zh-CN', key], ['zh-TW', key],
  ]),
  // Provider-key labels — ru/uk already translate config.ollamaApiKey as
  // «Ключ API Ollama»; these two lagged behind in the same file.
  ['ru', 'config.anthropicKey'],
  ['ru', 'config.geminiKey'],
  ['uk', 'config.anthropicKey'],
  // ta translates every other footer.* label; the manifesto was the holdout.
  ['ta', 'footer.manifesto'],
];

test('sweep: every fixed (locale, key) pair differs from the en value', () => {
  const missing = [];
  for (const [lang, key] of PAIRS) {
    assert.ok(I18N_LANGS.includes(lang), `unknown locale ${lang}`);
    assert.ok(DICT[key], `unknown key ${key}`);
    const en = DICT[key].en;
    const v = DICT[key][lang];
    assert.ok(v, `${key} missing for ${lang}`);
    if (v === en) missing.push(`${lang}.${key} = "${v}" (byte-identical to en)`);
    if ((lang === 'ru' || lang === 'uk') && !CYRILLIC.test(v)) {
      missing.push(`${lang}.${key} = "${v}" (no Cyrillic — still English)`);
    }
  }
  assert.deepEqual(missing, [], 'untranslated values:\n  ' + missing.join('\n  '));
});

// ─── 2. Closed sweep guard ───
// En-identical values with a 3+ Latin-word run that are DELIBERATE, each with
// its reason. Locale '*' matches every non-en locale. New entries need a
// reason — this list is the policy.
const ALLOW = [
  // Book title (proper noun) — the linked work's own name; ru alone localized
  // it, every other locale legitimately cites the English title.
  { key: 'footer.patterns', why: 'book title, proper noun' },
  // Feature name kept per each locale's own auto.title treatment
  // ("Auto-pipeline para una URL" / "Auto-pipeline для URL" / "URL-ஐ auto-pipeline செய்" …).
  { key: 'nav.v2.evalUrl', locales: ['es', 'pt-BR', 'pl', 'uk', 'da', 'it', 'ta', 'vi'],
    why: 'feature name "Auto-pipeline" kept, matches the locale own auto.title' },
  // de/it vocabulary keeps "Dashboard" (their own nav.dashboard spelling).
  { key: 'nav.logoHome', locales: ['de', 'it'], why: 'Dashboard is the de/it loanword used in nav.dashboard' },
  // pt-BR uses the "follow-up" loanword in followup.title; pl/it likewise in theirs.
  { key: 'track.histFollowups', locales: ['pt-BR'], why: 'pt-BR "follow-up" loanword (followup.title precedent)' },
  // ta keeps "API key" in Latin inside Tamil labels (config.geminiKey[ta]
  // translates only the parenthetical); "(Claude)" is a proper noun.
  { key: 'config.anthropicKey', locales: ['ta'], why: 'ta keeps "API key" Latin (geminiKey precedent)' },
  { key: 'config.ollamaApiKey', locales: ['ta'], why: 'ta keeps "API key" Latin (geminiKey precedent)' },
  // de keeps the example job title everywhere (cover.rolePh / cvs.tailorHeadPh)
  // and "(optional)" is valid German as written.
  { key: 'deep.roleExample', locales: ['de'], why: 'de keeps the example title; "(optional)" is German' },
  // de/da/it/ta keep the English example job title in every placeholder
  // (their own cover.rolePh / cvs.tailorHeadPh spelling) — tech-locale
  // convention, English titles are native in those job markets.
  { key: 'project.rolePh', locales: ['de', 'da', 'it', 'ta'], why: 'example job title kept per locale convention (cover.rolePh)' },
  { key: 'followup.rolePh', locales: ['de', 'da', 'it', 'ta'], why: 'example job title kept per locale convention (cover.rolePh)' },
  { key: 'contacto.rolePh', locales: ['de', 'da', 'it', 'ta'], why: 'example job title kept per locale convention (cover.rolePh)' },
  { key: 'interviewPrep.rolePh', locales: ['de', 'da', 'it', 'ta'], why: 'example job title kept per locale convention (cover.rolePh)' },
];

function allowed(loc, key) {
  return ALLOW.some((a) => a.key === key && (!a.locales || a.locales.includes(loc) || a.locales.includes('*')));
}

test('sweep: no en-identical 3+ Latin-word values outside the allowlist', () => {
  const leaks = [];
  for (const [key, row] of Object.entries(DICT)) {
    if (row['@alias']) continue;
    const en = row.en;
    if (typeof en !== 'string' || en.length < 4 || !isUntranslatedProse(en)) continue;
    for (const loc of NON_EN) {
      if (row[loc] !== en) continue;
      if (allowed(loc, key)) continue;
      leaks.push(`${loc}.${key} = ${JSON.stringify(en)}`);
    }
  }
  assert.deepEqual(leaks, [],
    'en-identical untranslated values found (translate them or add a reasoned allowlist row):\n  ' + leaks.join('\n  '));
});

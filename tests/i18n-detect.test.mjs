/**
 * detect() browser-language mapping (BACKLOG v1.243.0).
 *
 * Two live defects locked here:
 *   1. `da-DK` browsers fell through to English even though the da
 *      dictionary is complete — detect() had no `da` branch;
 *   2. Traditional-Chinese variants (`zh-Hant`, `zh-Hant-TW`, `zh-HK`,
 *      `zh-MO`) fell through to `zh-CN` even though the app ships a full
 *      zh-TW table — wrong script for Hong Kong / Macau / Hant browsers.
 *
 * The table pins the full mapping so future locale additions update it
 * deliberately, not silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { runDictInto } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(__dirname, '..', 'public', 'js', 'lib');

/** Load i18n.js exactly like the browser, with a controlled navigator.language. */
function detectFor(browserLanguage) {
  const ctx = createContext({
    window: {},
    navigator: { language: browserLanguage },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { lang: 'en' }, addEventListener: () => {} },
  });
  runDictInto(ctx);
  runInContext(readFileSync(resolve(LIB, 'i18n.js'), 'utf8'), ctx);
  return ctx.window.I18n.getLang();
}

const MAPPING = [
  // Danish — was missing entirely (live-confirmed: da-DK browser → en UI).
  ['da', 'da'],
  ['da-DK', 'da'],
  ['da-DK,de-DE;q=0.9', 'da'],
  // Chinese — script/region variants must land on the script the user reads.
  ['zh', 'zh-CN'],
  ['zh-CN', 'zh-CN'],
  ['zh-SG', 'zh-CN'],
  ['zh-Hans', 'zh-CN'],
  ['zh-Hans-CN', 'zh-CN'],
  ['zh-TW', 'zh-TW'],
  ['zh-HK', 'zh-TW'],
  ['zh-MO', 'zh-TW'],
  ['zh-Hant', 'zh-TW'],
  ['zh-Hant-TW', 'zh-TW'],
  ['zh-Hant-HK', 'zh-TW'],
  // Untouched siblings (regression pins).
  ['pt', 'pt-BR'],
  ['pt-PT', 'pt-BR'],
  ['es-419', 'es'],
  ['ko-KR', 'ko'],
  ['ja-JP', 'ja'],
  ['ru-RU', 'ru'],
  ['uk-UA', 'uk'],
  ['fr-FR', 'fr'],
  ['pl-PL', 'pl'],
  ['ar-EG', 'ar'],
  ['de-AT', 'de'],
  ['it-CH', 'it'],
  ['tr-TR', 'tr'],
  ['hi-IN', 'hi'],
  // No mapping → English.
  ['en-GB', 'en'],
  ['nb-NO', 'en'],
  ['sv-SE', 'en'],
];

test('detect(): every browser language lands on the intended locale', () => {
  for (const [browser, expected] of MAPPING) {
    assert.equal(detectFor(browser), expected, `navigator.language "${browser}"`);
  }
});

test('detect(): every LANGS entry has a detect() hit (a shippable locale is reachable)', () => {
  const ctx = createContext({
    window: {},
    navigator: { language: 'en' },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { lang: 'en' }, addEventListener: () => {} },
  });
  runDictInto(ctx);
  runInContext(readFileSync(resolve(LIB, 'i18n.js'), 'utf8'), ctx);
  const langs = ctx.window.I18n.getLangs().map((l) => l.code);
  // da/hi/etc. are detected via their own branch; pt-BR/zh-* via prefix rules.
  const probes = {
    en: 'en', es: 'es', 'pt-BR': 'pt', ko: 'ko', ja: 'ja', ru: 'ru',
    'zh-CN': 'zh', 'zh-TW': 'zh-hk', fr: 'fr', pl: 'pl', uk: 'uk', da: 'da',
    ar: 'ar', de: 'de', it: 'it', tr: 'tr', hi: 'hi',
  };
  for (const code of langs) {
    assert.ok(probes[code] !== undefined, `locale ${code} has no detect() probe in this test`);
    assert.equal(detectFor(probes[code]), code, `locale ${code} unreachable via detect()`);
  }
});

/**
 * I18N-EXPAND (v1.70.0) — coverage for the two behaviour changes that
 * shipped with the 12-locale expansion:
 *
 *   1. The flag `<select>` language switcher (renderLangSwitcher in app.js)
 *      replaced the wrapping `.lang-btn` row.
 *   2. Arabic RTL: i18n.js writes `<html dir>` (rtl for RTL_LANGS, ltr
 *      otherwise) on setLang() and at boot.
 *
 * The i18n behaviour is exercised by running the REAL dictionary + i18n.js
 * in a vm with a captured `document` mock. The switcher DOM-build is a
 * client IIFE that depends on Router/API/UI globals, so (per the repo
 * convention used by qa-report-fixes) its wiring is asserted against source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { runDictInto } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

/** Boot the real i18n module in a vm with a captured document + storage. */
function bootI18n() {
  const doc = { documentElement: { lang: 'en', dir: 'ltr' }, addEventListener() {} };
  const store = {};
  const ctx = createContext({
    window: {},
    document: doc,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    navigator: { language: 'en' },
  });
  runDictInto(ctx);
  runInContext(read('public', 'js', 'lib', 'i18n.js'), ctx);
  return { I18n: ctx.window.I18n, doc };
}

test('i18n: getLangs() exposes all 13 locales, each with code/label/flag', () => {
  const { I18n } = bootI18n();
  const langs = [...I18n.getLangs()]; // spread → main-realm array (getLangs is vm-realm)
  const codes = langs.map((l) => l.code);
  assert.deepEqual(
    codes.sort(),
    ['ar', 'da', 'en', 'es', 'fr', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'uk', 'zh-CN', 'zh-TW'].sort(),
    '13 locales must be registered',
  );
  for (const l of langs) {
    assert.ok(l.label && l.label.length, `${l.code} must have a label`);
    assert.ok(l.flag && /\p{Regional_Indicator}/u.test(l.flag), `${l.code} must have a flag emoji`);
  }
});

test('i18n RTL: setLang("ar") sets <html dir="rtl">; LTR locales reset it', () => {
  const { I18n, doc } = bootI18n();
  I18n.setLang('ar');
  assert.equal(I18n.getLang(), 'ar');
  assert.equal(doc.documentElement.dir, 'rtl', 'Arabic must flip <html dir> to rtl');
  I18n.setLang('en');
  assert.equal(doc.documentElement.dir, 'ltr', 'English must restore ltr');
  I18n.setLang('uk'); // a non-RTL new locale stays ltr
  assert.equal(doc.documentElement.dir, 'ltr', 'Ukrainian is LTR');
});

test('i18n: top.langLabel resolves (the <select> accessible name) in every locale', () => {
  const { I18n } = bootI18n();
  for (const l of I18n.getLangs()) {
    I18n.setLang(l.code);
    const v = I18n.t('top.langLabel');
    assert.ok(v && v !== 'top.langLabel', `top.langLabel must be translated in ${l.code}`);
  }
});

test('switcher source: renderLangSwitcher builds a <select> wired to setLang + aria-label', () => {
  const app = read('public', 'js', 'app.js');
  assert.match(app, /createElement\('select'\)/, 'must build a <select>');
  assert.match(app, /createElement\('option'\)/, 'must build <option>s');
  assert.match(app, /id = 'lang-select'/, 'select must carry id="lang-select" (tests + screenshot script target it)');
  assert.match(app, /setAttribute\('aria-label', I18n\.t\('top\.langLabel'/, 'select must have a localized aria-label');
  assert.match(app, /addEventListener\('change', \(\) => I18n\.setLang\(/, 'change must drive I18n.setLang');
  assert.doesNotMatch(app, /class = 'lang-btn'/, 'the old .lang-btn row must be gone');
});

/* global window */
/**
 * Assembler for window.I18n's translation dictionary.
 *
 * v1.60.0 (I18N-SPLIT) — the translations no longer live in this file.
 * They were split into one file per locale plus a shared alias map, all
 * under public/js/lib/locales/ and loaded (via <script src>) BEFORE this
 * file in public/index.html:
 *
 *   locales/i18n-dict.en.js     → window.__I18N_DICT_EN     (key → string)
 *   locales/i18n-dict.es.js     → window.__I18N_DICT_ES
 *   locales/i18n-dict.pt-BR.js  → window.__I18N_DICT_PT_BR
 *   locales/i18n-dict.ko.js     → window.__I18N_DICT_KO
 *   locales/i18n-dict.ja.js     → window.__I18N_DICT_JA
 *   locales/i18n-dict.ru.js     → window.__I18N_DICT_RU
 *   locales/i18n-dict.zh-CN.js  → window.__I18N_DICT_ZH_CN
 *   locales/i18n-dict.zh-TW.js  → window.__I18N_DICT_ZH_TW
 *   locales/i18n-dict.fr.js     → window.__I18N_DICT_FR
 *   locales/i18n-dict.aliases.js→ window.__I18N_ALIASES      (key → 'canonical.key')
 *
 * This file merges those locale-major tables back into the key-major
 * shape the rest of the app (and i18n.js's t()) has always consumed:
 *
 *   window.__I18N_DICT['nav.dashboard'] === { en: 'Dashboard', es: 'Panel', … }
 *   window.__I18N_DICT['nav.apply']     === { '@alias': 'apply.title' }
 *
 * So no view, no call-site, and no consumer of __I18N_DICT changed — only
 * the SOURCE of the strings did. Translators now edit a single language
 * file in isolation (the OpenWA/i18next per-locale layout) instead of one
 * 8-column megafile.
 *
 * @alias policy (unchanged from v1.59.13): an alias key shares ONE
 * translated string with its canonical key (sidebar label = page title =
 * dashboard tile). TRUE duplicates — identical in all 8 locales — are
 * aliased; FALSE duplicates that merely collapse in English but diverge in
 * another locale stay as independent keys in every per-locale file. See
 * locales/i18n-dict.aliases.js. tools/i18n-audit.mjs resolves aliases
 * before counting dupes; it hard-fails on personal-data leaks, broken
 * alias targets, empty values, bare-calendar-date placeholders, and
 * non-alias keys that lack full 8-locale parity.
 *
 * If a locale file failed to load (stale cache, CDN strip) its table is
 * absent and those keys fall back to English in t() — never a hard crash.
 *
 * Structured-data assembler: exempt from the 400-LOC file-size rule.
 */
window.__I18N_DICT = (function buildDict() {
  // en first: it is the fallback locale and the parity reference.
  const LANGS = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar'];
  const TABLES = {
    en: window.__I18N_DICT_EN,
    es: window.__I18N_DICT_ES,
    'pt-BR': window.__I18N_DICT_PT_BR,
    ko: window.__I18N_DICT_KO,
    ja: window.__I18N_DICT_JA,
    ru: window.__I18N_DICT_RU,
    'zh-CN': window.__I18N_DICT_ZH_CN,
    'zh-TW': window.__I18N_DICT_ZH_TW,
    fr: window.__I18N_DICT_FR,
    pl: window.__I18N_DICT_PL,
    uk: window.__I18N_DICT_UK,
    da: window.__I18N_DICT_DA,
    ar: window.__I18N_DICT_AR,
  };

  const dict = {};
  for (let i = 0; i < LANGS.length; i += 1) {
    const lang = LANGS[i];
    const table = TABLES[lang];
    if (!table || typeof table !== 'object') continue; // missing locale file → English fallback in t()
    const keys = Object.keys(table);
    for (let k = 0; k < keys.length; k += 1) {
      const key = keys[k];
      (dict[key] || (dict[key] = {}))[lang] = table[key];
    }
  }

  // Aliases are language-independent: rewrite each into the { '@alias': … }
  // shape t() understands. An alias entry REPLACES any per-locale entry for
  // that key (alias keys never appear in the per-locale tables anyway).
  const aliases = (typeof window.__I18N_ALIASES === 'object' && window.__I18N_ALIASES) || {};
  const aliasKeys = Object.keys(aliases);
  for (let a = 0; a < aliasKeys.length; a += 1) {
    const key = aliasKeys[a];
    dict[key] = { '@alias': aliases[key] };
  }

  return dict;
})();

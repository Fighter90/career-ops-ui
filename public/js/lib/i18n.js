/* global window, localStorage */
/**
 * Tiny i18n module. 8 languages, key-based translations, persisted in
 * localStorage. Falls back to English (and to the key itself) when missing.
 *
 * Usage in views:
 *   const t = window.I18n.t;
 *   t('nav.dashboard')      // → "Dashboard" / "Дашборд" / …
 *   t('scan.btn.en', '🌍 EN scan')   // optional default
 *
 * v1.23.0 (N-1) — the translation dictionary lives in i18n-dict.js
 * (loaded BEFORE this file in public/index.html). DICT is a structured-data
 * fixture exempt from the 400-LOC file-size rule; the logic in this file
 * stays well under it.
 */
window.I18n = (function () {
  // `flag` is a regional-indicator emoji shown in the language <select>
  // (renderLangSwitcher in app.js). It degrades gracefully to the region
  // letters on platforms without flag glyphs (e.g. Windows) — the label
  // still identifies the language, so it's informational, never load-bearing.
  const LANGS = [
    { code: 'en',    label: 'English',    flag: '🇬🇧' },
    { code: 'es',    label: 'Español',    flag: '🇪🇸' },
    { code: 'pt-BR', label: 'Português',  flag: '🇧🇷' },
    { code: 'ko',    label: '한국어',      flag: '🇰🇷' },
    { code: 'ja',    label: '日本語',      flag: '🇯🇵' },
    { code: 'ru',    label: 'Русский',    flag: '🇷🇺' },
    { code: 'zh-CN', label: '简体中文',    flag: '🇨🇳' },
    { code: 'zh-TW', label: '繁體中文',    flag: '🇹🇼' },
    { code: 'fr',    label: 'Français',   flag: '🇫🇷' },
    { code: 'pl',    label: 'Polski',     flag: '🇵🇱' },
    { code: 'uk',    label: 'Українська', flag: '🇺🇦' },
    { code: 'da',    label: 'Dansk',      flag: '🇩🇰' },
    { code: 'ar',    label: 'العربية',    flag: '🇸🇦' },
  ];

  // I18N-EXPAND (v1.70.0) — locales whose script is written right-to-left.
  // setLang() sets <html dir> accordingly so the whole SPA mirrors; the
  // [dir="rtl"] block in app.css handles the chrome (sidebar, drawer, etc.).
  const RTL_LANGS = new Set(['ar']);
  function dirFor(code) { return RTL_LANGS.has(code) ? 'rtl' : 'ltr'; }

  // The dictionary is loaded from `i18n-dict.js` via `<script src>`. If
  // that file failed to load (e.g. cached old build, stripped via CDN),
  // we fall back to an empty dict — every t() call returns its fallback
  // or the bare key. Better than a hard crash, surfaces the misconfig.
  const DICT = (typeof window.__I18N_DICT === 'object' && window.__I18N_DICT) || {};

  const STORAGE_KEY = 'career-ops-ui:lang';
  // v1.22.0 (M-5) — Safari private mode throws SecurityError on any
  // localStorage access. Wrap reads + writes in try/catch with the
  // browser-detect fallback so the IIFE doesn't fail at module load
  // and leave the SPA rendering raw keys.
  function _safeStorageGet(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  }
  function _safeStorageSet(k, v) {
    try { localStorage.setItem(k, v); } catch { /* private mode — ignore */ }
  }

  function detect() {
    const browser = (navigator.language || 'en').toLowerCase();
    if (browser.startsWith('pt')) return 'pt-BR';
    if (browser.startsWith('zh-tw') || browser.startsWith('zh-hk')) return 'zh-TW';
    if (browser.startsWith('zh')) return 'zh-CN';
    if (browser.startsWith('ko')) return 'ko';
    if (browser.startsWith('ja')) return 'ja';
    if (browser.startsWith('es')) return 'es';
    if (browser.startsWith('ru')) return 'ru';
    if (browser.startsWith('fr')) return 'fr';
    if (browser.startsWith('pl')) return 'pl';
    if (browser.startsWith('uk')) return 'uk';
    if (browser.startsWith('ar')) return 'ar';
    return 'en';
  }

  const _stored = _safeStorageGet(STORAGE_KEY);
  let current = (_stored || detect()).split('-')[0] === 'pt' ? 'pt-BR' : (_stored || detect());
  if (!LANGS.find((l) => l.code === current)) current = 'en';

  function t(key, fallback) {
    let entry = DICT[key];
    if (!entry) return fallback || key;
    // v1.59.13 — alias support. A key whose entry is { '@alias': 'x.y' }
    // resolves to the canonical key's translation. Lets duplicate-CONCEPT
    // keys (nav.help ↔ help.title ↔ dash.quick.helpCta — the sidebar
    // label, page title, and dashboard tile that must always read the
    // same) share ONE translated string. Translators fill the canonical
    // key once; alias keys need no translation. Call-sites are untouched
    // (zero breakage risk) and an alias can diverge later by replacing
    // the @alias with real per-locale strings. Genuinely-distinct keys
    // that merely collapse in English (a table column vs a form label)
    // are NOT aliased — see the i18n-dict.js header for the policy.
    if (entry['@alias']) entry = DICT[entry['@alias']] || entry;
    return entry[current] || entry.en || fallback || key;
  }

  const subscribers = [];
  function onChange(fn) { subscribers.push(fn); }

  function setLang(code) {
    if (!LANGS.find((l) => l.code === code)) return;
    current = code;
    _safeStorageSet(STORAGE_KEY, code);
    document.documentElement.lang = code;
    document.documentElement.dir = dirFor(code);
    subscribers.forEach((fn) => { try { fn(code); } catch {} });
  }

  function getLang() { return current; }
  function getLangs() { return LANGS.slice(); }

  // Initial document.lang + dir attributes
  document.documentElement.lang = current;
  document.documentElement.dir = dirFor(current);

  return { t, setLang, getLang, getLangs, onChange };
})();

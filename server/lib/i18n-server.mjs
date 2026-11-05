/**
 * Server-side loader for the split i18n dictionaries (I18N-SPLIT layout).
 *
 * In the browser, public/js/lib/locales/i18n-dict.<lang>.js (one flat
 * key → string table per locale) + i18n-dict.aliases.js (`key → canonical key`)
 * are assembled into window.__I18N_DICT by i18n-dict.js. Server features that
 * must speak the request's UI language (docs-assistant deep-link labels) read
 * the SAME shipped files: one per-locale table is run inside a node:vm context
 * — the same technique tests/helpers/i18n-vm.mjs uses — with only the needed
 * locale loaded, and cached for the process lifetime (the dict files ship with
 * the app and do not change at runtime).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { WEB_UI_ROOT } from './paths.mjs';

const LOCALES_DIR = resolve(WEB_UI_ROOT, 'public', 'js', 'lib', 'locales');

// The per-file global derives from the locale code the way the I18N-SPLIT
// generator names it: ru → __I18N_DICT_RU, pt-BR → __I18N_DICT_PT_BR.
const dictGlobalName = (lang) => `__I18N_DICT_${String(lang).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;

const dictCache = new Map();

/**
 * Language-independent alias map (`'nav.apply' → 'apply.title'`). Cached per
 * resolved directory — the shipped checkout and a test fixture (an empty dir
 * proving the missing-file degradation) must not share one cache slot.
 */
const aliasesCacheByDir = new Map();

/** Language-independent alias map (`'nav.apply' → 'apply.title'`). Static + tiny. */
export function loadI18nAliases(localesDir = LOCALES_DIR) {
  const file = resolve(localesDir, 'i18n-dict.aliases.js');
  if (aliasesCacheByDir.has(file)) return aliasesCacheByDir.get(file);
  let aliases = {};
  if (existsSync(file)) {
    const ctx = createContext({ window: {} });
    runInContext(readFileSync(file, 'utf8'), ctx);
    aliases = ctx.window.__I18N_ALIASES || {};
  }
  // A checkout without the alias file (partial deploy) degrades to no
  // aliases — every lookup falls through to its own key or the en dict.
  aliasesCacheByDir.set(file, aliases);
  return aliases;
}

/**
 * Flat key → string map for one locale, from the shipped per-locale file.
 * `null` for an unknown/missing locale file (the caller decides the fallback).
 */
export function loadLocaleDict(lang) {
  const code = String(lang || '').trim();
  if (!code) return null;
  if (dictCache.has(code)) return dictCache.get(code);
  const safe = code.replace(/[^a-zA-Z0-9_-]/g, '');
  let dict = null;
  if (safe) {
    const file = resolve(LOCALES_DIR, `i18n-dict.${safe}.js`);
    if (existsSync(file)) {
      const ctx = createContext({ window: {} });
      runInContext(readFileSync(file, 'utf8'), ctx);
      dict = ctx.window[dictGlobalName(safe)] || null;
    }
  }
  dictCache.set(code, dict);
  return dict;
}

/**
 * Resolve one UI label for a locale: the dict value, else through ONE alias
 * hop (nav.apply → apply.title), else the en dict's value. '' when nothing
 * resolves (the caller keeps whatever label it already had).
 */
export function localeLabel(lang, key) {
  if (typeof key !== 'string' || !key) return '';
  const resolveIn = (code) => {
    const dict = loadLocaleDict(code);
    if (!dict) return '';
    // Own-key lookups only ('constructor' and friends must not reach the
    // prototype chain of the table object).
    if (Object.prototype.hasOwnProperty.call(dict, key) && typeof dict[key] === 'string' && dict[key]) return dict[key];
    const aliases = loadI18nAliases();
    const target = Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : null;
    if (target && Object.prototype.hasOwnProperty.call(dict, target) && typeof dict[target] === 'string' && dict[target]) return dict[target];
    return '';
  };
  return resolveIn(String(lang || '')) || (String(lang) !== 'en' ? resolveIn('en') : '');
}

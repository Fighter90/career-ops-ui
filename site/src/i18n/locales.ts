/**
 * Single source of truth for every locale the landing ships in.
 * Drives: routes (getStaticPaths), hreflang alternates, the language
 * switcher, screenshot selection, and help-guide selection.
 *
 * `slug` is the lowercase URL prefix ('' = default English at /).
 * `file` is the repo's canonical file key used by images/dashboard-<file>.png
 * and docs/help/<file>.md (note: ko uses ko-KR on disk).
 */
export interface Locale {
  /** BCP 47 code used for <html lang> and hreflang. */
  readonly code: string;
  /** Lowercase URL prefix segment; '' for the default (English). */
  readonly slug: string;
  /** Language name in its own language (switcher label). */
  readonly endonym: string;
  /** Writing direction. */
  readonly dir: 'ltr' | 'rtl';
  /** Regional-indicator emoji shown next to the endonym (mirrors the SPA's
   *  language <select>); degrades to region letters where flag glyphs are
   *  missing, so the endonym stays the primary label. */
  readonly flag: string;
  /** File key for images/dashboard-<file>.png and docs/help/<file>.md. */
  readonly file: string;
  /** og:locale value. */
  readonly ogLocale: string;
}

export const LOCALES: readonly Locale[] = [
  { code: 'en', slug: '', endonym: 'English', flag: '🇬🇧', dir: 'ltr', file: 'en', ogLocale: 'en_US' },
  { code: 'es', slug: 'es', endonym: 'Español', flag: '🇪🇸', dir: 'ltr', file: 'es', ogLocale: 'es_ES' },
  { code: 'fr', slug: 'fr', endonym: 'Français', flag: '🇫🇷', dir: 'ltr', file: 'fr', ogLocale: 'fr_FR' },
  { code: 'pt-BR', slug: 'pt-br', endonym: 'Português (Brasil)', flag: '🇧🇷', dir: 'ltr', file: 'pt-BR', ogLocale: 'pt_BR' },
  { code: 'ko', slug: 'ko', endonym: '한국어', flag: '🇰🇷', dir: 'ltr', file: 'ko-KR', ogLocale: 'ko_KR' },
  { code: 'ja', slug: 'ja', endonym: '日本語', flag: '🇯🇵', dir: 'ltr', file: 'ja', ogLocale: 'ja_JP' },
  { code: 'ru', slug: 'ru', endonym: 'Русский', flag: '🇷🇺', dir: 'ltr', file: 'ru', ogLocale: 'ru_RU' },
  { code: 'zh-CN', slug: 'zh-cn', endonym: '简体中文', flag: '🇨🇳', dir: 'ltr', file: 'zh-CN', ogLocale: 'zh_CN' },
  { code: 'zh-TW', slug: 'zh-tw', endonym: '繁體中文', flag: '🇹🇼', dir: 'ltr', file: 'zh-TW', ogLocale: 'zh_TW' },
  { code: 'pl', slug: 'pl', endonym: 'Polski', flag: '🇵🇱', dir: 'ltr', file: 'pl', ogLocale: 'pl_PL' },
  { code: 'uk', slug: 'uk', endonym: 'Українська', flag: '🇺🇦', dir: 'ltr', file: 'uk', ogLocale: 'uk_UA' },
  { code: 'da', slug: 'da', endonym: 'Dansk', flag: '🇩🇰', dir: 'ltr', file: 'da', ogLocale: 'da_DK' },
  { code: 'ar', slug: 'ar', endonym: 'العربية', flag: '🇸🇦', dir: 'rtl', file: 'ar', ogLocale: 'ar_AR' },
  { code: 'de', slug: 'de', endonym: 'Deutsch', flag: '🇩🇪', dir: 'ltr', file: 'de', ogLocale: 'de_DE' },
  { code: 'it', slug: 'it', endonym: 'Italiano', flag: '🇮🇹', dir: 'ltr', file: 'it', ogLocale: 'it_IT' },
  { code: 'tr', slug: 'tr', endonym: 'Türkçe', flag: '🇹🇷', dir: 'ltr', file: 'tr', ogLocale: 'tr_TR' },
] as const;

export const DEFAULT_LOCALE: Locale = LOCALES[0];

export function localeBySlug(slug: string): Locale | undefined {
  return LOCALES.find((l) => l.slug === slug);
}

/** Path prefix for a locale ('' → '/', 'ru' → '/ru/'). */
export function localeHome(l: Locale): string {
  return l.slug === '' ? '/' : `/${l.slug}/`;
}

/** Same-page URL in another locale (page: '' for home, 'help' for the guide). */
export function localePath(l: Locale, page: '' | 'help'): string {
  const base = localeHome(l);
  return page === '' ? base : `${base}help/`;
}

// ---------------------------------------------------------------------------
// Translation dictionaries — one flat JSON per locale in src/i18n/<code>.json.
// Missing keys FAIL the build (see t() below + scripts/check-i18n.mjs).
// ---------------------------------------------------------------------------
const dictModules = import.meta.glob<{ default: Record<string, string> }>('./*.json', {
  eager: true,
});

const DICTS: Record<string, Record<string, string>> = {};
for (const [path, mod] of Object.entries(dictModules)) {
  const code = path.replace('./', '').replace('.json', '');
  DICTS[code] = mod.default;
}

export function t(locale: Locale, key: string): string {
  const dict = DICTS[locale.code];
  if (!dict) throw new Error(`[i18n] missing dictionary for locale "${locale.code}"`);
  const val = dict[key];
  if (val === undefined) {
    throw new Error(`[i18n] missing key "${key}" in locale "${locale.code}"`);
  }
  return val;
}

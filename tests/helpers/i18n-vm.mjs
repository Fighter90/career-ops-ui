/**
 * Shared vm loader for the split i18n dictionary (I18N-SPLIT v1.60.0).
 *
 * The dictionary is no longer one file: 8 per-locale tables + an alias map
 * live under public/js/lib/locales/ and are assembled by
 * public/js/lib/i18n-dict.js into window.__I18N_DICT. In the browser they
 * load in order via <script src>; here we replay that exact order inside a
 * vm context so tests + tooling exercise the real assembled dictionary.
 *
 * Used by tests/i18n-coverage, tests/i18n-alias, and tools/i18n-audit.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(__dirname, '..', '..', 'public', 'js', 'lib');
const LOCALES = resolve(LIB, 'locales');

export const I18N_LANGS = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'ar'];

/** Raw source text of one per-locale table file. */
export function localeSource(lang) {
  return readFileSync(resolve(LOCALES, `i18n-dict.${lang}.js`), 'utf8');
}

/** Concatenated raw source of all per-locale tables + the alias map. Used by
 *  source-text guards (no-personal-data, leak sweeps) that must scan every
 *  locale, not just the assembler. */
export function allLocaleSource() {
  return I18N_LANGS.map((l) => localeSource(l)).join('\n')
    + '\n' + readFileSync(resolve(LOCALES, 'i18n-dict.aliases.js'), 'utf8');
}

/** Run the per-locale tables + alias map + assembler into `ctx`, in browser order. */
export function runDictInto(ctx) {
  for (const lang of I18N_LANGS) {
    runInContext(readFileSync(resolve(LOCALES, `i18n-dict.${lang}.js`), 'utf8'), ctx);
  }
  runInContext(readFileSync(resolve(LOCALES, 'i18n-dict.aliases.js'), 'utf8'), ctx);
  runInContext(readFileSync(resolve(LIB, 'i18n-dict.js'), 'utf8'), ctx); // assembler → window.__I18N_DICT
}

/** Assemble and return just window.__I18N_DICT (key-major, alias-aware). */
export function loadAssembledDict() {
  const ctx = createContext({ window: {} });
  runDictInto(ctx);
  return ctx.window.__I18N_DICT;
}

/**
 * Render the assembled dictionary back into the PRE-SPLIT megaline source
 * format — one key per line, all 8 locales (or `'@alias'`) inline:
 *
 *   'key': { en: 'v', es: 'v', 'pt-BR': 'v', …, 'zh-TW': 'v' },
 *   'aliasKey': { '@alias': 'canonical.key' },
 *
 * This is a DERIVED compatibility view (not a source file) for the legacy
 * text-scanner tests that grep "key present in all 8 locales" by string —
 * it keeps them green without rewriting each, and it cannot drift because
 * it is generated from the same assembled dict the browser uses. Quoting
 * matches the old authoring style (single-quoted values, escaped \' \\ \n)
 * so value substring checks behave identically.
 */
export function legacyDictText() {
  const dict = loadAssembledDict();
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const qk = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
  const lines = [];
  for (const [key, row] of Object.entries(dict)) {
    if (row['@alias']) {
      lines.push(`  '${key}': { '@alias': '${row['@alias']}' },`);
      continue;
    }
    const pairs = I18N_LANGS
      .filter((l) => row[l] !== undefined)
      .map((l) => `${qk(l)}: '${esc(row[l])}'`)
      .join(', ');
    lines.push(`  '${key}': { ${pairs} },`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Build window.I18n with the real t() resolver, exposing the merged DICT via
 * the `_DICT` escape hatch (patched into i18n.js's return for inspection).
 */
export function loadI18n() {
  const logic = readFileSync(resolve(LIB, 'i18n.js'), 'utf8').replace(
    /return\s*\{\s*t,\s*setLang,\s*getLang,\s*getLangs,\s*onChange\s*\};/,
    'return { t, setLang, getLang, getLangs, onChange, _DICT: DICT };',
  );
  const ctx = createContext({
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { lang: 'en' }, addEventListener: () => {} },
    navigator: { language: 'en' },
  });
  runDictInto(ctx);
  runInContext(logic, ctx);
  return ctx.window.I18n;
}

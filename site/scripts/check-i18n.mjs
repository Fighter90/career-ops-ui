#!/usr/bin/env node
/**
 * check-i18n.mjs — fails the build when any locale dictionary is missing a
 * key (or carries an unknown extra key) relative to en.json, or when a
 * locale JSON is missing entirely for a registry entry.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const I18N = join(SITE, 'src', 'i18n');

// Keep in sync with src/i18n/locales.ts (codes).
const CODES = ['en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta'];

const files = readdirSync(I18N).filter((f) => f.endsWith('.json'));
let failed = false;

const en = JSON.parse(readFileSync(join(I18N, 'en.json'), 'utf8'));
const enKeys = Object.keys(en).sort();

for (const code of CODES) {
  const file = `${code}.json`;
  if (!files.includes(file)) {
    console.error(`[i18n] MISSING dictionary: src/i18n/${file}`);
    failed = true;
    continue;
  }
  if (code === 'en') continue;
  const dict = JSON.parse(readFileSync(join(I18N, file), 'utf8'));
  const keys = Object.keys(dict);
  const missing = enKeys.filter((k) => !(k in dict));
  const extra = keys.filter((k) => !(k in en));
  if (missing.length) {
    console.error(`[i18n] ${file}: missing ${missing.length} key(s): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`);
    failed = true;
  }
  if (extra.length) {
    console.error(`[i18n] ${file}: unknown extra key(s): ${extra.slice(0, 8).join(', ')}`);
    failed = true;
  }
  const empty = keys.filter((k) => typeof dict[k] !== 'string' || dict[k].trim() === '');
  if (empty.length) {
    console.error(`[i18n] ${file}: empty value(s): ${empty.slice(0, 8).join(', ')}`);
    failed = true;
  }
}

for (const f of files) {
  const code = f.replace('.json', '');
  if (!CODES.includes(code)) {
    console.error(`[i18n] dictionary ${f} has no entry in the locale registry`);
    failed = true;
  }
}

// The sitemap's hreflang map in astro.config.mjs is a second copy of the
// registry; a locale missing there silently loses its alternates (hi did).
const astroConfig = readFileSync(join(SITE, 'astro.config.mjs'), 'utf8');
// Anchor inside the sitemap(...) call so an Astro i18n `locales:` elsewhere
// can never be the block that gets validated.
const sitemapAt = astroConfig.indexOf('sitemap(');
const localesAt = sitemapAt < 0 ? -1 : astroConfig.indexOf('locales:', sitemapAt);
const sitemapBlock = localesAt < 0 ? '' : astroConfig.slice(localesAt, astroConfig.indexOf('}', localesAt));
if (!sitemapBlock) {
  console.error('[i18n] astro.config.mjs: no sitemap({ i18n: { locales } }) block found');
  failed = true;
}
const sitemapCodes = [...sitemapBlock.matchAll(/:\s*'([A-Za-z-]+)'/g)].map((m) => m[1]);
for (const code of CODES) {
  if (!sitemapCodes.includes(code)) {
    console.error(`[i18n] astro.config.mjs sitemap i18n map has no entry for ${code}`);
    failed = true;
  }
}
for (const code of sitemapCodes) {
  if (!CODES.includes(code)) {
    console.error(`[i18n] astro.config.mjs sitemap i18n map lists ${code}, which is not in the registry`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`[i18n] OK — ${CODES.length} locales × ${enKeys.length} keys, full parity`);

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
const CODES = ['en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

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

if (failed) process.exit(1);
console.log(`[i18n] OK — ${CODES.length} locales × ${enKeys.length} keys, full parity`);

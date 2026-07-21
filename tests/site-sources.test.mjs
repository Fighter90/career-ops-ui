/**
 * v1.125.0 — cvstart.org "Job sources" landing section.
 *
 * The section's list is synced from the live registry at build
 * (facts.sources via sync-assets), and every source value needs a row in
 * the curated SOURCE_URLS link map inside Sources.astro. These guards make
 * a newly ported adapter fail HERE (add its link) instead of silently
 * shipping a linkless chip, and keep the section wired into the landing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../server/lib/sources/registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'site');
const SITE_LOCALES = ['en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

test('Sources.astro exists and is wired into the landing + header nav', () => {
  assert.ok(existsSync(resolve(SITE, 'src', 'components', 'Sources.astro')), 'Sources.astro missing');
  const landing = readFileSync(resolve(SITE, 'src', 'components', 'Landing.astro'), 'utf8');
  assert.ok(landing.includes('<Sources locale={locale} />'), 'Landing missing <Sources>');
  const header = readFileSync(resolve(SITE, 'src', 'components', 'Header.astro'), 'utf8');
  assert.ok(header.includes("{ id: 'sources', key: 'nav.sources' }"), 'Header nav missing sources anchor');
});

test('SOURCE_URLS covers every registry source value', () => {
  const astro = readFileSync(resolve(SITE, 'src', 'components', 'Sources.astro'), 'utf8');
  // Map keys: bare identifiers or quoted strings followed by ": 'https…'" or ": ''".
  const keys = new Set(
    [...astro.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z0-9_]+)):\s*'/gm)].map((m) => m[1] || m[2]),
  );
  const urls = new Map(
    [...astro.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z0-9_]+)):\s*'([^']*)'/gm)].map((m) => [m[1] || m[2], m[3]]),
  );
  for (const s of SOURCES) {
    assert.ok(keys.has(s.value), `SOURCE_URLS missing '${s.value}' (${s.label}) — add its link`);
    if (s.value === 'rss') continue; // the app's own connector links to the guide
    const u = urls.get(s.value) || '';
    assert.ok(u.startsWith('https://'), `SOURCE_URLS['${s.value}'] must be a non-empty https URL, got '${u}'`);
  }
});

test('sync-assets exports the sources into facts', () => {
  const sync = readFileSync(resolve(SITE, 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(sync.includes('sources: scanSources'), 'sync-assets missing facts.sources');
  assert.ok(sync.includes("sources', 'registry.mjs"), 'sync-assets must import the live registry');
});

test('every site locale dictionary carries the sources-section keys', () => {
  for (const code of SITE_LOCALES) {
    const dict = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${code}.json`), 'utf8'));
    for (const key of ['nav.sources', 'src.title', 'src.lead', 'src.ru']) {
      assert.equal(typeof dict[key], 'string', `${code}.json missing ${key}`);
      assert.ok(dict[key].length > 0, `${code}.json empty ${key}`);
    }
  }
});

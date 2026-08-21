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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

test('no source module top-level-imports a third-party package (registry enumeration must be dep-free for the Pages build)', () => {
  // The cvstart.org Pages build imports the live registry to render the "Job
  // sources" section, but it only `npm ci`s in site/ — the repo-root
  // node_modules is absent. Any source that top-level-imports a third-party
  // package throws there, the registry silently drops it, and the landing's
  // count drifts from the app (v1.212.0: jobbankca imported js-yaml at top
  // level → site showed 80 vs 81). Enforce: sources import only `node:`
  // builtins or relative modules at top level; lazy-load third-party deps
  // (e.g. `const yaml = await import('js-yaml')`) inside functions instead.
  const dir = resolve(ROOT, 'server', 'lib', 'sources');
  const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'registry.mjs');
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(resolve(dir, f), 'utf8');
    for (const m of src.matchAll(/^import\s+(?:[^'";]*\bfrom\s+)?['"]([^'"]+)['"]/gm)) {
      const spec = m[1];
      if (spec.startsWith('node:') || spec.startsWith('.')) continue;
      offenders.push(`${f} → '${spec}'`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `sources must import only node: builtins or relative modules at top level; ` +
      `lazy-load third-party deps inside functions. Offenders: ${offenders.join(', ')}`,
  );
});

test('sync-assets guards the registry enumeration against a silent source drop', () => {
  const sync = readFileSync(resolve(SITE, 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(
    /scanSources\.length\s*!==\s*adapters/.test(sync),
    'sync-assets must fail the build when the registry enumeration count ≠ the adapter file count',
  );
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

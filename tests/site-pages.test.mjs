/**
 * v1.121.0 — cvstart.org Methodology / License / Changelog pages.
 *
 * The landing gained three localized pages sourced from the repo:
 *   /methodology/ — i18n-keyed summary of career-ops.org/methodology
 *   /license/     — canonical LICENSE text (synced at build time)
 *   /changelog/   — per-locale CHANGELOG.<lang>.md (synced at build time)
 *
 * These guards pin the wiring so a refactor can't silently drop a page,
 * a locale, or the build-time sync that keeps them from drifting.
 * Link checks use extraction + strict equality (see manifesto-link.test.mjs
 * for the CodeQL rationale).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'site');

const PAGES = ['methodology', 'license', 'changelog'];
const SITE_LOCALES = ['en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];
const NEW_KEYS = [
  'nav.methodology', 'footer.parentMethodology',
  'meta.methodologyTitle', 'meta.methodologyDesc',
  'meta.licenseTitle', 'meta.licenseDesc',
  'meta.changelogTitle', 'meta.changelogDesc',
  'method.title', 'method.lead', 'method.thresholdTitle', 'method.thresholdBody',
  'method.tblScore', 'method.tblNext', 'method.row45', 'method.row40', 'method.row35', 'method.row00',
  'method.dimsTitle', 'method.dimsBody', 'method.neverTitle', 'method.neverBody',
  'method.manifestoBody', 'method.canonical', 'method.docsLink',
  'license.title', 'license.lead', 'license.notice',
  'changelog.title', 'changelog.lead',
];

test('each new page has a root route, a [locale] route, and a component', () => {
  const COMPONENT = { methodology: 'MethodologyPage', license: 'LicensePage', changelog: 'ChangelogPage' };
  for (const p of PAGES) {
    assert.ok(existsSync(resolve(SITE, 'src', 'pages', `${p}.astro`)), `pages/${p}.astro missing`);
    assert.ok(existsSync(resolve(SITE, 'src', 'pages', '[locale]', `${p}.astro`)), `pages/[locale]/${p}.astro missing`);
    assert.ok(existsSync(resolve(SITE, 'src', 'components', `${COMPONENT[p]}.astro`)), `components/${COMPONENT[p]}.astro missing`);
  }
});

test('every site locale dictionary carries the 30 new page keys', () => {
  for (const code of SITE_LOCALES) {
    const dict = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${code}.json`), 'utf8'));
    for (const key of NEW_KEYS) {
      assert.equal(typeof dict[key], 'string', `${code}.json missing ${key}`);
      assert.ok(dict[key].length > 0, `${code}.json empty ${key}`);
    }
  }
});

test('footer links every new page locally and the parent methodology page', () => {
  const footer = readFileSync(resolve(SITE, 'src', 'components', 'Footer.astro'), 'utf8');
  for (const p of PAGES) {
    assert.ok(footer.includes(`\${home}${p}/`), `Footer.astro missing local /${p}/ link`);
  }
  assert.ok(footer.includes('footer.parentMethodology'), 'Footer.astro missing parent methodology link');
});

test('header nav carries the methodology page entry', () => {
  const header = readFileSync(resolve(SITE, 'src', 'components', 'Header.astro'), 'utf8');
  assert.ok(header.includes("key: 'nav.methodology'"), 'Header.astro missing nav.methodology');
  assert.ok(header.includes("PAGE_IDS = new Set(['help', 'methodology'])"), 'Header.astro PAGE_IDS missing methodology');
});

test('sync-assets syncs the changelog collection and the license text', () => {
  const sync = readFileSync(resolve(SITE, 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(sync.includes("src', 'content', 'changelog'"), 'sync-assets missing changelog sync');
  assert.ok(sync.includes('license.txt'), 'sync-assets missing license sync');
  const config = readFileSync(resolve(SITE, 'src', 'content.config.ts'), 'utf8');
  assert.ok(config.includes('changelog'), 'content.config missing changelog collection');
});

test('help bundles and README link the methodology page', () => {
  const METHODOLOGY_URL = 'https://career-ops.org/methodology';
  const targets = (text) => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  const HELP = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];
  for (const lang of HELP) {
    const text = readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
    assert.ok(targets(text).some((u) => u === METHODOLOGY_URL), `docs/help/${lang}.md missing methodology link`);
  }
  const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  assert.ok(targets(readme).some((u) => u === METHODOLOGY_URL), 'README.md missing methodology link');
});

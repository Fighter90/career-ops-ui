/**
 * v1.120.0 — parent v1.20.0 parity: the CareerOps Manifesto surfacing.
 *
 * The parent project shipped MANIFESTO.md + career-ops.org/manifesto and
 * surfaces it from its README, updater, and Go dashboard (footer link +
 * help entry). The web UI mirrors that: a sidebar-footer link in the SPA,
 * a §29 help-guide section in every locale, and a README section.
 *
 * These guards keep a future refactor from silently dropping any of the
 * three surfaces, and pin the link contract (outbound anchor, no inline
 * handlers, i18n-keyed label, no tracking params).
 *
 * Link checks extract the actual link targets and compare them with
 * strict equality — the canonical pattern CodeQL recommends over URL
 * substring / unanchored-regex matching (js/incomplete-url-substring-
 * sanitization, js/regex/missing-regexp-anchor).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MANIFESTO_URL = 'https://career-ops.org/manifesto';
const HELP_BUNDLES = [
  'en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW',
  'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi',
];

/** All link targets in a document: markdown `](url)`, html `href="url"`, astro `href: 'url'`. */
function linkTargets(text) {
  const out = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) out.push(m[1]);
  for (const m of text.matchAll(/href="([^"]+)"/g)) out.push(m[1]);
  for (const m of text.matchAll(/href: '([^']+)'/g)) out.push(m[1]);
  return out;
}

test('index.html sidebar footer carries the manifesto link', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('class="manifesto-link"'), 'manifesto-link anchor missing');
  // Exact-equality on the extracted href: correct URL AND no query params.
  assert.ok(linkTargets(html).some((u) => u === MANIFESTO_URL),
    'manifesto href must be exactly the clean manifesto URL');
  assert.ok(html.includes('data-i18n="footer.manifesto"'), 'footer.manifesto i18n binding missing');
  const anchor = html.split('manifesto-link')[1].split('</a>')[0];
  assert.ok(anchor.includes('rel="noopener noreferrer"'), 'outbound link must be noopener noreferrer');
  assert.ok(!/onclick=/i.test(anchor), 'no inline handlers (CSP)');
});

test('footer.manifesto key exists in the assembled dict for every locale', () => {
  // loadAssembledDict() returns per-key objects: { key: { en, es, … } }.
  const entry = loadAssembledDict()['footer.manifesto'];
  assert.ok(entry && typeof entry === 'object', 'footer.manifesto entry missing');
  assert.equal(I18N_LANGS.length, 17);
  for (const lang of I18N_LANGS) {
    assert.equal(typeof entry[lang], 'string', `footer.manifesto missing for ${lang}`);
    assert.ok(entry[lang].length > 0, `footer.manifesto empty for ${lang}`);
  }
});

test('every help bundle has the §29 manifesto section with the manifesto URL', () => {
  for (const lang of HELP_BUNDLES) {
    const text = readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
    assert.ok(/^## 29\. /m.test(text), `${lang}.md missing "## 29." heading`);
    assert.ok(linkTargets(text).some((u) => u === MANIFESTO_URL),
      `${lang}.md must link the clean manifesto URL`);
  }
});

test('README (en) explains the manifesto', () => {
  const text = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  assert.ok(text.includes('## The CareerOps Manifesto'), 'README manifesto section missing');
  assert.ok(linkTargets(text).some((u) => u === MANIFESTO_URL),
    'README must link the clean manifesto URL');
});

test('cvstart.org footer links to the manifesto in every site locale file', () => {
  const footer = readFileSync(resolve(ROOT, 'site', 'src', 'components', 'Footer.astro'), 'utf8');
  assert.ok(linkTargets(footer).some((u) => u === MANIFESTO_URL),
    'Footer.astro must link the clean manifesto URL');
  assert.ok(footer.includes("t(locale, 'footer.manifesto')"), 'Footer.astro must label via i18n');
  for (const lang of HELP_BUNDLES) {
    const jsonName = lang === 'ko-KR' ? 'ko' : lang;
    const json = JSON.parse(readFileSync(resolve(ROOT, 'site', 'src', 'i18n', `${jsonName}.json`), 'utf8'));
    assert.equal(typeof json['footer.manifesto'], 'string', `site ${jsonName}.json missing footer.manifesto`);
    assert.ok(json['footer.manifesto'].length > 0, `site ${jsonName}.json footer.manifesto empty`);
  }
});

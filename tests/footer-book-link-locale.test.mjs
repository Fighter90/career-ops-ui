/**
 * BOOK-1 regression (v1.237.1). The Agentic Coding Design Patterns footer link
 * localizes its TARGET, not only its label: the ru dictionary promises
 * «Паттерны агентного кодинга», so its href must be the Russian edition. Every
 * other locale points at the English edition. Before this test the label was
 * localized and the href was hardcoded to /en/ in all 17 locales — the one
 * locale whose label promised a Russian book was the one whose link led to the
 * English one.
 *
 * CI-isolated: reads the dictionaries and index.html from disk, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EN = 'https://mokevnin.github.io/agentic-coding-design-patterns/en/';
const RU = 'https://mokevnin.github.io/agentic-coding-design-patterns/ru/';

test('every locale carries a footer.patternsUrl that is an absolute https URL to the book', () => {
  const dict = loadAssembledDict();
  const urls = dict['footer.patternsUrl'];
  assert.ok(urls, 'footer.patternsUrl key missing');
  for (const lang of I18N_LANGS) {
    const u = urls[lang];
    assert.equal(typeof u, 'string', `${lang}: no footer.patternsUrl`);
    assert.ok(u.startsWith('https://mokevnin.github.io/agentic-coding-design-patterns/'), `${lang}: ${u}`);
  }
});

test('ru links the Russian edition; every other locale links the English edition', () => {
  const urls = loadAssembledDict()['footer.patternsUrl'];
  assert.equal(urls.ru, RU, 'ru must point at the /ru/ edition its label promises');
  for (const lang of I18N_LANGS) {
    if (lang === 'ru') continue;
    assert.equal(urls[lang], EN, `${lang} must point at the /en/ edition`);
  }
});

test('the label and the URL agree: a translated title implies a translated edition', () => {
  const dict = loadAssembledDict();
  const labels = dict['footer.patterns'];
  const urls = dict['footer.patternsUrl'];
  for (const lang of I18N_LANGS) {
    const translated = !labels[lang].includes('Agentic Coding Design Patterns');
    const localized = urls[lang] !== EN;
    assert.equal(translated, localized,
      `${lang}: label ${translated ? 'is' : 'is not'} translated but URL ${localized ? 'is' : 'is not'} localized`);
  }
});

test('index.html wires data-i18n-href on the book anchor and app.js applies it', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  const anchor = html.match(/<a[^>]*data-i18n="footer\.patterns"[^>]*>/);
  assert.ok(anchor, 'book anchor not found');
  assert.match(anchor[0], /data-i18n-href="footer\.patternsUrl"/);
  const app = readFileSync(resolve(ROOT, 'public', 'js', 'app.js'), 'utf8');
  assert.match(app, /querySelectorAll\('\[data-i18n-href\]'\)/, 'app.js does not apply data-i18n-href');
  // the applier must refuse anything that is not an absolute https URL
  assert.match(app, /\^https:\\\/\\\//, 'data-i18n-href applier is not restricted to https://');
});

test('the site footer resolves the same per-locale URL', () => {
  const site = resolve(ROOT, 'site', 'src', 'i18n');
  const ru = JSON.parse(readFileSync(resolve(site, 'ru.json'), 'utf8'));
  const en = JSON.parse(readFileSync(resolve(site, 'en.json'), 'utf8'));
  assert.equal(ru['footer.patternsUrl'], RU);
  assert.equal(en['footer.patternsUrl'], EN);
  const astro = readFileSync(resolve(ROOT, 'site', 'src', 'components', 'Footer.astro'), 'utf8');
  assert.match(astro, /href: t\(locale, 'footer\.patternsUrl'\)/, 'Footer.astro still hardcodes the href');
});

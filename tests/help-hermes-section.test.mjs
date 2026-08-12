/**
 * §30 "Hermes & Telegram" help-section canary (v1.147.0, Phase 5b part 2).
 *
 * The H2/H3 COUNT gates (canonical-docs-coverage, help-ui, help-ru-config-section)
 * prove every bundle has 30 H2 / 108 H3 — but not that the *new* section is the
 * Hermes one (a locale could hit 30 by duplicating another heading). This canary
 * pins the actual §30 in every locale by slicing the section out and asserting its
 * language-independent anchors *within that slice* (so a token that also appears
 * elsewhere in the bundle can't vacuously satisfy it).
 *
 * CI-isolated: reads only docs/help/*.md, no parent dependency, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HELP = resolve(ROOT, 'docs', 'help');
const LOCALES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];
const read = (lang) => readFileSync(resolve(HELP, `${lang}.md`), 'utf8');

/** The Hermes §30 slice: from its H2 up to the next `^## ` heading (or EOF). */
function hermesSection(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^## .*Hermes/.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

test('every help locale carries the §30 "Hermes & Telegram" section with its anchors', () => {
  for (const lang of LOCALES) {
    const text = read(lang);
    // Exactly one H2 heading naming Hermes (the word is untranslated across locales).
    const hermesH2 = (text.match(/^## .*Hermes.*$/gm) || []);
    assert.equal(hermesH2.length, 1, `${lang}.md: expected exactly one Hermes H2, got ${hermesH2.length}`);
    assert.match(hermesH2[0], /30\./, `${lang}.md: the Hermes H2 is numbered §30`);
    // Language-independent tokens that must appear INSIDE the §30 slice (not just
    // somewhere in the bundle — 127.0.0.1 e.g. also appears in earlier sections).
    const section = hermesSection(text);
    assert.ok(section, `${lang}.md: could not slice the Hermes section`);
    for (const tok of ['Telegram', 'docs/integrations/HERMES.md', 'hermes-bridge', '127.0.0.1', '#/help']) {
      assert.ok(section.includes(tok), `${lang}.md: §30 body must mention ${tok}`);
    }
  }
});

test('the EN §30 has exactly three H3 subsections (what/cloud/telegram)', () => {
  const section = hermesSection(read('en'));
  const h3 = (section.match(/^### /gm) || []).length;
  assert.equal(h3, 3, `EN §30 should have 3 H3s, got ${h3}`);
});

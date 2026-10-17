/**
 * FIX-PROMPT v1.252.1 §2 — the locale directive must settle the language
 * priority explicitly: the UI locale overrides the profile's
 * `language.output` (parent rule 6, modes/oferta.md) and the job posting's
 * language. The v1.252.0 remote-qa regression showed models resolving the
 * two conflicting instructions (parent mode: "write in language.output";
 * our directive: "respond in <locale>") inconsistently per locale.
 *
 * The test pins the DIRECTIVE TEXT (the only thing we control) — never a
 * model response.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocaleDirective } from '../server/lib/prompts.mjs';

test('non-EN directive names the locale AND the override over language.output and the JD language', () => {
  const d = buildLocaleDirective('ru');
  assert.match(d, /Respond in Russian \(locale: ru\)\./);
  assert.match(d, /This UI locale overrides the profile's language\.output setting and the job posting's own language\./);
  assert.match(d, /Keep code and identifiers in English/);
});

test('the override sentence is present for every non-EN locale the directive knows', () => {
  const locales = ['es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta'];
  for (const l of locales) {
    const d = buildLocaleDirective(l);
    assert.ok(d.includes("overrides the profile's language.output setting and the job posting's own language"), `${l}: override sentence missing`);
  }
});

test('EN stays empty — no directive, no override sentence', () => {
  assert.equal(buildLocaleDirective('en'), '');
  assert.equal(buildLocaleDirective(''), '');
  assert.equal(buildLocaleDirective(undefined), '');
  assert.equal(buildLocaleDirective('constructor'), ''); // own-key only
});

test('the directive stays a single # Output language block (prompt-shape contract)', () => {
  const d = buildLocaleDirective('de');
  assert.ok(d.startsWith('# Output language\n'), 'header line first');
  assert.equal(d.split('\n').filter((l) => l.startsWith('#')).length, 1, 'exactly one heading');
});

/**
 * v1.13.0 — locale-aware scaffolding in prompt builders. The parent's
 * `modes/<slug>.md` body stays English (read-only per CLAUDE.md hard
 * rule #1), but the surrounding career-ops-ui scaffolding (the
 * "Read these files first" line, the "User-supplied context" label,
 * the role line) IS localized by SCAFFOLD_STRINGS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModePrompt,
  buildEvaluationPrompt,
  scaffold,
} from '../server/lib/prompts.mjs';

test('scaffold(): returns en text when locale unknown', () => {
  assert.match(scaffold('readFiles', 'klingon'), /Read these files/);
});

test('scaffold(): readFiles in ru', () => {
  assert.match(scaffold('readFiles', 'ru'), /прочти/);
});

test('scaffold(): userContext in ja', () => {
  assert.match(scaffold('userContext', 'ja'), /ユーザー/);
});

test('buildModePrompt: ru output uses localized role + readFiles + userContext lines', () => {
  const p = buildModePrompt('TEMPLATE BODY', 'project', { company: 'Acme' }, 'ru');
  assert.match(p, /Respond in Russian/);          // locale directive
  assert.match(p, /career-ops в режиме project/); // localized role line
  assert.match(p, /прочти эти файлы/);             // localized readFiles
  assert.match(p, /Контекст от пользователя/);     // localized userContext
  assert.match(p, /TEMPLATE BODY/);                // English body preserved verbatim
});

test('buildModePrompt: en is unchanged shape (back-compat with v1.10.x tests)', () => {
  const p = buildModePrompt('TEMPLATE BODY', 'project', {}, 'en');
  assert.match(p, /You are career-ops in project mode/);
  assert.match(p, /Read these files first/);
  assert.match(p, /User-supplied context/);
});

test('buildEvaluationPrompt: ko output uses localized role + readFiles', () => {
  const p = buildEvaluationPrompt('Senior backend role with Go + PostgreSQL …', 'ko');
  assert.match(p, /Respond in Korean/);
  assert.match(p, /당신은 career-ops/);
  assert.match(p, /파일들을 읽으세요/);
});

// Regression: fr was silently absent from LOCALE_NAMES/SCAFFOLD_STRINGS until
// v1.70.0; pl/uk/ar were added with the 12-locale expansion. Lock the locale
// directive + localized scaffolding for all four so the prompt-locale path
// can't regress to English again.
const LOCALE_DIRECTIVE = {
  fr: /Respond in French \(locale: fr\)/,
  pl: /Respond in Polish \(locale: pl\)/,
  uk: /Respond in Ukrainian \(locale: uk\)/,
  ar: /Respond in Arabic \(locale: ar\)/,
};
const ROLE_MARKER = {
  fr: /career-ops en mode project/,
  pl: /career-ops w trybie project/,
  uk: /career-ops у режимі project/,
  ar: /career-ops في وضع project/,
};
for (const lang of ['fr', 'pl', 'uk', 'ar']) {
  test(`buildModePrompt: ${lang} gets a locale directive + localized role line`, () => {
    const p = buildModePrompt('TEMPLATE BODY', 'project', { company: 'Acme' }, lang);
    assert.match(p, LOCALE_DIRECTIVE[lang], `${lang} must emit its locale directive`);
    assert.match(p, ROLE_MARKER[lang], `${lang} must use its localized role line`);
    assert.match(p, /TEMPLATE BODY/, 'English mode body preserved verbatim');
  });
}

test('scaffold: fr/pl/uk/ar readFiles are localized (not the English fallback)', () => {
  assert.match(scaffold('readFiles', 'fr'), /Lisez/);
  assert.match(scaffold('readFiles', 'pl'), /przeczytaj/);
  assert.match(scaffold('readFiles', 'uk'), /прочитай/);
  assert.match(scaffold('readFiles', 'ar'), /اقرأ/);
});

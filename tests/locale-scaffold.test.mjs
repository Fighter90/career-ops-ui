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
import { I18N_LANGS } from './helpers/i18n-vm.mjs';

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
// v1.70.0; pl/uk/ar were added with the 12-locale expansion; da and hi were
// missed entirely until v1.125.3 (user-reported: Danish/Hindi deep-research
// prompts answered in English). Lock the locale directive + localized
// scaffolding for all six so the prompt-locale path can't regress to English.
const LOCALE_DIRECTIVE = {
  fr: /Respond in French \(locale: fr\)/,
  pl: /Respond in Polish \(locale: pl\)/,
  uk: /Respond in Ukrainian \(locale: uk\)/,
  ar: /Respond in Arabic \(locale: ar\)/,
  da: /Respond in Danish \(locale: da\)/,
  hi: /Respond in Hindi \(locale: hi\)/,
};
const ROLE_MARKER = {
  fr: /career-ops en mode project/,
  pl: /career-ops w trybie project/,
  uk: /career-ops у режимі project/,
  ar: /career-ops في وضع project/,
  da: /career-ops i project-tilstand/,
  hi: /project मोड में career-ops/,
};
for (const lang of ['fr', 'pl', 'uk', 'ar', 'da', 'hi']) {
  test(`buildModePrompt: ${lang} gets a locale directive + localized role line`, () => {
    const p = buildModePrompt('TEMPLATE BODY', 'project', { company: 'Acme' }, lang);
    assert.match(p, LOCALE_DIRECTIVE[lang], `${lang} must emit its locale directive`);
    assert.match(p, ROLE_MARKER[lang], `${lang} must use its localized role line`);
    assert.match(p, /TEMPLATE BODY/, 'English mode body preserved verbatim');
  });
}

// Single-shot output contract (v1.72.0) — every mode "Run live" must do its
// analysis silently and emit ONLY the final artifact, in EVERY locale. The
// contract/reminder are English meta-instructions; the artifact itself is
// produced in the UI locale via the locale directive.
// v1.125.3 — sweep the canonical SPA locale list instead of a hardcoded 12:
// a locale added to the i18n bundle but missed in prompts.mjs (the da/hi bug)
// now fails the `# Output language` assertion here.
for (const lang of I18N_LANGS) {
  test(`buildModePrompt: single-shot contract + cover artifact + locale directive (${lang})`, () => {
    const p = buildModePrompt('TEMPLATE BODY', 'cover', { company: 'Acme' }, lang);
    assert.match(p, /# Output contract — single-shot, non-interactive/, `${lang}: contract block`);
    assert.match(p, /Do NOT ask the user any questions/, `${lang}: no-questions rule`);
    assert.match(p, /output ONLY the cover letter\. Begin now\./, `${lang}: artifact reminder`);
    assert.match(p, /TEMPLATE BODY/, `${lang}: mode body preserved`);
    // en emits no locale directive (it's the default); every other locale must.
    if (lang === 'en') assert.doesNotMatch(p, /# Output language/, 'en: no locale directive');
    else assert.match(p, /# Output language/, `${lang}: locale directive present`);
  });
}

test('buildModePrompt: artifact reminder is per-mode (contacto / project / training)', () => {
  assert.match(buildModePrompt('X', 'contacto', {}, 'en'), /output ONLY the outreach message/);
  assert.match(buildModePrompt('X', 'project', {}, 'en'), /output ONLY the project evaluation/);
  assert.match(buildModePrompt('X', 'training', {}, 'en'), /output ONLY the course\/certification evaluation/);
});

test('scaffold: fr/pl/uk/ar/da/hi readFiles are localized (not the English fallback)', () => {
  assert.match(scaffold('readFiles', 'fr'), /Lisez/);
  assert.match(scaffold('readFiles', 'pl'), /przeczytaj/);
  assert.match(scaffold('readFiles', 'uk'), /прочитай/);
  assert.match(scaffold('readFiles', 'ar'), /اقرأ/);
  assert.match(scaffold('readFiles', 'da'), /Læs/);
  assert.match(scaffold('readFiles', 'hi'), /फ़ाइलें/);
});

// Structural parity gate (v1.125.3): every non-EN SPA locale must have its own
// translation for every scaffold key — an English fallback means the locale
// was skipped in one of the SCAFFOLD_STRINGS bags.
const SCAFFOLD_KEYS = ['readFiles', 'userContext', 'modeTemplate', 'modeRoleLine', 'evalRoleLine'];
for (const key of SCAFFOLD_KEYS) {
  test(`scaffold('${key}'): translated in every non-EN locale`, () => {
    for (const lang of I18N_LANGS.filter((l) => l !== 'en')) {
      assert.notEqual(scaffold(key, lang), scaffold(key, 'en'),
        `${key}.${lang} must not fall back to English`);
    }
  });
}

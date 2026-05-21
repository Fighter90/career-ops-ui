/**
 * v1.55.2 — F-V55-H / UX-5: the `#/cv` primary editor must carry a
 * non-empty, descriptive accessible name in every locale.
 *
 * History: v1.47.0 (WS2 #16) first gave the textarea an accessible
 * name via aria-labelledby → the visible "Markdown" <h3>. The
 * 2026-05-18 audit's F-V55-H symptom only inspected `aria-label`
 * (null) and `labels` (0) — it did not check `aria-labelledby`, so
 * the field was never actually nameless. v1.55.2 still upgrades the
 * terse "Markdown" name to a self-contained `aria-label` via
 * `cv.editorAria` so a screen-reader user hears what the field is.
 *
 * cv.js is browser-only → asserted statically (router.test.mjs /
 * auto-stepper-prerender.test.mjs style); the locale contract is
 * re-derived from i18n-dict.js so it stays locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const CV = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'cv.js'), 'utf8');
const DICT = legacyDictText();

const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW'];

test('#cv-editor textarea carries an aria-label via cv.editorAria', () => {
  const block = CV.match(/const ta = c\('textarea', \{[\s\S]*?\}, data\.markdown[^)]*\);/);
  assert.ok(block, 'cv-editor textarea creation not found');
  assert.match(block[0], /id: 'cv-editor'/);
  assert.match(block[0], /'aria-label':\s*t\('cv\.editorAria'/,
    'cv-editor must name itself via t(cv.editorAria)');
  // The fallback string passed to t() must be non-empty too.
  const fb = block[0].match(/t\('cv\.editorAria',\s*'([^']+)'\)/);
  assert.ok(fb && fb[1].trim().length > 0, 'cv.editorAria fallback must be non-empty');
});

test('cv.editorAria present + non-empty in all 8 locales', () => {
  const line = DICT.split('\n').find((l) => l.includes("'cv.editorAria'"));
  assert.ok(line, 'i18n key cv.editorAria missing from i18n-dict.js');
  for (const loc of LOCALES) {
    const key = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
    const m = line.match(new RegExp(`${key.replace(/[-]/g, '\\$&')}\\s*'([^']*)'`));
    assert.ok(m, `cv.editorAria missing locale ${loc}`);
    assert.ok(m[1].trim().length > 0, `cv.editorAria empty for locale ${loc}`);
  }
});

test('cv-editor no longer relies on the terse aria-labelledby name', () => {
  // The descriptive aria-label supersedes the old heading binding;
  // a leftover aria-labelledby on the same element would be dead
  // markup (aria-label wins per ARIA) and is removed for clarity.
  const block = CV.match(/const ta = c\('textarea', \{[\s\S]*?\}, data\.markdown[^)]*\);/);
  assert.ok(block, 'cv-editor textarea creation not found');
  assert.ok(!/'aria-labelledby'/.test(block[0]),
    'cv-editor should not keep a redundant aria-labelledby alongside aria-label');
});

// L262-R7 — the CSV-import picker read the ENTIRE file (`await file.text()`)
// before any size check; the server's 512 KB cap answered 413 only after the
// browser had already parsed a possibly huge file into memory. Contract:
// a client-side `file.size` guard runs BEFORE the read, mirrors the server's
// 512 KB cap, and its toast is a localized key in all 19 locales.
//
// Source-static (the lib is a browser classic script — no module import),
// plus the per-locale dictionary check through the real vm loader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const src = readFileSync(
  fileURLToPath(new URL('../public/js/lib/tracker-import.js', import.meta.url)),
  'utf8',
);

test('file.size is guarded before file.text()', () => {
  const readPos = src.indexOf('file.text()');
  assert.ok(readPos > -1, 'the picker still reads the file as text');
  const before = src.slice(0, readPos);
  assert.match(before, /file\.size/, 'a size guard must run before the read');
  assert.match(before, /512\s*\*\s*1024/, 'the guard mirrors the server 512KB cap');
  assert.match(before, /import\.tooLarge/, 'the rejection toasts the localized import.tooLarge key');
});

test('import.tooLarge exists in all 19 locales', () => {
  const dict = loadAssembledDict();
  const row = dict['import.tooLarge'];
  assert.ok(row, 'import.tooLarge is in the assembled dictionary');
  for (const lang of I18N_LANGS) {
    assert.ok(typeof row[lang] === 'string' && row[lang].length > 0, `import.tooLarge missing for ${lang}`);
  }
});

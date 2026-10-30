/**
 * v1.243.0 hand-off — hints tail.
 *
 * The server-side CV importer (server/lib/cv-import.mjs) has NEVER accepted
 * `.doc` (pandoc has no reader for the legacy binary Word format — it could
 * only ever 422), yet the upload UI advertised it:
 *   - the file input's accept list included `.doc`;
 *   - `cv.uploadHint` ×19 and the hard-coded English fallback named `.doc`;
 *   - help §"Upload an existing CV" / §"Office formats" ×19 listed `.doc`.
 *
 * Likewise `config.openaiModelHint` ×19 still advertised `gpt-5-codex` as the
 * default, but web-ui's OpenAI client speaks Chat Completions and maps any
 * `*-codex` model id to `gpt-5` (server/lib/openai.mjs::chatCompletionsModel)
 * — the effective default it sends is `gpt-5`, never `gpt-5-codex`.
 *
 * These gates pin the corrected surfaces. Static-source style (the view and
 * the help bundles are browser-only); dicts via the assembled i18n snapshot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

/** A bare `.doc` token (`.docx` does not match — the next char is `x`). */
const BARE_DOC = /\.doc(?![a-z0-9])/;

test('cv.js accept list does not offer .doc (pandoc cannot read it)', () => {
  const src = read('public', 'js', 'views', 'cv.js');
  const accept = src.match(/accept: '([^']+)'/)?.[1];
  assert.ok(accept, 'file-input accept attribute not found');
  const exts = accept.split(',').map((s) => s.trim());
  assert.ok(
    !exts.includes('.doc'),
    `accept list still offers .doc: ${accept}`,
  );
  // .docx must stay — it is the supported Word format.
  assert.ok(exts.includes('.docx'), 'accept list lost .docx');
});

test('cv.js uploadHint fallback does not advertise .doc', () => {
  const src = read('public', 'js', 'views', 'cv.js');
  const m = src.match(/t\('cv\.uploadHint',\s*\n?\s*'([^']+)'/);
  assert.ok(m, 'cv.uploadHint fallback string not found');
  assert.ok(!BARE_DOC.test(m[1]), `fallback hint still names .doc: ${m[1]}`);
});

test('cv.uploadHint ×19 drops .doc and keeps .docx', () => {
  const dict = JSON.parse(JSON.stringify(loadAssembledDict()));
  assert.ok(dict['cv.uploadHint'], 'cv.uploadHint missing from the dict');
  for (const lang of I18N_LANGS) {
    const value = dict['cv.uploadHint'][lang];
    assert.ok(value, `cv.uploadHint missing locale ${lang}`);
    assert.ok(!BARE_DOC.test(value), `cv.uploadHint[${lang}] still names .doc: ${value}`);
    assert.ok(/\.docx/.test(value), `cv.uploadHint[${lang}] lost .docx: ${value}`);
  }
});

test('config.openaiModelHint ×19 names gpt-5, not gpt-5-codex, as the sent default', () => {
  const dict = JSON.parse(JSON.stringify(loadAssembledDict()));
  assert.ok(dict['config.openaiModelHint'], 'config.openaiModelHint missing from the dict');
  for (const lang of I18N_LANGS) {
    const value = dict['config.openaiModelHint'][lang];
    assert.ok(value, `config.openaiModelHint missing locale ${lang}`);
    assert.ok(
      !value.includes('gpt-5-codex'),
      `config.openaiModelHint[${lang}] still advertises gpt-5-codex: ${value}`,
    );
    assert.ok(value.includes('gpt-5'), `config.openaiModelHint[${lang}] lost gpt-5: ${value}`);
  }
});

test('help ×19 upload/office-format lists do not list bare .doc', () => {
  for (const lang of I18N_LANGS) {
    const src = read('docs', 'help', `${lang === 'ko' ? 'ko-KR' : lang}.md`);
    const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => BARE_DOC.test(l));
    assert.deepEqual(
      hits.map(([n]) => n),
      [],
      `docs/help/${lang}.md still names .doc on lines ${hits.map(([n]) => n).join(', ')}`,
    );
  }
});

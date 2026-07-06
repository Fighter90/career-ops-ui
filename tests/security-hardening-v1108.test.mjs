/**
 * Security hardening (v1.108.0) — CodeQL triage round 2.
 *   - type-confusion: importDocumentToMarkdown coerces an array filename.
 *   - unvalidated-dynamic-method-call + polynomial-redos: source-pattern guards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { importDocumentToMarkdown } from '../server/lib/cv-import.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

test('importDocumentToMarkdown coerces an ARRAY filename (repeated header) to a string', async () => {
  // A repeated X-Filename header arrives as ['cv.md', 'x']; the ext logic must
  // not throw on a non-string, and should use the first element.
  const r = await importDocumentToMarkdown(Buffer.from('# Hi\n', 'utf8'), ['cv.md', 'x']);
  assert.equal(r.ok, true);
  assert.equal(r.sourceFormat, 'md');
  assert.match(r.markdown, /# Hi/);
  // A fully non-string (object) must also be handled, not crash.
  const r2 = await importDocumentToMarkdown(Buffer.from('hello', 'utf8'), { nope: 1 });
  assert.equal(typeof r2.ok, 'boolean');
});

test('prompts.mjs resolves the locale role-line by OWN key + string typeof (no dynamic call)', () => {
  const src = read('server', 'lib', 'prompts.mjs');
  assert.match(src, /Object\.prototype\.hasOwnProperty\.call\(SCAFFOLD_STRINGS\.modeRoleLine, lang\)/);
  // v1.111.0: role lines are now template STRINGS interpolated with String.replace,
  // so the resolved value is a string and the call site invokes no dynamic function.
  assert.match(src, /typeof SCAFFOLD_STRINGS\.modeRoleLine\[lang\] === 'string'/);
  assert.doesNotMatch(src, /roleLineFn/);
});

test('runners.mjs caps the slug length BEFORE the dash-trim regex (ReDoS guard)', () => {
  const src = read('server', 'lib', 'routes', 'runners.mjs');
  assert.match(src, /String\(slug \|\| 'doc'\)\.slice\(0, 200\)\.replace/);
});

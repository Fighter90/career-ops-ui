/**
 * v1.47.0 (WS2 UX-audit #7/#30/#31/#16) — every form control on the
 * swept screens has a programmatic accessible name: explicit
 * label[htmlFor] ↔ control[id], or aria-labelledby to a visible
 * heading. Views are browser-only → asserted statically + the binding
 * integrity is checked (every htmlFor has a matching id in the file).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const read = (f) => readFileSync(R('public', 'js', 'views', f), 'utf8');

test('#7 scan: dry-run + company-select labels are bound', () => {
  const s = read('scan.js');
  assert.match(s, /c\('label',\s*\{ htmlFor: 'company-select' \}/);
  assert.match(s, /c\('label',\s*\{ className: 'flex', htmlFor: 'dry-run'/);
  assert.match(s, /id: 'dry-run'/);
  assert.match(s, /id: 'company-select'/);
});

test('#30 deep: company + role inputs bound to their labels', () => {
  const s = read('deep.js');
  assert.match(s, /id: 'deep-company'/);
  assert.match(s, /id: 'deep-role'/);
  assert.match(s, /c\('label',\s*\{ htmlFor: 'deep-company' \}/);
  assert.match(s, /c\('label',\s*\{ htmlFor: 'deep-role' \}/);
});

test('#31 apply: url + jd bound to their labels', () => {
  const s = read('apply.js');
  assert.match(s, /id: 'apply-url'/);
  assert.match(s, /id: 'apply-jd'/);
  assert.match(s, /c\('label',\s*\{ htmlFor: 'apply-url' \}/);
  assert.match(s, /c\('label',\s*\{ htmlFor: 'apply-jd' \}/);
});

test('#16 cv: editor textarea named via descriptive aria-label (v1.55.2 F-V55-H)', () => {
  const s = read('cv.js');
  // v1.55.2 supersedes the v1.47.0 aria-labelledby → "Markdown"
  // binding with a self-contained descriptive aria-label so a
  // screen-reader user hears what the field is, not just "Markdown".
  assert.match(s, /id: 'cv-editor'/);
  assert.match(s, /'aria-label':\s*t\('cv\.editorAria'/);
  assert.ok(!/'aria-labelledby': 'cv-md-heading'/.test(s),
    'redundant aria-labelledby must be gone (aria-label wins per ARIA)');
  // The visible heading stays on screen for sighted users.
  assert.match(s, /c\('h3',\s*\{ className: 'section-title', id: 'cv-md-heading' \}/);
});

test('binding integrity: every new htmlFor/aria-labelledby has a matching id in-file', () => {
  const pairs = [
    ['scan.js', ['company-select', 'dry-run']],
    ['deep.js', ['deep-company', 'deep-role']],
    ['apply.js', ['apply-url', 'apply-jd']],
    ['cv.js', ['cv-editor', 'cv-md-heading']],
  ];
  for (const [file, ids] of pairs) {
    const s = read(file);
    for (const id of ids) {
      assert.ok(new RegExp(`id: '${id}'`).test(s), `${file}: missing id '${id}'`);
    }
  }
});

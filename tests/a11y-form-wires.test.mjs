/**
 * v1.20.1 (H-1, H-2) — a11y form-wire validity.
 *
 * Static analysis of every view file: confirms every `aria-describedby`
 * IDREF resolves to a sibling `id: '…'` declaration, and every
 * `htmlFor: '…'` resolves to an `id: '…'` declaration. v1.20.0 shipped
 * an `aria-describedby="batch-tsv-hint"` that pointed at nothing —
 * screen readers had no description to voice. Catching this class of
 * defect at CI time prevents repeat regressions.
 *
 * Why static analysis and not JSDOM? The view files mount on Router
 * registration; standing up a full DOM tree per view would require
 * the entire SPA boot path (i18n, API, router, UI helpers). The
 * defect we're chasing is purely string-level: a typo in an attribute
 * value. Grepping the same source the browser loads catches it as
 * cleanly as a live DOM check.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS_DIR = resolve(__dirname, '..', 'public', 'js', 'views');

function* walkJs(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walkJs(p);
    else if (extname(p) === '.js') yield p;
  }
}

/**
 * For a view file, extract:
 *   - declared ids: every `id: 'foo'` (or `id: "foo"`) literal
 *   - referenced ids:
 *       aria-describedby: 'foo' / "foo"
 *       'aria-describedby': 'foo' / "foo"
 *       htmlFor: 'foo' / "foo"
 *
 * We do NOT try to resolve dynamic expressions (template literals,
 * variable references) — the linter catches the literal-string class
 * which is by far the common bug shape.
 */
function extractIdMap(src) {
  const declared = new Set();
  const referenced = []; // { id, attr }
  const idRx = /\bid:\s*(['"])([a-zA-Z0-9_.\-]+)\1/g;
  for (const m of src.matchAll(idRx)) declared.add(m[2]);
  const ariaRx = /['"]?aria-describedby['"]?\s*:\s*(['"])([a-zA-Z0-9_.\-\s]+)\1/g;
  for (const m of src.matchAll(ariaRx)) {
    // aria-describedby may carry space-separated IDREFs — split each.
    for (const id of m[2].split(/\s+/).filter(Boolean)) {
      referenced.push({ id, attr: 'aria-describedby' });
    }
  }
  const htmlForRx = /\bhtmlFor:\s*(['"])([a-zA-Z0-9_.\-]+)\1/g;
  for (const m of src.matchAll(htmlForRx)) {
    referenced.push({ id: m[2], attr: 'htmlFor' });
  }
  return { declared, referenced };
}

test('a11y: every aria-describedby + htmlFor IDREF resolves within its view file', () => {
  const dangling = [];
  for (const file of walkJs(VIEWS_DIR)) {
    const src = readFileSync(file, 'utf8');
    const { declared, referenced } = extractIdMap(src);
    for (const ref of referenced) {
      if (!declared.has(ref.id)) {
        dangling.push(`${file.replace(VIEWS_DIR + '/', '')}: ${ref.attr}="${ref.id}" has no matching id:`);
      }
    }
  }
  if (dangling.length) {
    console.error('Dangling IDREFs:\n  ' + dangling.join('\n  '));
  }
  assert.deepStrictEqual(dangling, [],
    `${dangling.length} aria-describedby / htmlFor wires point at non-existent ids`);
});

test('a11y: at least 5 a11y-wired views found (sanity)', () => {
  // Floor check so a future refactor that mass-deletes a11y attrs
  // doesn't silently let this test "pass" by finding zero wires.
  let wired = 0;
  for (const file of walkJs(VIEWS_DIR)) {
    const src = readFileSync(file, 'utf8');
    if (/aria-describedby|\bhtmlFor:/.test(src)) wired += 1;
  }
  assert.ok(wired >= 5, `expected ≥5 views with a11y wires, found ${wired}`);
});

// ─── SPA-M4 — placeholder-only inputs gained accessible names ───
// A placeholder is not a reliable accessible name once the field has
// content. These four sites were placeholder-only; each now mirrors its
// localized placeholder into aria-label (no new i18n keys).
test('memory / networking / career-plan / two-pager inputs carry aria-labels (SPA-M4)', () => {
  const cases = [
    ['memory.js', /'data-i18n-aria-label': 'mem\.title'/],
    ['networking.js', /companyInput\.setAttribute\('aria-label'/],
    ['networking.js', /roleInput\.setAttribute\('aria-label'/],
    ['networking.js', /jdInput\.setAttribute\('aria-label'/],
    ['career-plan.js', /focus\.setAttribute\('aria-label'/],
    ['two-pager.js', /'data-i18n-aria-label': 'twoPager\.addTagPh'/],
  ];
  for (const [file, re] of cases) {
    const src = readFileSync(resolve(__dirname, '..', 'public', 'js', 'views', file), 'utf8');
    assert.match(src, re, `${file} missing ${re}`);
  }
});

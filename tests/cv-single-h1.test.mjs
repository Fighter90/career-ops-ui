/**
 * v1.54.1 (F-V54-A) — the CV markdown's own `# Name` rendered as a
 * SECOND top-level <h1> beside the page-title <h1>CV</h1> (WCAG 1.3.1
 * Info & Relationships / 2.4.6 Headings). cv.js now feeds the preview
 * through a `cvMd()` heading-shift (h1→h2 … h6→role=heading level 7)
 * at every injection point, scoped to cv.js (UI.md is shared by
 * help/reports/deep/evaluate which manage headings their own way).
 *
 * cv.js is browser-only → wiring asserted statically (router.test.mjs
 * style); the shift transform itself is sliced out of cv.js and run in a
 * `vm` context (with `UI.md` stubbed to identity) so the test exercises
 * the production expression, not a hand-maintained copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __d = dirname(fileURLToPath(import.meta.url));
const CV = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'cv.js'), 'utf8');

test('cv.js defines cvMd() with the full h1→…→h6 shift chain', () => {
  assert.ok(CV.includes("const cvMd = (src) => UI.md(src || '')"));
  assert.ok(CV.includes(`<div role="heading" aria-level="7"$1>`), 'h6→aria-level=7 div');
  for (const [a, b] of [[5, 6], [4, 5], [3, 4], [2, 3], [1, 2]]) {
    assert.ok(CV.includes(`'<h${b}')`), `missing open h${a}→h${b}`);
    assert.ok(CV.includes(`'</h${b}>')`), `missing close h${a}→h${b}`);
  }
});

test('every CV-preview injection point uses cvMd, never raw UI.md', () => {
  // The 3 preview writes: initial render (#cv-preview html:), the
  // import onChange (#cv-preview innerHTML), the live editor sync.
  const previewLines = CV.split('\n').filter((l) =>
    /cv-preview|p\.innerHTML =/.test(l) && /Md\(|UI\.md\(/.test(l));
  assert.ok(previewLines.length >= 3, `expected ≥3 preview writes, got ${previewLines.length}`);
  for (const l of previewLines) {
    assert.ok(/cvMd\(/.test(l) && !/\bUI\.md\(/.test(l),
      `preview write must use cvMd, not UI.md: ${l.trim()}`);
  }
  // the only UI.md( in the file is inside the cvMd definition itself
  const rawUiMd = (CV.match(/\bUI\.md\(/g) || []).length;
  assert.equal(rawUiMd, 1, 'UI.md must appear exactly once (inside cvMd)');
});

test('page-title <h1> is still the single top-level heading source', () => {
  // v1.58.21 (U-1) — supersedes v1.56.0 UX-9: the breadcrumb chip is gone,
  // the H1 is back to the standard `.page-title` style with a visible
  // `.page-subtitle` paragraph like every other page. F-V54-A invariant
  // unchanged: still exactly ONE <h1>, still the page title.
  assert.match(CV, /c\('h1',\s*\{\s*className:\s*'page-title'\s*\},\s*t\('cv\.title'\)\)/);
  assert.equal((CV.match(/c\('h1'/g) || []).length, 1, 'cv.js builds exactly one <h1>');
});

// Slice `const cvMd = (src) => UI.md(src || '')…;` out of cv.js and
// evaluate it with UI.md = identity, so the replace chain under test is
// byte-for-byte the shipped one.
function loadCvMd() {
  const start = CV.indexOf('const cvMd = (src) =>');
  assert.ok(start >= 0, 'cv.js must define cvMd');
  const end = CV.indexOf(';\n', start);
  assert.ok(end > start, 'cvMd definition must end with a semicolon');
  const ctx = vm.createContext({ UI: { md: (src) => src } });
  return vm.runInContext(`${CV.slice(start, end + 1)}\ncvMd;`, ctx);
}

test('cvMd transform (production source) maps every heading level down by one', () => {
  // A CV body `# Alex Doe` becomes <h2>, never a second <h1>.
  const cvMd = loadCvMd();
  const out = cvMd('<h1>Alex Doe</h1><h2>Summary</h2><h3>A</h3><h4>B</h4><h5>C</h5><h6 id="f">Foot</h6>');
  assert.ok(!/<h1[ >]/.test(out), 'no <h1> may remain in CV preview output');
  assert.equal(out,
    '<h2>Alex Doe</h2><h3>Summary</h3><h4>A</h4><h5>B</h5><h6>C</h6>'
    + '<div role="heading" aria-level="7" id="f">Foot</div>');
  assert.equal(cvMd(undefined), '', 'empty source renders as empty string');
});

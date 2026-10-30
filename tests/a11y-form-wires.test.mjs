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

// ─── CAR-209 (a11y wave 2) — every input/textarea carries a programmatic name ───
// A control without an accessible name is announced as just "edit text" /
// "checkbox" — unusable with a screen reader. Static contract: every literal
// `c('input'…)` / `c('textarea'…)` in views/ + lib/ must either
//   (a) carry `aria-label` / `data-i18n-aria-label` / `htmlFor` in its options,
//   (b) sit inside a `c('label'…)` span (inline or via its variable), or
//   (c) pair with a literal `htmlFor: 'X'` elsewhere in the same file,
// or appear in the reviewed ALLOWLIST below (each entry states WHY it is
// named at runtime in a way static analysis cannot see). Readonly dumps are
// exempt when their file names them via `A11yDump.label` (grep per file).
// Regex-based by design (same discipline as the IDREF test above): when the
// source shape changes, an allowlist entry stops matching and this test
// flags the site for re-triage instead of silently passing it.

function balancedCall(src, openIdx) {
  let depth = 0, quote = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === quote && src[i - 1] !== '\\') quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function objectSpan(text, start) { // text[start] === '{' → index of the matching '}'
  let depth = 0, quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

const CONTROLS_ALLOWLIST = [
  // Hidden file inputs driven by a visible button — never focused directly.
  { file: 'views/cv.js', re: /type: 'file'[\s\S]{0,200}display: 'none'/, reason: 'hidden file input clicked from the visible Upload CV button' },
  { file: 'lib/tracker-import.js', re: /type: 'file'[\s\S]{0,200}aria-hidden/, reason: 'hidden CSV file input opened from the visible Import button' },
  // Checkboxes wrapped in labels at runtime through the check() helper.
  { file: 'views/map.js', re: /type: 'checkbox', checked: mapPrefs\.showUnevaluated/, reason: 'wrapped via check() → c(label) in the map filter legend' },
  { file: 'views/map.js', re: /type: 'checkbox', checked: commutePrefs\.showUnknown/, reason: 'wrapped via check() → c(label) in the map filter legend' },
  { file: 'views/map.js', re: /type: 'checkbox', checked: mapPrefs\.layers\[layer\] !== false/, reason: 'wrapped via check() → c(label) in the map layer toggles' },
  // Checkboxes painted into c('label') by the filter-bar factory in scan/filters.js.
  { file: 'views/scan.js', re: /type: 'checkbox', id: 'scan-filter-salary-any'/, reason: 'wrapped in c(label) inside the scan/filters.js filter bar' },
  { file: 'views/scan.js', re: /type: 'checkbox', id: 'fav-only'/, reason: 'wrapped in c(label) inside the scan/filters.js filter bar' },
  // Dynamic-id label pairings (label[for] built with the same variable/id
  // expression at runtime — the literal regex cannot pair them).
  { file: 'views/assessments.js', re: /id,\s*\n?\s*'data-i18n-placeholder': phKey/, reason: 'labeled() helper pairs a dynamic id with c(label, htmlFor: id)' },
  { file: 'views/config.js', re: /id: inputId,\s*\n?\s*'aria-describedby': hintId/, reason: 'provider field pairs its dynamic inputId with c(label, htmlFor: inputId)' },
  { file: 'views/config.js', re: /\{ id, className: 'textarea', rows: 3 \}/, reason: 'structured profile field pairs its id with c(label, htmlFor: id)' },
  { file: 'views/config.js', re: /\{ id, className: 'input', type: f\.type \|\| 'text' \}/, reason: 'structured profile field pairs its id with c(label, htmlFor: id)' },
  { file: 'lib/modes-form.js', re: /rows: 6,\s*'aria-describedby': fieldId \+ '-desc',\s*style: \{ width: '100%', fontSize: '13px' \}/, reason: 'modes prose field pairs fieldId with c(label, htmlFor: fieldId)' },
  { file: 'lib/modes-form.js', re: /rows: 8,\s*'aria-describedby': fieldId \+ '-desc'/, reason: 'modes verbatim-list field pairs fieldId with c(label, htmlFor: fieldId)' },
  { file: 'lib/modes-form.js', re: /rows: 6,\s*style: \{ width: '100%', fontFamily: 'ui-monospace,monospace'/, reason: 'non-canonical modes field pairs fieldId with c(label, htmlFor: fieldId)' },
  // Reports toolbar inputs named through hiddenLabel() visually-hidden labels.
  { file: 'views/reports.js', re: /type: 'search',\s*\n?\s*id: 'reports-search',/, reason: 'named via hiddenLabel(reports-search) visually-hidden label' },
  { file: 'views/reports.js', re: /type: 'text',\s*\n?\s*id: 'reports-company',/, reason: 'named via hiddenLabel(reports-company) visually-hidden label' },
  { file: 'views/reports.js', re: /type: 'date', id: 'reports-date-from',/, reason: 'named via hiddenLabel(reports-date-from) visually-hidden label' },
  { file: 'views/reports.js', re: /type: 'date', id: 'reports-date-to',/, reason: 'named via hiddenLabel(reports-date-to) visually-hidden label' },
];

test('a11y: every c(input/textarea) literal carries a programmatic name (CAR-209)', () => {
  const ROOTS = [
    resolve(__dirname, '..', 'public', 'js', 'views'),
    resolve(__dirname, '..', 'public', 'js', 'lib'),
  ];
  const unnamed = [];
  for (const root of ROOTS) {
    for (const file of walkJs(root)) {
      const rel = file.slice(root.length + 1);
      const group = root.endsWith('views') ? `views/${rel}` : `lib/${rel}`;
      const src = readFileSync(file, 'utf8');
      // Balanced c('label'…) spans — a control inside one is labelled.
      const labelSpans = [];
      for (const m of src.matchAll(/\bc\(\s*'label'/g)) {
        const open = src.indexOf('(', m.index);
        const close = balancedCall(src, open);
        if (close > 0) labelSpans.push([m.index, close]);
      }
      const labelSpanText = labelSpans.map(([a, b]) => src.slice(a, b + 1)).join('\n');
      // Literal htmlFor targets declared in this file.
      const htmlForIds = new Set();
      for (const m of src.matchAll(/\bhtmlFor:\s*(['"])([a-zA-Z0-9_.\-]+)\1/g)) htmlForIds.add(m[2]);
      const hasDumpHelper = src.includes('A11yDump.label');
      for (const m of src.matchAll(/\bc\(\s*'(input|textarea)'/g)) {
        const open = src.indexOf('(', m.index);
        const close = balancedCall(src, open);
        if (close < 0) continue;
        const callText = src.slice(m.index, close + 1);
        const ob = callText.indexOf('{');
        const optsText = ob >= 0 ? callText.slice(ob, objectSpan(callText, ob) + 1) : '';
        // `const NAME = c('input'…` — NAME referenced inside a label span counts.
        const pre = src.slice(Math.max(0, m.index - 120), m.index);
        const varMatch = pre.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/);
        // (?<![\w.$]) keeps 'preview' from matching the i18n key 'bug.preview'.
        const varNamed = varMatch && new RegExp(`(?<![\\w.$])${varMatch[1].replace(/\$/g, '\\$')}\\b`).test(labelSpanText);
        const named =
          /aria-label|htmlFor/.test(optsText) ||
          labelSpans.some(([a, b]) => m.index >= a && m.index <= b) ||
          varNamed ||
          [...htmlForIds].some((id) => new RegExp(`\\bid:\\s*['"]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(callText));
        if (named) continue;
        // Readonly generated-output dumps: named via A11yDump.label in-file.
        if (/readonly|readOnly/i.test(optsText) && hasDumpHelper) continue;
        const line = src.slice(0, m.index).split('\n').length;
        const allow = CONTROLS_ALLOWLIST.some(
          (e) => e.file === group && e.re.test(optsText));
        if (allow) continue;
        unnamed.push(`${group}:${line} — ${callText.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
  }
  if (unnamed.length) {
    console.error(`Unnamed controls (${unnamed.length}):\n  ` + unnamed.join('\n  '));
  }
  assert.deepStrictEqual(unnamed, [],
    `${unnamed.length} input/textarea literal(s) without a programmatic name — add aria-label / data-i18n-aria-label / a label wrap, or an allowlist entry with a reason`);
});

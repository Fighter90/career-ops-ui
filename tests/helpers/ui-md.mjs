/**
 * vm loader for the client `UI.md()` markdown renderer (public/js/api.js).
 *
 * `UI.md()` is the app's escape-first XSS boundary: every byte of the input is
 * HTML-escaped BEFORE any tag-emitting transform runs, so LLM/report markdown
 * rendered via `c('div', { className:'md', html: UI.md(str) })` (career-plan,
 * reports, orientation, cv-studio, networking, evaluate, docs-assistant) can
 * never inject live `<script>`/`on*=`/`javascript:`.
 *
 * `md` lives inside the `window.UI = (function(){…})()` IIFE and is not a node
 * module, so — mirroring tests/helpers/i18n-vm.mjs — we extract the three pure
 * string functions it needs (`escapeHtml`, `md` (with nested `inline`), and
 * `isSafeUrl`) by brace-matching and evaluate them in a bare `node:vm` context.
 * They touch no DOM, so no document/window stub is required.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_JS = resolve(__dirname, '..', '..', 'public', 'js', 'api.js');

/** Extract a `function <name>(…) { … }` by matching its braces. The three
 *  functions we pull are pure and contain only balanced code/`${}` braces (no
 *  stray `{`/`}` in strings or `{n,m}` regex quantifiers), so this is sound. */
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`ui-md loader: function ${name} not found in api.js`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(start, i);
}

/** Load the real `md(src)` renderer from api.js. */
export function loadMd() {
  const src = readFileSync(API_JS, 'utf8');
  const bundle = ['escapeHtml', 'md', 'isSafeUrl']
    .map((n) => extractFn(src, n))
    .join('\n\n')
    + '\nglobalThis.__md = md;';
  const ctx = createContext({});
  runInContext(bundle, ctx);
  if (typeof ctx.__md !== 'function') throw new Error('ui-md loader: md did not evaluate to a function');
  // Self-probe (v1.138.0): the brace-matcher above assumes no stray `{`/`}` in
  // strings/regex/comments inside the extracted functions. If a future edit to
  // api.js breaks that assumption the extraction mis-slices SILENTLY and the XSS
  // suite would assert against a truncated function — a green false-positive on a
  // security boundary. Prove the loaded `md` still escapes before handing it back,
  // so a bad extraction fails LOUDLY here instead.
  const probe = ctx.__md('<script>alert(1)</script>');
  if (typeof probe !== 'string' || /<script/i.test(probe) || !/&lt;script&gt;/i.test(probe)) {
    throw new Error(`ui-md loader: escape-first self-probe FAILED (mis-sliced extraction?). Got: ${probe}`);
  }
  return ctx.__md;
}

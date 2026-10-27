/**
 * CAR-123 R3 — token-drift gates for the hand-written stylesheets.
 *
 * Two source-static canaries over the nine app+v2 stylesheets (the three
 * ordered sheets + the six view-owned v2 sheets; `map.css` and vendor CSS are
 * out of scope — see the hand-off note at the bottom):
 *
 *  (a) TRANSITION DRIFT — every `transition:` declaration either animates with
 *      the house token `var(--transition)` (= `180ms cubic-bezier(.2,.8,.2,1)`,
 *      the app.css token block; a `var(--transition, <fallback>)` fallback
 *      duration is the documented degraded form) or carries no duration at all
 *      (`transition: none`, the prefers-reduced-motion neutralizers). A literal
 *      duration outside a --transition fallback must sit in DURATION_ALLOWLIST
 *      with a reason (the CAR-57 precedent for sanctioned exceptions). Anything
 *      new FAILS and is printed with file:line + selector.
 *
 *  (b) TOKEN RESOLUTION — every `var(--x)` referenced in any stylesheet must
 *      resolve to a definition: a `--x:` declaration in any stylesheet, or a
 *      runtime injection from the SPA (`el.style.setProperty('--x', …)` /
 *      `'--x':` style-object keys in public/js). This is the gate that would
 *      have caught `--accent`: the v2-stats rules referenced it ~3× with a
 *      hardcoded `#4c8bf5` fallback, so it never followed the theme — and
 *      map.css referenced it WITHOUT a fallback, so its focus rings silently
 *      rendered nothing. Tokens in TOKEN_HANDOFF are known-undefined drift
 *      owned by another item (each entry names its referencing files and the
 *      hand-off); a NEW undefined token, a stale hand-off entry, or a hand-off
 *      whose referencing files moved all FAIL.
 *
 *  (c) pins the `--accent` resolution to the alias form so it keeps following
 *      the theme instead of being re-hardcoded to a literal.
 *
 * CI-isolated: pure source-static reads, no server, no network, no parent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = resolve(ROOT, 'public', 'css');
const JS_DIR = resolve(ROOT, 'public', 'js');

/** The three ordered stylesheets + the six v2 view sheets = the gated set. */
const GATED_FILES = [
  'app.css', 'components.css', 'overlays.css',
  'v2-pipeline.css', 'v2-reports.css', 'v2-llm.css', 'v2-nav.css',
  'v2-dash.css', 'v2-portals.css',
];
const ALL_CSS = readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'));

/** Blank out /* … *\/ comments while PRESERVING line structure, so reported
 *  line numbers match the raw file and `--transition:` (a custom property)
 *  or prose mentions can no longer read as declarations. */
const blankComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Walk the source and yield every `transition:` SHORTHAND declaration with
 *  its 1-based line number and nearest selector (text between the previous
 *  `{`/`}` boundary and the `{` that opened the current block). */
function* transitionDecls(src) {
  let segStart = 0; // start of the text since the last { or }
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    const close = src.indexOf('}', i);
    const t = src.indexOf('transition', i);
    const marks = [open, close, t].filter((n) => n !== -1).sort((a, b) => a - b);
    if (!marks.length) break;
    const next = marks[0];
    if (next === close) { i = close + 1; segStart = i; continue; }
    if (next === open) {
      const sel = src.slice(segStart, open).replace(/\s+/g, ' ').trim();
      yield* declsInBlock(src, open, sel);
      i = open + 1; segStart = i;
      continue;
    }
    // a bare "transition" word outside any block (shouldn't happen) — skip it
    i = t + 10;
  }

  function* declsInBlock(src, open, sel) {
    let j = open + 1;
    for (;;) {
      // stop at `;`, `}` — or `{`: a nested block start (@media > .rule) is
      // walked by the outer loop with its own selector, never swallowed here
      const end = nextMark(src, j, [';', '}', '{']);
      if (end === -1) return;
      const chunk = src.slice(j, end);
      const m = chunk.match(/(^|[\s;{])transition\s*:\s*([^;}]*)/);
      if (m) {
        // exclude custom-property declarations (`--transition:`): the char
        // run before the match must not end mid `--name`
        const before = chunk.slice(Math.max(0, m.index - 1), m.index + 1);
        if (!before.endsWith('-')) {
          const line = src.slice(0, j + m.index).split('\n').length;
          yield { line, sel, value: m[2].trim() };
        }
      }
      if (src[end] !== ';') return;
      j = end + 1;
    }
  }
  function nextMark(src, from, chars) {
    let best = -1;
    for (const c of chars) {
      const idx = src.indexOf(c, from);
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    }
    return best;
  }
}

/**
 * Sanctioned literal-duration outliers. Each entry must match EXACTLY ONE
 * transition declaration in its file (a stale entry fails the gate so the
 * list only ever shrinks by editing it, never by drifting the CSS).
 */
const DURATION_ALLOWLIST = [
  {
    file: 'v2-dash.css',
    re: /^transform 320ms cubic-bezier\(\.2, ?\.8, ?\.2, ?1\)$/,
    why: 'CAR-114 parallax planes — deliberate slow glide behind the dashboard; prefers-reduced-motion neutralizes it in the same file',
  },
];

test('(a) every transition declaration rides var(--transition) or the duration allowlist', () => {
  const offenders = [];
  const allowHits = new Map(); // allowlist index -> hit count
  for (const f of GATED_FILES) {
    const src = blankComments(readFileSync(resolve(CSS_DIR, f), 'utf8'));
    for (const { line, sel, value } of transitionDecls(src)) {
      if (value === 'none') continue;
      // strip var(--transition, <fallback>) — the fallback duration is the
      // documented degraded form, not drift
      const stripped = value.replace(/var\(--transition\s*,[^)]*\)/g, '');
      const hasLiteralDuration = /\d*\.?\d+(?:ms|s)\b/.test(stripped);
      if (!hasLiteralDuration) continue;
      const hit = DURATION_ALLOWLIST.findIndex((a) => a.file === f && a.re.test(value));
      if (hit !== -1) { allowHits.set(hit, (allowHits.get(hit) || 0) + 1); continue; }
      offenders.push(`public/css/${f}:${line}  ${sel} — transition: ${value}`);
    }
  }
  const stale = DURATION_ALLOWLIST.map((a, i) => ({ a, i }))
    .filter(({ i }) => (allowHits.get(i) || 0) !== 1)
    .map(({ a, i }) => `${a.file} ${a.re} — matched ${allowHits.get(i) || 0}× (must match exactly 1; ${a.why})`);
  assert.deepEqual(offenders, [],
    `off-token transition durations (fold onto var(--transition) or allowlist with a reason):\n  ${offenders.join('\n  ')}`);
  assert.deepEqual(stale, [], `stale duration-allowlist entries:\n  ${stale.join('\n  ')}`);
});

/** Every `var(--x…)` reference in any stylesheet must resolve to a definition:
 *  a `--x:` declaration in any stylesheet, or a runtime injection from the SPA. */
function collectReferenced() {
  const ref = new Map(); // token -> Set<file>
  for (const f of ALL_CSS) {
    const src = blankComments(readFileSync(resolve(CSS_DIR, f), 'utf8'));
    for (const m of src.matchAll(/var\(--([a-zA-Z0-9-]+)/g)) {
      if (!ref.has(m[1])) ref.set(m[1], new Set());
      ref.get(m[1]).add(f);
    }
  }
  return ref;
}

function collectDefined() {
  const def = new Set();
  for (const f of ALL_CSS) {
    const src = blankComments(readFileSync(resolve(CSS_DIR, f), 'utf8'));
    for (const m of src.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)) def.add(m[1]);
  }
  // runtime injections: el.style.setProperty('--x', …) and '--x': style-object keys
  const walk = (dir, acc = []) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, ent.name);
      if (ent.isDirectory()) walk(full, acc);
      else if (ent.name.endsWith('.js')) acc.push(full);
    }
    return acc;
  };
  for (const f of walk(JS_DIR)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/setProperty\(\s*['"]--([a-zA-Z0-9-]+)['"]/g)) def.add(m[1]);
    for (const m of src.matchAll(/['"]--([a-zA-Z0-9-]+)['"]\s*:/g)) def.add(m[1]);
  }
  return def;
}

/**
 * Known-undefined tokens — drift owned by another item. Each entry names the
 * files that reference it (the gate fails if that moves) and the hand-off.
 * New undefined tokens FAIL; entries whose token became defined FAIL (remove).
 */
const TOKEN_HANDOFF = [
  { token: 'bg-subtle', files: ['app.css', 'components.css'], why: 'hand-off (CAR-123 R3 scope = --accent): kbd-shortcut/dash-chip/table-head subtle wash; light fallback exact, no dark value — dark-mode wash belongs to the next dark-surface pass' },
  { token: 'warn-bg', files: ['app.css'], why: 'hand-off: .brief-warning cream wash — light fallback exact; dark value belongs to the dark-callout pass' },
  { token: 'warn-border', files: ['app.css'], why: 'hand-off: .brief-warning amber border — light fallback exact; dark value belongs to the dark-callout pass' },
  { token: 'warn-fg', files: ['app.css'], why: 'hand-off: .brief-warning amber text — light fallback exact; dark value belongs to the dark-callout pass' },
  { token: 'rose', files: ['overlays.css'], why: 'hand-off: .scan-error-banner wash — light fallback exact; dark value belongs to the dark-callout pass' },
  { token: 'rose-border', files: ['overlays.css'], why: 'hand-off: .scan-error-banner border — light fallback exact; dark value belongs to the dark-callout pass' },
  { token: 'rose-ink', files: ['overlays.css'], why: 'hand-off: .scan-error-banner text — light fallback exact; dark value belongs to the dark-callout pass' },
  { token: 'ease-out', files: ['v2-llm.css'], why: 'hand-off: llm2run slide easing read with an ease-in-out fallback; naming a token whose shipped value is ease-in-out needs the v2-llm owner' },
];

test('(b) every var(--x) referenced in any stylesheet resolves (token block or runtime)', () => {
  const ref = collectReferenced();
  const def = collectDefined();
  const undefinedTokens = [...ref.entries()].filter(([tok]) => !def.has(tok));
  const unallowed = undefinedTokens.filter(([tok]) => !TOKEN_HANDOFF.some((h) => h.token === tok));
  assert.deepEqual(unallowed.map(([t]) => t), [],
    `undefined tokens referenced in CSS (define in the app.css token block — or hand off WITH an entry):\n  ${unallowed.map(([t, fs]) => `--${t} → ${[...fs].join(', ')}`).join('\n  ')}`);
  // allowlist integrity: referenced files must match, and fixed tokens must
  // leave the list (a stale entry is debt the gate refuses to carry)
  const stale = [];
  for (const h of TOKEN_HANDOFF) {
    if (def.has(h.token)) { stale.push(`--${h.token} is now defined — remove its hand-off entry`); continue; }
    if (!ref.has(h.token)) { stale.push(`--${h.token} is no longer referenced — remove its hand-off entry`); continue; }
    const actual = [...ref.get(h.token)];
    const missing = h.files.filter((f) => !actual.includes(f));
    if (missing.length) stale.push(`--${h.token} hand-off names ${h.files.join(', ')} but is now referenced from ${actual.join(', ')} (missing: ${missing.join(', ')})`);
  }
  assert.deepEqual(stale, [], `stale token hand-off entries:\n  ${stale.join('\n  ')}`);
});

test('(c) --accent is aliased to the theme-aware brand accent, never re-hardcoded', () => {
  const app = readFileSync(resolve(CSS_DIR, 'app.css'), 'utf8');
  assert.match(app, /--accent\s*:\s*var\(--rausch\)/,
    '--accent must alias var(--rausch) (theme-following); a literal here would freeze the light value');
  // the target must stay theme-aware: light :root + at least one dark block
  const decls = app.match(/--rausch\s*:/g) || [];
  assert.ok(decls.length >= 2, `--rausch must be declared in both themes (found ${decls.length})`);
});

/**
 * Empty-state consistency (v1.150.0, Phase 4 visual polish).
 *
 * The shared `.empty` class owns the empty-state look — tokenized padding
 * (var(--space-7) = 48px), centered text, muted colour, dashed border. Four
 * views (activity/cv-studio/stats/usage) used to re-declare padding/textAlign/
 * colour inline with a magic `40px`, so their empty states drifted a few px from
 * every other one. Those were removed; this canary keeps the class the single
 * source of truth — a view may still add a genuinely layout-specific override
 * (width, border), but not re-state what `.empty` already provides.
 *
 * CI-isolated: reads only repo CSS + view sources, no parent dependency, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Both places that build `.empty` elements — views and the shared libs.
const SRC_DIRS = ['public/js/views', 'public/js/lib'].map((d) => resolve(ROOT, d));

test('.empty owns padding + centering + colour (the single source of truth)', () => {
  const css = loadAppCss();
  // Anchor on the exact top-level `.empty {` rule (not a descendant/compound
  // selector like `.card .empty {` that could sort earlier in the concatenation).
  const start = css.search(/^\.empty \{/m);
  assert.ok(start >= 0, 'a top-level `.empty {` rule exists');
  const block = css.slice(start, css.indexOf('}', start) + 1);
  assert.match(block, /padding:\s*var\(--space-7\)/, '.empty tokenizes its padding');
  assert.match(block, /text-align:\s*center/, '.empty centers its text');
  assert.match(block, /color:\s*var\(--foggy\)/, '.empty sets the muted colour');
  assert.match(block, /border:\s*2px dashed/, '.empty has the dashed border');
});

/**
 * The object literal that directly contains `idx` (a `c(tag, {…props…}, …)`
 * props object), found by brace-matching — so the check is bounded to THIS
 * element and never bleeds into a sibling's inline style.
 */
function enclosingObject(src, idx) {
  let depth = 0, start = -1;
  for (let j = idx; j >= 0; j--) {
    const ch = src[j];
    if (ch === '}') depth++;
    else if (ch === '{') { if (depth === 0) { start = j; break; } depth--; }
  }
  if (start < 0) return '';
  depth = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(start, j + 1);
  }
  return src.slice(start);
}

test('no view/lib re-declares the .empty class properties inline', () => {
  const offenders = [];
  // Markers that are ALWAYS redundant on a `.empty` element — the class already
  // centers, mutes, and pads at 48px, so re-stating any of these is the drift we
  // removed. A genuine layout override (width / border) is allowed and absent here.
  const REDUNDANT = [/\btextAlign\s*:/, /['"]text-align['"]\s*:/, /color:\s*'var\(--foggy\)'/, /padding:\s*'40px'/];
  for (const dir of SRC_DIRS) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
      const src = readFileSync(resolve(dir, f), 'utf8');
      const re = /className:\s*['"]empty['"]/g;
      let m;
      while ((m = re.exec(src))) {
        // Bound the check to this element's own props object (incl. its nested style).
        const props = enclosingObject(src, m.index);
        for (const bad of REDUNDANT) {
          if (bad.test(props)) offenders.push(`${f}: .empty element inline re-states ${bad}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

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
const VIEWS = resolve(ROOT, 'public/js/views');

test('.empty owns padding + centering + colour (the single source of truth)', () => {
  const css = loadAppCss();
  const block = css.slice(css.indexOf('.empty {'), css.indexOf('}', css.indexOf('.empty {')) + 1);
  assert.match(block, /padding:\s*var\(--space-7\)/, '.empty tokenizes its padding');
  assert.match(block, /text-align:\s*center/, '.empty centers its text');
  assert.match(block, /color:\s*var\(--foggy\)/, '.empty sets the muted colour');
  assert.match(block, /border:\s*2px dashed/, '.empty has the dashed border');
});

test('no view re-declares the .empty class properties inline', () => {
  const offenders = [];
  for (const f of readdirSync(VIEWS).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(resolve(VIEWS, f), 'utf8');
    // Every inline style attached to a `className: 'empty'` element.
    const re = /className:\s*'empty'\s*,\s*style:\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      const style = m[1];
      // These are all provided by the class — re-stating them is the drift we removed.
      for (const prop of ['textAlign', "padding: '40px'", "color: 'var(--foggy)'"]) {
        if (style.includes(prop)) offenders.push(`${f}: .empty inline re-states ${prop}`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

/**
 * Lead-row top-margin guard.
 *
 * `.page-subtitle` carries only a TOP margin (`margin: var(--space-2) 0 0`), so
 * a lead control row appended right after it must supply its own top margin —
 * otherwise the primary button sits flush against the subtitle with no breathing
 * room (user-reported on #/interview-digest). These five views each render a
 * lead button / control row directly under the subtitle. This test is ANCHORED
 * to that specific row (never a whole-file substring): it asserts the fixed form
 * `margin: '16px 0'` at the lead row and that the cramped `margin: '0 0 16px'`
 * form is gone from it — without tripping on unrelated top-0 stacking (e.g.
 * funded.js result cards legitimately keep `margin: '0 0 16px'`, so that view is
 * checked with an anchor tied to its `, btn)` lead row rather than a file scan).
 *
 * Excluded on purpose: #/stats market controls (separated from the subtitle by
 * the tab bar) and #/docs-assistant (its lead element is a chat-log, and its
 * control row lives at the bottom) — neither is a lead button under the subtitle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const view = (name) => readFileSync(resolve(HERE, '..', 'public', 'js', 'views', name), 'utf8');

// Per view: `fixed` must be present at the lead row, `cramped` must be absent.
// For funded.js the anchor is tied to the `, btn)` lead row so the legitimate
// top-0 result card (`… '0 0 16px' } }, [`) is not mistaken for the lead row.
const CASES = [
  { name: 'interview-digest.js', fixed: "margin: '16px 0'", cramped: "margin: '0 0 16px'" },
  { name: 'portals.js', fixed: "margin: '16px 0'", cramped: "margin: '0 0 16px'" },
  { name: 'career-plan.js', fixed: "margin: '16px 0'", cramped: "margin: '0 0 16px'" },
  { name: 'orientation.js', fixed: "margin: '16px 0'", cramped: "margin: '0 0 16px'" },
  { name: 'funded.js', fixed: "{ margin: '16px 0' } }, btn)", cramped: "{ margin: '0 0 16px' } }, btn)" },
];

for (const { name, fixed, cramped } of CASES) {
  test(`${name}: lead control row keeps a top margin (not cramped under the subtitle)`, () => {
    const src = view(name);
    assert.ok(src.includes(fixed), `${name} lead row should be "${fixed}"`);
    assert.ok(!src.includes(cramped), `${name} lead row must not regress to the cramped "${cramped}"`);
  });
}

/**
 * UX-A5-r4 (v1.59.9) — behavioural lock-test for the help TOC scroll-spy.
 *
 * The previous 5 closure cycles all shipped with static "tests green"
 * but the bug stayed open because the tests asserted source-code shape,
 * not behaviour. This test runs the algorithm against synthetic heading
 * geometry and asserts the user-facing promise: as the viewport scroll
 * position changes, the link whose H2 sits at-or-above 30 % of viewport
 * height carries the `.toc-current` class — exactly one at any time.
 *
 * No jsdom dependency: we slice the REAL `applyCurrent` +
 * `computeActiveAndApply` source out of help.js and evaluate it in a
 * `vm` context against minimal `heading.getBoundingClientRect()` stubs +
 * a fake link `.classList`. There is no hand-copied algorithm to drift:
 * any future PR that breaks the contract in help.js fails this test
 * before any browser/Playwright run is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * Minimal fake of the DOM surface help.js touches. Each heading carries
 * an `id` and a `_absTop` (synthetic absolute Y position in pixels).
 * Each link carries an `_href` and the `classList` interface
 * `add` / `remove` / `contains`.
 */
function fakeHeading(id, absTop) {
  return {
    id,
    _absTop: absTop,
    // help.js: `h.getBoundingClientRect().top + window.scrollY` →
    // returns the document-absolute Y of the heading top. We mirror
    // that by returning a rect.top relative to a known scrollY.
    getBoundingClientRect() {
      return { top: this._absTop - fakeWindow.scrollY };
    },
  };
}
function fakeLink(href) {
  const cls = new Set();
  return {
    _href: href,
    classList: {
      add: (c) => cls.add(c),
      remove: (c) => cls.delete(c),
      contains: (c) => cls.has(c),
      _all: cls,
    },
  };
}

const fakeWindow = { scrollY: 0, innerHeight: 800 };

// The production scroll-spy lives inside help.js's render closure, so it
// cannot be imported. Slice it from `function applyCurrent` up to (not
// including) `function onSpyScroll` — that span holds applyCurrent, the
// `spyScheduled` flag and computeActiveAndApply — and run it in a vm
// context whose free variables (`headings`, `linkByTarget`, `window`) are
// the fakes below.
const HELP_SRC = readFileSync(new URL('../public/js/views/help.js', import.meta.url), 'utf8');
const SPY_START = HELP_SRC.indexOf('function applyCurrent(id)');
const SPY_END = HELP_SRC.indexOf('function onSpyScroll()');
const SPY_SRC = HELP_SRC.slice(SPY_START, SPY_END);

function computeActiveAndApply(headings, linkByTarget) {
  const ctx = vm.createContext({ headings, linkByTarget, window: fakeWindow });
  vm.runInContext(`${SPY_SRC}\ncomputeActiveAndApply();`, ctx);
  const active = [...linkByTarget.entries()]
    .filter(([, l]) => l.classList.contains('toc-current'))
    .map(([id]) => id);
  return active.length ? active[0] : null;
}

test('UX-A5-r4 extraction: help.js still exposes the scroll-spy span this test evaluates', () => {
  assert.ok(SPY_START >= 0, 'help.js must define function applyCurrent(id)');
  assert.ok(SPY_END > SPY_START, 'help.js must define function onSpyScroll() after applyCurrent');
  assert.match(SPY_SRC, /function computeActiveAndApply\(\)/);
});

function makeFixture(n = 18, stride = 800) {
  // n headings, stride px apart starting at y=200.
  const headings = Array.from({ length: n }, (_, i) =>
    fakeHeading(`help-h-${i}`, 200 + i * stride));
  const linkByTarget = new Map(
    headings.map((h) => [h.id, fakeLink(`#${h.id}`)]),
  );
  return { headings, linkByTarget };
}

test('UX-A5-r4 behavioural: at scrollY=0, first heading is the active one', () => {
  fakeWindow.scrollY = 0;
  const { headings, linkByTarget } = makeFixture();
  const id = computeActiveAndApply(headings, linkByTarget);
  assert.equal(id, 'help-h-0');
  assert.equal(linkByTarget.get('help-h-0').classList.contains('toc-current'), true);
  // No other link carries the class.
  let count = 0;
  for (const l of linkByTarget.values()) if (l.classList.contains('toc-current')) count++;
  assert.equal(count, 1, 'exactly one link must carry .toc-current at any time');
});

test('UX-A5-r4 behavioural: scrollY past section 5 → section 5 (or 4) highlighted', () => {
  // heading 5 sits at absTop = 200 + 5*800 = 4200
  // triggerY at scrollY=4040: 4040 + 800*0.3 = 4280
  // → heading 5 (4200 <= 4280) is the last "above trigger" → chosen.
  fakeWindow.scrollY = 4040;
  const { headings, linkByTarget } = makeFixture();
  const id = computeActiveAndApply(headings, linkByTarget);
  assert.equal(id, 'help-h-5');
  assert.equal(linkByTarget.get('help-h-5').classList.contains('toc-current'), true);
});

test('UX-A5-r4 behavioural: scrollY past section 12 → section 12 highlighted', () => {
  // heading 12 sits at absTop = 200 + 12*800 = 9800
  // triggerY at scrollY=9640: 9640 + 240 = 9880 → 9800 <= 9880 → chosen 12.
  fakeWindow.scrollY = 9640;
  const { headings, linkByTarget } = makeFixture();
  const id = computeActiveAndApply(headings, linkByTarget);
  assert.equal(id, 'help-h-12');
});

test('UX-A5-r4 behavioural: linear scan breaks early once a heading exceeds the trigger', () => {
  // Instrument every getBoundingClientRect to count calls.
  fakeWindow.scrollY = 0;
  const { headings, linkByTarget } = makeFixture();
  let calls = 0;
  for (const h of headings) {
    const orig = h.getBoundingClientRect.bind(h);
    h.getBoundingClientRect = function () { calls++; return orig(); };
  }
  computeActiveAndApply(headings, linkByTarget);
  // At scrollY=0, heading 0 (200) <= triggerY (240) → keep going to
  // heading 1 (1000) which is > 240 → break. So only 2 calls.
  assert.equal(calls, 2,
    'linear scan must break on the first heading that exceeds triggerY');
});

test('UX-A5-r4 behavioural: empty fixture returns null without throwing', () => {
  fakeWindow.scrollY = 0;
  const id = computeActiveAndApply([], new Map());
  assert.equal(id, null);
});

test('UX-A5-r4 behavioural: scroll back up → highlight moves back to earlier section', () => {
  fakeWindow.scrollY = 9640;
  const { headings, linkByTarget } = makeFixture();
  computeActiveAndApply(headings, linkByTarget);
  assert.equal(linkByTarget.get('help-h-12').classList.contains('toc-current'), true);
  // Scroll back to the top.
  fakeWindow.scrollY = 0;
  computeActiveAndApply(headings, linkByTarget);
  assert.equal(linkByTarget.get('help-h-0').classList.contains('toc-current'), true,
    'after scroll-up, section 0 must be highlighted');
  assert.equal(linkByTarget.get('help-h-12').classList.contains('toc-current'), false,
    'previous highlight must be cleared');
});

test('UX-A5-r4 algorithm parity: help.js uses identical triggerY + linear-scan-break shape', () => {
  const help = readFileSync(new URL('../public/js/views/help.js', import.meta.url), 'utf8');
  // triggerY formula must be `scrollY + innerHeight * 0.3` (30 % from top).
  assert.match(help, /triggerY\s*=\s*window\.scrollY\s*\+\s*window\.innerHeight\s*\*\s*0\.3/,
    'help.js must use triggerY = scrollY + innerHeight * 0.3');
  // The linear scan must have an `else break` to short-circuit once a
  // heading exceeds the trigger — this is what makes the algorithm
  // O(active-index) instead of O(n) per scroll event.
  assert.match(help, /if \(absTop <= triggerY\) chosen = h;\s*else break;/,
    'help.js linear scan must short-circuit with `else break;` for performance + correctness');
});

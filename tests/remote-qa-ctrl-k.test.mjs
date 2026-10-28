/**
 * Unit check for the prod checker's Ctrl+K assertion
 * (scripts/remote-qa/prod-regression.mjs, "interactions" block).
 *
 * Contract (CAR-122, qa/QA-REGRESSION-PROMPT-v1.261.1 §2): Ctrl/Cmd+K opens
 * the nav-v2 COMMAND PALETTE — the `.nav-v2-palette` [role=dialog] command
 * menu with its `nav-v2-input` focused. nav-v2 registers its document-level
 * chord handler before app.js's legacy binding and wins via
 * stopImmediatePropagation(), so "Ctrl+K focuses the global search box" has
 * been the wrong expectation since the v2 shell shipped (the 40666148577
 * run flagged exactly that stale assertion as its one ctrl-k finding).
 *
 * The script itself needs a deployed prod host, so this suite extracts the
 * browser-side evaluate body from the script source and runs it against a
 * mock DOM for every acceptance/rejection scenario — the assertion logic
 * is exercised directly, no network, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(__dirname, '..', 'scripts', 'remote-qa', 'prod-regression.mjs'), 'utf8');

/** Extract the arrow function passed to page.evaluate in the Ctrl+K block. */
function extractChordEvaluate() {
  const anchor = SRC.indexOf("await page.keyboard.press('Control+k')");
  assert.notEqual(anchor, -1, 'prod-regression.mjs lost its Control+k block');
  const evalAt = SRC.indexOf('page.evaluate(() => {', anchor);
  assert.notEqual(evalAt, -1, 'Control+k block has no page.evaluate');
  const bodyStart = SRC.indexOf('{', evalAt);
  let depth = 0;
  let i = bodyStart;
  for (; i < SRC.length; i += 1) {
    if (SRC[i] === '{') depth += 1;
    else if (SRC[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  const arrowSrc = SRC.slice(SRC.indexOf('(', evalAt + 'page.evaluate'.length) + 1, i);
  // Re-bind the arrow's free `document` to the caller's mock on each call.
  return (doc) => new Function('document', `return (${arrowSrc})`)(doc)();
}

const el = (props) => ({ getAttribute: () => null, className: '', ...props });

function mockDocument({ paletteOpen, focus }) {
  const dlg = paletteOpen
    ? el({ closest: () => null }) // not inside a [hidden] ancestor → open
    : null;
  const search = el({ tagName: 'INPUT', id: 'global-search', type: 'text' });
  return {
    querySelector: (sel) => (sel.includes('nav-v2-palette') ? dlg : null),
    activeElement: focus === 'palette'
      ? el({ tagName: 'INPUT', className: 'nav-v2-input' })
      : focus === 'search' ? search : el({ tagName: 'BODY' }),
  };
}

const chord = extractChordEvaluate();
const accepted = (doc) => {
  const r = chord(doc);
  return (r.paletteOpen && r.paletteFocus) || r.searchFocus;
};

test('ctrl-k assertion: open palette with focused input satisfies the CAR-122 contract', () => {
  const r = chord(mockDocument({ paletteOpen: true, focus: 'palette' }));
  assert.equal(r.paletteOpen, true);
  assert.equal(r.paletteFocus, true);
  assert.equal(accepted(mockDocument({ paletteOpen: true, focus: 'palette' })), true);
});

test('ctrl-k assertion: palette open but focus elsewhere is a finding', () => {
  assert.equal(accepted(mockDocument({ paletteOpen: true, focus: 'body' })), false);
});

test('ctrl-k assertion: legacy search focus still accepted (palette-less fallback)', () => {
  const r = chord(mockDocument({ paletteOpen: false, focus: 'search' }));
  assert.equal(r.paletteOpen, false);
  assert.equal(r.searchFocus, true);
  assert.equal(accepted(mockDocument({ paletteOpen: false, focus: 'search' })), true);
});

test('ctrl-k assertion: neither palette nor search focus is a finding', () => {
  assert.equal(accepted(mockDocument({ paletteOpen: false, focus: 'body' })), false);
});

test('ctrl-k assertion: a [hidden] palette ancestor counts as closed', () => {
  const doc = mockDocument({ paletteOpen: true, focus: 'palette' });
  doc.querySelector = () => el({ closest: () => ({}) }); // inside [hidden]
  assert.equal(chord(doc).paletteOpen, false);
});

test('ctrl-k assertion: the stale search-focus contract is gone from the script', () => {
  assert.ok(!SRC.includes('did not focus the search box'), 'stale assertion message still present');
  assert.ok(SRC.includes('.nav-v2-palette'), 'palette selector missing');
  assert.ok(/CAR-122/.test(SRC.slice(SRC.indexOf('Control+k') - 600, SRC.indexOf('Control+k') + 400)), 'contract comment missing near the chord block');
});

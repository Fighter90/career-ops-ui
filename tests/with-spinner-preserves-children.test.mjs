/**
 * BUG-TB-SPIN (v1.231.3) — `UI.withSpinner` must not flatten a button's
 * element children into a bare text node.
 *
 * v1.231.2 made the top-bar actions icon-only on mobile by splitting each
 * button into two spans:
 *
 *     <button id="btn-doctor"><span class="btn-ico">🩺</span
 *       ><span class="btn-label" data-i18n="top.doctor">Doctor</span></button>
 *
 * and hiding `.btn-label` under `max-width: 900px`. `withSpinner` wrapped the
 * Doctor click and did its busy cue through `textContent`:
 *
 *     const original = button.textContent;            // "🩺Doctor"
 *     button.textContent = '⏳ ' + original;           // both spans destroyed
 *     button.textContent = button.dataset.originalText;
 *
 * Assigning `textContent` replaces every child with ONE text node. So the
 * first Doctor click permanently removed `.btn-ico` and `.btn-label` from the
 * DOM; the mobile rules had nothing left to match, the label reappeared as
 * bare text, and the 36 px square grew into a wide pill that pushed the row
 * out of the top bar. Reported from a phone right after v1.231.2 shipped.
 *
 * This is the same defect class as the `applyI18n()` trap documented in
 * app.js — code that assigns `textContent` to an element that now has element
 * children — reached through a different caller. The lock is behavioural: run
 * the real `withSpinner` against a fake button and assert the children survive
 * a full cycle, so a future "simplification" back to textContent fails here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const API_JS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js', 'api.js');

/** Extract `async function <name>(…) {…}` by brace matching (mirrors tests/helpers/ui-md.mjs). */
function extractFn(src, name) {
  const start = src.search(new RegExp(`(?:async )?function ${name}\\(`));
  if (start === -1) throw new Error(`withSpinner loader: ${name} not found in api.js`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(start, i);
}

function loadWithSpinner() {
  const src = readFileSync(API_JS, 'utf8');
  const ctx = createContext({ document: { createTextNode: (t) => ({ nodeType: 3, textContent: t }) } });
  runInContext(`${extractFn(src, 'withSpinner')}\nglobalThis.__ws = withSpinner;`, ctx);
  if (typeof ctx.__ws !== 'function') throw new Error('withSpinner loader: not a function (mis-sliced?)');
  return ctx.__ws;
}

/** Minimal stand-in for the real button: only the surface withSpinner touches. */
function fakeButton() {
  const ico = { nodeType: 1, className: 'btn-ico', textContent: '🩺' };
  const label = { nodeType: 1, className: 'btn-label', textContent: 'Doctor' };
  return {
    children: [ico, label],
    disabled: false,
    dataset: {},
    attrs: {},
    classList: { list: new Set(), add(c) { this.list.add(c); }, remove(c) { this.list.delete(c); } },
    get childNodes() { return this.children; },
    get textContent() { return this.children.map((n) => n.textContent).join(''); },
    set textContent(v) { this.children = [{ nodeType: 3, textContent: v }]; },
    replaceChildren(...nodes) { this.children = nodes; },
    querySelector(sel) {
      return this.children.find((n) => n.nodeType === 1 && `.${n.className}` === sel) || null;
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
  };
}

test('BUG-TB-SPIN: withSpinner leaves the icon and label spans intact after a full cycle', async () => {
  const withSpinner = loadWithSpinner();
  const btn = fakeButton();

  const result = await withSpinner(btn, async () => 'ok');

  assert.equal(result, 'ok', 'withSpinner must return the awaited result');
  assert.ok(btn.querySelector('.btn-ico'), '.btn-ico must survive — the mobile rules size the button by it');
  assert.ok(btn.querySelector('.btn-label'),
    '.btn-label must survive — without it `display:none` has nothing to hide and the label reappears');
  assert.equal(btn.childNodes.length, 2, 'the button must still hold exactly its two element children');
  assert.equal(btn.textContent, '🩺Doctor', 'visible text must be restored unchanged');
});

test('BUG-TB-SPIN: withSpinner shows a busy cue and restores the button state', async () => {
  const withSpinner = loadWithSpinner();
  const btn = fakeButton();
  let seenDuringFlight = null;

  await withSpinner(btn, async () => {
    seenDuringFlight = { text: btn.textContent, disabled: btn.disabled, busy: btn.attrs['aria-busy'] };
  });

  assert.match(seenDuringFlight.text, /⏳/, 'an hourglass cue must be visible while the request is in flight');
  assert.equal(seenDuringFlight.disabled, true, 'the button must be disabled in flight to swallow double-clicks');
  assert.equal(seenDuringFlight.busy, 'true', 'aria-busy must be set in flight');
  assert.equal(btn.disabled, false, 'the prior disabled state must be restored');
  assert.equal(btn.attrs['aria-busy'], undefined, 'aria-busy must be cleared');
});

test('BUG-TB-SPIN: a button whose child is plain text still round-trips', async () => {
  const withSpinner = loadWithSpinner();
  const btn = fakeButton();
  btn.children = [{ nodeType: 3, textContent: 'Save' }];

  await withSpinner(btn, async () => null);

  assert.equal(btn.textContent, 'Save', 'text-only buttons — the majority of call sites — must be unaffected');
});

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

test('BUG-TB-SPIN: withSpinner restores the busy-state contract', async () => {
  const withSpinner = loadWithSpinner();
  const btn = fakeButton();
  let inFlight = null;

  await withSpinner(btn, async () => {
    inFlight = { disabled: btn.disabled, busy: btn.attrs['aria-busy'], loading: btn.classList.list.has('is-loading') };
  });

  assert.equal(inFlight.disabled, true, 'the button must be disabled in flight to swallow double-clicks');
  assert.equal(inFlight.busy, 'true', 'aria-busy must be set in flight');
  assert.equal(inFlight.loading, true, 'the .is-loading class must carry the visual cue in flight');
  assert.equal(btn.disabled, false, 'the prior disabled state must be restored');
  assert.equal(btn.attrs['aria-busy'], undefined, 'aria-busy must be cleared');
  assert.equal(btn.classList.list.has('is-loading'), false, '.is-loading must be cleared');
});

/**
 * v1.231.4 — the half-fix. v1.231.3 restored the spans in `finally`, but the
 * IN-FLIGHT state still replaced them with the text '⏳ ' + label, so for the
 * whole length of a doctor run the 36px square was a wide `⏳ 🩺Doctor` pill and
 * the row broke exactly as before. Restoring the children fixed the aftermath,
 * not the moment — the user reported it again with a screenshot of the button
 * mid-run, on mobile and on desktop.
 *
 * A button that has element children must therefore not be rewritten AT ALL:
 * its cue is the `.is-loading` class, which the stylesheet dims and which swaps
 * the icon for an hourglass in CSS, so the geometry never changes.
 */
test('BUG-TB-SPIN: a button with element children is never rewritten, not even in flight', async () => {
  const withSpinner = loadWithSpinner();
  const btn = fakeButton();
  let inFlight = null;

  await withSpinner(btn, async () => {
    inFlight = {
      text: btn.textContent,
      children: btn.childNodes.length,
      ico: !!btn.querySelector('.btn-ico'),
      label: !!btn.querySelector('.btn-label'),
    };
  });

  assert.equal(inFlight.ico, true, 'the icon span must survive IN FLIGHT, not merely be restored after');
  assert.equal(inFlight.label, true, 'the label span must survive in flight');
  assert.equal(inFlight.children, 2, 'the button must still hold exactly its two element children in flight');
  assert.equal(inFlight.text, '🩺Doctor',
    'no hourglass may be written into the content — it would widen the 36px square for the whole run');
});

test('BUG-TB-SPIN: a button whose child is plain text still round-trips', async () => {
  const withSpinner = loadWithSpinner();
  const btn = fakeButton();
  btn.children = [{ nodeType: 3, textContent: 'Save' }];

  let seen = null;
  await withSpinner(btn, async () => { seen = btn.textContent; });

  assert.match(seen, /⏳/,
    'text-only buttons keep the prepended hourglass — 23 of the 24 call sites, unchanged since v1.58');
  assert.equal(btn.textContent, 'Save', 'and it is restored afterwards');
});

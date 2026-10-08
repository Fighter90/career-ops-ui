/**
 * CAR-36 (v1.243.0 views-3) — the "Record outcome" modal survived hash
 * navigation: it is a child of the app-chrome #modal node, not of the
 * #content subtree the router replaces, so after opening it any nav click
 * left it mounted over the new view intercepting every pointer event.
 *
 * The fix arms a document-level hashchange guard owned by the modal
 * (tracker.js `armTrackerModalNavGuard`), detached via UI.modal's onClose.
 * The guard is a top-level function in a browser-only view → run the REAL
 * source in a vm context against fakes (help-toc-spy-behavior pattern):
 * no hand-copied algorithm to drift.
 *
 * Also locks the sibling tracker fixes from the same finding batch:
 *   - legitimacyClass: 'Proceed with Caution' must tint warn (caution is
 *     checked before the bad tier's 'proceed' keyword).
 *   - withFocusPreserved: applyFilters rebuilds must not drop keyboard focus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const TRACKER = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'tracker.js'), 'utf8');

/** Slice a top-level `function name(…) {…}` out of a view (brace-counted). */
function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist in the view source`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

function fakeDocument() {
  const listeners = new Map(); // type -> Set<fn>
  return {
    listeners,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    dispatch(type) {
      for (const fn of [...(listeners.get(type) || [])]) fn();
    },
    count(type) { return (listeners.get(type) || new Set()).size; },
  };
}

function makeCtx(doc, routerCurrent, ui) {
  const ctx = vm.createContext({ document: doc, Router: { current: routerCurrent }, UI: ui });
  vm.runInContext(sliceFn(TRACKER, 'function armTrackerModalNavGuard'), ctx);
  return ctx;
}

test('CAR-36 behavioural: navigation away from #/tracker closes the outcome modal', () => {
  const doc = fakeDocument();
  let route = 'tracker';
  let closeCalls = 0;
  // The real UI.closeModal() fires the onClose hook — model that contract.
  const detachRef = { current: null };
  const ctx = makeCtx(doc, () => ({ name: route }), {
    closeModal: () => { closeCalls++; if (detachRef.current) detachRef.current(); },
  });

  const detach = vm.runInContext('armTrackerModalNavGuard();', ctx);
  detachRef.current = detach;
  assert.ok(detach, 'the guard factory returns the detach handle');
  assert.equal(doc.count('hashchange'), 1, 'exactly one hashchange listener armed');

  // Same-view re-render (?query / params): the modal must stay.
  doc.dispatch('hashchange');
  assert.equal(closeCalls, 0, 'same-route hashchange must NOT close the modal');

  // A nav click to any other view: the modal must close exactly once.
  route = 'dashboard';
  doc.dispatch('hashchange');
  assert.equal(closeCalls, 1, 'navigation away must close the modal');
  assert.equal(doc.count('hashchange'), 0, 'the guard must detach itself after closing');

  // A later hashchange (another view's lifetime) must not fire anything.
  route = 'reports';
  doc.dispatch('hashchange');
  assert.equal(closeCalls, 1, 'no stale guard may close a later modal');
});

test('CAR-36 behavioural: closing via × / Esc / record-success detaches the guard', () => {
  const doc = fakeDocument();
  let route = 'tracker';
  let closeCalls = 0;
  const ctx = makeCtx(doc, () => ({ name: route }), { closeModal: () => { closeCalls++; } });
  const detach = vm.runInContext('armTrackerModalNavGuard();', ctx);
  assert.equal(typeof detach, 'function', 'onClose receives a callable detach');

  detach(); // UI.modal's onClose path (× / Esc / backdrop / record-success)
  assert.equal(doc.count('hashchange'), 0, 'onClose must remove the guard');

  route = 'stats';
  doc.dispatch('hashchange');
  assert.equal(closeCalls, 0, 'a detached guard must never close another view\'s modal');
});

test('CAR-36 wiring: openOutcomeModal passes the detach as UI.modal onClose', () => {
  const open = TRACKER.indexOf('function openOutcomeModal');
  assert.ok(open >= 0);
  const body = TRACKER.slice(open);
  assert.match(body, /const detachNavGuard = armTrackerModalNavGuard\(\);/);
  assert.match(body, /UI\.modal\(t\('track\.outcome\.record', 'Record outcome'\), body, detachNavGuard\);/,
    'the detach must be UI.modal\'s third argument (fires on every dismissal path)');
});

test('legitimacyClass: caution verdicts tint warn even though they contain "proceed"', () => {
  const ctx = vm.createContext({});
  vm.runInContext(sliceFn(TRACKER, 'function legitimacyClass'), ctx);
  const cls = (s) => vm.runInContext(`legitimacyClass(${JSON.stringify(s)});`, ctx);
  assert.equal(cls('Proceed with Caution'), 'badge-warn', 'the CAR-22/M ordering bug: proceed-before-caution');
  assert.equal(cls('High'), 'badge-ok');
  assert.equal(cls('Verified'), 'badge-ok');
  assert.equal(cls('Medium'), 'badge-warn');
  assert.equal(cls('Suspicious — likely fake'), 'badge-bad');
  assert.equal(cls('Low'), 'badge-bad');
  assert.equal(cls(''), 'badge-info');
  assert.equal(cls(null), 'badge-info');
});

// ── withFocusPreserved ─────────────────────────────────────────────────────
// Minimal fake DOM surface: enough for the marker snapshot + re-find walk.

/** Extract just the function text so all three copies can be compared. */
const trackerFocusFn = sliceFn(TRACKER, 'function withFocusPreserved');

function focusableEl(tag, className, text) {
  const el = {
    tagName: tag, className, textContent: text,
    focused: false,
    focus() { this.focused = true; },
  };
  return el;
}
function fakeContainer(kids) {
  const focusableSel = /button|input|select|textarea|a\b/;
  const walk = (node, out) => {
    for (const k of (node.children || [])) {
      const isFocusable = focusableSel.test(k.tagName.toLowerCase())
        || (k.getAttribute && k.getAttribute('tabindex') === '0');
      const disabled = k.disabled === true;
      if (isFocusable && !disabled) out.push(k);
      walk(k, out);
    }
    return out;
  };
  return {
    children: kids,
    ownerDocument: { activeElement: null },
    contains(node) {
      const found = (n) => n === this || (this.children || []).some((c) => c === n || (
        c.children && (() => { const f = fakeContains(c, n); return f; })()));
      return found(node);
      function fakeContains(root, n) {
        for (const c of root.children || []) {
          if (c === n) return true;
          if (c.children && fakeContains(c, n)) return true;
        }
        return false;
      }
    },
    querySelectorAll() { return walk(this, []); },
  };
}

test('L-FOCUS behavioural: focus on a rebuilt paginator button is restored', () => {
  const ctx = vm.createContext({});
  vm.runInContext(trackerFocusFn, ctx);
  const run = vm.runInContext('(container, mutate) => withFocusPreserved(container, mutate)', ctx);

  const oldBtn = focusableEl('BUTTON', 'btn btn-ghost btn-sm pg-btn', '›');
  const container = fakeContainer([oldBtn]);
  container.ownerDocument.activeElement = oldBtn;

  let rebuilt;
  run(container, () => {
    rebuilt = focusableEl('BUTTON', 'btn btn-ghost btn-sm pg-btn', '›');
    container.children = [rebuilt]; // the rebuild replaced every node
  });

  assert.equal(rebuilt.focused, true, 'the equivalent rebuilt button must be refocused');
  assert.equal(oldBtn.focused, false, 'the destroyed node is never refocused');
});

test('L-FOCUS behavioural: focus outside the container is untouched; missing match is a no-op', () => {
  const ctx = vm.createContext({});
  vm.runInContext(trackerFocusFn, ctx);
  const run = vm.runInContext('(container, mutate) => withFocusPreserved(container, mutate)', ctx);

  const elsewhere = focusableEl('INPUT', 'input', '');
  const container = fakeContainer([focusableEl('BUTTON', 'btn pg-btn', '›')]);
  container.ownerDocument.activeElement = elsewhere; // e.g. the search box

  run(container, () => { container.children = []; });
  assert.equal(elsewhere.focused, false, 'must not steal focus from outside the rebuilt area');

  // Focus inside, but the control no longer exists after the rebuild.
  const gone = focusableEl('BUTTON', 'btn pg-btn', '‹');
  const c2 = fakeContainer([gone]);
  c2.ownerDocument.activeElement = gone;
  let threw = false;
  try { run(c2, () => { c2.children = []; }); } catch { threw = true; }
  assert.equal(threw, false, 'a missing match must be a silent no-op');
});

test('L-FOCUS wiring: all three views rebuild under focus preservation', () => {
  const read = (p) => readFileSync(resolve(__d, '..', 'public', 'js', 'views', p), 'utf8');
  const reports = read('reports.js');
  const stats = read('stats.js');

  // tracker.js: tbody + pgWrap rebuilds are wrapped.
  assert.match(TRACKER, /withFocusPreserved\(tbody, \(\) => \{[\s\S]*?tbody\.innerHTML = '';/);
  assert.match(TRACKER, /withFocusPreserved\(pgWrap, \(\) => \{[\s\S]*?pgWrap\.innerHTML = '';/);
  // reports.js: the page render is wrapped.
  assert.match(reports, /withFocusPreserved\(tbody, \(\) => \{[\s\S]*?page\.forEach\(\(rep\) => tbody\.appendChild\(makeRow\(rep\)\)\);/);
  assert.match(reports, /withFocusPreserved\(pgWrap, \(\) => \{[\s\S]*?pgWrap\.appendChild\(pager\.controls\(/);
  // stats.js: the re-attached metric/dimension selects are wrapped.
  assert.match(stats, /withFocusPreserved\(charts, \(\) => \{[\s\S]*?charts\.textContent = '';[\s\S]*?charts\.appendChild\(customChart\(\)\);/);

  // The three copies are textually identical — a drift guard (they may not
  // share a lib/ file in this change's file set, but they must not diverge).
  // Compared indentation-insensitively: tracker/stats carry the top-level
  // copy, reports.js nests its copy in the view closure.
  const fnOf = (src) => sliceFn(src, 'function withFocusPreserved')
    .split('\n').map((l) => l.trim()).join('\n');
  assert.equal(fnOf(TRACKER), fnOf(reports), 'tracker.js and reports.js copies must be identical');
  assert.equal(fnOf(TRACKER), fnOf(stats), 'tracker.js and stats.js copies must be identical');
});

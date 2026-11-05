/**
 * P3.3 (route-change overlay hygiene) — overlays that outlive their route.
 *
 * QA observed the two-pager "Preview & export" modal still hanging over a
 * DIFFERENT page after navigating away from #/two-pager (once, not
 * reproducible by clicks — but the class is real). The modal lives in the
 * top-level #modal element OUTSIDE #content: the router replaces the view
 * underneath it, and clicks hit the modal backdrop first (which is exactly
 * why a click-only repro fails), but browser back/forward, a programmatic
 * Router.go() from an async handler, or keyboard activation of a nav item
 * can change the route while the overlay is up — and nothing closed it.
 *
 * The fix is one centralized hook: the router keeps a route-change cleanup
 * registry (run on a ROUTE-NAME change only — the language-switch
 * same-route re-render must not slam dialogs shut, and the first paint has
 * nothing open), and api.js registers the shared overlay closer there.
 * UI.confirm and every UI.modal (two-pager Preview & export, AI fill, …)
 * render into the SAME #modal element, so one close covers them all.
 * Toasts are deliberately untouched — transient by design (auto-dismiss +
 * toast journal).
 *
 * Graceful contract: closing fires the modal's _onClose exactly once, which
 * resolves any pending UI.confirm Promise as `false` (cancelled) — awaited
 * handlers bail instead of hanging. Focus restoration into the view being
 * torn down is skipped on purpose; the router's own focusNewView owns focus
 * after the new view renders.
 *
 * Harness: no jsdom in the suite — api.js and router.js run unmodified
 * inside a node:vm realm against a minimal DOM stub (same pattern as
 * with-spinner-preserves-children / scan-results-state). The acceptance
 * test is red-first: against the pre-fix sources the modal survives the
 * navigation and the confirm promise never resolves (raced with a host
 * timer so the run FAILS instead of hanging).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_JS = resolve(ROOT, 'public', 'js', 'api.js');
const ROUTER_JS = resolve(ROOT, 'public', 'js', 'router.js');
const API_SRC = readFileSync(API_JS, 'utf8');
const ROUTER_SRC = readFileSync(ROUTER_JS, 'utf8');

// ───────────────────────── mini-DOM stub ─────────────────────────
// Only the surface api.js (UI.confirm/modal/toast) and router.js
// (render pipeline) actually touch.

function makeEl(tag) {
  const el = {
    tag,
    children: [],
    attrs: {},
    style: {},
    dataset: {},
    disabled: false,
    hidden: false,
    className: '',
    _toastLeave: null,
    firstElementChild: null,
    _listeners: {},
    classList: {
      contains: (c) => String(el.className).split(/\s+/).includes(c),
    },
    appendChild(ch) {
      if (ch == null || ch === false) return ch;
      el.children.push(ch);
      if (typeof ch === 'object') ch.parentNode = el;
      return ch;
    },
    addEventListener(type, fn) {
      (el._listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      const l = el._listeners[type] || [];
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    dispatch(type, ev = {}) {
      for (const fn of [...(el._listeners[type] || [])]) fn({ target: el, ...ev });
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    removeAttribute(k) { delete el.attrs[k]; },
    hasAttribute(k) { return k in el.attrs; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
    get textContent() {
      return el.children
        .map((n) => (typeof n === 'string' ? n : n.textContent ?? ''))
        .join('');
    },
    set textContent(v) { el.children = [{ textContent: v }]; },
    get innerHTML() { return el._html ?? ''; },
    set innerHTML(v) { el._html = String(v); el.children = []; },
  };
  return el;
}

function makeDocument() {
  const byId = new Map();
  const doc = {
    title: '',
    activeElement: null,
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, makeEl('div'));
      return byId.get(id);
    },
    createElement: (tag) => makeEl(tag),
    createTextNode: (t) => ({ textContent: t }),
    contains: () => false,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  };
  // Mirror the shipped index.html markup: the shared modal ships CLOSED
  // (<div id="modal" class="modal" hidden …>). Everything else starts bare.
  const modal = makeEl('div');
  modal.hidden = true;
  byId.set('modal', modal);
  return { doc, byId };
}

function makeWindow() {
  const listeners = {};
  return {
    location: { hash: '' },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      const l = listeners[type] || [];
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    dispatchHashchange() {
      for (const fn of [...(listeners.hashchange || [])]) fn();
    },
  };
}

/**
 * Boot api.js + router.js unmodified in one vm realm. The realm's
 * setTimeout/clearTimeout are no-ops: api.js's health-ping backoff loop
 * must never run inside a unit test (CI-isolation — no timers, no network).
 * Test-side waits use the HOST timers below instead.
 */
function bootRealm() {
  const win = makeWindow();
  const { doc, byId } = makeDocument();
  const ctx = createContext({
    window: win,
    document: doc,
    console,
    // router.render() checks `result instanceof Node` before string handling —
    // a dummy class keeps the check defined (and always false for strings).
    Node: class NodeStub {},
    // api.js never fires its health-ping loop (realm timers are no-ops below).
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  runInContext(API_SRC, ctx);
  // Browsers expose window properties as bare globals; the vm realm does not,
  // so alias the runtime-created globals the same way (router's error path
  // reads bare `UI.escapeHtml`, api.js reads bare `I18n` under guards).
  ctx.UI = ctx.window.UI;
  ctx.API = ctx.window.API;
  runInContext(ROUTER_SRC, ctx);
  return {
    win,
    ctx,
    byId,
    UI: win.UI,
    Router: win.Router,
    modal: () => byId.get('modal'),
    toast: () => byId.get('toast'),
    content: () => byId.get('content'),
  };
}

function registerTestRoutes(realm) {
  realm.Router.register('page-a', () => '<p data-a>page a</p>');
  realm.Router.register('page-b', () => '<p data-b>page b</p>');
}

/** Let the async render() finish (a couple of host macrotask turns). */
function settle() {
  return new Promise((r) => globalThis.setTimeout(r, 0));
}

async function navigate(realm, hash) {
  realm.win.location.hash = hash;
  realm.win.dispatchHashchange();
  await settle();
  await settle();
}

/** Resolves 'PENDING' after `ms` so an unresolved confirm FAILS the run instead of hanging it. */
function pending(ms = 300) {
  return new Promise((r) => globalThis.setTimeout(() => r('PENDING'), ms));
}

/** Depth-first walk of stub element children (for finding the confirm buttons). */
function walkButtons(node, out = []) {
  for (const ch of node.children || []) {
    if (typeof ch !== 'string' && ch.tag === 'button') out.push(ch);
    else if (typeof ch !== 'string') walkButtons(ch, out);
  }
  return out;
}

// ───────────── source-static drift guards (cheap pins) ─────────────

test('api.js exports closeOverlays alongside closeModal in the UI return object', () => {
  assert.match(API_SRC, /function\s+closeOverlays\s*\(/, 'the closer must exist');
  const ret = API_SRC.match(/return\s*\{[^}]*\bcloseModal\b[^}]*\}/);
  assert.ok(ret, 'UI return object not found');
  assert.match(ret[0], /\bcloseOverlays\b/, 'closeOverlays must be exported from UI');
});

test('router.js auto-registers the UI overlay closer and exports onRouteChange', () => {
  assert.match(ROUTER_SRC, /onRouteChange/, 'the registry must exist');
  assert.match(ROUTER_SRC, /closeOverlays/, 'router.js must auto-register UI.closeOverlays');
  const ret = ROUTER_SRC.match(/return\s*\{[^}]*\bonRouteChange\b[^}]*\}/);
  assert.ok(ret, 'onRouteChange must be exported from Router');
});

test('route-change hooks run BEFORE the router writes the new view into #content', () => {
  // Order matters: the overlay must be closed (and its confirm resolved)
  // before the view underneath it is replaced.
  const renderIdx = ROUTER_SRC.indexOf('async function render()');
  const hooksIdx = ROUTER_SRC.indexOf('if (routeChanged) runRouteChangeHooks();', renderIdx);
  const domIdx = ROUTER_SRC.indexOf("content.innerHTML = `<div class=\"loading\">", renderIdx);
  assert.ok(renderIdx !== -1 && hooksIdx !== -1 && domIdx !== -1, 'marker not found');
  assert.ok(hooksIdx < domIdx,
    'runRouteChangeHooks() must run before the first DOM write in render()');
});

// v1.268.1 SPA review — runRouteChangeHooks used to iterate the LIVE array.
// A hook that unsubscribes another hook mid-sweep (splice before the cursor)
// shifted the array under the for..of iterator and SKIPPED the next hook —
// e.g. the tracker menu slot disarming itself would skip the overlay closer
// registered after it. The sweep must iterate a snapshot.
test('runRouteChangeHooks iterates a snapshot, not the live array', () => {
  assert.match(ROUTER_SRC, /for \(const fn of \[\.\.\.routeChangeHooks\]\)/,
    'the sweep must iterate [...routeChangeHooks] — a hook may add/remove entries mid-sweep');
});

// ───────────── the acceptance test (red-first) ─────────────

test('RED-first: navigating away closes a mounted UI.confirm and resolves it false', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a');

  assert.equal(realm.modal().hidden, true, 'precondition: the modal starts closed');
  const p = realm.UI.confirm('Delete draft', 'This overwrites the saved two-pager.', { danger: true });
  assert.equal(realm.modal().hidden, false, 'confirm must mount the shared modal');

  await navigate(realm, '#/page-b');

  assert.equal(realm.modal().hidden, true,
    'navigation must close the overlay — it must not hang over the next page');
  const verdict = await Promise.race([p, pending()]);
  assert.equal(verdict, false,
    'the pending confirm must resolve false (cancelled) — awaited handlers must not hang');
  assert.ok(realm.content().innerHTML.includes('data-b'), 'the new view still rendered normally');
});

test('negative control: without the closer the confirm outlives the route (the reported bug class)', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a');
  const p = realm.UI.confirm('Delete draft', '…', { danger: true });
  assert.equal(realm.modal().hidden, false, 'precondition: confirm is mounted');

  // Simulate the pre-fix app: no overlay closer exists. The registered hook
  // becomes a contained no-op (its TypeError is swallowed by the registry).
  delete realm.UI.closeOverlays;

  await navigate(realm, '#/page-b');

  assert.equal(realm.modal().hidden, false,
    'regression shape: with no closer, the overlay survives the navigation');
  const verdict = await Promise.race([p, pending(150)]);
  assert.equal(verdict, 'PENDING',
    'the confirm promise is still unresolved — an awaited handler would hang');
});

test('route change also closes a plain UI.modal (the two-pager Preview & export shape)', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a');

  // The two-pager preview/export modal calls UI.modal(title, body) with NO
  // close hook — same shared #modal element, same bug class.
  const body = realm.UI.el('div', null, realm.UI.el('p', null, 'export actions here'));
  realm.UI.modal('Preview & export', body);
  assert.equal(realm.modal().hidden, false, 'precondition: preview modal is mounted');

  await navigate(realm, '#/page-b');
  assert.equal(realm.modal().hidden, true, 'the preview/export modal must close on navigation');
});

// ───────────── registry contract ─────────────

test('the registry fires on route-NAME change only (not first paint, not same-route re-render)', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  let runs = 0;
  realm.Router.onRouteChange(() => { runs += 1; });

  await navigate(realm, '#/page-a'); // first paint — nothing was open
  assert.equal(runs, 0, 'first paint must not run cleanup hooks');

  await realm.Router.render(); // same-route re-render (language-switch path)
  await settle();
  assert.equal(runs, 0, 'same-route re-render must not run cleanup hooks');

  await navigate(realm, '#/page-b');
  assert.equal(runs, 1, 'an actual route change runs the hooks exactly once');
});

test('unsubscribe detaches a cleanup hook', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  let runs = 0;
  const off = realm.Router.onRouteChange(() => { runs += 1; });
  off();
  await navigate(realm, '#/page-a'); // first paint
  await navigate(realm, '#/page-b');
  assert.equal(runs, 0, 'a detached hook must never fire');
  assert.doesNotThrow(() => off(), 'unsubscribe is idempotent');
});

test('a throwing cleanup hook cannot break navigation, and later hooks still run', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a'); // warm up past the first paint
  realm.Router.onRouteChange(() => { throw new Error('cleanup boom'); });
  let ran = false;
  realm.Router.onRouteChange(() => { ran = true; });

  await navigate(realm, '#/page-b');
  assert.equal(ran, true, 'hooks after the throwing one must still run');
  assert.ok(realm.content().innerHTML.includes('data-b'), 'the view still rendered');
});

test('a hook that detaches a LATER hook mid-sweep does not skip it (snapshot iteration)', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a'); // warm up past the first paint
  const ran = [];
  let offB;
  // Registration order = sweep order: the remover runs FIRST, the hook it
  // unsubscribes runs SECOND. With live-array iteration the splice shifts
  // the array under the cursor and B is skipped; with a snapshot B still
  // runs for this sweep (its removal takes effect from the NEXT sweep).
  realm.Router.onRouteChange(() => { ran.push('A'); offB(); });
  offB = realm.Router.onRouteChange(() => { ran.push('B'); });

  await navigate(realm, '#/page-b');
  assert.deepEqual(ran, ['A', 'B'],
    'a hook removed mid-sweep must still run for that sweep — the sweep iterates a snapshot');

  // And on the NEXT navigation the removal has taken effect.
  ran.length = 0;
  await navigate(realm, '#/page-a');
  assert.deepEqual(ran, ['A'], 'the detached hook stays detached for later sweeps');
});

test('onRouteChange ignores non-function registrations', () => {
  const realm = bootRealm();
  assert.doesNotThrow(() => {
    const off = realm.Router.onRouteChange('not a function');
    off();
  });
});

// ───────────── toasts are deliberately untouched ─────────────

test('toasts survive a navigation — the sweep closes overlays, not toasts', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a');

  realm.UI.toast('Two-pager saved', 'success');
  const before = realm.toast().className;
  assert.ok(before.includes('toast'), 'precondition: toast is visible');

  await navigate(realm, '#/page-b');
  assert.equal(realm.toast().className, before, 'the toast must be untouched by navigation');

  // And with no modal open, the closer itself is a no-op.
  assert.equal(realm.modal().hidden, true, 'no modal is open');
  assert.equal(realm.UI.closeOverlays(), false, 'closeOverlays returns false when nothing to close');
});

// ───────────── stub sanity: the confirm flow itself works ─────────────

test('sanity: confirm resolves true when the user clicks Confirm', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a');
  const p = realm.UI.confirm('Overwrite?', 'This replaces the saved file.', { danger: true });
  const buttons = walkButtons(realm.byId.get('modal-body'));
  assert.equal(buttons.length, 2, 'confirm renders Cancel + Confirm');
  const ok = buttons.find((b) => b.className.includes('btn-danger'));
  ok.dispatch('click');
  assert.equal(await p, true, 'Confirm click resolves true');
  assert.equal(realm.modal().hidden, true, 'the modal closed');
});

test('sanity: confirm resolves false when the user clicks Cancel', async () => {
  const realm = bootRealm();
  registerTestRoutes(realm);
  await navigate(realm, '#/page-a');
  const p = realm.UI.confirm('Overwrite?', 'This replaces the saved file.', { danger: true });
  const buttons = walkButtons(realm.byId.get('modal-body'));
  const cancel = buttons.find((b) => b.className.includes('btn-ghost'));
  cancel.dispatch('click');
  assert.equal(await p, false, 'Cancel click resolves false');
  assert.equal(realm.modal().hidden, true, 'the modal closed');
});

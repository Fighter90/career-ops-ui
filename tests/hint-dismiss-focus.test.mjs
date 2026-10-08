/**
 * CAR-18 / client-libs-1 [L] — popover dismissal must not steal focus.
 *
 * Pre-fix EVERY dismissal path refocused the trigger:
 *   • HelpHint.close() focused the `?` button even when the close came from
 *     outside click / scroll / resize — reading a page with an open hint
 *     yanked focus back to the header on every scroll;
 *   • DocsFab.close() focused the launcher even for outside clicks and the
 *     route-change auto-close.
 *
 * Contract under test: ONLY explicit dismissals (Escape key, the widget's own
 * ✕ / toggle button) return focus. Passive closes never move focus.
 *
 * Both libs are browser classic scripts → loaded with a minimal synthetic DOM
 * (same pattern as tests/countries.test.mjs); document/window listeners are
 * captured so tests can fire them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function mkEl(tag) {
  return {
    tagName: tag, children: [], className: '', style: {},
    hidden: false, innerHTML: '', textContent: '', value: '', id: '',
    parentNode: null,
    _focusCalls: 0,
    _handlers: {},
    focus() { this._focusCalls++; },
    setAttribute() {}, getAttribute: () => null,
    appendChild(ch) { this.children.push(ch); ch.parentNode = this; return ch; },
    removeChild(ch) { const i = this.children.indexOf(ch); if (i > -1) this.children.splice(i, 1); ch.parentNode = null; return ch; },
    contains: () => false,
    addEventListener(type, fn) { this._handlers[type] = fn; },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 10, right: 30, top: 10, bottom: 30 }),
    querySelector: () => null,
    querySelectorAll: () => [],
    scrollIntoView() {},
    click(ev) {
      const h = this._handlers.click;
      h && h(ev || { preventDefault() {}, stopPropagation() {} });
    },
  };
}

function makeEnv() {
  const docListeners = [];
  const winListeners = [];
  const doc = {
    body: mkEl('body'),
    documentElement: { getAttribute: () => null },
    title: '',
    hidden: false,
    readyState: 'complete',
    addEventListener(type, fn) { docListeners.push({ type, fn }); },
    removeEventListener() {},
    getElementById: () => null,
    createElement: (tag) => mkEl(tag),
  };
  const win = {
    innerWidth: 1200, innerHeight: 800,
    addEventListener(type, fn) { winListeners.push({ type, fn }); },
    removeEventListener() {},
  };
  return {
    doc, win, docListeners, winListeners,
    fireDoc(type, ev) {
      const h = docListeners.filter((l) => l.type === type).map((l) => l.fn);
      if (!h.length) throw new Error(`no document listener for ${type}`);
      h.forEach((fn) => fn(ev));
    },
    fireWin(type, ev) {
      const h = winListeners.filter((l) => l.type === type).map((l) => l.fn);
      if (!h.length) throw new Error(`no window listener for ${type}`);
      h.forEach((fn) => fn(ev));
    },
  };
}

const mkUI = () => ({
  el: (tag, attrs, children) => {
    const e = mkEl(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style') Object.assign(e.style, v);
      else e[k] = v;
    }
    const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
    for (const kid of kids) if (kid) e.children.push(kid);
    return e;
  },
  md: (s) => `<md>${s}</md>`,
  toast() {}, modal() {},
});

// ── HelpHint ─────────────────────────────────────────────────────────────

function loadHelpHint() {
  const env = makeEnv();
  const I18n = { t: (k, f) => (f === undefined ? k : f) };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'UI', 'I18n', readFileSync(resolve(ROOT, 'public/js/lib/help-hint.js'), 'utf8'))(
    env.win, env.doc, mkUI(), I18n,
  );
  return env;
}

const tick = () => new Promise((r) => setTimeout(r, 5)); // open() defers listener attach by a tick

test('HelpHint: Escape and toggle-click DO refocus; passive closes never do', async () => {
  const env = loadHelpHint();
  const btn = env.win.HelpHint.icon('help.scan');
  // 1. open → Escape → focus returns (explicit)
  btn.click();
  await tick();
  assert.equal(btn._focusCalls, 0, 'opening never moves focus');
  env.fireDoc('keydown', { key: 'Escape', stopPropagation() {} });
  assert.equal(btn._focusCalls, 1, 'Escape is an explicit dismissal → refocus');
  assert.ok(!env.doc.body.children.includes(btn), 'popover node removed (the button itself stays)');

  // 2. open → outside click → NO refocus (passive)
  btn.click();
  await tick();
  env.fireDoc('click', { target: mkEl('div') });
  assert.equal(btn._focusCalls, 1, 'outside click must not steal focus');

  // 3. open → scroll → NO refocus (passive); resize too
  btn.click();
  await tick();
  env.fireWin('scroll', {});
  assert.equal(btn._focusCalls, 1, 'scroll must not steal focus');
  btn.click();
  await tick();
  env.fireWin('resize', {});
  assert.equal(btn._focusCalls, 1, 'resize must not steal focus');

  // 4. open → toggle the same button → focus returns (explicit)
  btn.click();
  btn.click();
  assert.equal(btn._focusCalls, 2, 'toggle-click is an explicit dismissal → refocus');
});

// ── DocsFab ──────────────────────────────────────────────────────────────

function loadDocsFab() {
  const env = makeEnv();
  env.location = { hash: '#/dashboard' };
  const API = { post: async () => ({}) };
  const ui = mkUI();
  env.win.UI = ui; // build() guards on window.UI
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'location', 'UI', 'API', 'I18n', readFileSync(resolve(ROOT, 'public/js/lib/docs-fab.js'), 'utf8'))(
    env.win, env.doc, env.location, ui, API, { t: (k, f) => (f === undefined ? k : f) },
  );
  return env;
}

function findBtns(root, pred) {
  const hits = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (pred(n)) hits.push(n);
    for (const k of n.children || []) walk(k);
  }(root));
  return hits;
}

test('DocsFab: outside click and route-change close WITHOUT focusing the launcher', () => {
  const env = loadDocsFab();
  const launcher = findBtns(env.doc.body, (n) => n.id === 'docs-fab')[0];
  assert.ok(launcher, 'launcher mounted into body');
  launcher.click(); // open
  env.fireDoc('click', { target: mkEl('div') }); // click elsewhere
  assert.equal(launcher._focusCalls, 0, 'outside click must not steal focus');

  launcher.click(); // reopen
  env.location.hash = '#/docs-assistant'; // route change auto-close
  env.fireWin('hashchange', {});
  assert.equal(launcher._focusCalls, 0, 'route-change auto-close must not steal focus');
});

test('DocsFab: Escape and the ✕ close button DO refocus the launcher', () => {
  const env = loadDocsFab();
  const launcher = findBtns(env.doc.body, (n) => n.id === 'docs-fab')[0];
  launcher.click(); // open
  env.fireDoc('keydown', { key: 'Escape' });
  assert.equal(launcher._focusCalls, 1, 'Escape is explicit → refocus');

  launcher.click(); // reopen
  const closeBtn = findBtns(env.doc.body, (n) => n.className === 'docs-fab__close')[0];
  assert.ok(closeBtn, '✕ button exists');
  closeBtn.click();
  assert.equal(launcher._focusCalls, 2, '✕ click is explicit → refocus');
});

/**
 * prod-QA run 40602310441 (v1.261.0) — three client fixes, red→green gates.
 *
 * 1. #/two-pager TDZ (CAR-170, ×19 locales, route fully broken): tagEditor
 *    fires its onChange during CONSTRUCTION for every saved chip, and the
 *    construction loop sits lexically above `let previewTimer` — so any
 *    saved two-pager with a tag threw `ReferenceError: Cannot access
 *    'previewTimer' before initialization` from schedulePreviewRender and
 *    the route rendered no h1 at all. Gates: a behavioral render (the view
 *    module executed with stubbed DOM/API — populated tags must not throw)
 *    + the lexical-order contract that keeps the declaration above the
 *    first invocation.
 * 2. Ctrl/Cmd+K (CAR-172): both chord handlers live at document level
 *    (nav-v2 palette = the designed main entry, app.js legacy search-focus
 *    fallback) — never view-scoped — and must match `e.code === 'KeyK'`,
 *    not just `e.key`, so the chord works on a Russian (or any non-QWERTY)
 *    layout where Ctrl+K produces key='л' and code='KeyK'. Prod repro:
 *    a 'л'/KeyK synthetic chord opened nothing.
 * 3. #/docs-assistant +56px horizontal overflow at 390px (#546): .btn's
 *    `white-space: nowrap` + `flex-shrink: 0` made one long localized
 *    starter question ("How does the pipeline work? What happens to
 *    evaluated jobs?" — 418px wide) a non-shrinkable flex item inside the
 *    flex-wrap chip row. The rows are now `.docs-chip-row` and their
 *    buttons wrap (the CAR-146 pattern).
 *
 * CI-isolated: file reads + `new Function` module loads with stubbed
 * globals; no server, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

// ── 1. two-pager TDZ ─────────────────────────────────────────────────────

/** Minimal DOM double: enough surface for the two-pager route render. */
function el(tag, attrs, children) {
  const a = attrs || {};
  const node = {
    tagName: String(tag).toUpperCase(),
    className: typeof a.className === 'string' ? a.className : '',
    style: a.style || {},
    attrs: a,
    children: [],
    textContent: '',
    _listeners: {},
    appendChild(ch) { this.children.push(ch); return ch; },
    insertBefore(ch, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(ch); else this.children.splice(i, 0, ch);
      return ch;
    },
    replaceChildren(...kids) { this.children = kids.slice(); },
    removeChild(ch) { const i = this.children.indexOf(ch); if (i > -1) this.children.splice(i, 1); return ch; },
    remove() { /* detached stub */ },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    setAttribute(n, v) { this.attrs[n] = v; },
    getAttribute(n) { return (n in this.attrs) ? this.attrs[n] : null; },
    get firstChild() { return this.children[0] || null; },
    get lastChild() { return this.children[this.children.length - 1] || null; },
    querySelector(sel) {
      const cls = String(sel).replace(/^\./, '');
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (String(n.className || '').split(' ').includes(cls)) return n;
        if (n.children) stack.push(...n.children);
      }
      return null;
    },
    scrollIntoView() { /* stub */ },
  };
  if (Array.isArray(children)) children.forEach((k) => { if (k) node.appendChild(k); });
  else if (children != null) node.textContent = String(children);
  return node;
}

/** Load public/js/views/two-pager.js with stubbed globals; return the
 *  registered route handler. `twoPager` is what API.get resolves with. */
function loadTwoPagerRoute(twoPager) {
  const registered = {};
  const windowStub = {
    LlmPageKit: {
      layout({ form, result }) {
        const r = el('div');
        r.appendChild(form);
        r.appendChild(result);
        return { root: r, show() {} };
      },
      createRun() { return { mount() { return {}; } }; },
      run: async () => ({}),
      postJSON: async () => ({}),
    },
  };
  const uiStub = {
    el,
    md: (s) => '<md>' + s + '</md>',
    modal() {},
    toast() {},
    confirm: async () => false,
  };
  const apiStub = { get: (p) => (p === '/api/two-pager' ? Promise.resolve({ twoPager }) : Promise.resolve({})) };
  const src = read('public', 'js', 'views', 'two-pager.js');
  new Function('window', 'Router', 'API', 'UI', 'I18n', 'HelpHint', src)(
    windowStub,
    { register: (name, fn) => { registered[name] = fn; }, go() {} },
    apiStub,
    uiStub,
    { t: (k, f) => (f == null ? k : f) },
    { title: () => el('div') },
  );
  return registered['two-pager'];
}

test('prodqa 1: #/two-pager renders with a POPULATED saved two-pager (the TDZ trigger)', async () => {
  const handler = loadTwoPagerRoute({
    who_i_am: 'Senior backend engineer',
    loves: ['remote work', 'ownership'],
    must_haves: ['comp floor'],
    hates: ['endless meetings'],
    deal_breakers: [],
    non_negotiables: [],
    target_environment: 'Series A-B product company',
  });
  assert.equal(typeof handler, 'function', 'the view registered the two-pager route');
  let err = null;
  let root = null;
  try { root = await handler(); } catch (e) { err = e; }
  assert.ok(!err, `route render must not throw — got: ${err && err.constructor.name}: ${err && err.message}`);
  assert.ok(root, 'the handler returned the rendered root');
});

test('prodqa 1: previewTimer is declared lexically ABOVE its first invocation', () => {
  const src = read('public', 'js', 'views', 'two-pager.js');
  const declAt = src.indexOf('let previewTimer');
  const firstCallAt = src.indexOf('schedulePreviewRender()');
  assert.ok(declAt > -1, 'previewTimer is declared');
  assert.ok(firstCallAt > -1, 'schedulePreviewRender is invoked');
  assert.ok(declAt < firstCallAt,
    'the declaration must precede the first call: tagEditor fires onChange during ' +
    'construction (saved chips), and a hoisted function body still hits the let-TDZ');
});



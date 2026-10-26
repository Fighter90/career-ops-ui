/**
 * CAR-119 review round (PR #503 findings) — view-level fixes.
 *
 *   #1  memory.js destructures run()'s result AFTER the cancel guard
 *       (assign-then-guard-then-read); a cancelled run must not produce a
 *       phantom error toast.
 *   #2  every layout view hands createRun an onBegin that flips to the
 *       Result tab — the run panel must never paint into a hidden pane.
 *   #8  mode-page's jobPicker `fields` binding actually fills inputs
 *       (the reviewer's ReferenceError claim verified against the real kit).
 *   #9  mock-interview: a cancelled turn pops the pending candidate entry,
 *       removes its bubble, and restores the answer box.
 *   #10 two-pager: the live preview re-renders after an AI fill
 *       (programmatic .value fires no input event) and typing debounces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

// ── synthetic DOM (same shape as car119-llm-page-kit.test.mjs) ───────────

function makeEl(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], attrs: {}, style: {}, handlers: {}, parentNode: null,
    textContent: '', value: '', hidden: false, scrollTop: 0, scrollHeight: 0,
    className: '',
    appendChild(child) {
      if (typeof child === 'string') child = makeText(child);
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    replaceChildren(...kids) { node.children = []; for (const k of kids) node.appendChild(k); },
    removeChild(child) {
      const i = node.children.indexOf(child);
      if (i >= 0) node.children.splice(i, 1);
      child.parentNode = null;
    },
    remove() { if (node.parentNode) node.parentNode.removeChild(node); },
    get lastChild() { return node.children[node.children.length - 1] || null; },
    get firstChild() { return node.children[0] || null; },
    insertBefore(newNode, ref) {
      newNode.parentNode = node;
      if (ref == null) { node.children.push(newNode); return newNode; }
      const i = node.children.indexOf(ref);
      if (i >= 0) node.children.splice(i, 0, newNode); else node.children.push(newNode);
      return newNode;
    },
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute(k) { return (k in node.attrs) ? node.attrs[k] : null; },
    removeAttribute(k) { delete node.attrs[k]; },
    addEventListener(ev, fn) { (node.handlers[ev] ||= []).push(fn); },
    dispatch(ev, arg) { for (const fn of node.handlers[ev] || []) fn(arg || { currentTarget: node, preventDefault() {} }); },
    focus() { node.focused = true; },
    scrollIntoView() {},
    querySelectorAll(sel) {
      const out = [];
      // comma groups; each group may be a descendant chain ('.llm2pick input')
      const groups = String(sel).split(',').map((s) => s.trim()).filter(Boolean)
        .map((g) => g.split(/\s+/));
      const matchesSimple = (n, s) => {
        if (s.startsWith('.')) return (' ' + n.className + ' ').includes(' ' + s.slice(1) + ' ');
        if (s.startsWith('#')) return n.attrs && n.attrs.id === s.slice(1);
        if (s.startsWith('[')) {
          const m = s.slice(1, -1).split('=');
          if (m.length < 2) return n.attrs && m[0].trim() in (n.attrs || {});
          return String((n.attrs || {})[m[0].trim()]) === m[1].trim().replace(/^["']|["']$/g, '');
        }
        return n.tagName === s.toUpperCase();
      };
      const matchesChain = (n, chain) => {
        // the node matches the LAST part, an ancestor each earlier part
        if (!matchesSimple(n, chain[chain.length - 1])) return false;
        let i = chain.length - 2;
        let cur = n.parentNode;
        while (i >= 0 && cur) {
          if (matchesSimple(cur, chain[i])) i--;
          cur = cur.parentNode;
        }
        return i < 0;
      };
      const walk = (n) => {
        for (const c of n.children || []) {
          if (typeof c !== 'string' && groups.some((chain) => matchesChain(c, chain))) out.push(c);
          walk(c);
        }
      };
      walk(node);
      return out;
    },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
    append(...kids) { for (const k of kids) node.appendChild(k); },
    get classList() {
      return {
        toggle(cls, on) {
          const parts = new Set(node.className.split(' ').filter(Boolean));
          if (on === undefined) on = !parts.has(cls);
          if (on) parts.add(cls); else parts.delete(cls);
          node.className = Array.from(parts).join(' ');
        },
        add: (cls) => node.classList.toggle(cls, true),
        remove: (cls) => node.classList.toggle(cls, false),
        contains: (cls) => node.className.split(' ').includes(cls),
      };
    },
  };
  return node;
}
function makeText(s) { const n = makeEl('#text'); n.textContent = String(s); return n; }
function textOf(node) {
  if (!node) return '';
  if (node.tagName === '#TEXT') return String(node.textContent || '');
  return (node.children || []).map(textOf).join('');
}
/** A window stub with UI.el/I18n/Router capture + the REAL kit loaded. */
function makeHarness({ fetchImpl, api = {}, confirmAnswer = true } = {}) {
  const doc = { createElement: (t) => makeEl(t), createTextNode: (s) => makeText(s) };
  const w = {};
  const toasts = [];
  const routes = {};
  w.Router = { register: (k, fn) => { routes[k] = fn; }, go() {} };
  w.I18n = { t: (k, f) => (f ?? k), getLang: () => 'en' };
  w.UI = {
    el(tag, attrs, children) {
      const e = doc.createElement(tag);
      if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
          if (k === 'className') e.className = v;
          else if (k === 'style') Object.assign(e.style, v);
          else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
          else if (v !== false && v != null) e.setAttribute(k, v);
        }
      }
      if (children) for (const c of [].concat(children)) { if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }
      return e;
    },
    toast: (msg, kind) => toasts.push({ msg, kind }),
    confirm: async () => confirmAnswer,
    modal() {},
    pageMeta: (t, ...nodes) => w.UI.el('div', { className: 'page-meta' }, nodes.filter(Boolean)),
    providerCostHint: () => w.UI.el('span', null, ''),
    withSpinner: async (btn, fn) => fn(),
    escapeHtml: (s) => String(s),
    md: (s) => String(s || ''),
  };
  w.HelpHint = { title: (label) => w.UI.el('h1', { className: 'page-title' }, [label]) };
  w.API = {
    get: async () => ({}),
    post: async () => ({}),
    put: async () => ({}),
    del: async () => ({}),
    ...api,
  };
  w.ProviderStatus = { live: async () => ({ available: false, engine: '' }) };
  w.ReportExport = { actionsBar: () => w.UI.el('div', null, '') };
  // the REAL kit
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'UI', 'I18n',
    read('public/js/lib/llm-page-kit.js'))(
    w, doc, fetchImpl || (async () => ({ ok: true, status: 200, text: async () => '{}' })),
    // a faithful AbortController: abort() actually fires the signal listeners,
    // so postJSON's pending fetch rejects and the run settles (a no-op stub
    // left the run active forever and hung the file).
    class {
      constructor() {
        this._listeners = [];
        this.signal = { aborted: false, addEventListener: (_e, fn) => this._listeners.push(fn) };
      }
      abort() {
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        for (const fn of this._listeners) fn();
      }
    },
    // Inert timers: the kit's tick loop self-reschedules; a live timer here
    // would keep node --test's event loop open after the tests finish. No
    // test asserts ticking, so the handles are simply never created.
    () => 0, () => {}, w.UI, w.I18n,
  );
  return { w, doc, toasts, routes };
}

// ── #1 memory.js — a cancelled run must not phantom-toast ────────────────

test('CAR-119 #1: memory suggest on a cancelled run paints no phantom error toast', async () => {
  const { w, doc, toasts, routes } = makeHarness({
    api: { get: async (p) => (p === '/api/memory' ? { markdown: 'note' } : {}) },
  });
  // A kit stand-in whose run() resolves UNDEFINED — exactly what the real
  // kit returns when the run was cancelled mid-flight.
  w.LlmPageKit = {
    layout: ({ form, result }) => ({ root: w.UI.el('div', null, [form, result]), show() {} }),
    createRun: () => ({
      mount: (h) => h,
      signal: { aborted: true },
      cancelled: true,
      begin: () => true,
      log() {},
      finish() {},
      fail() {},
    }),
    run: async () => undefined, // cancelled mid-run
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Router', 'API', 'UI', 'I18n', 'HelpHint', read('public/js/views/memory.js'))(
    w, doc, w.Router, w.API, w.UI, w.I18n, w.HelpHint,
  );
  const root = await routes.memory();
  assert.ok(root, 'the view rendered');
  // Click every button (Save is harmless — its PUT succeeds via the stub;
  // Suggest is the one under test).
  const buttons = [];
  const walk = (n) => { for (const c of n.children || []) { if (c.tagName === 'BUTTON') buttons.push(c); walk(c); } };
  walk(root);
  assert.ok(buttons.length >= 2, 'save + suggest buttons rendered');
  for (const b of buttons) {
    for (const fn of b.handlers.click || []) await fn({ currentTarget: b });
  }
  const errorToasts = toasts.filter((t) => t.kind === 'error');
  assert.deepEqual(errorToasts, [],
    `a cancelled run must not produce an error toast (got: ${JSON.stringify(errorToasts)})`);
});

// ── #2 every layout view switches to the Result tab when a run begins ────

test('CAR-119 #2: every createRun in the 11 layout views carries onBegin → page.show(result)', () => {
  const views = ['deep.js', 'mode-page.js', 'networking.js', 'mock-interview.js', 'career-plan.js',
    'orientation.js', 'memory.js', 'docs-assistant.js', 'two-pager.js', 'funded.js', 'stats.js'];
  for (const f of views) {
    const src = read('public/js/views', f);
    const runs = (src.match(/LlmPageKit\.createRun\(/g) || []).length;
    const wired = (src.match(/onBegin: \(\) => \w+\.show\('result'\)/g) || []).length;
    assert.ok(runs >= 1, `${f} still creates runs`);
    assert.equal(wired, runs, `${f}: every createRun must carry onBegin → show('result')`);
  }
  // cv-studio has no layout — its hosts are always visible; assert the deliberate absence.
  const cvs = read('public/js/views', 'cv-studio.js');
  assert.equal((cvs.match(/LlmPageKit\.createRun\(/g) || []).length, 3);
});

// ── #8 mode-page jobPicker actually fills the mapped inputs ──────────────

test('CAR-119 #8: mode-page picker fills company/role inputs from a tracker pick (real kit)', async () => {
  const { w, doc, routes } = makeHarness({
    // jobPicker reads the tracker through API.get (one transport, the kit's);
    // everything else stays the default stub.
    api: {
      get: async (p) => (p === '/api/tracker'
        ? { rows: [{ company: 'Acme', role: 'Senior Engineer' }] }
        : {}),
    },
  });
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Router', 'API', 'UI', 'I18n', 'ProviderStatus', read('public/js/views/mode-page.js'))(
    w, doc, w.Router, w.API, w.UI, w.I18n, w.ProviderStatus,
  );
  assert.ok(routes.contacto, 'contacto registered');
  const root = await routes.contacto();
  // pick from the tracker combobox
  const pickInput = root.querySelector('.llm2pick input');
  assert.ok(pickInput, 'the picker renders for a company/role mode');
  await new Promise((r) => setTimeout(r, 10)); // background tracker load
  pickInput.value = 'Acme — Senior Engineer';
  pickInput.dispatch('change');
  const company = root.querySelector('#mode-contacto-company');
  const role = root.querySelector('#mode-contacto-role');
  assert.equal(company.value, 'Acme', 'the company input is filled');
  assert.equal(role.value, 'Senior Engineer', 'the role input is filled');
});

// ── #9 mock-interview cancelled turn restores the candidate answer ───────

test('CAR-119 #9: a cancelled turn pops the candidate entry, removes the bubble, restores the answer', async () => {
  const pending = (signal) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
  const { w, doc, routes } = makeHarness({
    fetchImpl: async (path, opts = {}) => {
      if (path === '/api/mock-interview/turn') return pending(opts.signal);
      return { ok: true, status: 200, text: async () => JSON.stringify(path === '/api/tracker' ? { rows: [] } : path === '/api/mock-interview/sessions' ? { sessions: [] } : {}) };
    },
  });
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Router', 'API', 'UI', 'I18n', 'HelpHint', read('public/js/views/mock-interview.js'))(
    w, doc, w.Router, w.API, w.UI, w.I18n, w.HelpHint,
  );
  const root = await routes['mock-interview']();
  // start with a role
  const roleInput = root.querySelectorAll('input')[0];
  roleInput.value = 'Senior Engineer';
  const startBtn = root.querySelectorAll('button').find((b) => textOf(b) === 'Start interview');
  await startBtn.handlers.click[0]();
  // type an answer and send — the answer box is the SECOND textarea (the
  // first is the hidden setup JD field, still first in document order)
  const answerBox = root.querySelectorAll('textarea')[1];
  assert.ok(answerBox, 'the answer box is mounted');
  answerBox.value = 'My answer about scaling';
  const sendBtn = root.querySelectorAll('button').find((b) => textOf(b) === 'Send answer');
  await sendBtn.handlers.click[0]();
  // the interview thread is the role=log that is NOT the kit's run log
  const thread = root.querySelectorAll('[role="log"]').filter((n) => !(' ' + n.className + ' ').includes(' llm2run__log '))[0];
  assert.ok(thread, 'the interview thread is mounted');
  assert.equal(thread.children.length, 1, 'the candidate bubble is in the thread');
  // cancel the running turn
  const cancelBtn = root.querySelector('.llm2run__cancel');
  assert.ok(cancelBtn, 'the run panel with Cancel is present');
  await cancelBtn.handlers.click[0]();
  await new Promise((r) => setTimeout(r, 10)); // abort → reject → view guard (microtask chain)
  assert.equal(thread.children.length, 0, 'the candidate bubble left the thread');
  assert.equal(answerBox.value, 'My answer about scaling', 'the answer is back in the box, ready to re-send');
});

// ── #10 two-pager live preview freshness ─────────────────────────────────

test('CAR-119 #10: two-pager re-renders the preview after an AI fill and debounces typing', () => {
  const src = read('public/js/views', 'two-pager.js');
  assert.match(src, /applyFields\(res\.fields\);\s*\n\s*renderLivePreview\(\);/,
    'the AI-fill path re-renders the live preview (programmatic .value fires no input event)');
  assert.match(src, /previewTimer = setTimeout\(renderLivePreview, 150\);/,
    'typing debounces the preview render at ~150 ms');
  assert.match(src, /if \(previewTimer\) clearTimeout\(previewTimer\);/,
    'the debounce cancels the pending render');
});

/**
 * CAR-119 — llm-page-kit.js unit tests (pure parts + DOM behaviour in a
 * synthetic browser, the same pattern as car130-form-errors.test.mjs).
 *
 * Covered:
 *   • formatDuration / dedupTrackerRows (pure)
 *   • layout(): two-pane structure + mobile tab toggle (aria-selected/hidden)
 *   • createRun(): synchronous first paint (the ≤300 ms criterion — no timer
 *     or await precedes the panel existing in the DOM), stages, log
 *     (role=log aria-live=polite), finish/fail/cancel states, single panel
 *   • postJSON(): API.call-compatible error shaping + abort classification
 *   • run(): begin→request→finish wiring; abort resolves silent
 *   • jobPicker(): tracker dedup + field fill on pick
 *   • historyDrawer(): cards, confirm-gated delete, failure surface
 *   • no auto-start: the kit reads no URL/hash and only fetches inside an
 *     explicit user action (the v1.248.2 paid-run bug class).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_SRC = readFileSync(resolve(ROOT, 'public/js/lib/llm-page-kit.js'), 'utf8');

// ── synthetic DOM ─────────────────────────────────────────────────────────

function makeEl(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    attrs: {},
    style: {},
    handlers: {},
    parentNode: null,
    textContent: '',
    value: '',
    hidden: false,
    scrollTop: 0,
    scrollHeight: 0,
    className: '',
    appendChild(child) {
      if (typeof child === 'string') child = makeText(child);
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    replaceChildren(...kids) {
      node.children = [];
      for (const k of kids) node.appendChild(k);
    },
    removeChild(child) {
      const i = node.children.indexOf(child);
      if (i >= 0) node.children.splice(i, 1);
      child.parentNode = null;
    },
    remove() { if (node.parentNode) node.parentNode.removeChild(node); },
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute(k) { return (k in node.attrs) ? node.attrs[k] : null; },
    removeAttribute(k) { delete node.attrs[k]; },
    addEventListener(ev, fn) { (node.handlers[ev] ||= []).push(fn); },
    dispatch(ev, arg) { for (const fn of node.handlers[ev] || []) fn(arg || { currentTarget: node }); },
    focus() { node.focused = true; },
    querySelectorAll(sel) {
      const out = [];
      const sels = String(sel).split(',').map((s) => s.trim()).filter(Boolean);
      const matches = (n, s) => {
        if (s.startsWith('.')) return (' ' + n.className + ' ').includes(' ' + s.slice(1) + ' ');
        if (s.startsWith('#')) return n.attrs && n.attrs.id === s.slice(1);
        return n.tagName === s.toUpperCase();
      };
      const walk = (n) => {
        for (const c of n.children || []) {
          if (typeof c !== 'string' && sels.some((s) => matches(c, s))) out.push(c);
          walk(c);
        }
      };
      walk(node);
      return out;
    },
    append(...kids) { for (const k of kids) node.appendChild(k); },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
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

/** Recursive text of a stub subtree (text nodes concatenated). */
function textOf(node) {
  if (!node) return '';
  if (node.tagName === '#TEXT') return String(node.textContent || '');
  return (node.children || []).map(textOf).join('');
}

const doc = {
  createElement: (tag) => makeEl(tag),
  createTextNode: (s) => makeText(s),
  body: makeEl('body'),
};

function loadKit({ fetchImpl = async () => ({ ok: true, status: 200, text: async () => '{}' }) } = {}) {
  const w = {};
  w.API = {
    get: async () => ({}),
    post: async () => ({}),
  };
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
    toast() {},
    confirm: async () => true,
  };
  w.I18n = { t: (k, f) => f ?? k, getLang: () => 'en' };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'UI', 'I18n', KIT_SRC)(
    w, doc, fetchImpl,
    class { constructor() { this.signal = { aborted: false }; const listeners = []; this.abort = () => { this.signal.aborted = true; for (const fn of listeners) fn(); }; this.addEventListener = (_e, fn) => listeners.push(fn); } },
    () => 0, () => {}, w.UI, w.I18n,
  );
  return w;
}

// ── pure helpers ──────────────────────────────────────────────────────────

test('CAR-119: formatDuration humanizes seconds', () => {
  const { LlmPageKit } = loadKit();
  assert.equal(LlmPageKit.formatDuration(0), '0s');
  assert.equal(LlmPageKit.formatDuration(42), '42s');
  assert.equal(LlmPageKit.formatDuration(75), '1m 15s');
  assert.equal(LlmPageKit.formatDuration(-5), '0s');
  assert.equal(LlmPageKit.formatDuration('junk'), '0s');
});

test('CAR-119: dedupTrackerRows folds case-insensitive company+role, newest wins, blanks skipped', () => {
  const { LlmPageKit } = loadKit();
  const rows = [
    { company: 'Acme', role: 'Senior Engineer' },
    { company: 'acme', role: 'senior engineer' }, // dup, older
    { company: 'Globex', role: '' },
    { company: '', role: '' },        // blank → skipped
    null,                              // junk → skipped
    { company: 'Acme', role: 'Platform Engineer' }, // distinct role → kept
  ];
  const out = LlmPageKit.dedupTrackerRows(rows);
  assert.deepEqual(out, [
    { company: 'Acme', role: 'Senior Engineer' },
    { company: 'Globex', role: '' },
    { company: 'Acme', role: 'Platform Engineer' },
  ]);
  assert.deepEqual(LlmPageKit.dedupTrackerRows(undefined), []);
  assert.deepEqual(LlmPageKit.dedupTrackerRows('nope'), []);
});

// ── layout ────────────────────────────────────────────────────────────────

test('CAR-119: layout builds a tablist + two labelled panes; show() switches the mobile tab state', () => {
  const { LlmPageKit } = loadKit();
  const form = doc.createElement('div');
  const result = doc.createElement('div');
  const { root, show } = LlmPageKit.layout({ form, result });
  const tabs = root.querySelectorAll('.llm2__tab');
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].getAttribute('role'), 'tab');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  const panes = root.querySelectorAll('.llm2__form, .llm2__result');
  assert.equal(panes.length, 2);
  assert.equal(panes[0].children[0], form, 'the form node mounts into the form pane');
  assert.equal(panes[1].children[0], result, 'the result node mounts into the result pane');

  show('result');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'false');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(root.querySelectorAll('.llm2__form')[0].hidden, true);
  assert.equal(root.querySelectorAll('.llm2__result')[0].hidden, false);
  show('form');
  assert.equal(root.querySelectorAll('.llm2__form')[0].hidden, false);
  assert.equal(root.querySelectorAll('.llm2__result')[0].hidden, true);
});

// ── run controller ────────────────────────────────────────────────────────

test('CAR-119: createRun paints the panel SYNCHRONOUSLY on begin (≤300 ms), with log a11y + focus', () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({ stages: ['Send', 'Analyze'], etaSeconds: 40 }).mount(host);
  assert.equal(ctrl.active, false);
  assert.equal(host.children.length, 0);
  const ok = ctrl.begin(); // no await, no timer — first paint is synchronous
  assert.equal(ok, true);
  assert.equal(ctrl.active, true);
  assert.equal(host.children.length, 1, 'the progress panel exists immediately after begin()');
  const panel = host.children[0];
  assert.ok(panel.className.includes('llm2run'));
  const log = panel.querySelector('.llm2run__log');
  assert.equal(log.getAttribute('role'), 'log');
  assert.equal(log.getAttribute('aria-live'), 'polite');
  assert.equal(log.focused, true, 'focus moves to the run log on start');
  assert.ok(panel.querySelector('.llm2run__cancel'), 'a cancel control is present');
  const stages = panel.querySelectorAll('.llm2run__stage');
  assert.equal(stages.length, 2);
  assert.ok(stages[0].className.includes('is-active'));

  ctrl.stage(1);
  assert.ok(stages[0].className.includes('is-done'));
  assert.ok(stages[1].className.includes('is-active'));

  ctrl.log('sent');
  assert.equal(log.children.length, 1);
  ctrl.finish();
  assert.equal(ctrl.active, false);
  assert.equal(host.children.length, 0, 'finish tears the panel down');
});

test('CAR-119: a second begin() while active is refused (one panel per view)', () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  assert.equal(ctrl.begin(), true);
  assert.equal(ctrl.begin(), false, 'refused while the run is active');
  assert.equal(host.children.length, 1, 'no second panel was painted');
});

test('CAR-119: cancel aborts the signal and paints the honest cancelled state; a later fail paints nothing', () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  ctrl.begin();
  ctrl.cancel();
  assert.equal(ctrl.cancelled, true);
  assert.equal(ctrl.signal.aborted, true);
  assert.equal(ctrl.active, false);
  assert.equal(host.children.length, 1);
  assert.ok(host.children[0].className.includes('llm2run--cancelled'));
  ctrl.fail(new Error('late failure'));
  assert.equal(host.children.length, 1, 'no phantom error painted over the cancelled state');
});

test('CAR-119: fail paints an error panel with the server message (real text assertion)', () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  ctrl.begin();
  ctrl.fail(new Error('boom'));
  assert.equal(ctrl.active, false);
  assert.equal(host.children.length, 1);
  assert.ok(host.children[0].className.includes('llm2run--fail'));
  assert.ok(textOf(host.children[0]).includes('boom'), 'the server message reaches the panel text');
});

test('CAR-119: fail with paint=false leaves the announcement to the view (no double role=alert)', () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  ctrl.begin();
  ctrl.fail(new Error('view announces this'), false);
  assert.equal(ctrl.active, false);
  assert.equal(host.children.length, 0, 'the kit painted nothing');
});

// ── review #4 — states never pile up in one host ─────────────────────────

test('CAR-119: a new run on the same host replaces the stale cancelled panel (fresh controller per click)', () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const first = LlmPageKit.createRun({}).mount(host);
  first.begin();
  first.cancel(); // cancelled panel painted into host
  assert.equal(host.children.length, 1);
  // The view creates a FRESH controller per click — that new run must
  // REPLACE the stale state panel, not stack below it.
  const second = LlmPageKit.createRun({}).mount(host);
  assert.equal(second.begin(), true, 'a fresh controller begins normally after another was cancelled');
  assert.equal(host.children.length, 1, 'begin() cleared the stale panel');
  assert.ok(!host.children[0].className.includes('--cancelled'), 'the live panel replaced the stale one');
});

// ── transport ─────────────────────────────────────────────────────────────

function makeSignal(aborted = false) { return { aborted }; }

test('CAR-119: postJSON augments lang, parses JSON, and shapes non-OK errors like API.call', async () => {
  let seen = null;
  const { LlmPageKit } = loadKit({
    fetchImpl: async (path, opts) => {
      seen = { path, opts };
      return { ok: false, status: 400, statusText: 'Bad Request', text: async () => JSON.stringify({ error: 'validation failed', details: ['company: required'] }) };
    },
  });
  await assert.rejects(
    () => LlmPageKit.postJSON('/api/deep', { company: 'x' }, makeSignal()),
    (e) => e.message.includes('validation failed — company: required (POST /api/deep · HTTP 400)'),
  );
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.headers['Accept-Language'], 'en');
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.lang, 'en', 'the lang is auto-attached like API.post');
});

test('CAR-119: postJSON classifies an abort (e.aborted) and never reports it as a network error', async () => {
  const { LlmPageKit } = loadKit({
    fetchImpl: async (_p, opts) => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      // real fetch rejects from inside the call — signal already aborted
      if (opts.signal && opts.signal.aborted) throw err;
      return { ok: true, status: 200, text: async () => '{}' };
    },
  });
  await assert.rejects(
    () => LlmPageKit.postJSON('/api/deep', {}, makeSignal(true)),
    (e) => e.aborted === true && !e.network,
  );
});

// ── run() wiring ──────────────────────────────────────────────────────────

test('CAR-119: run() begins, passes the signal to request, finishes, and calls onDone', async () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  let seenSignal = null;
  const res = await LlmPageKit.run({
    run: ctrl,
    request: async (signal) => { seenSignal = signal; return { markdown: '# ok' }; },
    onDone: (r) => { seenSignal.res = r; },
  });
  assert.equal(res.markdown, '# ok');
  assert.equal(seenSignal, ctrl.signal, 'the request received the controller signal');
  assert.equal(seenSignal.res.markdown, '# ok');
  assert.equal(ctrl.active, false);
  assert.equal(host.children.length, 0);
});

test('CAR-119: run() on a rejected request paints the failure and rethrows for the view', async () => {
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  await assert.rejects(
    () => LlmPageKit.run({ run: ctrl, request: async () => { throw new Error('nope'); } }),
    /nope/,
  );
  assert.ok(host.children[0].className.includes('llm2run--fail'));
});

test('CAR-119: begin() after cancel REFUSES — the spent controller never fires a silent request', async () => {
  // Review #5/#6 — a cancelled controller is spent: re-beginning it used to
  // "succeed" and fire a fetch on an aborted signal, which aborted silently
  // and made the run vanish. The refusal is observable: the request spy is
  // never called and the host keeps exactly the one cancelled panel.
  const { LlmPageKit } = loadKit();
  const host = doc.createElement('div');
  const ctrl = LlmPageKit.createRun({}).mount(host);
  ctrl.begin();
  ctrl.cancel();
  let calls = 0;
  const out = await LlmPageKit.run({ run: ctrl, request: async () => { calls++; return {}; } });
  assert.equal(out, undefined);
  assert.equal(calls, 0, 'the request spy was never called');
  assert.equal(host.children.length, 1, 'exactly the cancelled panel remains');
  assert.ok(host.children[0].className.includes('llm2run--cancelled'));
});

// ── review #2 — begin() reveals the result pane via onBegin ──────────────

test('CAR-119: onBegin fires before the panel paints so the view can show the result tab', () => {
  const { LlmPageKit } = loadKit();
  const form = doc.createElement('div');
  const result = doc.createElement('div');
  const page = LlmPageKit.layout({ form, result });
  // Below 1280 px the layout starts on the Input tab: the result pane is
  // hidden until a run begins.
  assert.equal(page.resultPane.hidden, true, 'initial state hides the result pane (mobile tab start)');

  const host = doc.createElement('div');
  page.resultPane.appendChild(host);
  const order = [];
  const ctrl = LlmPageKit.createRun({
    onBegin: () => { order.push('onBegin'); page.show('result'); },
  }).mount(host);
  const painted = [];
  const origAppend = host.appendChild.bind(host);
  host.appendChild = (n) => { painted.push('paint'); return origAppend(n); };
  ctrl.begin();
  assert.deepEqual(order, ['onBegin'], 'onBegin ran');
  assert.equal(page.resultPane.hidden, false, 'the result pane is VISIBLE when the run panel paints');
  assert.equal(painted.length, 1, 'the panel painted into the (now visible) pane');
});

// ── job picker ────────────────────────────────────────────────────────────

test('CAR-119: jobPicker fills mapped fields from a tracker pick and hides itself with no rows', async () => {
  const w = loadKit();
  const rows = [
    { company: 'Acme', role: 'Senior Engineer' },
    { company: 'acme', role: 'senior engineer' },
    { company: 'Globex', role: '' },
  ];
  w.API.get = async (p) => {
    assert.equal(p, '/api/tracker');
    return { rows };
  };
  const company = doc.createElement('input');
  const role = doc.createElement('input');
  const pick = w.LlmPageKit.jobPicker({ map: { company: 'company', role: 'role' }, fields: { company, role } });
  await new Promise((r) => setTimeout(r, 0)); // background load
  const datalist = pick.querySelectorAll('datalist')[0];
  assert.equal(datalist.children.length, 2, 'case-duplicate tracker rows collapse to one option');

  pick.querySelector('input').value = 'Acme — Senior Engineer';
  pick.querySelector('input').dispatch('change');
  assert.equal(company.value, 'Acme');
  assert.equal(role.value, 'Senior Engineer');

  // company-only match still fills
  pick.querySelector('input').value = 'globex';
  pick.querySelector('input').dispatch('change');
  assert.equal(company.value, 'Globex');

  // no rows at all → honest note instead of an empty picker
  w.API.get = async () => ({ rows: [] });
  const empty = w.LlmPageKit.jobPicker({ map: {}, fields: {} });
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(empty.querySelector('.llm2pick__empty'), 'an empty tracker renders the honest note');
});

// ── history drawer ────────────────────────────────────────────────────────

test('CAR-119: historyDrawer renders cards and gates delete behind confirm; failure surfaces as alert', async () => {
  const w = loadKit();
  let confirmAnswer = true;
  w.UI.confirm = async () => confirmAnswer;
  const toasts = [];
  w.UI.toast = (msg) => toasts.push(msg);

  let deleted = [];
  const entries = [{ name: 'session-1.md', mtime: Date.now() }, { name: 'session-2.md' }];
  const drawer = w.LlmPageKit.historyDrawer({
    load: async () => entries.filter((s) => !deleted.includes(s.name)),
    onDelete: async (s) => { deleted.push(s.name); },
  });
  await new Promise((r) => setTimeout(r, 0));
  let cards = drawer.el.querySelectorAll('.llm2hist__card');
  assert.equal(cards.length, 2);

  // confirm=false → no delete (the delete button is the last control on the card)
  confirmAnswer = false;
  const btns = cards[0].querySelectorAll('button');
  const delBtn = btns[btns.length - 1];
  await delBtn.handlers.click[0]();
  assert.deepEqual(deleted, []);

  // confirm=true → delete + refresh
  confirmAnswer = true;
  await cards[0].querySelectorAll('button').at(-1).handlers.click[0]();
  assert.deepEqual(deleted, ['session-1.md']);
  cards = drawer.el.querySelectorAll('.llm2hist__card');
  assert.equal(cards.length, 1, 'the drawer refreshed after the delete');

  // load failure → role=alert, not a fake empty state
  const failing = w.LlmPageKit.historyDrawer({
    load: async () => { throw new Error('disk full'); },
  });
  await new Promise((r) => setTimeout(r, 0));
  const alert = failing.el.querySelector('.llm2hist__empty');
  assert.equal(alert.getAttribute('role'), 'alert');
  assert.ok(alert.children[0].textContent.includes('disk full'));

  // empty list → honest empty note
  const empty = w.LlmPageKit.historyDrawer({ load: async () => [] });
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(empty.el.querySelector('.llm2hist__empty'));
});

// ── the auto-start guard (v1.248.2 bug class) ─────────────────────────────

test('CAR-119: the kit never auto-starts — no URL/hash reads, fetch only inside postJSON, no Router', () => {
  assert.doesNotMatch(KIT_SRC, /location\.hash/);
  assert.doesNotMatch(KIT_SRC, /URLSearchParams/);
  assert.doesNotMatch(KIT_SRC, /\bRouter\b/);
  assert.doesNotMatch(KIT_SRC, /DOMContentLoaded/);
  // fetch is referenced only inside the postJSON transport — a load-time or
  // constructor-time request is impossible.
  const fetchUses = KIT_SRC.match(/\bfetch\(/g) || [];
  assert.equal(fetchUses.length, 1, 'exactly one fetch call site (postJSON)');
  const postJSON = KIT_SRC.slice(KIT_SRC.indexOf('async function postJSON'), KIT_SRC.indexOf('── two-column'));
  assert.ok(postJSON.includes('fetch('), 'that call site lives in postJSON');
});

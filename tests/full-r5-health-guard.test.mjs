/**
 * FULL-R5 (review 1) — the #/health malformed-payload guard is dead code.
 *
 * Pre-fix the view built a `body[]` array holding the role="alert"
 * «Health data is unavailable or malformed» state (the CAR-121 "never read
 * as all-clear" contract) but RETURNED a hand-duplicated tree that ignored
 * `checksOk` — so a broken /api/health payload rendered empty card rows
 * with no alert, and the duplicated summary/required-list/<details> blocks
 * could drift from the guarded ones.
 *
 * Contract under test (behavioural, synthetic DOM — same pattern as
 * tests/auto-pipeline-stream-flush.test.mjs):
 *   1. malformed payload (no `checks` array)  → role=alert visible, NO green
 *      summary, NO duplicated <details> outside the guarded branch;
 *   2. well-formed, all required pass         → green summary, no alert;
 *   3. well-formed, a required check failing  → no green summary, failing
 *      row carries badge-bad.
 *
 * health.js is a browser classic script → loaded with a synthetic UI. No
 * network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public/js/views/health.js'), 'utf8');

function mkEl(tag) {
  return {
    tagName: tag,
    children: [],
    attrs: {},
    className: '',
    style: {},
    value: '',
    hidden: false,
    disabled: false,
    innerHTML: '',
    textContent: '',
    _handlers: {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener(type, fn) { this._handlers[type] = fn; },
    setAttribute(k, v) { this.attrs[k] = v; },
    click() { this._handlers.click && this._handlers.click({ currentTarget: this, preventDefault() {} }); },
  };
}

async function renderHealth(payload) {
  const created = [];
  const el = (tag, attrs, children) => {
    const e = mkEl(tag);
    created.push(e);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'className') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const kid of [].concat(children == null ? [] : children)) {
      if (kid == null || kid === false) continue;
      e.children.push(kid);
    }
    return e;
  };
  const w = {
    Router: { register(name, fn) { w.handler = fn; } },
    API: {
      get: async (p) => (p === '/api/health' ? payload : { activeProvider: 'anthropic', activeModel: 'claude-test' }),
    },
    UI: {
      el,
      toast() {}, dismissToast() {},
      modal() { return { close() {} }; },
      withSpinner: async (btn, fn) => fn(),
    },
    I18n: { t: (k, f) => (f === undefined ? k : f) },
  };
  // CAR-137 — the health H1 is built via HelpHint.title(); inert stand-in.
  w.HelpHint = {
    title: (text) => w.UI.el('h1', { className: 'page-title' }, [w.UI.el('span', null, text)]),
    icon: () => w.UI.el('button', { className: 'help-hint', type: 'button' }, '?'),
    close() {},
  };
  // eslint-disable-next-line no-new-func
  new Function('Router', 'API', 'UI', 'I18n', 'HelpHint', 'document', SRC)(
    w.Router, w.API, w.UI, w.I18n, w.HelpHint,
    { getElementById: () => null, head: { appendChild() {} } },
  );
  assert.ok(w.handler, 'health.js must register the health route');
  return { root: await w.handler(), created };
}

function walk(node, acc = []) {
  if (node == null) return acc;
  acc.push(node);
  for (const k of node.children || []) walk(k, acc);
  return acc;
}

function findBy(nodes, pred) { return nodes.filter(pred); }

test('FULL-R5: a malformed /api/health payload renders the role=alert error state — never empty cards, never green', async () => {
  const { root } = await renderHealth({ version: '9.9.9' }); // no checks array
  const nodes = walk(root);
  const alerts = findBy(nodes, (n) => n.attrs && n.attrs.role === 'alert');
  assert.ok(alerts.length === 1, `expected exactly one role=alert node, got ${alerts.length}`);
  assert.match(
    alerts[0].children.map((c) => (typeof c === 'string' ? c : '')).join(' '),
    /unavailable or malformed/,
    'the alert must carry the malformed-data message',
  );
  const green = findBy(nodes, (n) => String(n.className || '').includes('v2-portals-health-ok'));
  assert.equal(green.length, 0, 'a malformed payload must never render the green all-clear summary');
  // The required/optional rows come from data.checks — malformed means none.
  const rows = findBy(nodes, (n) => n.tagName === 'li');
  assert.equal(rows.length, 0, 'no check rows can exist without a checks array');
});

test('FULL-R5: the guarded tree is the ONLY tree — no hand-duplicated summary/details block outside it', () => {
  // The dead-code shape: two separate renderings of the same summary +
  // required list + <details> (one into body[], one inline in the return).
  const returns = [...SRC.matchAll(/return c\('div', null, \[/g)].length;
  assert.ok(returns <= 1, 'health.js must have a single return tree (the guarded body)');
  // The inline duplicate carried its own copy of each block; after the fix
  // those appear exactly once (inside the body[] build).
  for (const marker of ['v2-portals-health-ok', "c('details'", "requiredChecks.map(checkRow)"]) {
    const count = SRC.split(marker).length - 1;
    assert.ok(count === 1, `"${marker}" must appear exactly once (got ${count}) — the duplicated tree is back`);
  }
});

test('FULL-R5: a well-formed payload with all required checks passing renders the green summary, no alert', async () => {
  const { root } = await renderHealth({
    version: '9.9.9',
    checks: [
      { name: 'Server', ok: true },
      { name: 'PROFILE CUSTOMIZED', ok: true },
      { name: 'ANTHROPIC_API_KEY', ok: true, required: false },
    ],
  });
  const nodes = walk(root);
  assert.equal(findBy(nodes, (n) => n.attrs && n.attrs.role === 'alert').length, 0);
  const green = findBy(nodes, (n) => String(n.className || '').includes('v2-portals-health-ok'));
  assert.equal(green.length, 1, 'all-required-pass must render the green summary');
  const details = findBy(nodes, (n) => n.tagName === 'details');
  assert.equal(details.length, 1, 'optional checks collapse into exactly one <details>');
  const rows = findBy(nodes, (n) => n.tagName === 'li');
  assert.equal(rows.length, 3, 'every check renders exactly one row');
});

test('FULL-R5: a failing required check suppresses the green summary and paints badge-bad', async () => {
  const { root } = await renderHealth({
    version: '9.9.9',
    checks: [
      { name: 'Server', ok: true },
      { name: 'cv.md', ok: false },
      { name: 'GEMINI_API_KEY', ok: false, required: false },
    ],
  });
  const nodes = walk(root);
  assert.equal(findBy(nodes, (n) => n.attrs && n.attrs.role === 'alert').length, 0);
  assert.equal(findBy(nodes, (n) => String(n.className || '').includes('v2-portals-health-ok')).length, 0,
    'a failing required check must suppress the green summary');
  const badges = findBy(nodes, (n) => String(n.className || '').includes('badge-bad'));
  assert.equal(badges.length, 1, 'exactly one required failure is painted bad');
});

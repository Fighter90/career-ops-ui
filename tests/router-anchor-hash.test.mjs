/**
 * CAR-18 / client-libs-1 [H] — router must not slice non-'#/' hashes.
 *
 * Pre-fix `current()` did `window.location.hash.slice(2)`, which assumes the
 * hash starts with '#/':
 *   • the skip link's `#content` anchor → hashchange → `slice(2)` slices INTO
 *     the token and manufactures the phantom route `ontent` → 404 view wipes
 *     the page the user is reading;
 *   • `#/?x=1` → after the query strip nothing remains → empty route name → 404.
 *
 * Contract under test:
 *   1. Only '#/…' hashes are SPA routes; anything else ('', '#', '#content')
 *      resolves to the default view name ('dashboard'), never a mangled token.
 *   2. The '?query' is stripped BEFORE the default decision, so '#/?x=1' is
 *      the dashboard, not the 404 view (v1.28.1 behaviour preserved for
 *      '#/evaluate?url=…' and '#/config?tab=modes').
 *   3. render() does NOT re-render on a bare in-page anchor — the skip link
 *      must scroll natively without wiping the current view.
 *
 * router.js is a browser classic script → loaded in a synthetic window
 * (same pattern as tests/countries.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTER_SRC = readFileSync(resolve(ROOT, 'public/js/router.js'), 'utf8');

function fakeNode(tag) {
  return {
    tagName: tag,
    className: '',
    style: {},
    children: [],
    innerHTML: '',
    append(...kids) { this.children.push(...kids); },
    appendChild(ch) { this.children.push(ch); return ch; },
    querySelector: () => null,
    setAttribute() {},
    getAttribute: () => null,
    hasAttribute: () => false,
    addEventListener() {},
  };
}

// router.js render() does `result instanceof Node`; browsers have the Node
// interface, node:test does not — provide a stand-in class (plain fake nodes
// are intentionally NOT instances, so the string-render path is exercised).
class NodeStub {}

function loadRouter(hash) {
  const doc = {
    title: '',
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: (tag) => fakeNode(tag),
  };
  const w = {
    location: { hash },
    addEventListener() {},
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Node', ROUTER_SRC)(w, doc, NodeStub);
  return { w, doc };
}

test('current(): #content (skip-link anchor) must NOT become the phantom route "ontent"', () => {
  const { w } = loadRouter('#content');
  const cur = w.Router.current();
  assert.notEqual(cur.name, 'ontent', 'slice(2) of a non-#/# hash must not be routed');
  assert.equal(cur.name, 'dashboard', 'non-route hashes fall back to the default view');
});

test('current(): #/?x=1 resolves to dashboard, not the empty-name 404', () => {
  const { w } = loadRouter('#/?x=1');
  assert.equal(w.Router.current().name, 'dashboard');
});

test('current(): empty hash, bare "#" and "#/" all resolve to dashboard', () => {
  for (const h of ['', '#', '#/']) {
    const { w } = loadRouter(h);
    assert.equal(w.Router.current().name, 'dashboard', `hash ${JSON.stringify(h)}`);
  }
});

test('current(): query-bearing and param-bearing routes keep working (v1.28.1 contract)', () => {
  assert.equal(loadRouter('#/evaluate?url=https://x.example/j/1').w.Router.current().name, 'evaluate');
  assert.equal(loadRouter('#/config?tab=modes').w.Router.current().name, 'config');
  const rep = loadRouter('#/reports/acme-senior-eng').w.Router.current();
  assert.equal(rep.name, 'reports');
  assert.deepEqual(rep.params, ['acme-senior-eng']);
  assert.equal(loadRouter('#/dashboard').w.Router.current().name, 'dashboard');
});

test('render(): a bare in-page anchor (#content) does NOT re-render and wipe the view', async () => {
  const content = fakeNode('div');
  const doc = {
    title: 'keep me',
    querySelectorAll: () => [],
    getElementById: () => content,
    createElement: (tag) => fakeNode(tag),
  };
  const w = { location: { hash: '#content' }, addEventListener() {} };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Node', ROUTER_SRC)(w, doc, NodeStub);
  await w.Router.render();
  assert.equal(content.innerHTML, '', 'skip-link anchor must not trigger a route render');
  assert.equal(doc.title, 'keep me', 'document.title must be left alone');
});

test('render(): boot with an empty hash still renders the default view', async () => {
  const content = fakeNode('div');
  const doc = {
    title: '',
    querySelectorAll: () => [],
    getElementById: () => content,
    createElement: (tag) => fakeNode(tag),
  };
  const w = { location: { hash: '' }, addEventListener() {} };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Node', ROUTER_SRC)(w, doc, NodeStub);
  await w.Router.render();
  assert.match(content.innerHTML, /Loading…/, 'empty hash is a real boot render');
});

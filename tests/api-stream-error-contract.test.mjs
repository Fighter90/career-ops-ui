/**
 * CAR-18 / client-libs-1 — api.js contracts:
 *
 * [M] API.stream error contract (v1.243.0): a dropped EventSource fired the
 * consumer's onEvent('error') TWICE — once from the named 'error'
 * addEventListener with `data === undefined` (a transport error is not an
 * SSE frame), then again from `es.onerror`. views/cv.js:113 reads
 * `data.message` and threw on the undefined first delivery. Contract now:
 *   • exactly ONE 'error' delivery per stream lifetime;
 *   • every 'error' payload is a well-formed object with a string `message`
 *     (consumers may rely on it without guarding);
 *   • the v1.29.2 multi-phase `done`/`final:false` close contract unchanged.
 *
 * [L] UI.providerCostHint lifecycle: it registered 2 document-level listeners
 * per call and never removed them — every view mount leaked a pair. The
 * helper now tears its listeners down itself once the returned node is
 * detached from the document (views deep.js/auto.js are not modified).
 *
 * api.js is a browser classic script → loaded in a synthetic window with an
 * injected EventSource fake; no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public/js/api.js'), 'utf8');

// ── synthetic browser ────────────────────────────────────────────────────
function mkEl(tag) {
  return {
    tagName: tag, children: [], className: '', style: {}, hidden: false,
    textContent: '', innerHTML: '', isConnected: true,
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
}

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this._listeners = {};
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  close() { this.closed = true; }
  // A real server-sent `event: <name>` frame reaches only the listeners.
  emitFrame(type, data) {
    for (const fn of this._listeners[type] || []) fn({ data });
  }
  // A transport failure fires BOTH the 'error' listeners and the onerror
  // property — this duplication is exactly what produced double delivery.
  emitTransportDrop() {
    for (const fn of this._listeners.error || []) fn({ data: undefined });
    if (this.onerror) this.onerror({ data: undefined });
  }
}

let moInstances = [];
class FakeMutationObserver {
  constructor(cb) { this._cb = cb; moInstances.push(this); }
  observe() {}
  disconnect() { this._disconnected = true; }
  trigger() { this._cb([], this); }
}

function loadApi({ providers = null } = {}) {
  FakeEventSource.instances = [];
  moInstances = [];
  const doc = {
    title: '',
    addEventListener(type, fn, opts) { (this._add ||= []).push({ type, fn, opts }); },
    removeEventListener() {},
    getElementById: () => null,
    createElement: (tag) => mkEl(tag),
    querySelectorAll: () => [],
    execCommand: () => true,
  };
  const w = { location: { hash: '#/' }, addEventListener() {} };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => (providers || {}),
  });
  // api.js line ~71 starts the self-rescheduling connection watchdog at load;
  // a real setTimeout would keep the node:test event loop alive forever.
  // no-op timers are fine — nothing under test depends on them firing.
  const setTimeoutNoop = () => 0;
  const clearTimeoutNoop = () => {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'EventSource', 'MutationObserver', 'setTimeout', 'clearTimeout', SRC)(
    w, doc, fetchImpl, FakeEventSource, FakeMutationObserver, setTimeoutNoop, clearTimeoutNoop,
  );
  return { w, doc };
}

// ── [M] API.stream error contract ────────────────────────────────────────

test('stream: a dropped EventSource delivers error EXACTLY once', () => {
  const { w } = loadApi();
  const events = [];
  const es = w.API.stream('/api/stream/x', (ev, data) => events.push({ ev, data }));
  es.emitTransportDrop();
  const errs = events.filter((e) => e.ev === 'error');
  assert.equal(errs.length, 1, `expected one error delivery, got ${errs.length}`);
  assert.equal(es.closed, true, 'stream closes after the error');
});

test('stream: error payload is always a well-formed {message} object', () => {
  const { w } = loadApi();
  // transport drop
  const events1 = [];
  w.API.stream('/s1', (ev, data) => events1.push({ ev, data }));
  FakeEventSource.instances[0].emitTransportDrop();
  assert.equal(events1[0].ev, 'error');
  assert.equal(typeof events1[0].data.message, 'string',
    'cv.js:113 must be able to read data.message without guarding');

  // server error frame with JSON object lacking a message
  const events2 = [];
  w.API.stream('/s2', (ev, data) => events2.push({ ev, data }));
  FakeEventSource.instances[1].emitFrame('error', JSON.stringify({ step: 'pdf' }));
  assert.equal(events2[0].data.message, 'connection lost',
    'a message-less error frame still yields a string message');

  // server error frame with a plain (non-JSON) string body
  const events3 = [];
  w.API.stream('/s3', (ev, data) => events3.push({ ev, data }));
  FakeEventSource.instances[2].emitFrame('error', 'provider exploded');
  assert.equal(events3[0].data.message, 'provider exploded');
});

test('stream: named error frame keeps its data (object preserved), delivered once', () => {
  const { w } = loadApi();
  const events = [];
  const es = w.API.stream('/s4', (ev, data) => events.push({ ev, data }));
  es.emitFrame('error', JSON.stringify({ message: 'boom', step: 'evaluate' }));
  // a late transport drop (already-closing socket) must NOT deliver again
  es.emitTransportDrop();
  const errs = events.filter((e) => e.ev === 'error');
  assert.equal(errs.length, 1);
  assert.equal(errs[0].data.message, 'boom', 'server-provided message wins');
  assert.equal(errs[0].data.step, 'evaluate', 'extra error fields preserved');
  assert.equal(es.closed, true);
});

test('stream: v1.29.2 multi-phase done/final contract unchanged', () => {
  const { w } = loadApi();
  const es1 = w.API.stream('/s5', () => {});
  es1.emitFrame('done', JSON.stringify({ final: false }));
  assert.equal(es1.closed, false, 'intermediate done (final:false) keeps the stream open');
  es1.emitFrame('done', JSON.stringify({ final: true }));
  assert.equal(es1.closed, true);

  const es2 = w.API.stream('/s6', () => {});
  es2.emitFrame('done', JSON.stringify({}));
  assert.equal(es2.closed, true, 'done without final closes (single-phase producers)');
});

// ── [L] providerCostHint listener lifecycle ─────────────────────────────

test('providerCostHint: document listeners carry an abort signal and self-clean on detach', async () => {
  const { w, doc } = loadApi({ providers: { activeProvider: 'anthropic', activeModel: 'claude' } });
  const node = w.UI.providerCostHint((k, f) => f);
  await new Promise((r) => setImmediate(r)); // refreshCostLine is async
  // api.js ALSO registers a load-time visibilitychange watchdog (no signal);
  // the hint's own pair are the two signal-carrying ones.
  const added = doc._add.filter((a) => a.opts && a.opts.signal);
  assert.equal(added.length, 2, 'two document listeners registered by the hint');
  assert.deepEqual(added.map((a) => a.type).sort(), ['providers-changed', 'visibilitychange']);

  // still attached → nothing aborted, hint rendered the provider line
  assert.ok(moInstances.length === 1, 'one lifecycle observer for the hint');
  assert.equal(node.hidden, false);
  assert.match(node.textContent, /Anthropic/);
  assert.ok(added.every((a) => !a.opts.signal.aborted), 'attached → signals still live');

  // view navigates away → node detached → the NEXT DOM mutation tears down
  node.isConnected = false;
  moInstances[0].trigger();
  assert.ok(added.every((a) => a.opts.signal.aborted),
    'detached hint must abort its document listeners (no leak)');
});

test('providerCostHint: listener keeps working while the node is attached', async () => {
  const { w, doc } = loadApi({ providers: { activeProvider: 'openai', activeModel: 'gpt' } });
  const node = w.UI.providerCostHint((k, f) => f);
  await new Promise((r) => setImmediate(r));
  const pc = doc._add.find((a) => a.type === 'providers-changed');
  await pc.fn(); // re-fetch → still connected → hint updates, signal NOT aborted
  assert.equal(pc.opts.signal.aborted, false);
  assert.match(node.textContent, /OpenAI/);
});

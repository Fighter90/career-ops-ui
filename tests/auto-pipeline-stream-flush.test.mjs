/**
 * CAR-18 / client-libs-1 + FULL-R5 — the SSE terminal-frame flush lives in
 * the SHARED transport (API.postStream), and auto-pipeline drains through
 * it.
 *
 * Pre-fix auto-pipeline looped `reader.read()` over its own private parser
 * and kept the tail in `buf`. A server that writes the terminal frame
 * WITHOUT a trailing blank line (or whose last chunk is split mid-JSON)
 * ended the stream with that frame unprocessed → the modal rendered
 * NOTHING: no result card, no error, buttons re-enabled into a dead-end.
 * The flush was added to auto-pipeline's private copy in CAR-18; FULL-R5
 * migrates the lib onto API.postStream and moves the flush into the shared
 * transport so every consumer gets it.
 *
 * Contract under test (through the REAL api.js postStream over a stubbed
 * fetch — no network, no server):
 *   1. A `done` frame that arrives without a trailing '\n\n' is processed on
 *      stream end → the result card renders (company/score/tracker links).
 *   2. A `done` frame SPLIT across two reads is processed too (decode +
 *      buffer flush).
 *   3. An `error` frame as the final unterminated frame renders the error
 *      card instead of nothing.
 *   4. A stream that ends with no terminal frame at all leaves the timeline
 *      WITHOUT an invented result (CAR-94.6: it now lands in the terminal
 *      error card instead of staying on "running" forever) and re-enables
 *      the controls.
 *
 * auto-pipeline.js is a browser classic script → loaded with a synthetic
 * UI + the real api.js (whose postStream is the transport under test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = readFileSync(resolve(ROOT, 'public/js/api.js'), 'utf8');
const SRC = readFileSync(resolve(ROOT, 'public/js/lib/auto-pipeline.js'), 'utf8');

function mkEl(tag) {
  return {
    tagName: tag,
    children: [],
    className: '',
    style: {},
    value: '',
    hidden: false,
    disabled: false,
    innerHTML: '',
    textContent: '',
    attrs: {},
    _handlers: {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener(type, fn) { this._handlers[type] = fn; },
    setAttribute(k, v) { this.attrs[k] = v; },
    click() { this._handlers.click && this._handlers.click({ preventDefault() {}, stopPropagation() {} }); },
  };
}

function makeEnv(frames) {
  const created = [];
  const el = (tag, attrs, children) => {
    const e = mkEl(tag);
    created.push(e);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style') Object.assign(e.style, v);
      else if (k === 'className') e.className = v;
      else if (k === 'onClick') e.addEventListener('click', v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
    for (const kid of kids) if (kid) e.children.push(kid);
    return e;
  };
  let modalBody = null;

  // The real api.js, loaded over a ReadableStream-shaped fetch stub.
  const enc = new TextEncoder();
  let i = 0;
  const fetchImpl = async () => ({
    ok: true,
    body: {
      getReader: () => ({
        read: async () => (i < frames.length
          ? { done: false, value: enc.encode(frames[i++]) }
          : { done: true }),
      }),
    },
  });
  const doc = {
    title: '',
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    createElement: (tag) => mkEl(tag),
    querySelectorAll: () => [],
    execCommand: () => true,
  };
  const w = { location: { hash: '#/' }, addEventListener() {} };
  const setTimeoutNoop = () => 0;
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'EventSource', 'MutationObserver', 'setTimeout', 'clearTimeout', API_SRC)(
    w, doc, fetchImpl, function () { this.close = () => {}; }, function () { this.disconnect = () => {}; },
    setTimeoutNoop, setTimeoutNoop,
  );
  w.I18n = { t: (k, f) => (f === undefined ? k : f), getLang: () => 'en' };

  // auto-pipeline realm — the real lib over the real API.postStream.
  const apW = {
    UI: { el, modal: (title, body) => { modalBody = body; return { close() {} }; } },
    API: w.API,
    I18n: w.I18n,
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'console', 'UI', 'API', 'I18n', 'fetch', SRC)(
    apW, { warn() {}, error() {} }, apW.UI, apW.API, apW.I18n, fetchImpl,
  );
  apW.AutoPipeline.open({ prefillUrl: 'https://jobs.example.com/123', autoStart: true });
  return { created, modalBody: () => modalBody };
}

// The modal body is [intro <p>, controls <div>, timelineRoot, resultRoot].
function roots(env) {
  const kids = env.modalBody().children;
  return { timeline: kids[2], result: kids[3] };
}

function collectStrings(node, acc = []) {
  if (node == null) return acc;
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (typeof node === 'object') {
    if (node.value) acc.push(node.value);
    for (const k of node.children || []) collectStrings(k, acc);
  }
  return acc;
}

async function settle() { await new Promise((r) => setTimeout(r, 25)); }

test('final `done` frame without a trailing blank line still renders the result card', async () => {
  const env = makeEnv([
    'event: start\ndata: {}\n\n',
    'event: step\ndata: {"i":0,"status":"done"}\n\n',
    'event: done\ndata: {"score":4.5,"company":"Acme","role":"Engineer","slug":"acme-engineer","trackerNum":42}',
  ]);
  await settle();
  const { result } = roots(env);
  const text = collectStrings(result).join(' | ');
  assert.match(text, /Auto-pipeline complete/, 'done frame must be flushed and rendered');
  assert.match(text, /Acme/, 'company from the flushed frame must reach the result card');
  assert.ok(result.children.length > 0, 'resultRoot must not stay empty');
});

test('a done frame split across two reads is flushed (decoder + buffer)', async () => {
  const env = makeEnv([
    'event: step\ndata: {"i":1,"status":"running"}\n\n',
    'event: done\ndata: {"score":4.2,"comp',
    'any":"SplitCo","slug":"split-co","trackerNum":7}',
  ]);
  await settle();
  const { result } = roots(env);
  assert.match(collectStrings(result).join(' | '), /SplitCo/, 'split terminal frame must render');
});

test('a final unterminated `error` frame renders the failure card', async () => {
  const env = makeEnv([
    'event: step\ndata: {"i":2,"status":"running"}\n\n',
    'event: error\ndata: {"step":"pdf","message":"playwright missing"}',
  ]);
  await settle();
  const { result } = roots(env);
  assert.match(collectStrings(result).join(' | '), /playwright missing/, 'error frame must be flushed and rendered');
});

test('a stream that ends without any terminal frame renders the error card (no invented result) and re-enables controls', async () => {
  const env = makeEnv([
    'event: start\ndata: {}\n\n',
    'event: step\ndata: {"i":0,"status":"done"}\n\n',
    'event: step\ndata: {"i":1,"status":"running"}\n\n',
  ]);
  await settle();
  const { timeline, result } = roots(env);
  // CAR-94.6 — a silent end-of-stream is a TERMINAL state: the timeline may
  // not sit on "running" forever, but the error card must not invent a
  // result either (no score, no company).
  const text = collectStrings(result).join(' | ');
  assert.doesNotMatch(text, /Auto-pipeline complete/, 'no phantom result card');
  assert.match(text, /Auto-pipeline failed/, 'the failure card is the terminal state');
  const startBtn = env.created.find((e) => e.tagName === 'button' && (e.children[0] || '').toString().includes('Run auto-pipeline'));
  assert.ok(startBtn, 'start button exists');
  assert.equal(startBtn.disabled, false, 'controls re-enabled after the stream ends');
  assert.ok(timeline.children.length > 0, 'timeline stays visible');
});

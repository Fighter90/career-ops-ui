/**
 * FULL-R5 (review 5) — the auto-pipeline reopen race + the shared
 * API.postStream transport.
 *
 * Pre-fix race: closing modal A fires UI.modal's onClose → currentAbort
 * aborts the in-flight run, but `running` only clears in the async finally.
 * Reopening immediately (Cmd+K autoStart's setTimeout(0)) hit
 * `if (running) return` SILENTLY — the fresh modal was inert: no run, no
 * message, nothing.
 *
 * Contract under test (behavioural, real api.js transport + stubbed fetch):
 *   1. start → modal close (abort) → reopen → start again SETTLES: the
 *      second run actually executes (fetch is called twice) and its result
 *      card renders in the new modal — never a silent return;
 *   2. a run in flight still serializes: a queued start waits for the
 *      in-flight run's settlement instead of racing it;
 *   3. the transport is API.postStream (Accept-Language header rides the
 *      request; the private SSE-parser copy is gone).
 *
 * No network, no server: fetch is a ReadableStream-shaped stub.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = readFileSync(resolve(ROOT, 'public/js/api.js'), 'utf8');
const AP_SRC = readFileSync(resolve(ROOT, 'public/js/lib/auto-pipeline.js'), 'utf8');

function mkEl(tag) {
  return {
    tagName: tag, children: [], className: '', style: {}, hidden: false,
    value: '', disabled: false, textContent: '', innerHTML: '', isConnected: true,
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener(type, fn) { this._handlers = this._handlers || {}; this._handlers[type] = fn; },
    removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
    scrollIntoView() {},
    click() { this._handlers && this._handlers.click && this._handlers.click({ preventDefault() {}, stopPropagation() {} }); },
  };
}

/**
 * Builds an env whose API is the REAL api.js postStream over a scripted
 * fetch. `script` = array of { frames, release } consumed in fetch order;
 * a stream whose `release` promise is unresolved blocks reader.read() —
 * simulating an in-flight run until the test releases it.
 */
function makeEnv() {
  const fetchCalls = [];
  const streams = [];
  const makeFetch = () => async (path, opts) => {
    const spec = streams.shift() || { frames: [], release: Promise.resolve() };
    fetchCalls.push({ path, opts, spec });
    const enc = new TextEncoder();
    let i = 0;
    return {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            await spec.release;
            return i < spec.frames.length
              ? { done: false, value: enc.encode(spec.frames[i++]) }
              : { done: true };
          },
        }),
      },
    };
  };

  // api.js realm — the real transport.
  const doc = {
    title: '',
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    createElement: (tag) => mkEl(tag),
    querySelectorAll: () => [],
    execCommand: () => true,
  };
  const w = { location: { hash: '#/' }, addEventListener() {} };
  const fetchImpl = makeFetch();
  const setTimeoutNoop = () => 0;
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'EventSource', 'MutationObserver', 'setTimeout', 'clearTimeout', API_SRC)(
    w, doc, fetchImpl, function () { this.close = () => {}; }, function () { this.disconnect = () => {}; },
    setTimeoutNoop, setTimeoutNoop,
  );
  w.I18n = { t: (k, f) => (f === undefined ? k : f), getLang: () => 'en' };

  // auto-pipeline realm — the real lib over the real API.
  const created = [];
  const el = (tag, attrs, children) => {
    const e = mkEl(tag);
    created.push(e);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style') Object.assign(e.style, v);
      else if (k === 'className') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const kid of [].concat(children == null ? [] : children)) {
      if (kid == null || kid === false) continue;
      e.children.push(kid);
    }
    return e;
  };
  const modals = [];
  const UI = {
    el,
    modal: (title, body, onClose) => {
      const m = { title, body, onClose, closed: false };
      modals.push(m);
      return { close() { m.closed = true; if (onClose) onClose(); } };
    },
    toast() {}, dismissToast() {},
    withSpinner: async (btn, fn) => fn(),
  };
  const apW = { UI, API: w.API, I18n: w.I18n };
  // eslint-disable-next-line no-new-func
  new Function('window', 'console', 'UI', 'API', 'I18n', 'fetch', AP_SRC)(
    apW, { warn() {}, error() {} }, UI, w.API, w.I18n, fetchImpl,
  );
  w.AutoPipeline = apW.AutoPipeline;
  return {
    w, UI, modals, created, fetchCalls, streams,
    open: (opts) => w.AutoPipeline.open(opts),
  };
}

// The modal body is [intro <p>, controls <div>, timelineRoot, resultRoot].
function roots(modal) {
  const kids = modal.body.children;
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

const DONE_FRAMES = ['event: done\ndata: {"score":4.5,"company":"Acme","role":"Engineer","slug":"acme-engineer","trackerNum":42}\n\n'];
async function settle(ms = 25) { await new Promise((r) => setTimeout(r, ms)); }

test('FULL-R5: close-abort → reopen → start again SETTLES (no silent return, second run executes)', async () => {
  const env = makeEnv();
  // Run 1: a stream that stays in flight until the test releases it.
  let release1;
  env.streams.push({ frames: DONE_FRAMES, release: new Promise((r) => { release1 = r; }) });

  // 1. first modal, autoStart → run 1 begins (blocks on the stream).
  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle();
  assert.equal(env.fetchCalls.length, 1, 'run 1 must have started');
  assert.equal(env.modals.length, 1);

  // 2. the user closes modal A (onClose aborts the in-flight run).
  env.modals[0].onClose && env.modals[0].onClose();
  release1(); // the aborted stream settles (postStream returns silently)

  // 3. reopen + autoStart — pre-fix this hit `if (running) return` silently.
  env.streams.push({ frames: DONE_FRAMES, release: Promise.resolve() });
  env.open({ prefillUrl: 'https://jobs.example.com/2', autoStart: true });
  await settle(60);

  assert.equal(env.fetchCalls.length, 2,
    'the second start must EXECUTE (await the first run\'s settlement), not silently return');
  assert.equal(env.modals.length, 2);
  const { result } = roots(env.modals[1]);
  const text = collectStrings(result).join(' | ');
  assert.match(text, /Auto-pipeline complete/, 'the reopened modal must render run 2\'s result card');
  assert.match(text, /Acme/, 'run 2 payload reaches the reopened modal');
  const run2 = env.fetchCalls[1];
  assert.equal(run2.opts.body, JSON.stringify({ url: 'https://jobs.example.com/2', lang: 'en' }),
    'run 2 posts its own URL through the shared transport (lang rides along)');
});

test('FULL-R5: a start while a run is in flight waits for it, then runs once', async () => {
  const env = makeEnv();
  let release1;
  env.streams.push({ frames: DONE_FRAMES, release: new Promise((r) => { release1 = r; }) });

  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle();

  // A second start against the SAME in-flight run (new modal, no abort).
  env.streams.push({ frames: DONE_FRAMES, release: Promise.resolve() });
  env.open({ prefillUrl: 'https://jobs.example.com/2', autoStart: true });
  await settle(20);
  assert.equal(env.fetchCalls.length, 1, 'run 2 must wait for run 1, not race it');

  release1();
  await settle(60);
  assert.equal(env.fetchCalls.length, 2, 'run 2 executes after run 1 settles');
  const text = collectStrings(roots(env.modals[1]).result).join(' | ');
  assert.match(text, /Auto-pipeline complete/, 'the queued modal renders its result');
});

test('FULL-R5: the transport is API.postStream — Accept-Language rides the request', async () => {
  const env = makeEnv();
  env.streams.push({ frames: DONE_FRAMES, release: Promise.resolve() });
  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle(40);
  assert.equal(env.fetchCalls.length, 1);
  const headers = env.fetchCalls[0].opts.headers;
  assert.equal(headers['Accept-Language'], 'en', 'postStream sends Accept-Language');
  assert.equal(headers.Accept, 'text/event-stream', 'postStream sends the SSE accept header');
});

test('static: the private SSE parser copy is gone from auto-pipeline.js', () => {
  assert.ok(!AP_SRC.includes('getReader'), 'the lib must not carry its own reader loop');
  assert.ok(AP_SRC.includes('API.postStream'), 'the lib must drain through API.postStream');
  // Abort-on-close contract (CAR-94.6) survives the migration.
  assert.match(AP_SRC, /let currentAbort = null;/, 'the module-scope abort handle stays');
  assert.match(AP_SRC, /abort\.signal/, 'the signal must reach the transport');
  assert.match(AP_SRC, /renderError\('network'/, 'a silent stream end still lands in a terminal error');
});

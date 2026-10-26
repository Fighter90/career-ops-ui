/**
 * FULL-R5 (review 5 + review-round-2 findings 1/2/5/6/7) — auto-pipeline
 * lifecycle: the reopen race, the shared API.postStream transport, and the
 * abort contract end to end.
 *
 * Round 1 fix: a start landing on an in-flight run queues (module-scope run
 * promise) instead of silently returning.
 *
 * Round 2 contracts:
 *   F1 [high] a queued start carries its OWN AbortController; closing the
 *      modal cancels the queued run too — a cancelled waiter must never
 *      wake into a fresh PAID run with no visible modal (silent spend,
 *      reverses CAR-94.6).
 *   F2 a superseded queued start renders an explicit «Superseded» state,
 *      never a silent inert modal.
 *   F5 the abort contract is real: the signal reaches fetch, the stub
 *      reader rejects on abort, and a closed modal's result root stays
 *      empty; API.postStream receives abort.signal.
 *   F6 frames buffered after close do not paint into the detached modal.
 *   F7 a transport-level non-OK response renders the old step-0
 *      «HTTP nnn» state, not a generic network failure.
 *
 * No network, no server: fetch is a ReadableStream-shaped stub that honours
 * opts.signal.
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
 * fetch. Each queued spec = one fetch: { frames, release, ok, status }.
 * A stream whose `release` promise is unresolved blocks reader.read() —
 * simulating an in-flight run until the test releases it. The reader
 * REJECTS when the request signal aborts (real fetch behaviour, F5).
 */
function makeEnv() {
  const fetchCalls = [];
  const streams = [];
  const makeFetch = () => async (path, opts) => {
    const spec = streams.shift() || { frames: [], release: Promise.resolve(), ok: true };
    spec.signal = opts.signal || null;
    fetchCalls.push({ path, opts, spec });
    if (spec.ok === false) {
      return { ok: false, status: spec.status || 502, text: async () => '' };
    }
    const enc = new TextEncoder();
    let i = 0;
    return {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            await spec.release;
            if (spec.signal && spec.signal.aborted) {
              const e = new Error('The user aborted a request.');
              e.name = 'AbortError';
              throw e;
            }
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

// ── round 1 contract (kept): reopen after a close-aborted run settles ─────

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

  // 3. reopen + autoStart — a fresh user-triggered start must run.
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

// ── F1a [high]: a queued start whose modal CLOSES must never run ──────────

test('F1a: queued start + its modal closed → NO second fetch (cancelled waiter never spends)', async () => {
  const env = makeEnv();
  // Run 1 streams, blocked.
  let release1;
  env.streams.push({ frames: DONE_FRAMES, release: new Promise((r) => { release1 = r; }) });

  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle();
  assert.equal(env.fetchCalls.length, 1);

  // Modal B opens while A streams → B's start queues behind run 1.
  env.open({ prefillUrl: 'https://jobs.example.com/2', autoStart: true });
  await settle();
  assert.equal(env.fetchCalls.length, 1, 'B must be queued, not running');

  // The user closes B — the queued run must be cancelled with the modal.
  env.modals[1].onClose && env.modals[1].onClose();

  // Run 1 settles. Pre-fix the cancelled waiter woke into a fresh PAID run
  // (fetch #2, report, tracker row) with no visible modal and no cancel.
  release1();
  await settle(80);

  assert.equal(env.fetchCalls.length, 1,
    'a queued start whose modal closed must NEVER fire (silent spend = CAR-94.6 regression)');
  // B's modal must not show a result either.
  const text = collectStrings(roots(env.modals[1]).result).join(' | ');
  assert.doesNotMatch(text, /Auto-pipeline complete/, 'no phantom result in the closed modal');
});

// ── F1b: a queued start behind an ABORTED in-flight run runs ONCE, visibly ─

test('F1b: second Cmd+K while A streams → A aborts, B runs exactly once with visible progress', async () => {
  const env = makeEnv();
  let release1;
  env.streams.push({ frames: DONE_FRAMES, release: new Promise((r) => { release1 = r; }) });

  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle();

  // Opening B replaces A (the real UI.modal fires A's onClose → aborts A).
  env.modals[0].onClose && env.modals[0].onClose();
  // B's run 2 stream (consumed when B's queued start fires after settle).
  env.streams.push({ frames: DONE_FRAMES, release: Promise.resolve() });
  env.open({ prefillUrl: 'https://jobs.example.com/2', autoStart: true });
  await settle();
  assert.equal(env.fetchCalls.length, 1, 'B queues behind the still-settling run 1');

  release1();
  await settle(80);
  assert.equal(env.fetchCalls.length, 2, 'B runs exactly once after run 1 settles');
  const runs = env.fetchCalls.filter((c) => c.opts.body.includes('jobs.example.com/2'));
  assert.equal(runs.length, 1, 'no double-fire of the queued URL');
  const text = collectStrings(roots(env.modals[1]).result).join(' | ');
  assert.match(text, /Auto-pipeline complete/, 'B\'s modal shows the run it paid for');
});

// ── F2: a superseded queued start renders an explicit state ───────────────

test('F2: a superseded queued start renders «Superseded» — never a silent inert modal', async () => {
  const env = makeEnv();
  let release1;
  env.streams.push({ frames: DONE_FRAMES, release: new Promise((r) => { release1 = r; }) });

  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle();

  // B queues while A streams. (The env's UI.modal does not auto-fire the
  // previous onClose, so B's modal is still the visible one when C
  // supersedes it — exactly the state where silence would strand the user.)
  env.open({ prefillUrl: 'https://jobs.example.com/2', autoStart: true });
  await settle();
  // C supersedes B's queued start.
  env.streams.push({ frames: DONE_FRAMES, release: Promise.resolve() }); // C's run 2
  env.open({ prefillUrl: 'https://jobs.example.com/3', autoStart: true });
  await settle();
  assert.equal(env.fetchCalls.length, 1, 'still only run 1');

  release1();
  await settle(80);

  // B: superseded → explicit state in its timeline.
  const bRoots = roots(env.modals[1]);
  const bTimeline = collectStrings(bRoots.timeline).join(' | ');
  assert.match(bTimeline, /Superseded/, 'B\'s timeline must announce the supersede');
  const bText = collectStrings(bRoots.result).join(' | ');
  assert.doesNotMatch(bText, /Auto-pipeline complete/, 'B must not render a result');
  // C: runs.
  assert.equal(env.fetchCalls.length, 2, 'C (the newest queued start) runs');
  const text = collectStrings(roots(env.modals[2]).result).join(' | ');
  assert.match(text, /Auto-pipeline complete/, 'C renders its result');
});

// ── F5: the abort contract is real — the signal reaches fetch ─────────────

test('F5: onClose aborts the signal that postStream passed to fetch; the closed modal paints nothing', async () => {
  const env = makeEnv();
  let release1;
  env.streams.push({ frames: DONE_FRAMES, release: new Promise((r) => { release1 = r; }) });

  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle();
  const sentSignal = env.fetchCalls[0].opts.signal;
  assert.ok(sentSignal, 'the request must carry an AbortSignal (not undefined)');
  assert.equal(sentSignal.aborted, false, 'the signal starts live');

  env.modals[0].onClose && env.modals[0].onClose();
  assert.equal(sentSignal.aborted, true, 'onClose must abort the exact signal fetch received');

  release1();
  await settle(60);
  // The modal closed before any terminal frame — nothing may render.
  const { result } = roots(env.modals[0]);
  assert.equal(result.children.length, 0, 'the closed modal\'s result root stays empty');
  assert.equal(env.fetchCalls.length, 1, 'no follow-up fetch');
});

test('F5 static: postStream receives abort.signal; onEvent is abort-guarded', () => {
  assert.match(AP_SRC, /API\.postStream\([^)]*abort\.signal\)/,
    'the transport call must pass abort.signal');
  const onEventBlock = AP_SRC.slice(AP_SRC.indexOf('const onEvent'), AP_SRC.indexOf('try {', AP_SRC.indexOf('const onEvent')));
  assert.match(onEventBlock, /if \(abort\.signal\.aborted\) return;/,
    'onEvent must drop frames after the modal closed (F6)');
});

// ── F7: transport-level HTTP errors keep the step-0 «HTTP nnn» rendering ──

test('F7: a non-OK response renders step 0 failed with the HTTP status, not a generic network card', async () => {
  const env = makeEnv();
  env.streams.push({ ok: false, status: 502, frames: [], release: Promise.resolve() });
  env.open({ prefillUrl: 'https://jobs.example.com/1', autoStart: true });
  await settle(60);

  const { timeline, result } = roots(env.modals[0]);
  const tl = collectStrings(timeline).join(' | ');
  assert.match(tl, /HTTP 502/, 'the timeline step must carry the HTTP status');
  const res = collectStrings(result).join(' | ');
  assert.doesNotMatch(res, /network error/, 'no generic network failure card for a clean HTTP error');
  const startBtn = env.created.find((e) => e.tagName === 'button' && collectStrings(e).join('').includes('Run auto-pipeline'));
  assert.ok(startBtn, 'start button exists');
  assert.equal(startBtn.disabled, false, 'controls re-enabled');
});

// ── round 1 serialization contract (kept) ──────────────────────────────────

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
  // Abort-on-close contract (CAR-94.6 + F1) survives the migration.
  assert.match(AP_SRC, /let currentAbort = null;/, 'the module-scope abort handle stays');
  assert.match(AP_SRC, /let pendingAbort = null;/, 'a queued start has its own module-scope controller (F1)');
  assert.match(AP_SRC, /abort\.signal/, 'the signal must reach the transport');
  assert.match(AP_SRC, /renderError\('network'/, 'a silent stream end still lands in a terminal error');
});

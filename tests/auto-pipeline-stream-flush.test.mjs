/**
 * CAR-18 / client-libs-1 [M] — auto-pipeline SSE drain must flush the final
 * buffered frame when the stream ends.
 *
 * Pre-fix `start()` looped `reader.read()` and split on '\n\n', keeping the
 * tail in `buf`. A server that writes the terminal frame WITHOUT a trailing
 * blank line (or whose last chunk is split mid-JSON) ends the stream with
 * that frame still unprocessed → the modal renders NOTHING: no result card,
 * no error, buttons re-enabled into a dead-end.
 *
 * Contract under test:
 *   1. A `done` frame that arrives without a trailing '\n\n' is processed on
 *      stream end → the result card renders (company/score/tracker links).
 *   2. A `done` frame SPLIT across two reads is processed too (decode +
 *      buffer flush).
 *   3. An `error` frame as the final unterminated frame renders the error
 *      card instead of nothing.
 *   4. A stream that ends with no terminal frame at all leaves the timeline
 *      (no invented result) and re-enables the controls.
 *
 * auto-pipeline.js is a browser classic script → loaded with a synthetic
 * UI (same pattern as tests/countries.test.mjs); the SSE transport is an
 * injected ReadableStream-shaped fetch stub — no network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
    _handlers: {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener(type, fn) { this._handlers[type] = fn; },
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
      else if (k === 'onClick') e.addEventListener('click', v);
      else e[k] = v;
    }
    const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
    for (const kid of kids) if (kid) e.children.push(kid);
    return e;
  };
  let modalBody = null;
  const env = {
    w: {
      UI: {
        el,
        modal: (title, body) => { modalBody = body; return { close() {} }; },
      },
      API: {},
      I18n: { t: (k, f) => (f === undefined ? k : f), getLang: () => 'en' },
      fetch: async () => {
        const enc = new TextEncoder();
        let i = 0;
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => (i < frames.length
                ? { done: false, value: enc.encode(frames[i++]) }
                : { done: true }),
            }),
          },
        };
      },
    },
    created,
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'console', 'UI', 'API', 'I18n', 'fetch', SRC)(
    env.w, { warn() {}, error() {} },
    env.w.UI, env.w.API, env.w.I18n, env.w.fetch,
  );
  env.w.AutoPipeline.open({ prefillUrl: 'https://jobs.example.com/123', autoStart: true });
  env.modalBody = () => modalBody;
  return env;
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

test('a stream that ends without any terminal frame invents nothing and re-enables controls', async () => {
  const env = makeEnv([
    'event: start\ndata: {}\n\n',
    'event: step\ndata: {"i":0,"status":"done"}\n\n',
    'event: step\ndata: {"i":1,"status":"running"}\n\n',
  ]);
  await settle();
  const { timeline, result } = roots(env);
  assert.equal(result.children.length, 0, 'no phantom result card');
  const startBtn = env.created.find((e) => e.tagName === 'button' && (e.children[0] || '').toString().includes('Run auto-pipeline'));
  assert.ok(startBtn, 'start button exists');
  assert.equal(startBtn.disabled, false, 'controls re-enabled after the stream ends');
  assert.ok(timeline.children.length > 0, 'timeline stays visible');
});

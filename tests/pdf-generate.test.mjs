/**
 * public/js/lib/pdf-generate.js — shared Generate-PDF SSE runner
 * (browser classic script → synthetic window + minimal DOM stub, no jsdom).
 *
 * v1.243.0 coverage (all four defect classes):
 *   - any terminal state (done / error / stream cut / fetch throw) settles
 *     the run exactly ONCE and re-enables the Generate button — an SSE
 *     failure used to leave it disabled forever;
 *   - `done` with `code: null` (child killed by a signal) is a FAILURE —
 *     `?? 0` used to treat it as exit 0 (success + bogus download);
 *   - the GET (EventSource) kinds' error-frame + closing done frame (and
 *     the reconnect onerror) produce ONE error path, not two.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public/js/lib/pdf-generate.js'), 'utf8');

const enc = new TextEncoder();

/** Minimal DOM: only what pdf-generate.js touches (anchor download). */
function makeDom() {
  const downloads = [];
  const document = {
    createElement() {
      return {
        style: {},
        href: '',
        download: '',
        appendChild() {},
        remove() {},
        click() { downloads.push(this.download); },
      };
    },
    body: { appendChild() {}, removeChild() {} },
  };
  return { document, downloads };
}

/** Build the synthetic environment; returns { win, dom, buttons } probes. */
function makeEnv({ pdfLists, fetchImpl } = {}) {
  const dom = makeDom();
  const toasts = [];
  let modalNode = null;
  const btn = { disabled: false, classList: { add() {}, remove() {} } };
  const win = {
    // No I18n → t() falls back, so toast text assertions are English.
    UI: {
      toast: (msg, type) => toasts.push({ msg: String(msg), type }),
      modal: (_title, node) => { modalNode = node; },
      el: (tag, attrs, children) => {
        const node = {
          tag, attrs: attrs || {}, children: [], textContent: '',
          style: {}, scrollTop: 0, scrollHeight: 0,
          appendChild(child) { this.children.push(child); },
          set textContent_(v) { this.textContent = v; },
        };
        if (attrs && attrs.style) Object.assign(node.style, attrs.style);
        if (attrs && attrs.className) node.className = attrs.className;
        if (children != null) [].concat(children).forEach(() => {});
        return node;
      },
    },
    API: {
      get: async () => (pdfLists.length ? pdfLists.shift() : { files: [] }),
      stream: (url, onEvent) => {
        win.__streamedUrl = url;
        for (const [ev, data] of win.__streamEvents || []) onEvent(ev, data);
        return { close() {} };
      },
    },
  };
  const env = { win, dom, toasts, btn, modalNode: () => modalNode };
  env.load = () => {
    new Function('window', 'document', 'fetch', SRC)(win, dom.document, fetchImpl); // eslint-disable-line no-new-func
  };
  return env;
}

/** A fetch impl returning one SSE payload chunk then closing. */
function sseFetch(frames) {
  const payload = frames.join('');
  let sent = false;
  return async () => ({
    ok: true,
    body: {
      getReader() {
        return {
          read: async () => (sent
            ? { done: true }
            : (sent = true, { done: false, value: enc.encode(payload) })),
        };
      },
    },
  });
}

const sseFrame = (ev, data) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;

/** Let the async onEvent continuation (await latestPdfName → download) run. */
const flush = () => new Promise((r) => setImmediate(r));

after(() => { delete globalThis.fetch; });

// ───────────────────────── code: null is a failure ─────────────────────────

test('POST done with code null (killed by signal) is a FAILURE — no success toast, no download', async () => {
  const env = makeEnv({
    pdfLists: [{ files: [{ name: 'old.pdf' }] }],
    fetchImpl: sseFetch([sseFrame('done', { code: null })]),
  });
  env.load();
  await env.win.PdfGenerate.run({ kind: 'inline', markdown: '# x', button: env.btn });
  assert.equal(env.btn.disabled, false, 'button re-enabled');
  assert.ok(!env.toasts.some((t) => t.type === 'success'), 'no success toast');
  const err = env.toasts.filter((t) => t.type === 'error');
  assert.equal(err.length, 1);
  assert.match(err[0].msg, /signal|Error/i, 'the failure names what happened');
  assert.equal(env.dom.downloads.length, 0, 'nothing downloaded');
});

test('POST done with a non-zero code is a failure naming the exit code', async () => {
  const env = makeEnv({
    pdfLists: [{ files: [{ name: 'old.pdf' }] }],
    fetchImpl: sseFetch([sseFrame('done', { code: 2 })]),
  });
  env.load();
  await env.win.PdfGenerate.run({ kind: 'inline', markdown: '# x', button: env.btn });
  const err = env.toasts.filter((t) => t.type === 'error');
  assert.equal(err.length, 1);
  assert.match(err[0].msg, /2/, 'toast carries the exit code');
  assert.equal(env.dom.downloads.length, 0);
});

// ───────────────────────── single terminal state ─────────────────────────

test('POST error frame followed by the closing done frame → ONE error toast', async () => {
  const env = makeEnv({
    pdfLists: [{ files: [{ name: 'old.pdf' }] }],
    fetchImpl: sseFetch([sseFrame('error', { message: 'empty markdown' }), sseFrame('done', { code: 2 })]),
  });
  env.load();
  await env.win.PdfGenerate.run({ kind: 'inline', markdown: '# x', button: env.btn });
  assert.equal(env.toasts.filter((t) => t.type === 'error').length, 1, 'double error fixed');
  assert.equal(env.dom.downloads.length, 0);
});

test('GET kinds: error frame + closing done frame → ONE error toast', async () => {
  const env = makeEnv({ pdfLists: [] });
  env.win.__streamEvents = [
    ['error', { message: 'cv.md not found in project root' }],
    ['done', { code: 2 }],
  ];
  env.load();
  await env.win.PdfGenerate.run({ kind: 'cv', button: env.btn });
  assert.equal(env.win.__streamedUrl, '/api/stream/pdf');
  assert.equal(env.toasts.filter((t) => t.type === 'error').length, 1);
  assert.equal(env.btn.disabled, false);
});

test('GET kinds: done code 0 still succeeds (success toast + download)', async () => {
  const env = makeEnv({ pdfLists: [{ files: [{ name: 'old.pdf' }] }, { files: [{ name: 'new.pdf' }] }] });
  env.win.__streamEvents = [['done', { code: 0 }]];
  env.load();
  await env.win.PdfGenerate.run({ kind: 'cv', button: env.btn });
  await flush();
  assert.ok(env.toasts.some((t) => t.type === 'success'));
  assert.deepEqual(env.dom.downloads, ['new.pdf']);
  assert.equal(env.btn.disabled, false);
});

// ───────────────────────── stream failure paths ─────────────────────────

test('POST stream that dies with NO terminal frame re-enables the button (was: disabled forever)', async () => {
  const env = makeEnv({
    pdfLists: [{ files: [{ name: 'old.pdf' }] }],
    fetchImpl: sseFetch([sseFrame('log', { line: 'rendering…' })]),
  });
  env.load();
  await env.win.PdfGenerate.run({ kind: 'inline', markdown: '# x', button: env.btn });
  assert.equal(env.btn.disabled, false, 'button must not stay disabled');
  assert.equal(env.toasts.filter((t) => t.type === 'error').length, 1);
});

test('POST fetch throwing (network down) re-enables the button and toasts once', async () => {
  const env = makeEnv({
    pdfLists: [{ files: [] }],
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  env.load();
  await env.win.PdfGenerate.run({ kind: 'inline', markdown: '# x', button: env.btn });
  assert.equal(env.btn.disabled, false);
  assert.equal(env.toasts.filter((t) => t.type === 'error').length, 1);
  assert.match(env.toasts[env.toasts.length - 1].msg, /ECONNREFUSED/);
});

test('POST non-OK response → single error path, button re-enabled', async () => {
  const env = makeEnv({
    pdfLists: [],
    fetchImpl: async () => ({ ok: false, status: 500, body: null }),
  });
  env.load();
  await env.win.PdfGenerate.run({ kind: 'inline', markdown: '# x', button: env.btn });
  assert.equal(env.btn.disabled, false);
  assert.equal(env.toasts.filter((t) => t.type === 'error').length, 1);
});

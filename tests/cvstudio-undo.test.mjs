/**
 * CAR-179 — two upstream CV-Studio concepts ported onto our vanilla
 * toolbox page (upstream PRs #6183 "undo the last CV Studio edit" and
 * #6182 "keep the last CV Studio edit when you leave"; upstream's React
 * studio edits a tailored CV in place, our studio's equivalent of "the
 * last edit" is the pasted tool input plus the finished LLM result the
 * next run would overwrite).
 *
 * Behavioral gates (no source greps): the view module is loaded through
 * `new Function(...)` with stubbed globals — the tests/prodqa-client-
 * fixes.test.mjs pattern — and driven like a user:
 *   1. Undo returns the text before the last AI run (shared bounded
 *      snapshot stack + one Undo button).
 *   2. Cmd/Ctrl+Z pops the stack outside text fields and steps aside
 *      inside them (native undo owns the keystroke there); matched on
 *      e.code too, so a non-QWERTY layout (CAR-172 lesson) works.
 * (The leave-guard gates live in the CAR-179 guard commit of the same
 * branch and extend this file.)
 *
 * CI-isolated: stubbed DOM/API, no server, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

// ── Stub DOM ─────────────────────────────────────────────────────────────

/** Minimal DOM double: enough surface for the cv-studio route render. */
function el(tag, attrs, children) {
  const a = attrs || {};
  const node = {
    tagName: String(tag).toUpperCase(),
    className: typeof a.className === 'string' ? a.className : '',
    style: a.style || {},
    attrs: a,
    children: [],
    value: '',
    checked: false,
    disabled: false,
    placeholder: '',
    title: '',
    _listeners: {},
    appendChild(ch) { this.children.push(ch); return ch; },
    insertBefore(ch, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(ch); else this.children.splice(i, 0, ch);
      return ch;
    },
    removeChild(ch) { const i = this.children.indexOf(ch); if (i > -1) this.children.splice(i, 1); return ch; },
    replaceChildren(...kids) { this.children = kids.slice(); },
    remove() { /* detached stub */ },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      const arr = this._listeners[type];
      if (arr) { const i = arr.indexOf(fn); if (i > -1) arr.splice(i, 1); }
    },
    setAttribute(n, v) {
      this.attrs[n] = v;
      if (n === 'disabled') this.disabled = true;
      if (n === 'placeholder') this.placeholder = v;
      if (n === 'title') this.title = v;
    },
    getAttribute(n) { return (n in this.attrs) ? this.attrs[n] : null; },
  };
  if (a.disabled != null) node.disabled = true;
  if (a.placeholder != null) node.placeholder = a.placeholder;
  if (a.title != null) node.title = a.title;
  // Real-DOM textContent semantics: assigning replaces every child with a
  // text node (the repaint helpers rely on `out.textContent = ''` clearing).
  let _text = '';
  Object.defineProperty(node, 'textContent', {
    get() { return _text; },
    set(v) { _text = String(v); node.children.length = 0; },
  });
  // UI.el parity: `[].concat(children)` then appendChild per item — a
  // single node child is a child, a string child becomes text content.
  if (children != null) {
    for (const k of [].concat(children)) {
      if (k == null || k === false) continue;
      if (typeof k === 'string') node.textContent += k;
      else node.appendChild(k);
    }
  }
  return node;
}

/** Depth-first walk over the stub tree. */
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  (node.children || []).forEach((k) => walk(k, fn));
}

/** Concatenated descendant text (stub textContent only holds strings set
 *  directly; markdown painted through UI.md lands in the `html` attr the
 *  way UI.el assigns innerHTML). */
function textOf(node) {
  let out = '';
  walk(node, (n) => {
    if (n.textContent) out += (out ? ' ' : '') + n.textContent;
    if (n.attrs && typeof n.attrs.html === 'string') out += (out ? ' ' : '') + n.attrs.html;
  });
  return out;
}

function findTextarea(root, placeholderKey) {
  let hit = null;
  walk(root, (n) => {
    if (!hit && n.tagName === 'TEXTAREA' && n.attrs['data-i18n-placeholder'] === placeholderKey) hit = n;
  });
  return hit;
}

function findInput(root, placeholderKey) {
  let hit = null;
  walk(root, (n) => {
    if (!hit && n.tagName === 'INPUT' && n.attrs['data-i18n-placeholder'] === placeholderKey) hit = n;
  });
  return hit;
}

function findButton(root, match) {
  let hit = null;
  walk(root, (n) => {
    if (!hit && n.tagName === 'BUTTON' && match(textOf(n), n)) hit = n;
  });
  return hit;
}

/** Fire a click and let the async handler settle. */
async function click(btn) {
  (btn._listeners.click || []).forEach((fn) => fn({ preventDefault() {}, currentTarget: btn }));
  await new Promise((r) => setImmediate(r));
}

// ── View loader (prodqa pattern: new Function with stubbed globals) ──────

/**
 * Load public/js/views/cv-studio.js; return the registered route handler
 * plus the stubs the test drives. `humanize` lists the markdown payloads
 * the humanize POST returns, in call order.
 */
function loadStudioRoute({ markdown = '# Jane Doe\n\nEngineer.', humanize = [], jds = [] } = {}) {
  const registered = {};
  const win = {
    location: { hash: '#/cv-studio' },
    confirmCalls: [],
    confirm(msg) { this.confirmCalls.push(msg); return this.confirmAnswer !== undefined ? this.confirmAnswer : true; },
    LlmPageKit: {
      createRun() { return { mount() { return { cancelled: false, signal: { aborted: false } }; } }; },
      async run({ request }) { return request(undefined); },
      async postJSON() { return { markdown: humanize.shift() || 'FALLBACK-RESULT' }; },
    },
    // CvPrivacy/CvDiagnostics/ReportExport deliberately absent — the view guards them.
  };
  const winListeners = {};
  win.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); };
  win.removeEventListener = (type, fn) => {
    const arr = winListeners[type];
    if (arr) { const i = arr.indexOf(fn); if (i > -1) arr.splice(i, 1); }
  };
  const ui = {
    el,
    md: (s) => '<md>' + s + '</md>',
    toast() {},
    modal() {},
    confirm: async () => false,
  };
  const api = {
    get: (p) => (p === '/api/cv'
      ? Promise.resolve({ markdown })
      : p === '/api/jds' ? Promise.resolve({ jds }) : Promise.resolve({})),
  };
  const src = read('public', 'js', 'views', 'cv-studio.js');
  new Function('window', 'Router', 'API', 'UI', 'I18n', 'HelpHint', src)(
    win,
    { register: (name, fn) => { registered[name] = fn; }, go() {} },
    api,
    ui,
    { t: (k, f) => (f == null ? k : f) },
    { title: () => el('div') },
  );
  return {
    handler: registered['cv-studio'],
    win,
    winListeners,
    fire(type, event) { (winListeners[type] || []).forEach((fn) => fn(event)); },
  };
}

/** The humanOut panel: the div right after the humanize run-host card. */
function humanOutPanel(root) {
  let hit = null;
  walk(root, (n) => {
    if (!hit && n.attrs && n.attrs['data-studio-panel'] === 'human') hit = n;
  });
  return hit;
}

// ── 1. Undo returns the text before the last AI run ─────────────────────

test('cvstudio undo: the Undo button restores the previous humanize result', async () => {
  const { handler, win } = loadStudioRoute({ humanize: ['RESULT-ONE', 'RESULT-TWO'] });
  const root = await handler();

  const humanIn = findTextarea(root, 'cvs.humanPh');
  assert.ok(humanIn, 'humanize input textarea must render');
  humanIn.value = 'A stiff CV sentence that is definitely long enough to pass.';

  const runBtn = findButton(root, (txt) => txt.includes('Make it human'));
  assert.ok(runBtn, 'humanize run button must render');

  await click(runBtn);
  await click(runBtn);
  let panel = humanOutPanel(root);
  assert.ok(panel, 'humanize result panel must be marked');
  assert.match(textOf(panel), /RESULT-TWO/, 'second result is painted');

  const undoBtn = findButton(root, (txt, n) => txt.trim() === 'Undo');
  assert.ok(undoBtn, 'an Undo button must exist');
  assert.equal(undoBtn.disabled, false, 'Undo is armed after an overwrite');

  await click(undoBtn);
  panel = humanOutPanel(root);
  assert.match(textOf(panel), /RESULT-ONE/, 'undo restores the text before the last edit');
  assert.doesNotMatch(textOf(panel), /RESULT-TWO/, 'the overwritten result is gone');
  assert.equal(undoBtn.disabled, false, 'a second undo is still available');

  await click(undoBtn);
  panel = humanOutPanel(root);
  assert.equal(textOf(panel).trim(), '', 'undo past the first snapshot empties the panel again');
  assert.equal(undoBtn.disabled, true, 'Undo disarms when the stack is empty');
  assert.equal(win.location.hash, '#/cv-studio', 'undo itself never navigates');
});

// ── 2. Hotkey: Cmd/Ctrl+Z outside text fields, native undo inside ───────

test('cvstudio undo hotkey: Cmd/Ctrl+Z pops the stack only outside text fields', async () => {
  const { handler, fire, win } = loadStudioRoute({ humanize: ['RESULT-ONE', 'RESULT-TWO', 'RESULT-THREE'] });
  const root = await handler();
  const humanIn = findTextarea(root, 'cvs.humanPh');
  humanIn.value = 'A stiff CV sentence that is definitely long enough to pass.';
  const runBtn = findButton(root, (txt) => txt.includes('Make it human'));
  await click(runBtn);
  await click(runBtn);

  // Non-QWERTY layout (CAR-172 lesson): key is 'я' but code is KeyZ.
  const events = [];
  fire('keydown', { key: 'z', code: 'KeyZ', metaKey: true, shiftKey: false, target: { tagName: 'DIV' }, preventDefault: () => events.push('pd') });
  assert.match(textOf(humanOutPanel(root)), /RESULT-ONE/, 'Cmd+Z undoes the last overwrite');
  assert.deepEqual(events, ['pd'], 'the hotkey is consumed (native undo has no text field to own)');

  // Focus in a textarea → the field's native undo owns the keystroke.
  fire('keydown', { key: 'z', code: 'KeyZ', metaKey: true, shiftKey: false, target: { tagName: 'TEXTAREA' }, preventDefault: () => events.push('pd2') });
  assert.deepEqual(events, ['pd'], 'no preventDefault and no studio undo inside a textarea');
  assert.match(textOf(humanOutPanel(root)), /RESULT-ONE/, 'the panel is untouched');

  // No modifier → nothing.
  fire('keydown', { key: 'z', code: 'KeyZ', metaKey: false, ctrlKey: false, target: { tagName: 'DIV' }, preventDefault: () => events.push('pd3') });
  assert.deepEqual(events, ['pd'], 'bare Z never triggers the studio undo');

  // Ctrl+KeyZ on a Russian layout (key 'я') → still undoes: it pops the
  // last snapshot (the panel's initial empty state), emptying the panel.
  fire('keydown', { key: 'я', code: 'KeyZ', ctrlKey: true, target: { tagName: 'DIV' }, preventDefault: () => events.push('pd4') });
  assert.equal(textOf(humanOutPanel(root)).trim(), '', 'the code-based chord pops the initial empty snapshot too');
  assert.deepEqual(events, ['pd', 'pd4'], 'the code-based chord is consumed too');
  assert.equal(win.location.hash, '#/cv-studio');
});

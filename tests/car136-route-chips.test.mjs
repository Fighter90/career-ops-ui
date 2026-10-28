/**
 * CAR-136 T4 — deterministic route-link chips in #/docs-assistant.
 *
 * The ask response already carries `sections` (the titles of the help
 * sections the answer was grounded on); most embed their route in backticks
 * ("7. Scan (`#/scan`)"). The view must turn those titles into an
 * "Open: <Label> · <Label>" chip row rendered RIGHT ABOVE the answer
 * container (above the copy-paste prompt in manual mode) — derived from the
 * server payload, never from the model's prose, so it works with no LLM key
 * at all. §1 (Quick start) names no route in its title → one hardcoded
 * fallback ('1.' → #/auto).
 *
 * Two layers, per the repo convention for browser-only Router views:
 *   - source-static gates (chip-row builder present, Router.go wiring,
 *     the fallback map, i18n via the existing `common.open` key, CSP-safe:
 *     no innerHTML);
 *   - a behavioral pass that EXECUTES the view (new Function + synthetic
 *     DOM, same shape as car119-review-fixes.test.mjs) and clicks the chips.
 *
 * CI-isolated: reads files only; no server, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIEW = readFileSync(resolve(ROOT, 'public/js/views/docs-assistant.js'), 'utf8');

// ─────────────────────── source-static gates ───────────────────────

test('CAR-136 T4 (static): the view extracts route hashes and builds a chip row', () => {
  assert.ok(VIEW.includes('#\\/[a-z0-9-]+/'),
    'the route-hash extraction regex /#\\/[a-z0-9-]+/ must exist in the view');
  assert.match(VIEW, /routeChips\(/, 'a routeChips() builder must exist');
  assert.match(VIEW, /chipRow\(/, 'a chipRow() renderer must exist');
  assert.match(VIEW, /Router\.go\(/, 'chips must be wired to Router.go');
});

test('CAR-136 T4 (static): the §1 Quick-start fallback map is hardcoded', () => {
  // §1 names no route in its title; the fallback must not depend on the LLM.
  assert.match(VIEW, /'1\.'[\s\S]{0,80}#\/auto/,
    "the fallback map { '1.': '#/auto' } must be in the view source");
});

test('CAR-136 T4 (static): CSP-safe + i18n via the existing common.open key', () => {
  assert.ok(!VIEW.includes('innerHTML'), 'no innerHTML — UI.el only (CSP)');
  assert.match(VIEW, /t\('common\.open'/,
    'the row label reuses the existing common.open dict key (no new keys)');
});

// ─────────────── behavioral pass: execute the real view ───────────────

// Synthetic DOM (same shape as tests/car119-review-fixes.test.mjs — trimmed
// to what docs-assistant.js touches).
function makeEl(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], attrs: {}, style: {}, handlers: {},
    className: '', textContent: '', value: '', parentNode: null,
    appendChild(child) {
      if (typeof child === 'string') child = makeText(child);
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    get lastChild() { return node.children[node.children.length - 1] || null; },
    addEventListener(ev, fn) { (node.handlers[ev] ||= []).push(fn); },
    click() { for (const fn of node.handlers.click || []) fn({ currentTarget: node, preventDefault() {} }); },
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute(k) { return (k in node.attrs) ? node.attrs[k] : null; },
    scrollIntoView() {},
  };
  return node;
}
function makeText(s) { const n = makeEl('#text'); n.textContent = String(s); return n; }
function textOf(node) {
  if (!node) return '';
  if (node.tagName === '#TEXT') return String(node.textContent || '');
  return (node.children || []).map(textOf).join('');
}
function walk(node, fn) {
  fn(node);
  for (const ch of node.children || []) if (typeof ch !== 'string') walk(ch, fn);
}

/** Execute the view with stub globals; the kit returns the canned response. */
function makeHarness(response) {
  const doc = { createElement: (t) => makeEl(t), createTextNode: (s) => makeText(s) };
  const w = {};
  const routes = {};
  const went = [];
  const modals = [];
  const toasts = [];
  w.Router = { register: (k, fn) => { routes[k] = fn; }, go: (p) => went.push(p) };
  w.I18n = { t: (k, f) => (f ?? k), getLang: () => 'en' };
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
      if (children) {
        for (const ch of [].concat(children)) {
          if (ch == null || ch === false) continue;
          e.appendChild(typeof ch === 'string' ? doc.createTextNode(ch) : ch);
        }
      }
      return e;
    },
    toast: (msg, kind) => toasts.push({ msg, kind }),
    modal: (title, body) => modals.push({ title, body }),
    md: (s) => String(s || ''),
  };
  w.API = { get: async () => ({}), post: async () => ({}), put: async () => ({}), del: async () => ({}) };
  // CAR-137 — the docs-assistant H1 is built via HelpHint.title(); give the
  // harness the same inert stand-in the browser lib's shape provides.
  w.HelpHint = {
    title: (text) => w.UI.el('h1', { className: 'page-title' }, [w.UI.el('span', null, text)]),
    icon: () => w.UI.el('button', { className: 'help-hint', type: 'button' }, '?'),
    close() {},
  };
  w.LlmPageKit = {
    layout: ({ form, result }) => ({ root: w.UI.el('div', null, [form, result]), show() {} }),
    // the real kit's mount(container) returns the run api (llm-page-kit.js:194),
    // and the view reads runCtrl.cancelled / runCtrl.signal.aborted off it.
    createRun: () => {
      const api = { cancelled: false, signal: { aborted: false, addEventListener() {} }, mount: () => api };
      return api;
    },
    run: async (opts) => opts.request(opts.run.signal),
    postJSON: async () => response,
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Router', 'API', 'UI', 'I18n', 'HelpHint', VIEW)(
    w, doc, w.Router, w.API, w.UI, w.I18n, w.HelpHint,
  );
  return { w, routes, went, modals, toasts };
}

async function ask(routes, question = 'how do I scan job portals?') {
  const root = await routes['docs-assistant']();
  let input = null;
  const buttons = [];
  walk(root, (n) => {
    if (n.tagName === 'INPUT' && !input) input = n;
    if (n.tagName === 'BUTTON') buttons.push(n);
  });
  input.value = question;
  const askBtn = buttons.find((b) => textOf(b) === 'Ask');
  assert.ok(askBtn, 'the Ask button rendered');
  askBtn.click();
  await new Promise((r) => setTimeout(r, 5));
  return root;
}

function chatLog(root) {
  let log = null;
  walk(root, (n) => { if (n.className === 'chat-log') log = n; });
  assert.ok(log, 'the chat log rendered');
  return log;
}

/** The last bot bubble's inner parts container (bubble > div > [parts]). */
function lastAnswerParts(root) {
  return chatLog(root).lastChild.lastChild.children;
}

function chipsIn(node) {
  const chips = [];
  walk(node, (n) => { if (n.tagName === 'BUTTON') chips.push(n); });
  return chips;
}

test('CAR-136 T4: live answer renders Open chips ABOVE the answer, §1 falls back to #/auto', async () => {
  const { routes, went } = makeHarness({
    mode: 'live',
    answer: 'Run a scan from the Scan page.',
    sections: [
      '7. Scan (`#/scan`)',
      '1. Quick start — full step-by-step from "create CV" to "applied & messaged"',
      '15. Interview preparation', // names no route → no chip
      '8. Pipeline (`#/pipeline`)',
    ],
  });
  const root = await ask(routes);
  const parts = lastAnswerParts(root);
  // The chip row is the FIRST part, directly above the answer container.
  const row = parts[0];
  assert.ok(textOf(row).startsWith('Open:'), 'the row is labelled "Open:"');
  const chips = chipsIn(row);
  assert.deepEqual(chips.map(textOf),
    ['7. Scan', '1. Quick start — full', '8. Pipeline'],
    'labels: route-less §15 skipped, §1 label word-truncated');
  assert.equal(parts[1].className, 'md', 'the answer container sits BELOW the chip row');
  // Clicks route deterministically — no LLM compliance involved.
  chips[0].click();
  assert.ok(went.includes('#/scan'), 'chip click → Router.go(#/scan)');
  chips[1].click();
  assert.ok(went.includes('#/auto'), 'the hardcoded §1 fallback routes to #/auto');
  chips[2].click();
  assert.ok(went.includes('#/pipeline'), 'chip click → Router.go(#/pipeline)');
});

test('CAR-136 T4: duplicate routes collapse to one chip (first label wins)', async () => {
  const { routes } = makeHarness({
    mode: 'live',
    answer: 'ok',
    sections: ['20. Statistics by target roles (`#/stats`)', '26. Statistics (`#/stats`)'],
  });
  const root = await ask(routes);
  const chips = chipsIn(lastAnswerParts(root)[0]);
  assert.equal(chips.length, 1, 'one #/stats chip, not two');
  assert.equal(textOf(chips[0]), '20. Statistics by target roles');
});

test('CAR-136 T4: split sub-section titles (Parent › Sub) keep the parent route+label', async () => {
  const { routes, went } = makeHarness({
    mode: 'live',
    answer: 'ok',
    sections: ['7. Scan (`#/scan`) › Search & filters'],
  });
  const root = await ask(routes);
  const chips = chipsIn(lastAnswerParts(root)[0]);
  assert.deepEqual(chips.map(textOf), ['7. Scan']);
  chips[0].click();
  assert.ok(went.includes('#/scan'));
});

test('CAR-136 T4: manual-prompt mode shows the same chips above the copy-paste prompt', async () => {
  const { routes, went, modals } = makeHarness({
    mode: 'manual',
    prompt: 'PROMPT TEXT',
    sections: ['11. Tracker (`#/tracker`)'],
  });
  const root = await ask(routes);
  assert.equal(modals.length, 1, 'the manual prompt modal opened');
  const body = modals[0].body;
  // The chip row is the FIRST node of the modal body, above the textarea.
  const chips = chipsIn(body.children[0]);
  assert.deepEqual(chips.map(textOf), ['11. Tracker']);
  chips[0].click();
  assert.ok(went.includes('#/tracker'), 'manual-mode chips route too');
  const ta = body.children[body.children.length - 1];
  assert.equal(ta.tagName, 'TEXTAREA', 'the copy-paste prompt stays below the chips');
});

test('CAR-136 T4: no sections → no chip row, the answer still renders', async () => {
  const { routes } = makeHarness({ mode: 'live', answer: 'plain answer', sections: [] });
  const root = await ask(routes);
  const parts = lastAnswerParts(root);
  assert.equal(parts.length, 1, 'nothing but the answer');
  assert.equal(parts[0].className, 'md');
  assert.ok(!textOf(parts[0]).startsWith('Open:'));
});

test('CAR-136 T4: malformed section entries are ignored, valid ones still chip', async () => {
  const { routes } = makeHarness({
    mode: 'live',
    answer: 'x',
    sections: [null, 42, '   ', '9. Evaluate (`#/evaluate`)'],
  });
  const root = await ask(routes);
  const chips = chipsIn(lastAnswerParts(root)[0]);
  assert.deepEqual(chips.map(textOf), ['9. Evaluate']);
  assert.equal(chips.length, 1);
});

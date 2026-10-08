/**
 * window.ScanResults (public/js/lib/scan-results.js) — the #/scan
 * results-rendering subsystem, exercised through a minimal DOM stub (no
 * jsdom in the suite; only what render() actually touches).
 *
 * v1.243.0 coverage:
 *   - a facet-chip toggle re-renders the whole results subtree: the
 *     Advanced <details> used to collapse, keyboard focus dropped to
 *     <body>, and the pager kept its deep page — now the open state and
 *     focus are carried across and the pager resets like any filter
 *     change;
 *   - the "Advanced" summary timestamps format with the ACTIVE locale
 *     (was hard-coded toLocaleString('ru') for all 17 locales);
 *   - the Cyrillic dynamic-keyword gate includes uk (was lang==='ru'
 *     only, hiding Cyrillic chips from Ukrainian users);
 *   - only an http(s) r.url becomes an anchor href (a javascript:/data:
 *     url or a missing one used to be written straight into href).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ───────────────────────── mini-DOM ─────────────────────────

function matchesSel(node, sel) {
  const parts = sel.split('.');
  const tag = (parts[0] || '').toLowerCase();
  if (tag && String(node.tag).toLowerCase() !== tag) return false;
  return parts.slice(1).every((cls) => String(node.className || '').split(/\s+/).includes(cls));
}

function walk(node, fn) {
  fn(node);
  for (const ch of node.children) if (typeof ch !== 'string') walk(ch, fn);
}

function makeEl(docRef) {
  return (tag, attrs, children) => {
    const node = {
      tag, attrs: {}, children: [], style: {}, value: '', checked: false,
      className: '', open: false, scrollTop: 0, scrollHeight: 0,
      _listeners: {},
      get classList() {
        const self = this;
        return {
          contains: (c) => String(self.className).split(/\s+/).includes(c),
          add: (c) => { if (!self.classList.contains(c)) self.className = (self.className + ' ' + c).trim(); },
          remove: (c) => { self.className = String(self.className).split(/\s+/).filter((x) => x !== c).join(' '); },
        };
      },
      appendChild(ch) {
        if (ch == null || ch === false) return;
        this.children.push(typeof ch === 'string' ? ch : ch);
        if (ch && typeof ch === 'object') ch.parentNode = this;
      },
      removeChild(ch) {
        const i = this.children.indexOf(ch);
        if (i >= 0) this.children.splice(i, 1);
      },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      setAttribute(k, v) {
        this.attrs[k] = String(v);
        if (k === 'class') this.className = String(v);
        if (k === 'open') this.open = true;
        if (k === 'value') this.value = String(v);
      },
      getAttribute(k) { return (k in this.attrs) ? this.attrs[k] : null; },
      focus() { docRef.activeElement = this; },
      click() { if (this._listeners.click) this._listeners.click(); },
      keydown(k) { if (this._listeners.keydown) this._listeners.keydown({ key: k, preventDefault() {} }); },
      contains(other) {
        let found = false;
        walk(this, (n) => { if (n === other) found = true; });
        return found;
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const skip = new Set([this]);
        walk(this, (n) => { if (!skip.has(n) && matchesSel(n, sel)) out.push(n); });
        return out;
      },
      get childNodes() { return this.children; },
      get lastChild() { return this.children[this.children.length - 1] || null; },
      get options() { return this.children; },
      get textContent() {
        return this.children.map((ch) => (typeof ch === 'string' ? ch : ch.textContent)).join('');
      },
      set textContent(v) { this.children.length = 0; if (v) this.children.push(String(v)); },
      set innerHTML(v) { this.children.length = 0; },
    };
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'className') node.className = v;
      else if (k === 'style') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node._listeners[k.slice(2).toLowerCase()] = v;
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    if (children != null) {
      for (const ch of [].concat(children)) {
        if (ch == null || ch === false) continue;
        node.appendChild(typeof ch === 'string' ? ch : ch);
      }
    }
    return node;
  };
}

// ───────────────────────── harness ─────────────────────────

const ROWS = [
  { title: 'Старший разработчик Python', company: 'Ромашка', location: 'Москва', url: 'https://hh.ru/1', salary: '', source: 'hh.ru', isRemote: false, date: '2026-10-08' },
  { title: 'Старший разработчик Go', company: 'Вектор', location: 'СПб', url: 'https://hh.ru/2', salary: '', source: 'hh.ru', isRemote: false, date: '2026-10-08' },
  { title: 'Старший разработчик Java', company: 'Дельта', location: 'Казань', url: '', salary: '', source: 'hh.ru', isRemote: false, date: '2026-10-08' },
  { title: 'Product Manager', company: 'Acme', location: 'Berlin', url: 'javascript:alert(1)', salary: '', source: 'greenhouse', isRemote: true, date: '2026-10-08' },
];

function makeEnv(lang, { pageSize = 1 } = {}) {
  const document = { activeElement: null };
  globalThis.document = document;
  const w = { UI: { el: makeEl(document) }, Skills: null };
  // Real skills.js — the facets/keyword/salary logic under test is the
  // production one.
  new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/skills.js'), 'utf8'))(w); // eslint-disable-line no-new-func
  new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/scan-results.js'), 'utf8'))(w); // eslint-disable-line no-new-func
  w.Countries = { countriesIn: () => [], rowInCountry: () => true };
  w.ScanPrefs = { listFavorites: () => [], isFavorite: () => false, toggleFavorite() {} };
  w.I18n = { getLang: () => lang };
  // scan-results.js reads `window.I18n && I18n.getLang()` — the bare I18n is
  // the browser global; mirror it so the same branch runs under Node.
  globalThis.I18n = w.I18n;

  const results = {
    en: { when: '2026-10-08T10:00:00Z', fresh: ROWS.slice(0, 1), filtered: [ROWS[3]] },
    ru: { when: '2026-10-08T09:30:00Z', fresh: [], filtered: ROWS.slice(0, 3) },
  };
  const el = w.UI.el;
  const input = (v) => { const n = el('input'); n.value = v; return n; };
  const select = (v) => { const n = el('select'); n.value = v; n.appendChild(el('option', { value: '' }, 'All')); return n; };
  const pager = {
    page: 0, pageSize,
    reset() { this.page = 0; },
    slice(arr) { return arr.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize); },
    controls() { return el('div', { className: 'paginator' }, ''); },
  };
  const resultsEl = el('div', { id: 'results' });
  const ctx = {
    t: (k, f) => f,
    resultsEl, pager,
    filterScope: select(''), filterText: input(''), filterExclude: input(''), filterRemote: select(''),
    filterSource: select(''), filterCountry: select(''), filterSeniority: select(''),
    filterAge: input(''), favOnly: input(''), filterSalaryMin: input(''), filterSalaryMax: input(''),
    activeTech: new Set(), activeLevel: new Set(), activeDynamic: new Set(),
    twoPagerData: null,
    getLastResults: () => results,
  };
  const SR = w.ScanResults.create(ctx);
  return { SR, ctx, resultsEl, pager, document };
}

/** Every anchor href in the rendered tree. */
function hrefs(root) {
  const out = [];
  walk(root, (n) => { if (n.attrs && typeof n.attrs.href === 'string') out.push(n.attrs.href); });
  return out;
}

before(() => {});

// ───────────────────────── chip toggle state ─────────────────────────

test('toggling a chip keeps the Advanced disclosure open (was: collapsed)', () => {
  const env = makeEnv('ru');
  env.SR.render();
  const details = env.resultsEl.querySelector('details.scan-advanced');
  assert.ok(details, 'advanced disclosure rendered');
  details.open = true; // the user expanded it
  const chip = details.querySelectorAll('.chip').find((n) => n.getAttribute('data-chip') === 'разработчик');
  assert.ok(chip, 'cyrillic keyword chip rendered');
  chip.click(); // toggle → re-render
  const after = env.resultsEl.querySelector('details.scan-advanced');
  assert.ok(after, 'disclosure re-rendered');
  assert.equal(after.open, true, 'open state carried across the re-render');
});

test('toggling a chip restores keyboard focus to the same chip (was: dropped to body)', () => {
  const env = makeEnv('ru');
  env.SR.render();
  const details = env.resultsEl.querySelector('details.scan-advanced');
  details.open = true;
  const chip = details.querySelectorAll('.chip').find((n) => n.getAttribute('data-chip') === 'разработчик');
  env.document.activeElement = chip;
  chip.click();
  const focused = env.document.activeElement;
  assert.ok(focused, 'something is focused');
  assert.equal(focused.getAttribute && focused.getAttribute('data-chip'), 'разработчик',
    'focus restored to the same chip after the rebuild');
});

test('toggling a chip resets the pager like any other filter change', () => {
  const env = makeEnv('ru');
  env.pager.page = 2; // user paged deep
  env.SR.render();
  const chip = env.resultsEl.querySelectorAll('.chip').find((n) => n.getAttribute('data-chip') === 'разработчик');
  chip.click();
  assert.equal(env.pager.page, 0, 'pager.reset() ran on the facet toggle');
});

test('the clear-all chip resets the pager too', () => {
  const env = makeEnv('ru');
  env.pager.page = 1;
  env.SR.render();
  const chip = env.resultsEl.querySelectorAll('.chip').find((n) => n.getAttribute('data-chip') === 'разработчик');
  chip.click(); // activate one chip first
  assert.equal(env.pager.page, 0);
  const clear = env.resultsEl.querySelectorAll('.chip.clear')[0];
  assert.ok(clear, 'clear-all chip rendered while a chip is active');
  clear.click();
  assert.ok(!env.resultsEl.querySelectorAll('.chip').some((n) => n.getAttribute('aria-pressed') === 'true'),
    'all chips cleared');
});

test('chips keep their button semantics and Enter/Space toggles (regression guard)', () => {
  const env = makeEnv('ru');
  env.pager.page = 2;
  env.SR.render();
  const chip = env.resultsEl.querySelectorAll('.chip').find((n) => n.getAttribute('data-chip') === 'разработчик');
  assert.equal(chip.getAttribute('role'), 'button');
  assert.equal(chip.getAttribute('tabindex'), '0');
  chip.keydown('Enter'); // toggle via keyboard → re-render + pager reset
  assert.equal(env.pager.page, 0, 'keyboard toggle drove the same toggle() path');
  assert.ok(env.resultsEl.querySelector('details.scan-advanced'), 'render survived');
});

// ───────────────────────── locale handling ─────────────────────────

test('summary timestamps format with the ACTIVE locale, not hard-coded ru', () => {
  const seen = [];
  const orig = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (...args) { seen.push(args[0]); return orig.apply(this, args); };
  try {
    makeEnv('de').SR.render();
    assert.ok(seen.length >= 2, 'both badges formatted');
    assert.ok(seen.every((l) => l === 'de'), `every toLocaleString call used the active locale, saw: ${seen}`);
  } finally {
    Date.prototype.toLocaleString = orig;
  }
});

test('uk locale keeps Cyrillic dynamic keyword chips (gate is ru+uk, not ru only)', () => {
  const env = makeEnv('uk');
  env.SR.render();
  const chips = env.resultsEl.querySelectorAll('.chip').map((n) => n.getAttribute('data-chip'));
  assert.ok(chips.includes('разработчик'), `uk must see Cyrillic chips, saw: ${chips}`);
});

test('en locale still hides Cyrillic-only keyword chips (latin script gate)', () => {
  const env = makeEnv('en');
  env.SR.render();
  const chips = env.resultsEl.querySelectorAll('.chip').map((n) => n.getAttribute('data-chip')).filter(Boolean);
  assert.ok(!chips.includes('разработчик'), 'en must not show Cyrillic-only chips');
  assert.ok(chips.length === 0 || chips.every((c) => !/[а-я]/i.test(c)), `no cyrillic chips: ${chips}`);
});

// ───────────────────────── href safety ─────────────────────────

test('only http(s) URLs become anchors — javascript: renders as text', () => {
  const env = makeEnv('en', { pageSize: 10 });
  env.SR.render();
  const hs = hrefs(env.resultsEl);
  assert.ok(hs.length > 0);
  assert.ok(hs.every((h) => /^https?:\/\//i.test(h)), `unsafe href leaked: ${hs}`);
  assert.ok(env.resultsEl.textContent.includes('Product Manager'),
    'the unsafe-url title is still rendered as text');
});

test('https rows keep target=_blank + rel=noopener', () => {
  const env = makeEnv('en', { pageSize: 10 });
  env.SR.render();
  const anchor = env.resultsEl.querySelectorAll('a').find((n) => n.attrs.href === 'https://hh.ru/1');
  assert.ok(anchor, 'anchor present');
  assert.equal(anchor.attrs.target, '_blank');
  assert.equal(anchor.attrs.rel, 'noopener');
});

test('a row with an empty url renders unlinked (no href attribute)', () => {
  const env = makeEnv('en', { pageSize: 10 });
  env.SR.render();
  const hs = hrefs(env.resultsEl);
  assert.ok(!hs.includes(''), `empty href leaked: ${hs}`);
  assert.ok(env.resultsEl.textContent.includes('Старший разработчик Java'),
    'empty-url row still listed');
});

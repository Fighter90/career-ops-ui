/**
 * CAR-115 — #/scan v2: live filter chips, one filter system, windowed
 * results, quick view.
 *
 * Behavioural coverage of the pure logic through the REAL modules (no
 * network, no browser, no parent dependency — the scan-results-state harness
 * pattern):
 *
 *   1. filters.js — URL round-trip (#/scan?q=…), -word-aware state,
 *      active-filter descriptors, applyFilters pinned body intact.
 *   2. scan-results windowing — windowRange math (buffer, WIN_MIN bypass,
 *      scrollTop offset) driven through the real create() with a layoutful
 *      stub viewport.
 *   3. sort — the user comparator re-orders the boost-first partition and
 *      th clicks report through ctx.onSortChange.
 *   4. quick view (scan/runner.js) — opens with the row's data, actions
 *      wired, Escape/backdrop close restores focus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadScanSrc } from './helpers/scan-src.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FILTERS_SRC = readFileSync(resolve(ROOT, 'public/js/views/scan/filters.js'), 'utf8');
const RUNNER_SRC = readFileSync(resolve(ROOT, 'public/js/views/scan/runner.js'), 'utf8');
const SCAN_SRC = readFileSync(resolve(ROOT, 'public/js/views/scan.js'), 'utf8');

// ───────────────────────── mini-DOM (same shape as scan-results-state) ──────

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
function makeEl(docRef, layout = {}) {
  return (tag, attrs, children) => {
    const node = {
      tag, attrs: {}, children: [], style: {}, value: '', checked: false,
      className: '', open: false, scrollTop: 0, scrollHeight: 0, dataset: {},
      hidden: false,
      // windowing inputs — per-factory layout defaults (the windowed render
      // reads clientHeight off the viewport and offsetHeight off rows)
      clientHeight: layout.clientHeight || 0, offsetHeight: layout.offsetHeight || 0,
      _listeners: {},
      get classList() {
        const self = this;
        return {
          contains: (c) => String(self.className).split(/\s+/).includes(c),
          add: (c) => { if (!self.classList.contains(c)) self.className = (self.className + ' ' + c).trim(); },
          remove: (c) => { self.className = String(self.className).split(/\s+/).filter((x) => x !== c).join(' '); },
          toggle: (c) => { if (self.classList.contains(c)) { self.classList.remove(c); return false; } self.classList.add(c); return true; },
        };
      },
      addEventListener(type, fn) { this._listeners[type] = this._listeners[type] || []; this._listeners[type].push(fn); },
      removeEventListener(type, fn) { const a = this._listeners[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
      appendChild(ch) {
        if (ch == null || ch === false) return;
        this.children.push(ch);
        if (ch && typeof ch === 'object') ch.parentNode = this;
      },
      replaceChildren(...nodes) { this.children.length = 0; for (const n of nodes) this.appendChild(n); },
      removeChild(ch) { const i = this.children.indexOf(ch); if (i >= 0) this.children.splice(i, 1); },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); if (k === 'hidden') this.hidden = true; if (k === 'value') this.value = String(v); },
      getAttribute(k) { return (k in this.attrs) ? this.attrs[k] : null; },
      focus() { docRef.activeElement = this; },
      _fire(type, ev) {
        const ls = this._listeners[type];
        if (!ls) return;
        for (const fn of Array.isArray(ls) ? ls : [ls]) fn(ev);
      },
      click() { this._fire('click', { target: this, currentTarget: this, stopPropagation() {} }); },
      keydown(k) { this._fire('keydown', { key: k, preventDefault() {}, target: this, currentTarget: this }); },
      contains(other) { let found = false; walk(this, (n) => { if (n === other) found = true; }); return found; },
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
      get selectedOptions() { return this.value ? [this.children.find((o) => o.attrs && o.attrs.value === this.value)].filter(Boolean) : []; },
      get textContent() { return this.children.map((ch) => (typeof ch === 'string' ? ch : ch.textContent)).join(''); },
      set textContent(v) { this.children.length = 0; if (v) this.children.push(String(v)); },
      set innerHTML(v) { this.children.length = 0; },
    };
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'className') node.className = v;
      else if (k === 'style') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        const type = k.slice(2).toLowerCase();
        node._listeners[type] = node._listeners[type] || [];
        node._listeners[type].push(v);
      }
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

// ───────────────────────── 1. filters.js — URL state + active chips ─────────

function bootFilters() {
  globalThis.document = { activeElement: null };
  const fakeWindow = { UI: { confirm: async () => true, toast: () => {} }, ScanPrefs: { listSearches: () => [], saveSearch() {}, removeSearch() {} } };
  new Function('window', FILTERS_SRC)(fakeWindow); // eslint-disable-line no-new-func
  const document = { activeElement: null };
  const el = makeEl(document);
  const mk = () => ({ value: '', checked: false, dataset: {} });
  const select = () => {
    const n = { value: '', checked: false, dataset: {}, children: [], selectedOptions: [] };
    return n;
  };
  const refs = {
    filterText: mk(), filterExclude: mk(), filterRemote: select(),
    filterSalaryMin: mk(), filterSalaryMax: mk(), filterSalaryAny: mk(),
    filterSource: select(), filterCountry: select(), filterSeniority: select(),
    filterScope: mk(), filterAge: mk(), favOnly: mk(),
    activeTech: new Set(), activeLevel: new Set(), activeDynamic: new Set(),
  };
  let renders = 0;
  const api = fakeWindow.createScanFilters(refs, {
    pager: { reset() {} },
    SR: { render() { renders += 1; } },
    t: (k, f) => f,
  });
  return { api, refs, el, renders: () => renders };
}

test('CAR-115: filter state round-trips through the #/scan?… URL params', () => {
  const { api, refs } = bootFilters();
  refs.filterText.value = 'python -django';
  refs.filterRemote.value = 'remote';
  refs.filterSalaryMin.value = '100000';
  refs.filterSalaryAny.checked = true;
  refs.filterSource.value = 'greenhouse';
  refs.filterCountry.value = 'DE';
  refs.filterSeniority.value = 'senior';
  refs.filterScope.value = 'fresh';
  refs.filterAge.value = '7';
  refs.favOnly.checked = true;
  refs.activeTech.add('php');
  refs.activeDynamic.add('разработчик');
  const qs = api.urlFromFilters({ sort: 'salary', dir: 'desc' });
  const restored = api.filtersFromUrl('#/scan?' + qs);
  assert.ok(restored, 'params recognized');
  assert.equal(restored.text, 'python -django');
  assert.equal(restored.remote, 'remote');
  assert.equal(restored.salaryMin, '100000');
  assert.equal(restored.salaryAny, true);
  assert.equal(restored.source, 'greenhouse');
  assert.equal(restored.country, 'DE');
  assert.equal(restored.seniority, 'senior');
  assert.equal(restored.scope, 'fresh');
  assert.equal(restored.age, '7');
  assert.equal(restored.favOnly, true);
  assert.deepEqual(restored.tech, ['php']);
  assert.deepEqual(restored.dynamic, ['разработчик']);
  assert.deepEqual(restored.__extra, undefined);
  // sort rides the SAME query (written by the caller, read back here)
  const p = new URLSearchParams(qs);
  assert.equal(p.get('sort'), 'salary');
  assert.equal(p.get('dir'), 'desc');
});

test('CAR-115: an empty or foreign hash parses to null (no filters from URL)', () => {
  const { api } = bootFilters();
  assert.equal(api.filtersFromUrl('#/scan'), null);
  assert.equal(api.filtersFromUrl('#/tracker?x=1'), null);
});

test('CAR-115: applyFilters keeps its pinned minimal body; commitFilters adds URL sync', () => {
  // scan-paginator pins applyFilters() { pager.reset(); SR.render(); } — the
  // live path must funnel THROUGH it, not around it.
  assert.match(FILTERS_SRC, /function\s+applyFilters\s*\(\s*\)\s*\{\s*pager\.reset\(\)\s*;\s*SR\.render\(\)\s*;?\s*\}/);
  assert.match(FILTERS_SRC, /function commitFilters\(\) \{ applyFilters\(\); syncUrl\(\); \}/);
  const { api, renders } = bootFilters();
  api.commitFilters();
  assert.equal(renders(), 1, 'commitFilters rendered once');
});

test('CAR-115: active descriptors name every engaged filter with a clear() back-out', () => {
  const { api, refs } = bootFilters();
  assert.deepEqual(api.activeDescriptors(), [], 'nothing engaged → no chips');
  refs.filterText.value = 'python';
  refs.favOnly.checked = true;
  refs.activeLevel.add('senior');
  const desc = api.activeDescriptors();
  const keys = desc.map((d) => d.key);
  assert.deepEqual(keys, ['q', 'fav', 'lvl']);
  assert.ok(desc.every((d) => typeof d.clear === 'function'));
  // clearing through the descriptor really clears the control
  desc.find((d) => d.key === 'q').clear();
  assert.equal(refs.filterText.value, '');
  desc.find((d) => d.key === 'lvl').clear();
  assert.equal(refs.activeLevel.size, 0);
});

test('CAR-115: buildActiveBar renders a chip per engaged filter + Reset all', () => {
  const { api, refs, el } = bootFilters();
  refs.filterText.value = 'python';
  refs.filterSeniority.value = 'senior';
  refs.filterSeniority.selectedOptions = [{ textContent: 'Senior (3)' }];
  const bar = api.buildActiveBar(el, () => {});
  assert.equal(bar.className, 'v2-scan-active');
  const chips = bar.querySelectorAll('.chip');
  assert.equal(chips.length, 3, 'two filters + Reset all');
  assert.equal(chips[2].getAttribute('data-chip'), 'active-reset');
  // clicking a chip's ✕ (the chip itself here) clears that filter
  chips[0].click();
  assert.equal(refs.filterText.value, '');
});

// ───────────────────────── 2. windowing (real create()) ─────────────────────

const ROWS = Array.from({ length: 120 }, (_, i) => ({
  title: `Engineer ${i}`, company: `C${i}`, location: 'Berlin', url: `https://x/${i}`,
  salary: '', source: 'greenhouse', isRemote: false, date: '2026-10-01',
}));

function bootResults({ corpus = ROWS, viewportH = 0, rowH = 48 } = {}) {
  const document = { activeElement: null };
  globalThis.document = document; // the eval'd view reads the bare global
  const w = { UI: { el: makeEl(document, { clientHeight: viewportH, offsetHeight: rowH }) }, Skills: null };
  new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/skills.js'), 'utf8'))(w); // eslint-disable-line no-new-func
  new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/scan-results.js'), 'utf8'))(w); // eslint-disable-line no-new-func
  w.Countries = { countriesIn: () => [], rowInCountry: () => true };
  w.ScanPrefs = { listFavorites: () => [], isFavorite: () => false, toggleFavorite() {} };
  w.I18n = { getLang: () => 'en' };
  globalThis.I18n = w.I18n;
  const el = w.UI.el;
  const input = (v) => { const n = el('input'); n.value = v; return n; };
  const select = () => { const n = el('select'); n.appendChild(el('option', { value: '' }, 'All')); return n; };
  const pager = {
    page: 0, pageSize: 50,
    reset() { this.page = 0; },
    slice(arr) { return arr.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize); },
    controls() { return el('div', { className: 'paginator' }, ''); },
  };
  const resultsEl = el('div', { id: 'results' });
  let lastSort = null;
  const ctx = {
    t: (k, f) => f, resultsEl, pager,
    filterScope: select(), filterText: input(''), filterExclude: input(''), filterRemote: select(),
    filterSource: select(), filterCountry: select(), filterSeniority: select(),
    filterAge: input(''), favOnly: input(''), filterSalaryMin: input(''), filterSalaryMax: input(''),
    filterSalaryAny: input(''),
    activeTech: new Set(), activeLevel: new Set(), activeDynamic: new Set(),
    twoPagerData: null,
    getLastResults: () => ({ en: { when: '2026-10-01T10:00:00Z', fresh: [], filtered: corpus }, ru: null }),
    onSortChange: (k, d) => { lastSort = [k, d]; },
  };
  const SR = w.ScanResults.create(ctx);
  return { SR, resultsEl, el, document, viewportH, rowH, lastSort: () => lastSort, ctx };
}

test('CAR-115: windowing — a tall viewport renders only visible rows + buffer + spacers', () => {
  const env = bootResults({ viewportH: 480, rowH: 48 });
  env.SR.render();
  const paged = env.resultsEl.querySelectorAll('tr.scan-row').length;
  // 480px viewport → 10 visible rows + 2×6 buffer = 22 (page size 50)
  assert.ok(paged > 0 && paged <= 22, `windowed rows: ${paged} (expected ≤ 22)`);
  // spacer rows account for the off-screen remainder
  const pads = env.resultsEl.querySelectorAll('tr.v2-scan-pad');
  assert.equal(pads.length, 1, 'a bottom spacer keeps the scrollbar honest');
});

test('CAR-115: windowing — small corpora render whole (no spacers, exact counts)', () => {
  const env = bootResults({ corpus: ROWS.slice(0, 6), viewportH: 480 });
  env.SR.render();
  const rows = env.resultsEl.querySelectorAll('tr.scan-row').length;
  assert.equal(rows, 6, 'all six rows render — WIN_MIN bypasses the window');
  assert.equal(env.resultsEl.querySelectorAll('tr.v2-scan-pad').length, 0, 'no spacers');
});

test('CAR-115: scroll moves the window (scrollTop → offset slice)', () => {
  const env = bootResults({ viewportH: 480, rowH: 48 });
  env.SR.render();
  const vp = env.resultsEl.querySelector('.v2-scan-viewport');
  vp.scrollTop = 48 * 20; // row 20 at the top
  // the scroll listener is a real DOM addEventListener — drive the handler
  const handlers = vp._listeners.scroll || [];
  assert.ok(handlers.length >= 1, 'a passive scroll listener is attached');
  handlers[handlers.length - 1]();
  const firstTr = vp.querySelectorAll('tr.scan-row')[0];
  const first = firstTr.querySelector('.scan-posting-title').textContent;
  assert.match(first, /Engineer (1[0-9]|2[0-5])$/, `the window slid to ~row ${first}`);
});

// ───────────────────────── 3. sort ───────────────────────────────────────────

test('CAR-115: salary sort re-orders the boost-first partition (desc → richest first)', () => {
  const rows = [
    { title: 'A', company: 'x', salary: '50k', url: 'https://x/1' },
    { title: 'B', company: 'x', salary: '120k', url: 'https://x/2' },
    { title: 'C', company: 'x', salary: '90k', url: 'https://x/3' },
  ];
  const env = bootResults({ corpus: rows });
  env.ctx.onSortChange && null;
  // drive through the real th button
  env.SR.render();
  const sortBtns = env.resultsEl.querySelectorAll('.v2-scan-sort');
  assert.equal(sortBtns.length, 3, 'role/seniority/salary are sortable');
  sortBtns[2].click(); // salary asc→desc default desc
  assert.deepEqual(env.lastSort(), ['salary', 'desc']);
  const tbody = env.resultsEl.querySelector('tbody');
  const salaries = tbody.querySelectorAll('tr')
    .map((tr) => { const s = tr.querySelector('span.scan-salary-text'); return s ? s.textContent : null; })
    .filter(Boolean);
  assert.equal(salaries[0], '120k', 'richest first');
});

test('CAR-115: th sort keeps the aria-sort state machine (none → descending → ascending)', () => {
  const env = bootResults({ corpus: ROWS.slice(0, 3) });
  env.SR.render();
  const th = () => env.resultsEl.querySelectorAll('.v2-scan-sort')[2].parentNode;
  assert.equal(th().getAttribute('aria-sort'), 'none');
  const btn = th().querySelector('button.v2-scan-sort');
  btn.click();
  assert.equal(th().getAttribute('aria-sort'), 'descending');
  btn.click();
  assert.equal(th().getAttribute('aria-sort'), 'ascending');
});

// ───────────────────────── 4. quick view (scan/runner.js) ────────────────────

function bootQuickView() {
  const document = { activeElement: null, body: { addEventListener() {}, removeEventListener() {} } };
  globalThis.document = document; // the eval'd factory reads the bare global
  const w = {
    UI: { el: makeEl(document), toast: (msg) => { w.__toast = msg; } },
    ScanPrefs: { isFavorite: (u) => u === 'https://x/starred', toggleFavorite() {} },
    JobFacets: { daysSince: () => 2 },
    API: { post: async () => ({ ok: true, deduped: false }) },
    Router: { go: (h) => { w.__nav = h; } },
  };
  new Function('window', RUNNER_SRC)(w); // eslint-disable-line no-new-func
  const view = {};
  const pair = w.createScanQuickView({ c: w.UI.el, t: (k, f) => f, SR: { render() {} }, view });
  return { w, view, backdrop: pair[0], panel: pair[1], document };
}

test('CAR-115: quick view opens with the row data; Escape closes and restores focus', () => {
  const { view, panel, backdrop, document } = bootQuickView();
  const row = { title: 'Backend Engineer', company: 'Acme', location: 'Berlin', source: 'greenhouse', url: 'https://x/1', salary: '90k', description: 'Build things', isRemote: false, workplaceType: 'Onsite' };
  const focal = { focus() { document.activeElement = focal; } };
  document.activeElement = focal;
  view.openQuickView(row);
  assert.equal(panel.classList.contains('is-open'), true);
  assert.equal(backdrop.classList.contains('is-open'), true);
  assert.match(panel.textContent, /Backend Engineer/);
  assert.match(panel.textContent, /Acme · Berlin · greenhouse · 2d · Onsite/);
  assert.match(panel.textContent, /Build things/);
  assert.ok(panel.querySelector('a').attrs.href === 'https://x/1', 'the posting link carries the safe URL');
  // Escape closes and hands focus back to the row
  panel.keydown('Escape');
  assert.equal(panel.classList.contains('is-open'), false);
  assert.equal(document.activeElement, focal, 'focus returned to the opening row');
});

test('CAR-115: quick view actions — Evaluate navigates, ★ toggles, unsafe URLs unlink', () => {
  const { w, view, panel } = bootQuickView();
  view.openQuickView({ title: 'X', company: 'Y', url: 'javascript:alert(1)', salary: '' });
  const btns = panel.querySelectorAll('button');
  const evalBtn = btns.find((b) => b.textContent === 'Evaluate');
  assert.ok(evalBtn.getAttribute('disabled') !== null, 'Evaluate disables for a non-http(s) posting');
  evalBtn.click();
  assert.equal(w.__nav, undefined, 'a javascript: url never navigates');
  assert.ok(panel.textContent.includes('No description captured'), 'the empty-description fallback');
  const safe = bootQuickView();
  safe.view.openQuickView({ title: 'X', company: 'Y', url: 'https://x/2', salary: '' });
  safe.panel.querySelectorAll('button').find((b) => b.textContent === 'Evaluate').click();
  assert.equal(safe.w.__nav, '/evaluate?url=' + encodeURIComponent('https://x/2'));
  const link = safe.panel.querySelector('a');
  assert.equal(link.attrs.href, 'https://x/2');
  assert.equal(link.attrs.rel, 'noopener');
});

// ───────────────────────── 5. static guards ──────────────────────────────────

test('CAR-115: URL sync uses replaceState (no hashchange re-render loop)', () => {
  assert.match(FILTERS_SRC, /history\.replaceState\(null, '', next \+ \(qs \? '\?' \+ qs : ''\)\)/);
  assert.doesNotMatch(FILTERS_SRC, /location\.hash\s*=/, 'never re-assign the hash (would re-render)');
});

test('CAR-115: the quick-view row trigger keeps nested controls clickable', () => {
  const ALL = loadScanSrc();
  assert.match(ALL, /tgt\.closest\('a,button'\)/, 'the row click guard');
  assert.match(ALL, /e\.target !== e\.currentTarget\) return;/, 'the row keydown guard');
});

test('CAR-115: every row icon keeps its accessible name (acceptance #4)', () => {
  // boost/fit/score/trust/reloc icons all set aria-label + title (existing
  // contract); the quick-view affordance adds a title hint on the row.
  const ALL = loadScanSrc();
  assert.match(ALL, /t\('scan\.boostIcon'/);
  assert.match(ALL, /t\('scan\.fitIcon'/);
  assert.match(ALL, /t\('scan\.scoreIcon'/);
  assert.match(ALL, /t\('scan\.trustTip'/);
  assert.match(ALL, /t\('scan\.col\.reloc'/);
});

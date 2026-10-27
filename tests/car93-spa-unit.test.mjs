/**
 * CAR-93 (Opus 5-5 SPA review, sourcing views) — unit-level red→green gates.
 *
 * Behavioural (run the production code through minimal stubs):
 *   - scan/runner.js: releasing the stream handle CLOSES the EventSource
 *     before nulling it (a live ES left in `activeES` made Stop/teardown
 *     no-ops and could auto-reconnect a finished scan);
 *   - scan/filters.js: a saved-search restore stashes the desired
 *     country/seniority/source in `dataset.want` so the dynamically
 *     painted <option>s can apply it once they exist;
 *   - scan-results.js paintCountryOptions/paintSeniorityOptions: apply (and
 *     clear) a pending `dataset.want`, and keep the star's `data-key` so a
 *     toggle re-render can restore keyboard focus to the same row.
 *
 * Source canaries (the views are browser-only IIFEs; the repo convention is
 * static canaries + browser suites — see views-client-fixes-car21.test.mjs):
 *   pipeline onKeyDown target guard · config keep · config/dashboard
 *   re-render-safe listener cleanup · scan route prologue teardown ·
 *   auto.js has no bare fetch · tracker/dashboard classifier rename ·
 *   focus-preservation marker carries data-key/aria-label.
 *
 * CI-isolated: reads files + runs stubs only; no server, no network, no
 * parent project.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const SCAN_SRC = () => [
  R('public/js/views/scan.js'),
  R('public/js/views/scan/runner.js'),
  R('public/js/views/scan/filters.js'),
  R('public/js/lib/scan-results.js'),
].join('\n');
const PIPE = R('public/js/views/pipeline.js');
const CONFIG = R('public/js/views/config.js');
const DASH = R('public/js/views/dashboard.js');
const AUTO = R('public/js/views/auto.js');
const TRACKER = R('public/js/views/tracker.js');
const APIJS = R('public/js/api.js');

// ═══════════════════════ F7 — runner closes the EventSource ═══════════════════════

function bootRunner() {
  const closings = [];
  let streamHandler = null;
  let streamPath = '';
  const es = {
    close() { es.closed = true; closings.push('close'); },
    closed: false,
  };
  const btn = () => ({
    disabled: false, hidden: false, className: '', textContent: '',
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    appendChild() {}, addEventListener() {},
  });
  const consoleEl = { textContent: '', children: [], scrollTop: 0, scrollHeight: 0, appendChild(ch) { this.children.push(ch); } };
  const ctx = {
    consoleEl,
    statusRegion: { textContent: '' },
    errBanner: { hidden: true, textContent: '', appendChild() {} },
    terminalEl: { dataset: {} },
    scanProgress: { classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} },
    scanProgressBar: { style: {} },
    scanProgressLabel: { textContent: '' },
    scanProgressWrap: { hidden: true },
    scanBtn: btn(), stopBtn: btn(),
    dryRun: { checked: false },
    companySelect: { value: '' },
    maxPerSource: { value: '' },
    t: (k, f) => f,
    c: (tag, attrs, kids) => ({ tag, attrs: attrs || {}, children: [].concat(kids == null ? [] : kids) }),
    refreshResults: () => Promise.resolve(),
    resetResultsCache: () => {},
  };
  const fakeWindow = {
    UI: { toast() {} },
    API: {
      stream(path, onEvent) {
        streamPath = path;
        streamHandler = onEvent;
        return es;
      },
    },
    createScanRunner: null,
  };
  const sandbox = {
    window: fakeWindow,
    UI: fakeWindow.UI,
    API: fakeWindow.API,
    document: { createElement: () => ({ className: '', textContent: '', style: {} }) },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    Promise, URL, URLSearchParams, TextDecoder: function () { this.decode = () => ''; },
    __cancelActiveScanPoll: () => {},
    __activeScanPollHandle: null,
    __activeScanDoneTimeout: null,
  };
  sandbox.globalThis = sandbox;
  const code = R('public/js/views/scan/runner.js');
  new Function('window', 'UI', 'API', 'document', 'setInterval', 'clearInterval',
    'setTimeout', 'clearTimeout', 'TextDecoder', 'URL', 'URLSearchParams',
    '__cancelActiveScanPoll', '__activeScanPollHandle', '__activeScanDoneTimeout', code)(
    fakeWindow, fakeWindow.UI, fakeWindow.API, sandbox.document,
    sandbox.setInterval, sandbox.clearInterval, sandbox.setTimeout, sandbox.clearTimeout,
    sandbox.TextDecoder, URL, URLSearchParams,
    sandbox.__cancelActiveScanPoll, sandbox.__activeScanPollHandle, sandbox.__activeScanDoneTimeout);
  const runner = fakeWindow.createScanRunner(ctx);
  return { runner, handler: () => streamHandler, path: () => streamPath, closings, es, consoleEl };
}

test('CAR-93 F7: runScanAll terminal done CLOSES the stream before dropping the handle', () => {
  const env = bootRunner();
  env.runner.runScanAll();
  assert.ok(env.handler(), 'API.stream was called');
  env.handler()('done', { counts: { raw: 1, fresh: 1 }, final: true });
  assert.equal(env.es.closed, true, 'the EventSource must be closed on the terminal done');
});

test('CAR-93 F7: runScanAll error branch CLOSES the stream before dropping the handle', () => {
  const env = bootRunner();
  env.runner.runScanAll();
  env.handler()('error', { message: 'boom' });
  assert.equal(env.es.closed, true, 'the EventSource must be closed on error');
});

test('CAR-93 F7: an intermediate-phase done keeps the stream; Stop still closes it', () => {
  const env = bootRunner();
  // runScanAll with final:false (the ATS phase of source=both) must NOT
  // close the stream — the regional phase is still running. Stop then
  // closes the still-open EventSource (the guard for the release path
  // streamTo shares).
  env.runner.runScanAll();
  env.handler()('done', { counts: { fresh: 0 }, final: false });
  assert.equal(env.es.closed, false, 'intermediate phase keeps the stream open');
  env.runner.stopScan();
  assert.equal(env.es.closed, true, 'Stop closes a still-open stream');
});

// ═══════════════════════ F3 — saved-search want stash (filters.js) ═══════════════════════

test('CAR-93 F3: setFilterState stashes country/seniority/source in dataset.want', () => {
  // filters.js is an IIFE assigning window.createScanFilters — boot it
  // against a stub window and drive the real factory.
  const fakeWindow = {};
  new Function('window', R('public/js/views/scan/filters.js'))(fakeWindow);
  const mk = () => ({ value: '', checked: false, dataset: {} });
  const refs = {
    filterText: mk(), filterExclude: mk(), filterRemote: mk(),
    filterSalaryMin: mk(), filterSalaryMax: mk(),
    filterSource: mk(), filterCountry: mk(), filterSeniority: mk(),
    filterScope: mk(), filterAge: mk(), favOnly: mk(),
    activeTech: new Set(), activeLevel: new Set(), activeDynamic: new Set(),
  };
  const { setFilterState, resetFilters, getFilterState } = fakeWindow.createScanFilters(
    refs, { pager: { reset() {} }, SR: { render() {} } });

  setFilterState({ text: 'engineer', country: 'DE', seniority: 'senior', source: 'greenhouse', scope: 'all', age: '', favOnly: false });
  assert.equal(refs.filterCountry.dataset.want, 'DE', 'country stash');
  assert.equal(refs.filterSeniority.dataset.want, 'senior', 'seniority stash');
  assert.equal(refs.filterSource.dataset.want, 'greenhouse', 'source stash');

  resetFilters();
  assert.equal(refs.filterCountry.dataset.want || '', '', 'reset clears the country stash');
  assert.equal(refs.filterSeniority.dataset.want || '', '', 'reset clears the seniority stash');
  assert.equal(refs.filterSource.dataset.want || '', '', 'reset clears the source stash');
  assert.equal(getFilterState().country, '', 'state round-trips');
});

// ═══════════════════ F3/F12 — scan-results paint + star focus (mini-DOM) ═══════════════════

function matchesSel(node, sel) {
  const parts = sel.split('.');
  const tag = (parts[0] || '').toLowerCase();
  if (tag && String(node.tag).toLowerCase() !== tag) return false;
  return parts.slice(1).every((cls) => String(node.className || '').split(/\s+/).includes(cls));
}
function walk(node, fn) {
  fn(node);
  for (const ch of node.children || []) if (typeof ch !== 'string') walk(ch, fn);
}
function makeEl(docRef) {
  return (tag, attrs, children) => {
    const node = {
      tag, attrs: {}, children: [], style: {}, value: '', checked: false,
      className: '', open: false, scrollTop: 0, scrollHeight: 0,
      dataset: {}, // CAR-93 — the saved-search stash lives on el.dataset
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
        this.children.push(ch);
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
      contains(other) {
        let found = false;
        walk(this, (n) => { if (n === other) found = true; });
        return found;
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        walk(this, (n) => { if (n !== this && matchesSel(n, sel)) out.push(n); });
        return out;
      },
      get childNodes() { return this.children; },
      get lastChild() { return this.children[this.children.length - 1] || null; },
      get options() { return this.children; },
      get textContent() {
        return (this.children || []).map((ch) => (typeof ch === 'string' ? ch : ch.textContent)).join('');
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

const CAR93_ROWS = [
  { title: 'Senior Backend Engineer', company: 'Acme', location: 'Berlin, Germany', url: 'https://example.com/j/1', salary: '', source: 'greenhouse', isRemote: false, date: '2026-10-20' },
  { title: 'Staff Platform Engineer', company: 'Globex', location: 'Remote', url: 'https://example.com/j/2', salary: '', source: 'lever', isRemote: true, date: '2026-10-20' },
  { title: 'Senior Data Engineer', company: 'Wayne', location: 'Toronto, Canada', url: 'https://example.com/j/3', salary: '', source: 'lever', isRemote: false, date: '2026-10-20' },
];

function bootScanResults({ wantCountry, wantSeniority } = {}) {
  const document = { activeElement: null };
  globalThis.document = document;
  const w = { UI: { el: makeEl(document) } };
  new Function('window', R('public/js/lib/skills.js'))(w);
  new Function('window', R('public/js/lib/job-facets.js'))(w);
  new Function('window', R('public/js/lib/scan-results.js'))(w);
  w.Countries = {
    countriesIn: (rows) => {
      const seen = new Map();
      for (const r of rows) {
        const m = String(r.location || '').match(/Germany|Canada/);
        if (m) {
          const code = m[0] === 'Germany' ? 'DE' : 'CA';
          seen.set(code, { code, flag: 'x', name: m[0], count: (seen.get(code)?.count || 0) + 1 });
        }
      }
      return [...seen.values()];
    },
    rowInCountry: (r, code) => (code === 'DE' ? /Germany/.test(r.location || '') : code === 'CA' ? /Canada/.test(r.location || '') : true),
    detectCountry: (name) => (/Germany/.test(name || '') ? { code: 'DE' } : /Canada/.test(name || '') ? { code: 'CA' } : null),
  };
  w.ScanPrefs = { listFavorites: () => [], isFavorite: () => false, toggleFavorite() {} };
  w.I18n = { getLang: () => 'en' };
  globalThis.I18n = w.I18n;
  const el = w.UI.el;
  const input = (v) => { const n = el('input'); n.value = v; return n; };
  const select = (v) => { const n = el('select'); n.value = v; n.appendChild(el('option', { value: '' }, 'All')); return n; };
  const results = {
    en: { when: '2026-10-20T10:00:00Z', fresh: CAR93_ROWS, filtered: CAR93_ROWS },
    ru: null,
  };
  const resultsEl = el('div', { id: 'results' });
  const filterCountry = select('');
  const filterSeniority = select('');
  if (wantCountry != null) filterCountry.dataset.want = wantCountry;
  if (wantSeniority != null) filterSeniority.dataset.want = wantSeniority;
  const ctx = {
    t: (k, f) => f,
    resultsEl,
    pager: { page: 0, pageSize: 50, reset() { this.page = 0; }, slice(a) { return a.slice(0, 50); }, controls() { return el('div', { className: 'paginator' }, ''); } },
    filterScope: select('all'), filterText: input(''), filterExclude: input(''), filterRemote: select(''),
    filterSource: select(''), filterCountry, filterSeniority,
    filterAge: input(''), favOnly: input(''), filterSalaryMin: input(''), filterSalaryMax: input(''),
    activeTech: new Set(), activeLevel: new Set(), activeDynamic: new Set(),
    twoPagerData: null,
    getLastResults: () => results,
  };
  const SR = w.ScanResults.create(ctx);
  return { SR, ctx, resultsEl, document, filterCountry, filterSeniority, el };
}

test('CAR-93 F3: paintCountryOptions applies a pending dataset.want once the option exists', () => {
  const env = bootScanResults({ wantCountry: 'DE' });
  env.SR.render();
  assert.equal(env.filterCountry.value, 'DE', 'the stashed country must be applied');
  const want = env.filterCountry.dataset.want || '';
  assert.equal(want, '', 'the stash is cleared once applied');
});

test('CAR-93 F3: paintSeniorityOptions applies a pending dataset.want once the option exists', () => {
  const env = bootScanResults({ wantSeniority: 'senior' });
  env.SR.render();
  assert.equal(env.filterSeniority.value, 'senior', 'the stashed seniority must be applied');
  assert.equal(env.filterSeniority.dataset.want || '', '', 'the stash is cleared once applied');
});

test('CAR-93 F12: toggling a star keeps keyboard focus on the same row (data-key)', () => {
  const env = bootScanResults();
  env.SR.render();
  const star = env.resultsEl.querySelectorAll('.btn-star')[1];
  assert.ok(star, 'star rendered');
  assert.equal(star.getAttribute('data-key'), CAR93_ROWS[1].url, 'stars carry data-key = url');
  env.document.activeElement = star;
  star.click(); // toggle → render()
  const focused = env.document.activeElement;
  assert.equal(focused && focused.getAttribute && focused.getAttribute('data-key'), CAR93_ROWS[1].url,
    'focus restored to the same row star, got: ' + (focused && focused.getAttribute && focused.getAttribute('data-key')));
});

// ═══════════════════════ source canaries ═══════════════════════

test('CAR-93 F1: UI.paginate controls() never returns null (appendChild safety)', () => {
  const ctl = APIJS.slice(APIJS.indexOf('controls(visibleCount, totalCount)'), APIJS.indexOf('function makeBtn'));
  assert.ok(!/\breturn null\b/.test(ctl), 'controls() must always return a node');
  assert.match(ctl, /return wrap;/, 'both branches return the wrapper');
  // The stale "returns null when there's only one page" comment is gone.
  assert.ok(!/controls\(\) returns null/.test(SCAN_SRC()), 'stale null-comment removed');
});

test('CAR-93 F2: pipeline urlRow key handler ignores events from nested controls', () => {
  const rowAt = PIPE.indexOf('function urlRow');
  const rowEnd = PIPE.indexOf('// Virtualization state', rowAt);
  const row = PIPE.slice(rowAt, rowEnd);
  const kdAt = row.indexOf('onKeyDown');
  const kd = row.slice(kdAt, row.indexOf('style:', kdAt));
  assert.match(kd, /if \(e\.target !== e\.currentTarget\) return;/,
    'the first guard must reject keydowns bubbling from ▶/✕/link');
  assert.match(row, /role: 'button'/, 'row button role kept');
});

test('CAR-93 F4: paintSourceOptions preserves the selected source across the repaint', () => {
  const src = SCAN_SRC();
  const at = src.indexOf('function paintSourceOptions');
  const body = src.slice(at, src.indexOf('paintSourceOptions(window.ScanResults.FALLBACK_SOURCES)'));
  assert.match(body, /const prev =/, 'capture the current choice before the repaint');
  assert.match(body, /filterSource\.value = prev/, 'restore it after the options are rebuilt');
});

test('CAR-93 F5: config select-remote keeps a deliberate "Use the default" (empty) choice', () => {
  assert.ok(!/const keep = input\.value \|\| current;/.test(CONFIG),
    'the `input.value || current` fallback reverts a deliberate empty choice');
  assert.match(CONFIG, /const keep = input\.value;/, 'the chosen value wins verbatim');
});

test('CAR-93 F6: config + dashboard detach the per-visit listeners on Router.render() re-entry', () => {
  assert.match(CONFIG, /__configVisitCleanup/, 'config keeps a module-scoped cleanup');
  assert.match(CONFIG, /if \(typeof __configVisitCleanup === 'function'\) __configVisitCleanup\(\)/,
    'config invokes the previous visit cleanup at the top of the route');
  // CAR-114 — the v1.58 provider chip was removed (the header badge owns
  // provider status); the same module-scoped discipline now guards the
  // parallax hero's window listeners instead of the chip's document ones.
  assert.match(DASH, /__dashV2Cleanup/, 'dashboard keeps a module-scoped cleanup');
  assert.match(DASH, /if \(typeof __dashV2Cleanup === 'function'\) __dashV2Cleanup\(\)/,
    'dashboard invokes the previous visit cleanup before mounting the listeners');
});

test('CAR-93 F8: the scan route prologue tears down the stale runner (not only on hashchange)', () => {
  const prologue = SCAN_SRC().slice(SCAN_SRC().indexOf("Router.register('scan'"),
    SCAN_SRC().indexOf('const c = UI.el;'));
  assert.match(prologue, /__teardownActiveScanRunner\(\)/,
    'a same-hash re-render must close the old runner');
});

test('CAR-93 F9: auto.js streams through window.API, never a bare fetch', () => {
  assert.ok(!/\bfetch\(/.test(AUTO), 'no raw fetch in auto.js');
  assert.match(AUTO, /API\.postStream\(/, 'the drain goes through the API layer');
  assert.match(APIJS, /postStream\(/, 'api.js ships the POST-SSE transport');
});

test('CAR-93 F11: the status classifier is single-source (no global collision, no divergence)', () => {
  // FULL-M6 — both copies are consolidated into lib/status-class.js. The
  // CAR-93 invariant (no top-level `function statusClass` in a classic
  // script, so the window binding can't be stolen) is preserved by the
  // namespaced lib; the dashboard copy's missing Hired branch is gone.
  assert.ok(!/^function statusClass\(/m.test(TRACKER), 'no top-level statusClass in tracker');
  assert.ok(!/^function statusClass\(/m.test(DASH), 'no top-level statusClass in dashboard');
  assert.match(TRACKER, /trackerStatusClass\(r\.status\)/, 'the tracker call site keeps its name');
  assert.match(TRACKER, /StatusClass\.of\(/, 'tracker rides the shared classifier');
  assert.match(DASH, /StatusClass\.of\(/, 'dashboard rides the shared classifier');
  const lib = R('public/js/lib/status-class.js');
  assert.match(lib, /badge-hired/, 'the shared classifier keeps the Hired tint');
});

test('CAR-93 F12: focus-preservation markers key on data-key/aria-label, not text alone', () => {
  // FULL-M6 — the three view copies are consolidated into lib/focus-preserve.js;
  // the marker contract lives there now (views delegate via FocusPreserved.*).
  const lib = R('public/js/lib/focus-preserve.js');
  assert.match(lib, /getAttribute\('data-key'\) \|\| el\.getAttribute\('aria-label'\)/,
    'the shared marker must prefer data-key/aria-label over identical text');
  for (const f of ['public/js/views/tracker.js', 'public/js/views/stats.js', 'public/js/views/reports.js']) {
    assert.match(R(f), /FocusPreserved\.withFocusPreserved\(/,
      f + ' must delegate to the shared helper');
  }
  assert.match(TRACKER, /'data-key': String\(r\.num/, 'tracker row action buttons carry data-key');
});

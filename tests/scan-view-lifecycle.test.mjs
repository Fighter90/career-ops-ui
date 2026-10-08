/**
 * v1.243.0 (views-3) — #/scan view lifecycle defects:
 *
 *   1. The body-level 'scan:refresh' listeners (Active-companies counter
 *      label + Workday-fallback chip) were added on EVERY #/scan visit and
 *      never removed → N visits = N handlers per refresh tick, each
 *      re-fetching /api/scan-results. Locked via the REAL module-top source
 *      (scan.js) run in a vm against fake document/window.
 *   2. The runner's SSE EventSource was orphaned on navigate-away (the
 *      server kept scanning; the next Scan hit SCAN_BUSY with no way to
 *      stop the orphan). Locked behaviourally against the REAL
 *      scan/runner.js factory: teardown() closes the stream + poll.
 *   3. The client API-company test was a 3-host regex drifted from the
 *      server adapter registry (eu.greenhouse / eu.lever / Workday /
 *      SmartRecruiters / Workable mislabelled "Web-search only", counter
 *      denominator wrong). Locked against the REAL isApiBackedCompany.
 *   4. refreshResults wiped the table on a failed GET and had no
 *      latest-wins guard (stale poll response overwrote a fresher one).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const SCAN = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'scan.js'), 'utf8');
const RUNNER = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'scan', 'runner.js'), 'utf8');

// ── 1. scan:refresh listener lifecycle (real scan.js module top) ───────────
const MODULE_TOP_START = SCAN.indexOf('let __activeScanPollHandle');
const MODULE_TOP_END = SCAN.indexOf('function hostOf');
assert.ok(MODULE_TOP_START >= 0 && MODULE_TOP_END > MODULE_TOP_START,
  'scan.js module-top slice (poll handles + listener registry + runner teardown)');
const MODULE_TOP = SCAN.slice(MODULE_TOP_START, MODULE_TOP_END);

function bootModuleTop() {
  const subs = new Set();
  const doc = {
    body: {
      addEventListener(type, fn) { if (type === 'scan:refresh') subs.add(fn); },
      removeEventListener(type, fn) { if (type === 'scan:refresh') subs.delete(fn); },
      dispatch() { for (const fn of [...subs]) fn(); },
      get size() { return subs.size; },
    },
  };
  const windowHandlers = [];
  const cleared = [];
  let intervalId = 0;
  const ctx = vm.createContext({
    document: doc,
    window: { addEventListener: (type, fn) => { if (type === 'hashchange') windowHandlers.push(fn); } },
    setInterval: () => ++intervalId,
    clearInterval: (id) => cleared.push(id),
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  vm.runInContext(MODULE_TOP, ctx);
  return { ctx, doc, windowHandlers, cleared };
}

test('scan:refresh listeners are registered once per visit and detached on route change', () => {
  const { ctx, doc, windowHandlers } = bootModuleTop();

  // ── visit #1 ──
  const calls1 = [];
  const calls2 = [];
  ctx.__f1 = () => calls1.push(1);
  ctx.__f2 = () => calls2.push(1);
  vm.runInContext('addScanRefreshListener(__f1); addScanRefreshListener(__f2);', ctx);
  assert.equal(doc.body.size, 2, 'two tracked subscriptions on this visit');
  doc.body.dispatch();
  assert.equal(calls1.length, 1);
  assert.equal(calls2.length, 1);

  // ── navigate away ──
  assert.equal(windowHandlers.length, 1, 'one module-level hashchange cleanup handler');
  vm.runInContext('__activeScanRunner = null;', ctx);
  windowHandlers[0]();
  assert.equal(doc.body.size, 0, 'both listeners removed on route change');
  doc.body.dispatch();
  assert.equal(calls1.length, 1, 'no handler survives the route change');

  // ── visit #2 — the regression: the old code left visit #1's handlers
  // attached, so dispatching fired both visits' handlers per tick ──
  vm.runInContext('addScanRefreshListener(__f1);', ctx);
  doc.body.dispatch();
  assert.equal(calls1.length, 2, 'exactly ONE handler per visit, not one per accumulated visit');
});

test('hashchange teardown closes the active scan runner exactly once', () => {
  const { ctx, windowHandlers, cleared } = bootModuleTop();
  ctx.teardownCalls = 0;
  vm.runInContext('__activeScanRunner = { teardown: () => { teardownCalls += 1; } };', ctx);
  // An in-flight poll handle from a prior visit must be cancelled too.
  vm.runInContext('__activeScanPollHandle = 42;', ctx);
  windowHandlers[0]();
  assert.equal(ctx.teardownCalls, 1, 'the runner\'s EventSource teardown runs on route change');
  assert.ok(cleared.includes(42), 'the in-flight poll interval is cancelled');
  windowHandlers[0]();
  assert.equal(ctx.teardownCalls, 1, 'no double teardown on subsequent navigations');
});

test('source wiring: both chip subscriptions go through the tracked helper; runner is stashed', () => {
  // The only body subscription allowed is INSIDE the tracked helper itself.
  const bare = [...SCAN.matchAll(/document\.body\.addEventListener\('scan:refresh'/g)].length;
  assert.equal(bare, 1, 'no bare body subscription outside addScanRefreshListener()');
  assert.match(SCAN, /function addScanRefreshListener\(fn\) \{\s*document\.body\.addEventListener\('scan:refresh', fn\);/);
  assert.match(SCAN, /addScanRefreshListener\(setLabel\);/);
  assert.match(SCAN, /addScanRefreshListener\(refreshWorkdayChip\);/);
  assert.match(SCAN, /__activeScanRunner = runner;/,
    'the runner must be stashed for the hashchange teardown');
});

// ── 2. runner SSE teardown (real runner.js factory) ────────────────────────

function bootRunner() {
  let esClosed = 0;
  const es = { close: () => { esClosed += 1; } };
  let streamCb = null;
  let streamPath = '';
  const cleared = [];
  const ctx = vm.createContext({
    window: {},
    URL, URLSearchParams,
    document: { createElement: () => ({ className: '', textContent: '', style: {} }) },
    UI: { toast: () => {} },
    API: { stream: (path, cb) => { streamPath = path; streamCb = cb; return es; } },
    setInterval: () => 77,   // fake poll handle
    clearInterval: (id) => cleared.push(id),
    setTimeout: () => 0,
    clearTimeout: () => {},
    __activeScanPollHandle: null,
    __activeScanDoneTimeout: null,
    __cancelActiveScanPoll() {
      if (ctx.__activeScanPollHandle) { ctx.clearInterval(ctx.__activeScanPollHandle); ctx.__activeScanPollHandle = null; }
      if (ctx.__activeScanDoneTimeout) { ctx.clearTimeout(ctx.__activeScanDoneTimeout); ctx.__activeScanDoneTimeout = null; }
    },
  });
  vm.runInContext(RUNNER, ctx);
  const create = ctx.window.createScanRunner;
  assert.equal(typeof create, 'function', 'runner.js must export the factory');
  const ctxArgs = {
    consoleEl: { textContent: '', appendChild: () => {}, scrollTop: 0, scrollHeight: 0 },
    statusRegion: { textContent: '' },
    errBanner: { hidden: true, textContent: '', appendChild: () => {} },
    scanProgress: { classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} },
    scanProgressBar: { style: {} },
    scanProgressLabel: { textContent: '' },
    scanProgressWrap: { hidden: false },
    scanBtn: { disabled: false, setAttribute() {} },
    stopBtn: { hidden: true, className: '' },
    dryRun: { checked: false },
    companySelect: { value: '' },
    maxPerSource: { value: '' },
    t: (k, f) => (f == null ? k : f),
    c: () => ({}),
    refreshResults: async () => {},
    resetResultsCache: () => {},
  };
  const runner = create(ctxArgs);
  return { runner, ctxArgs, es, getClosed: () => esClosed, getCb: () => streamCb, getPath: () => streamPath, cleared };
}

test('runner: teardown() closes the orphaned SSE stream + poll on navigate-away', async () => {
  const { runner, ctxArgs, es, getClosed, getCb, getPath, cleared } = bootRunner();

  runner.runScanAll();
  await new Promise((r) => setImmediate(r));
  assert.equal(getClosed(), 0, 'the stream is open while the scan runs');
  assert.ok(getCb(), 'the stream handler is armed');
  assert.match(getPath(), /^\/api\/stream\/scan\?/);
  assert.equal(es.closed, undefined);
  assert.equal(ctxArgs.scanBtn.disabled, true, 'the view is in run-state');

  // User navigates away mid-scan → scan.js's hashchange handler calls teardown.
  runner.teardown();
  assert.equal(getClosed(), 1, 'the EventSource is closed — no orphaned stream');
  assert.ok(cleared.includes(77), 'the 2.5s results poll is cancelled');
  assert.equal(ctxArgs.scanBtn.disabled, false, 'run-state ended');
  assert.equal(ctxArgs.stopBtn.hidden, true, 'Stop hidden again');

  // Double teardown (paranoia: repeated route changes) is safe.
  runner.teardown();
  assert.equal(getClosed(), 1, 'closing twice must not double-close');
});

test('runner: teardown() is silent (no console line / toast), unlike Stop', () => {
  const { runner, ctxArgs } = bootRunner();
  const consoleLines = [];
  ctxArgs.consoleEl.appendChild = (n) => consoleLines.push(n.textContent);
  runner.teardown();
  assert.equal(consoleLines.length, 0, 'teardown writes nothing to the SSE console');
});

test('runner: factory exports the teardown contract for scan.js', () => {
  const { runner } = bootRunner();
  assert.equal(typeof runner.runScanAll, 'function');
  assert.equal(typeof runner.stopScan, 'function');
  assert.equal(typeof runner.teardown, 'function',
    'scan.js\'s hashchange cleanup depends on teardown()');
});

// ── 3. adapter-registry-driven API classification ──────────────────────────
const CLS_START = SCAN.indexOf('function hostOf');
const CLS_END = SCAN.indexOf("Router.register('scan'");
assert.ok(CLS_START >= 0 && CLS_END > CLS_START, 'classifier slice bounds');
const CLASSIFIER = SCAN.slice(CLS_START, CLS_END);

function classifier() {
  const ctx = vm.createContext({ URL, Set });
  vm.runInContext(CLASSIFIER, ctx);
  return vm.runInContext('({ hostOf, isApiBackedCompany })', ctx);
}

test('classifier: registry ids classify Workday / SmartRecruiters / Workable / eu boards as API-backed', () => {
  const { isApiBackedCompany } = classifier();
  const ids = new Set(['greenhouse', 'ashby', 'lever', 'workday', 'smartrecruiters', 'workable', '4dayweek', 'rss', 'hh']);

  // The exact drift cases from the finding — each was labelled
  // "Web-search only" by the old 3-host regex.
  assert.equal(isApiBackedCompany({ name: 'A', careers_url: 'https://acme.myworkdayjobs.com/en-US/acme' }, ids), true, 'Workday');
  assert.equal(isApiBackedCompany({ name: 'B', careers_url: 'https://jobs.eu.lever.co/acme' }, ids), true, 'eu Lever');
  assert.equal(isApiBackedCompany({ name: 'C', careers_url: 'job-boards.eu.greenhouse.io/acme' }, ids), true, 'eu Greenhouse (schemeless)');
  assert.equal(isApiBackedCompany({ name: 'D', careers_url: 'https://jobs.smartrecruiters.com/Acme' }, ids), true, 'SmartRecruiters');
  assert.equal(isApiBackedCompany({ name: 'E', careers_url: 'https://www.apply.workable.com/acme' }, ids), true, 'Workable');
  assert.equal(isApiBackedCompany({ name: 'F', careers_url: 'https://jobs.ashbyhq.com/acme' }, ids), true, 'Ashby (still ok)');
  assert.equal(isApiBackedCompany({ name: 'G', api: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs' }, ids), true, 'explicit api: field');
  assert.equal(isApiBackedCompany({ name: 'H', provider: '4dayweek', careers_url: 'https://4dayweek.io/company/acme' }, ids), true, 'provider pin');
  assert.equal(isApiBackedCompany({ name: 'I', provider: 'hh', careers_url: 'https://careers.dreamjob.ru/vacancy' }, ids), true, 'short-id provider pin');
});

test('classifier: unknown companies are NOT claimed as API-backed; short ids never substring-match', () => {
  const { isApiBackedCompany } = classifier();
  const ids = new Set(['rss', 'hh', 'gem', 'workday']);

  assert.equal(isApiBackedCompany({ name: 'X', careers_url: 'https://jobs.acme-careers.example.com/listing' }, ids), false,
    'no registry id match → unknown, not API-backed');
  assert.equal(isApiBackedCompany({ name: 'Y', careers_url: 'https://www.rsschool.info/jobs' }, ids), false,
    '3-char ids are excluded from host substring matching (rss ≠ rsschool)');
  assert.equal(isApiBackedCompany({ name: 'Z', careers_url: '' }, ids), false);
  assert.equal(isApiBackedCompany(null, ids), false);
  assert.equal(isApiBackedCompany({}, ids), false);
});

test('classifier wiring: classification runs off the registry payload, not a host regex', () => {
  // The drifted regex must be gone.
  assert.doesNotMatch(SCAN, /jobs\\.ashbyhq\\.com\|jobs\\.lever\\.co\|job-boards\\.greenhouse\\.io/);
  // Companies start classified from the build-time fallback mirror of the
  // registry (drift-gated by tests/scan-fallback-sources.test.mjs).
  assert.match(SCAN, /FALLBACK_SOURCES \|\| \[\]\)\.map\(\(s\) => s\.value\)/);
  assert.match(SCAN, /let apiCompanies = companies\.filter\(\(co\) => isApiBackedCompany\(co, adapterIdSet\)\);/);
  // The live registry fetch re-classifies when it adds ids the fallback lacked.
  assert.match(SCAN, /apiCompanies = companies\.filter\(\(co\) => isApiBackedCompany\(co, adapterIdSet\)\);\s*\n\s*paintCompanyOptions\(\);/);
});

// ── 4. refreshResults latest-wins + keep-the-table-on-failure ──────────────
const RR_START = SCAN.indexOf('let refreshSeq = 0;');
const RR_END = SCAN.indexOf('// v1.30.0 — replaces the hardcoded');
assert.ok(RR_START >= 0 && RR_END > RR_START, 'refreshResults slice bounds');
const REFRESH = SCAN.slice(RR_START, RR_END);

test('refreshResults: sequenced (latest wins) and never wipes the table on failure', () => {
  assert.match(REFRESH, /const mySeq = \+\+refreshSeq;/, 'every call claims a sequence number');
  const returns = [...REFRESH.matchAll(/if \(mySeq !== refreshSeq\) return;/g)];
  assert.ok(returns.length >= 2,
    'both the stale-success path and the stale-failure path must bail before touching the table');
  assert.doesNotMatch(REFRESH, /lastResults = \{ en: null, ru: null \}/,
    'the catch must keep the previous table, not reset it to empty');
  assert.match(REFRESH, /lastResults = next;/, 'only a fresh, in-sequence response replaces the table');
  assert.match(REFRESH, /SR\.render\(\);/, 'a fresh response still re-renders');
  assert.match(REFRESH, /dispatchEvent\(new CustomEvent\('scan:refresh'\)\)/, 'the counter relabel event still fires');
});

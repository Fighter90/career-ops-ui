/**
 * FULL-M6 wave 1 (client consolidations) — red→green gates.
 *
 * Consolidations under test (BACKLOG FULL-M6, client half):
 *   1. withFocusPreserved ×3 → one shared lib (tracker/reports/stats).
 *   2. statusClass divergence → one shared classifier (dashboard gains the
 *      Hired tint the tracker copy always had).
 *   3. H1-label tables ×3 → ONE client copy (report-ops + pipeline-view)
 *      drift-gated against the server table.
 *   4. pdf-generate's hand-rolled POST-SSE parser → the shared
 *      API.postStream transport (FULL-R5).
 *   5. evaluate/mode-page clipboard writeText awaited (no false «Copied»).
 *   6. two-pager chip edits refresh the debounced live preview.
 *   7. ONE shared cost-hint MutationObserver (was one per call on body).
 *   8. scan-results star column reads ONE favorites snapshot per render.
 *
 * CI-isolated: file reads + pure-function stubs only; no server, no
 * network, no parent project.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => readFileSync(resolve(ROOT, p), 'utf8');

// Load a classic-script lib into this process with a stubbed `window`.
function loadClassic(relPath, windowStub = {}) {
  new Function('window', R(relPath))(windowStub);
  return windowStub;
}

// ── 1. withFocusPreserved ────────────────────────────────────────────────

let FocusPreserved;
before(() => {
  const w = {};
  loadClassic('public/js/lib/focus-preserve.js', w);
  FocusPreserved = w.FocusPreserved;
});

/** Minimal DOM double: enough surface for withFocusPreserved. */
function fakeEl(tag, attrs = {}, text = '') {
  const node = {
    tagName: String(tag).toUpperCase(),
    className: attrs.className || '',
    textContent: text,
    parentNode: null,
    children: [],
    attrs,
    disabled: Boolean(attrs.disabled),
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; },
    focusCount: 0,
    focus() { this.focusCount += 1; doc.activeElement = this; },
  };
  return node;
}
const doc = { activeElement: null };
function fakeContainer(children) {
  const container = fakeEl('div');
  container.ownerDocument = doc;
  container.children = children;
  for (const ch of children) ch.parentNode = container;
  container.contains = (n) => {
    for (let p = n; p; p = p.parentNode) if (p === container) return true;
    return false;
  };
  container.querySelectorAll = () => container.children.filter((ch) => !ch.disabled);
  return container;
}

test('M6 focus: one shared helper; tracker/reports/stats delegate to it', () => {
  const lib = R('public/js/lib/focus-preserve.js');
  assert.match(lib, /function withFocusPreserved\(/, 'the shared lib ships the helper');
  for (const f of ['public/js/views/tracker.js', 'public/js/views/reports.js', 'public/js/views/stats.js']) {
    const src = R(f);
    assert.doesNotMatch(src, /function withFocusPreserved\(/, f + ' must not carry its own copy');
    assert.match(src, /FocusPreserved\.withFocusPreserved\(/, f + ' must delegate to the shared lib');
  }
});

test('M6 focus: index.html loads the lib before the three views', () => {
  const html = R('public/index.html');
  const libAt = html.indexOf('src="/js/lib/focus-preserve.js"');
  assert.ok(libAt > -1, 'focus-preserve.js must be wired into index.html');
  for (const f of ['/js/views/tracker.js', '/js/views/reports.js', '/js/views/stats.js']) {
    assert.ok(html.indexOf(`src="${f}"`) > libAt, f + ' must load after focus-preserve.js');
  }
});

test('M6 focus: marker keys on data-key/aria-label, not identical text (car93 F12)', () => {
  const lib = R('public/js/lib/focus-preserve.js');
  assert.match(lib, /getAttribute\('data-key'\) \|\| el\.getAttribute\('aria-label'\)/,
    'the marker must prefer data-key/aria-label over identical text');
});

test('M6 focus: focus survives a rebuild of the focused row (behaviour)', () => {
  const mk = (key) => fakeEl('button', { 'data-key': key }, 'Open');
  const a1 = mk('row-1');
  const b1 = mk('row-2');
  const container = fakeContainer([a1, b1]);
  doc.activeElement = b1;
  const b2 = mk('row-2');
  const a2 = mk('row-1');
  FocusPreserved.withFocusPreserved(container, () => {
    container.children = [a2, b2];
    for (const ch of container.children) ch.parentNode = container;
  });
  assert.equal(doc.activeElement, b2, 'focus restored to the rebuilt node with the same data-key');
  assert.equal(a2.focusCount, 0, 'the look-alike row-1 control must not steal focus');
});

test('M6 focus: focus outside the container is a no-op', () => {
  const outside = fakeEl('button', {}, 'elsewhere');
  doc.activeElement = outside;
  const container = fakeContainer([fakeEl('button', {}, 'x')]);
  FocusPreserved.withFocusPreserved(container, () => {
    container.children = [fakeEl('button', {}, 'x')];
  });
  assert.equal(doc.activeElement, outside, 'no focus change when focus was elsewhere');
});

// ── 2. statusClass ───────────────────────────────────────────────────────

let StatusClass;
before(() => {
  const w = {};
  loadClassic('public/js/lib/status-class.js', w);
  StatusClass = w.StatusClass;
});

test('M6 status: one shared classifier; tracker + dashboard delegate', () => {
  const lib = R('public/js/lib/status-class.js');
  assert.match(lib, /function of\(/, 'the shared lib ships the classifier');
  for (const f of ['public/js/views/tracker.js', 'public/js/views/dashboard.js']) {
    const src = R(f);
    // No view-local copy under EITHER name — the CAR-93 collision stays
    // impossible because the only implementation is the namespaced lib.
    assert.doesNotMatch(src, /^function (statusClass|trackerStatusClass)\(/m,
      f + ' must not carry its own classifier');
    assert.match(src, /StatusClass\.of\(/, f + ' must use the shared classifier');
  }
});

test('M6 status: classifier tiers (Hired celebratory, offer ok, reject/discard bad)', () => {
  assert.equal(StatusClass.of('Hired'), 'badge-hired');
  assert.equal(StatusClass.of('hired'), 'badge-hired', 'case-insensitive');
  assert.equal(StatusClass.of('Offer'), 'badge-ok');
  assert.equal(StatusClass.of('Rejected'), 'badge-bad');
  assert.equal(StatusClass.of('Discarded'), 'badge-bad');
  assert.equal(StatusClass.of('Interview'), 'badge-info');
  assert.equal(StatusClass.of('Responded'), 'badge-info');
  assert.equal(StatusClass.of('SKIP'), 'badge-warn');
  assert.equal(StatusClass.of('Evaluated'), '');
  assert.equal(StatusClass.of(''), '');
  assert.equal(StatusClass.of(null), '');
  assert.equal(StatusClass.of(undefined), '');
});

test('M6 status: index.html loads the lib before dashboard and tracker', () => {
  const html = R('public/index.html');
  const libAt = html.indexOf('src="/js/lib/status-class.js"');
  assert.ok(libAt > -1, 'status-class.js must be wired into index.html');
  for (const f of ['/js/views/dashboard.js', '/js/views/tracker.js']) {
    assert.ok(html.indexOf(`src="${f}"`) > libAt, f + ' must load after status-class.js');
  }
});

// ── 3. H1 label tables ───────────────────────────────────────────────────

let ReportLabels;
before(() => {
  const w = {};
  loadClassic('public/js/lib/report-labels.js', w);
  ReportLabels = w.ReportLabels;
});

test('M6 labels: ONE client H1-label table; both consumers read it', () => {
  const lib = R('public/js/lib/report-labels.js');
  assert.match(lib, /H1_LABEL_WORDS/, 'the shared table lives in report-labels.js');
  // report-ops keeps its LABEL_RE construction but sources the WORDS from
  // the shared table; pipeline-view sources TITLE_LABELS from it too. No
  // view-local literal list may remain.
  assert.doesNotMatch(R('public/js/lib/report-ops.js'), /'Оценка вакансии'/,
    'report-ops must not carry its own literal table');
  assert.doesNotMatch(R('public/js/lib/pipeline-view.js'), /'Оценка вакансии'/,
    'pipeline-view must not carry its own literal table');
});

test('M6 labels: the shared client table mirrors the server table (drift gate)', () => {
  const srv = R('server/lib/routes/auto-pipeline.mjs');
  const m = srv.match(/const H1_LABEL_WORDS = \[([\s\S]*?)\]\.sort/);
  assert.ok(m, 'the server table must exist');
  const serverWords = Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]).sort();
  assert.ok(serverWords.length >= 15, 'sanity: the server table is populated');
  assert.deepEqual(ReportLabels.H1_LABEL_WORDS.slice().sort(), serverWords,
    'the client table must mirror the server H1_LABEL_WORDS exactly');
});

test('M6 labels: the shared table is longest-first (Оценка вакансии beats Оценка)', () => {
  const words = ReportLabels.H1_LABEL_WORDS;
  assert.equal(words.indexOf('Оценка вакансии') < words.indexOf('Оценка'), true,
    'longest first so the short label never wins the prefix race');
});

test('M6 labels: index.html loads report-labels before report-ops and pipeline-view', () => {
  const html = R('public/index.html');
  const libAt = html.indexOf('src="/js/lib/report-labels.js"');
  assert.ok(libAt > -1, 'report-labels.js must be wired into index.html');
  for (const f of ['/js/lib/report-ops.js', '/js/lib/pipeline-view.js']) {
    assert.ok(html.indexOf(`src="${f}"`) > libAt, f + ' must load after report-labels.js');
  }
});

// ── 4. SSE: pdf-generate rides API.postStream ────────────────────────────

test('M6 sse: pdf-generate has no hand-rolled POST-SSE parser', () => {
  const src = R('public/js/lib/pdf-generate.js');
  assert.doesNotMatch(src, /streamPostSse/, 'the private parser is gone');
  assert.doesNotMatch(src, /getReader/, 'no manual ReadableStream drain');
  assert.doesNotMatch(src, /text\/event-stream/, 'no hand-built SSE fetch headers');
  assert.match(src, /API\.postStream\(/, 'the inline kind rides the shared transport');
  assert.match(src, /API\.stream\(/, 'the GET kinds keep the EventSource transport');
});

// ── 5. clipboard ─────────────────────────────────────────────────────────

test('M6 clipboard: evaluate + mode-page await writeText with a real failure path', () => {
  for (const f of ['public/js/views/evaluate.js', 'public/js/views/mode-page.js']) {
    const src = R(f);
    assert.doesNotMatch(src, /onClick: \(\) => \{\s*navigator\.clipboard\.writeText/,
      f + ': no fire-and-forget clipboard write');
    assert.match(src, /await navigator\.clipboard\.writeText\(/, f + ': the write is awaited');
    assert.match(src, /auto\.copyFail/, f + ': failure falls back to the manual-copy hint');
  }
});

// ── 6. two-pager live preview ────────────────────────────────────────────

test('M6 two-pager: chip edits schedule a preview refresh (the debounce path)', () => {
  const src = R('public/js/views/two-pager.js');
  assert.match(src, /function schedulePreviewRender\(/, 'the debounce has a named scheduler');
  assert.match(src, /root\.addEventListener\('input', schedulePreviewRender\)/,
    'typing rides the same scheduler');
  // tagEditor notifies on add AND remove — a chip mutation fires no native
  // input event, so without the explicit notify the preview went stale.
  assert.match(src, /onChange/, 'tagEditor takes an onChange hook');
  assert.match(src, /schedulePreviewRender\)/, 'the tag editors are wired to the scheduler');
});

// ── 7. cost-hint observer ────────────────────────────────────────────────

test('M6 cost-hint: ONE shared body observer, none inside the per-call function', () => {
  const src = R('public/js/api.js');
  const fnStart = src.indexOf('function providerCostHint(');
  const fnEnd = src.indexOf('function pageMeta(');
  assert.ok(fnStart > -1 && fnEnd > fnStart, 'providerCostHint found');
  const body = src.slice(fnStart, fnEnd);
  assert.doesNotMatch(body, /new MutationObserver/, 'no per-call observer');
  assert.doesNotMatch(body, /\.observe\(document\.body/, 'no per-call body watch');
  assert.match(src, /costHints/, 'a shared registry of live hints exists');
  // Exactly one observer, created lazily by the shared sweep.
  const observerCount = (src.match(/new MutationObserver/g) || []).length;
  assert.equal(observerCount, 1, 'api.js must create exactly one MutationObserver');
});

// ── 8. favorites snapshot ────────────────────────────────────────────────

test('M6 favorites: the star column reads ONE snapshot per render', () => {
  const src = R('public/js/lib/scan-results.js');
  assert.doesNotMatch(src, /ScanPrefs\.isFavorite\(/,
    'no per-row localStorage read');
  assert.match(src, /starredSet/, 'a render-scoped starred set feeds the star column');
});

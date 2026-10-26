/**
 * FULL-R5 (review 2) — one shared `UI.safeHref(u)` for scraped / LLM-sourced
 * URLs, applied at the unvalidated href sites.
 *
 * Pre-fix pipeline.js (urlRow link, entryCard link, preview link, the
 * "Open" window.open), reports.js («Open JD» → r.url, an LLM-written report
 * header) and portals.js (careers_url row links) wrote their URLs straight
 * into href / window.open. dashboard.js, scan-results.js, funded.js and
 * map.js already gate — this adds the shared helper and the missing sites.
 *
 * Contract: http/https URLs pass through unchanged; everything else
 * (javascript:, data:, local:jds/…, #/in-app, empty, non-string) returns
 * null so the caller renders plain text instead of a link.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = readFileSync(resolve(ROOT, 'public/js/api.js'), 'utf8');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');
const PIPELINE = read('public/js/views/pipeline.js');
const REPORTS = read('public/js/views/reports.js');
const PORTALS = read('public/js/views/portals.js');

// ── synthetic browser (same loader as tests/api-stream-error-contract.test.mjs)

function mkEl(tag) {
  return {
    tagName: tag, children: [], className: '', style: {}, hidden: false,
    textContent: '', innerHTML: '', isConnected: true,
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
}

function loadApi() {
  const doc = {
    title: '',
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    createElement: (tag) => mkEl(tag),
    querySelectorAll: () => [],
    execCommand: () => true,
  };
  const w = { location: { hash: '#/' }, addEventListener() {} };
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  const setTimeoutNoop = () => 0;
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'EventSource', 'MutationObserver', 'setTimeout', 'clearTimeout', API_SRC)(
    w, doc, fetchImpl, function () { this.close = () => {}; }, function () { this.disconnect = () => {}; },
    setTimeoutNoop, setTimeoutNoop,
  );
  return w;
}

test('UI.safeHref: http/https pass through, every other scheme is refused', () => {
  const w = loadApi();
  const safeHref = w.UI && w.UI.safeHref;
  assert.equal(typeof safeHref, 'function', 'UI.safeHref must exist on the shared UI object');
  assert.equal(safeHref('https://jobs.example.com/123'), 'https://jobs.example.com/123');
  assert.equal(safeHref('http://example.com/a?b=c'), 'http://example.com/a?b=c');
  assert.equal(safeHref('  https://spaces.example.com/x  '), 'https://spaces.example.com/x', 'surrounding whitespace is trimmed');
  assert.equal(safeHref('javascript:alert(1)'), null, 'javascript: must not become a link target');
  assert.equal(safeHref('jAvAsCrIpT:alert(1)'), null, 'scheme matching must be case-insensitive');
  assert.equal(safeHref('data:text/html,<script>'), null, 'data: must not become a link target');
  assert.equal(safeHref('local:jds/064-acme.pdf'), null, 'local: capture refs stay plain text');
  assert.equal(safeHref('file:///etc/passwd'), null);
  assert.equal(safeHref('vbscript:x'), null);
  assert.equal(safeHref('#/reports/acme'), null, 'in-app hashes are not external hrefs');
  assert.equal(safeHref(''), null);
  assert.equal(safeHref(null), null);
  assert.equal(safeHref(undefined), null);
  assert.equal(safeHref(42), null);
});

test('pipeline.js routes every scraped URL through UI.safeHref', () => {
  assert.ok(PIPELINE.includes('UI.safeHref('), 'pipeline.js must call UI.safeHref');
  // the three href sites + the window.open site
  assert.ok(!/href: url\b/.test(PIPELINE), 'urlRow/entryCard href must not use the raw url');
  assert.ok(!/href: activeUrl\b/.test(PIPELINE), 'the preview href must not use the raw activeUrl');
  assert.ok(!/window\.open\(activeUrl\b/.test(PIPELINE), 'the Open button must not window.open a raw URL');
});

test('reports.js «Open JD» gates the LLM-written report URL', () => {
  assert.ok(REPORTS.includes('UI.safeHref('), 'reports.js must call UI.safeHref');
  assert.ok(!/href: r\.url\b/.test(REPORTS), 'the Open JD href must not use the raw r.url');
});

test('portals.js gates careers_url row links', () => {
  assert.ok(PORTALS.includes('UI.safeHref('), 'portals.js must call UI.safeHref');
  assert.ok(!/href: company\.careers_url\b/.test(PORTALS), 'company row href must not use the raw careers_url');
  assert.ok(!/href: res\.careers_url\b/.test(PORTALS), 'discovered-board href must not use the raw careers_url');
  // FULL-R5 review r2 (finding 9) — a non-http careers_url must still RENDER
  // (as plain text), not vanish: both link sites keep a span fallback.
  const companyRowBlock = PORTALS.slice(PORTALS.indexOf('const link = company.careers_url'));
  assert.match(companyRowBlock, /: c\('span'/,
    'the company-row link must fall back to a span for a non-http careers_url');
  const discoveredBlock = PORTALS.slice(PORTALS.indexOf('UI.safeHref(res.careers_url)'));
  assert.match(discoveredBlock, /: c\('span'/,
    'the discovered-board link must fall back to a span for a non-http careers_url');
});

test('already-gated views keep their own gates (no double-gating regressions)', () => {
  for (const f of ['public/js/views/dashboard.js', 'public/js/lib/scan-results.js']) {
    const src = read(f);
    assert.ok(/isHttp|safeUrl/.test(src), `${f} keeps its existing gate`);
  }
});

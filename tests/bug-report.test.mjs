/**
 * bug-report.js + logbuf.js — in-app bug reporter (v1.98.0, parent web-v0.2.0
 * parity). Pure-logic units loaded in a synthetic window (same pattern as
 * fit-score.test.mjs). collect()/openModal() need DOM/fetch and are exercised
 * by Playwright, not here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal window/globals the two IIFEs touch; enough to load them + call the
// pure exports. addEventListener/fetch are no-ops (we don't drive events here).
function loadLibs() {
  const win = { addEventListener() {}, __coLogBufInstalled: false };
  const console_ = { error() {} };
  const location = { origin: 'http://localhost', hash: '#/scan' };
  const load = (rel) => {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('window', 'console', 'location', 'URL', 'URLSearchParams', 'navigator', 'document', 'fetch', src)(
      win, console_, location, URL, URLSearchParams, { userAgent: 'node-test' }, {}, () => {},
    );
  };
  load('public/js/lib/logbuf.js');
  load('public/js/lib/bug-report.js');
  return win;
}

test('logbuf ring buffer caps at 20 newest entries', () => {
  const w = loadLibs();
  assert.ok(w.CoLogBuf && typeof w.CoLogBuf.recent === 'function');
  for (let i = 0; i < 25; i++) w.CoLogBuf._push('[error] boom ' + i);
  const buf = w.CoLogBuf.recent();
  assert.equal(buf.length, 20);
  assert.match(buf[buf.length - 1], /boom 24/);
  assert.match(buf[0], /boom 5/); // oldest 5 dropped
});

test('scrub redacts home paths + secret-looking tokens', () => {
  const { BugReport } = loadLibs();
  assert.equal(BugReport.scrub('/Users/sergey/cv.md failed'), '~/cv.md failed');
  assert.equal(BugReport.scrub('/home/alex/data'), '~/data');
  assert.ok(!/ABCDEFGH12345678/.test(BugReport.scrub('api-key=ABCDEFGH12345678')));
  // Bare (unlabelled) provider keys must be redacted too — common in SDK traces.
  assert.ok(!/sk-ant-api03-ABCDEFGH12345678/.test(BugReport.scrub('Error from sk-ant-api03-ABCDEFGH12345678 boom')));
  assert.ok(!/ghp_ABCDEFGH12345678/.test(BugReport.scrub('token ghp_ABCDEFGH12345678')));
  assert.ok(!/AIzaABCDEFGH12345678/.test(BugReport.scrub('AIzaABCDEFGH12345678')));
});

test('fingerprint is deterministic + stable across volatile status codes', () => {
  const { BugReport } = loadLibs();
  const a = { route: '#/scan', logs: ['[api] /api/scan → 500'], failChecks: [] };
  const b = { route: '#/scan', logs: ['[api] /api/scan → 503'], failChecks: [] };
  const c = { route: '#/tracker', logs: ['[api] /api/scan → 500'], failChecks: [] };
  const fpA = BugReport.fingerprint(a);
  assert.match(fpA, /^co-web-[a-z0-9]+$/);
  assert.equal(BugReport.fingerprint(a), fpA, 'deterministic');
  assert.equal(BugReport.fingerprint(b), fpA, 'stable: status codes are volatile → same bug class');
  assert.notEqual(BugReport.fingerprint(c), fpA, 'different route → different fingerprint');
});

test('issueBody carries the privacy floor + the format marker, scrubs the description', () => {
  const { BugReport } = loadLibs();
  const d = { version: '1.98.0', parentVersion: '1.16.0', route: '#/cv', ua: 'X', viewport: '800×600', okChecks: 18, failChecks: ['portals.yml'], logs: ['[api] /api/cv → 500'] };
  const body = BugReport.issueBody(d, 'crash when I open /Users/sergey/cv.md');
  assert.match(body, /## What happened/);
  assert.match(body, /## Environment/);
  assert.match(body, /\*\*Version:\*\* `1\.98\.0` · parent `1\.16\.0`/);
  assert.match(body, /\*\*Fingerprint:\*\* `co-web-/);
  assert.match(body, /Health checks:\*\* 18 OK · \*\*FAIL:\*\* portals\.yml/);
  assert.match(body, /## Recent errors/);
  assert.match(body, /report-format: v1/);
  assert.match(body, /Contains NO CV, profile/);
  // the user's description is scrubbed (home path → ~)
  assert.match(body, /~\/cv\.md/);
  assert.ok(!/\/Users\/sergey/.test(body), 'home path must be scrubbed out');
});

test('issueUrl targets the web-ui repo with title + labels + fingerprint in body', () => {
  const { BugReport } = loadLibs();
  const d = { version: '1.98.0', route: '#/scan', ua: 'X', viewport: '800×600', okChecks: 1, failChecks: [], logs: [] };
  const url = BugReport.issueUrl(d, 'scan hangs');
  assert.match(url, /^https:\/\/github\.com\/Fighter90\/career-ops-ui\/issues\/new\?/);
  const q = new URL(url).searchParams;
  assert.match(q.get('title'), /^\[web\] scan hangs/);
  assert.equal(q.get('labels'), 'bug');
  assert.match(q.get('body'), /co-web-/);
});

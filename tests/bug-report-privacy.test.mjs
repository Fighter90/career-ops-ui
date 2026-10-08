/**
 * CAR-18 / client-libs-1 [M] — bug-report.js privacy + correctness contract.
 *
 * Four defects, one privacy invariant ("NEVER job URLs / report content leave
 * the machine"):
 *   1. `collect()` put the RAW location hash into the report's Screen line —
 *      `#/evaluate?url=https://jobs.acme.com/123` carried the job URL, and
 *      `#/reports/<company-slug>` carried the company. Route must be reduced
 *      to the bare view name.
 *   2. Health checks from /api/health are `{name, required, ok, value}` —
 *      collect() read `c.status || c.state`, so okChecks was always 0 and
 *      failing checks were never reported.
 *   3. issueBody() truncated the body to 6000 chars BEFORE URL-encoding; a
 *      body full of multi-byte characters percent-encodes to far more and
 *      blew past the ~16KB URL guard browsers enforce. The cap must be
 *      applied to the ENCODED url.
 *   4. The copy fallback (`navigator.clipboard` missing) toasted success
 *      without copying anything at all — and never attempted
 *      document.execCommand('copy').
 *
 * Loaded in a synthetic window (same pattern as tests/bug-report.test.mjs)
 * with an injected /api/health response — no network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HEALTH = {
  version: '1.243.0',
  parentVersion: '1.16.0',
  checks: [
    { name: 'Node version', required: true, ok: true, value: 'v22' },
    { name: 'cv.md', required: true, ok: true, value: '/…' },
    { name: 'LLM key', required: false, ok: false, value: 'missing' },
    { name: 'portals.yml', required: true, ok: false, value: 'missing' },
  ],
};

function loadLibs({ hash = '#/scan', clipboard = false, execCommand = true } = {}) {
  const location = { origin: 'http://localhost', hash };
  const navigator = clipboard
    ? { userAgent: 'node-test', clipboard: { writeText: async () => {} } }
    : { userAgent: 'node-test' };
  const doc = { execCommand: () => execCommand };
  const win = { addEventListener() {}, innerWidth: 800, innerHeight: 600, __coLogBufInstalled: false };
  const console_ = { error() {} };
  const toastCalls = [];
  const load = (rel, extra) => {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('window', 'console', 'location', 'URL', 'URLSearchParams', 'navigator', 'document', 'fetch', src)(
      win, console_, location, URL, URLSearchParams, navigator, doc, () => {},
    );
  };
  load('public/js/lib/logbuf.js');
  // API stub BEFORE bug-report.js so collect() sees the health payload
  win.API = { get: async () => JSON.parse(JSON.stringify(HEALTH)) };
  const src = readFileSync(resolve(ROOT, 'public/js/lib/bug-report.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'console', 'location', 'URL', 'URLSearchParams', 'navigator', 'document', 'fetch', 'UI', 'I18n', src)(
    win, console_, location, URL, URLSearchParams, navigator, doc, () => {},
    {
      el: (tag, attrs, children) => {
        const e = {
          tagName: tag, children: [], value: '', hidden: false, href: '',
          className: '', style: {},
          _handlers: {},
          appendChild(ch) { this.children.push(ch); return ch; },
          addEventListener(type, fn) { this._handlers[type] = fn; },
          select() { this._selected = true; },
        };
        for (const [k, v] of Object.entries(attrs || {})) if (k !== 'style') e[k] = v;
        const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
        for (const kid of kids) if (kid) e.children.push(kid);
        return e;
      },
      modal: (title, body) => { win._modal = { title, body }; },
      toast: (msg, type) => toastCalls.push({ msg: String(msg), type }),
    },
  );
  win.BugReport._toastCalls = toastCalls;
  return win;
}

// ── 1. route privacy ─────────────────────────────────────────────────────

test('collect(): the job URL query never reaches the report route', async () => {
  const w = loadLibs({ hash: '#/evaluate?url=https%3A%2F%2Fjobs.acme.com%2F123%3Fref%3Dli' });
  const d = await w.BugReport.collect();
  assert.equal(d.route, '#/evaluate', 'query string (job URL) must be stripped');
  assert.ok(!/acme\.com|url=/.test(d.route), 'no job URL may appear in the route');
});

test('collect(): report slugs (company names) never reach the report route', async () => {
  const w = loadLibs({ hash: '#/reports/acme-senior-engineer-2026-10' });
  const d = await w.BugReport.collect();
  assert.equal(d.route, '#/reports', 'the per-report slug must be stripped');
});

test('fingerprint(): identical view with different query/slug → same fingerprint', async () => {
  const a = loadLibs({ hash: '#/evaluate?url=https://jobs.acme.com/1' }).BugReport;
  const b = loadLibs({ hash: '#/evaluate?url=https://jobs.other.example.org/999' }).BugReport;
  const c = loadLibs({ hash: '#/evaluate' }).BugReport;
  const da = { ...(await a.collect()), logs: [], failChecks: [] };
  const db = { ...(await b.collect()), logs: [], failChecks: [] };
  const dc = { ...(await c.collect()), logs: [], failChecks: [] };
  assert.equal(a.fingerprint(da), b.fingerprint(db), 'query must not split the fingerprint');
  assert.equal(a.fingerprint(da), c.fingerprint(dc), 'stripped and raw routes dedupe together');
});

// ── 2. health check counting against the real {name,required,ok,value} ──

test('collect(): counts checks by c.ok (the real /api/health shape)', async () => {
  const w = loadLibs();
  const d = await w.BugReport.collect();
  assert.equal(d.okChecks, 2, 'two ok:true checks');
  assert.deepEqual(d.failChecks, ['LLM key', 'portals.yml'], 'failing checks by name');
});

// ── 3. the 16KB encoded-URL guard ────────────────────────────────────────

test('issueUrl(): stays under the ~16KB browser URL guard even when percent-encoding inflates the body', () => {
  const w = loadLibs();
  const d = { version: '1.243.0', parentVersion: '', route: '#/scan', ua: 'X', viewport: '1×1', okChecks: 1, failChecks: [], logs: [] };
  // 6000 × 'é' → 6000 raw chars (issueBody's old pre-encoding cap) but
  // 36,000 chars once percent-encoded — the old code produced a URL that
  // browsers refuse to open.
  const url = w.BugReport.issueUrl(d, 'é'.repeat(6000));
  assert.ok(url.length <= 16000, `encoded URL must fit the guard, got ${url.length}`);
  const q = new URL(url).searchParams;
  assert.ok(q.get('body').length > 0, 'body is still present (truncated, not dropped)');
});

test('issueUrl(): a small report is byte-identical to the old format', () => {
  const w = loadLibs();
  const d = { version: '1.98.0', route: '#/scan', ua: 'X', viewport: '800×600', okChecks: 1, failChecks: [], logs: [] };
  const url = w.BugReport.issueUrl(d, 'scan hangs');
  assert.match(url, /^https:\/\/github\.com\/Fighter90\/career-ops-ui\/issues\/new\?/);
  assert.match(new URL(url).searchParams.get('title'), /^\[web\] scan hangs/);
  assert.equal(new URL(url).searchParams.get('labels'), 'bug');
});

// ── 4. the copy fallback ─────────────────────────────────────────────────

async function openModalAndGetCopyBtn(overrides) {
  const w = loadLibs(overrides);
  await w.BugReport.openModal();
  // creation order in openModal(): ta, preview, openLink, searchLink, copyBtn
  assert.ok(w._modal, 'preview modal opened');
  return w;
}

test('copy fallback: execCommand failure must NOT toast success', async () => {
  const w = await openModalAndGetCopyBtn({ execCommand: false });
  const btns = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.tagName === 'button' && (n.children || []).includes('Copy report')) btns.push(n);
    for (const k of n.children || []) walk(k);
  }(w._modal.body));
  assert.equal(btns.length, 1, 'copy button found in the modal');
  btns[0]._handlers.click();
  const copied = w.BugReport._toastCalls.find((t) => t.type === 'success');
  assert.equal(copied, undefined, 'no success toast when execCommand fails');
  assert.ok(w.BugReport._toastCalls.some((t) => t.type === 'error'), 'an error toast explains the failure');
});

test('copy fallback: execCommand success copies via select + execCommand and toasts success', async () => {
  const w = await openModalAndGetCopyBtn({ execCommand: true });
  const btns = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.tagName === 'button' && (n.children || []).includes('Copy report')) btns.push(n);
    for (const k of n.children || []) walk(k);
  }(w._modal.body));
  btns[0]._handlers.click();
  assert.ok(w.BugReport._toastCalls.some((t) => t.type === 'success'), 'success toast after a real copy');
});

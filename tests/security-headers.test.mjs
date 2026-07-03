/**
 * NEW-1 (v1.58.4) — security headers (CSP, X-Content-Type-Options,
 * X-Frame-Options, Referrer-Policy).
 *
 * CSP is now UNCONDITIONAL. Prior to v1.58.4 it was gated behind
 * isPubliclyExposed() and was absent over loopback — the v1.58.3 MASTER
 * regression (§5) flagged that `/` and `/api/health` returned NO CSP
 * header on 127.0.0.1, leaving `UI.md()`'s escape-first contract as the
 * sole XSS defence. Defense-in-depth must not depend on the bind address;
 * an XSS escalation is just as fatal on loopback. These tests lock the
 * header in on every response regardless of HOST.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let createApp;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'sec-headers-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ createApp } = await import('../server/index.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.HOST;
});

async function bootAndGet(host, path) {
  process.env.HOST = host;
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    await res.text();
    return Object.fromEntries(res.headers);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

// ───────────────────────── baseline (always on) ─────────────────────────

test('baseline headers present on /', async () => {
  const h = await bootAndGet('127.0.0.1', '/');
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.equal(h['x-frame-options'], 'DENY');
  assert.equal(h['referrer-policy'], 'same-origin');
});

test('baseline headers present on /api/health', async () => {
  const h = await bootAndGet('127.0.0.1', '/api/health');
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.equal(h['x-frame-options'], 'DENY');
  assert.equal(h['referrer-policy'], 'same-origin');
});

// ───────────── X-Powered-By is disabled (#29 / v1.69.5 hygiene) ──────────

test('X-Powered-By is not advertised on / or /api/health', async () => {
  const root = await bootAndGet('127.0.0.1', '/');
  assert.equal(root['x-powered-by'], undefined, 'Express must not advertise itself via X-Powered-By');
  const health = await bootAndGet('127.0.0.1', '/api/health');
  assert.equal(health['x-powered-by'], undefined);
});

// ───────────────── CSP is unconditional (NEW-1, v1.58.4) ─────────────────

function assertCspHardened(csp) {
  assert.ok(csp, 'expected Content-Security-Policy header');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  // script-src must never allow inline or eval — that would defeat CSP:
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), "script-src must not allow 'unsafe-inline'");
  assert.ok(!/'unsafe-eval'/.test(csp), "CSP must not allow 'unsafe-eval'");
  // SPA needs Google Fonts (Inter) — keep those allowlists intact:
  assert.match(csp, /style-src[^;]*fonts\.googleapis\.com/);
  assert.match(csp, /font-src[^;]*fonts\.gstatic\.com/);
}

test('CSP present on / over loopback (regression: was null pre-v1.58.4)', async () => {
  const h = await bootAndGet('127.0.0.1', '/');
  assertCspHardened(h['content-security-policy']);
});

test('CSP present on /api/health over loopback', async () => {
  const h = await bootAndGet('127.0.0.1', '/api/health');
  assertCspHardened(h['content-security-policy']);
});

test('CSP present on ::1', async () => {
  const h = await bootAndGet('::1', '/');
  assertCspHardened(h['content-security-policy']);
});

test('CSP present when HOST=localhost', async () => {
  const h = await bootAndGet('localhost', '/');
  assertCspHardened(h['content-security-policy']);
});

test('CSP present when HOST=0.0.0.0 (LAN-exposed)', async () => {
  const h = await bootAndGet('0.0.0.0', '/');
  assertCspHardened(h['content-security-policy']);
});

test('CSP present for any non-loopback HOST', async () => {
  const h = await bootAndGet('192.168.1.42', '/');
  assertCspHardened(h['content-security-policy']);
});

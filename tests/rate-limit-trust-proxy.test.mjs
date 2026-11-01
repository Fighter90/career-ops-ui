/**
 * TRUST_PROXY + writeRateLimit validation coupling (review LOW #1/#2,
 * REVIEW-2026-10-31-v1.264.1):
 *
 *   1. writeValidateConfig() — the targeted `validate` opt-out. Without
 *      TRUST_PROXY only xForwardedForHeader is disabled (Caddy on prod
 *      always sends X-Forwarded-For; ignoring it without trust proxy is
 *      the designed spoof-proof state, not a misconfiguration). With
 *      TRUST_PROXY=1 XFF becomes trusted input ⇒ full validation (`true`).
 *   2. trust-proxy coupling — an express app with `trust proxy = true`
 *      (the dangerous boolean) must surface ERR_ERL_PERMISSIVE_TRUST_PROXY
 *      through console.error again (the old blanket `validate: false` was
 *      silent).
 *   3. hop-count keying — `trust proxy = 1` resolves req.ip to the
 *      RIGHT-most XFF entry, so a spoofed head does not mint fresh
 *      buckets while genuinely different tails get separate ones.
 *   4. loopback default — no TRUST_PROXY ⇒ every request from 127.0.0.1
 *      shares the per-route bucket regardless of a spoofed XFF head
 *      (documented degeneration, deliberate design).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT (paths-once eager-import rule),
 * minimal express apps per case (each writeRateLimit() call owns its own
 * MemoryStore → fresh buckets), listen(0) on 127.0.0.1, env restored.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, request as httpRequest } from 'node:http';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));

let rl; // server/lib/rate-limit.mjs — imported AFTER CAREER_OPS_ROOT is set
let root;
const origRoot = process.env.CAREER_OPS_ROOT;
const origTrustProxy = process.env.TRUST_PROXY;
const origWriteLimit = process.env.WRITE_RATE_LIMIT;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'rl-trust-proxy-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 1 | 2026-10-01 | Acme | Backend Engineer | 4.2/5 | Applied | ❌ | — | — |',
    '',
  ].join('\n'));
  process.env.CAREER_OPS_ROOT = root;
  // rate-limit.mjs (→ security.mjs) is paths-light, but the eager-import
  // rule stays: set CAREER_OPS_ROOT BEFORE the first server import.
  rl = await import('../server/lib/rate-limit.mjs');
});

after(async () => {
  rl?.__resetRateLimits?.();
  if (origRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = origRoot;
  if (origTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = origTrustProxy;
  if (origWriteLimit === undefined) delete process.env.WRITE_RATE_LIMIT;
  else process.env.WRITE_RATE_LIMIT = origWriteLimit;
  if (root) rmSync(root, { recursive: true, force: true });
});

/** Minimal express app with one writeRateLimit()-protected route. */
function buildApp({ trustProxy } = {}) {
  const app = express();
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  app.post('/api/test-write', rl.writeRateLimit(), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function post(port, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/api/test-write',
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    req.end('{}');
  });
}

// ── 1. Unit: writeValidateConfig() mirrors the TRUST_PROXY split ──

test('writeValidateConfig: xForwardedForHeader-only opt-out by default, full validation with TRUST_PROXY=1', () => {
  assert.equal(typeof rl.writeValidateConfig, 'function', 'writeValidateConfig must be exported');
  const saved = process.env.TRUST_PROXY;
  try {
    delete process.env.TRUST_PROXY;
    assert.deepEqual(rl.writeValidateConfig(), { xForwardedForHeader: false });
    process.env.TRUST_PROXY = '1';
    assert.equal(rl.writeValidateConfig(), true);
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
  }
});

// ── 2. Behavioral: boolean trust proxy = true is loudly rejected again ──

test('writeRateLimit re-arms the trustProxy validation — boolean true logs ERR_ERL_PERMISSIVE_TRUST_PROXY', async () => {
  const saved = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  const errors = [];
  const origError = console.error;
  console.error = (...args) => { errors.push(args); };
  let app;
  try {
    app = buildApp({ trustProxy: true });
    const { server, port } = await listen(app);
    try {
      const r = await post(port);
      assert.equal(r.status, 200);
    } finally {
      server.close();
    }
  } finally {
    console.error = origError;
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
  }
  const logged = errors.map((a) => String(a[0]?.code ?? a[0])).join('\n');
  assert.match(logged, /ERR_ERL_PERMISSIVE_TRUST_PROXY/,
    'boolean trust proxy must surface ERR_ERL_PERMISSIVE_TRUST_PROXY (validate was blanket-false before the fix)');
});

test('writeRateLimit default state is quiet — hop-count trust proxy with XFF logs no validation errors', async () => {
  const saved = process.env.TRUST_PROXY;
  try {
    process.env.TRUST_PROXY = '1'; // ⇒ writeValidateConfig() === true (full validation)
    const app = buildApp({ trustProxy: 1 }); // hop count — NOT boolean true
    const { server, port } = await listen(app);
    const errors = [];
    const origError = console.error;
    console.error = (...args) => { errors.push(args); };
    try {
      const r = await post(port, { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' });
      assert.equal(r.status, 200);
    } finally {
      console.error = origError;
      server.close();
    }
    const logged = errors.map((a) => String(a[0]?.code ?? a[0])).join('\n');
    assert.equal(logged, '', 'hop-count trust proxy + XFF must pass every armed validation silently');
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
  }
});

// ── 3. Behavioral: hop-count keying ignores a spoofed XFF head ──

test('trust proxy = 1 keys on the right-most XFF entry: spoofed heads share, distinct tails split', async () => {
  const saved = process.env.TRUST_PROXY;
  const savedLimit = process.env.WRITE_RATE_LIMIT;
  try {
    delete process.env.TRUST_PROXY;
    process.env.WRITE_RATE_LIMIT = '1/60s'; // 1 request per bucket — the tightest possible probe
    const app = buildApp({ trustProxy: 1 });
    const { server, port } = await listen(app);
    try {
      // Same spoofed head (203.0.113.9), different right-most tails.
      const a = await post(port, { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' });
      const b = await post(port, { 'x-forwarded-for': '203.0.113.9, 198.51.100.8' });
      assert.equal(a.status, 200, 'first client (tail …100.7) passes');
      assert.equal(b.status, 200, 'second client (tail …100.8) gets its OWN bucket — the spoofed head is ignored');
      // Same right-most tail as (a) ⇒ same bucket ⇒ throttled.
      const c = await post(port, { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' });
      assert.equal(c.status, 429, 'repeating the tail …100.7 must hit the SAME bucket → 429');
    } finally {
      server.close();
    }
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
    if (savedLimit === undefined) delete process.env.WRITE_RATE_LIMIT;
    else process.env.WRITE_RATE_LIMIT = savedLimit;
  }
});

// ── 4. Loopback default stays as accepted ──

test('no TRUST_PROXY: requests from 127.0.0.1 share the per-route bucket regardless of spoofed XFF', async () => {
  // Documented degeneration (review LOW #1): on the default loopback bind
  // there is no proxy to trust, so the limiter keys on the socket address
  // and every connection is 127.0.0.1 — one bucket per route. The XFF head
  // is UNTRUSTED input: a spoofed header must NOT split the bucket.
  const savedLimit = process.env.WRITE_RATE_LIMIT;
  try {
    delete process.env.TRUST_PROXY;
    process.env.WRITE_RATE_LIMIT = '1/60s';
    const app = buildApp(); // no app.set('trust proxy') — the default
    const { server, port } = await listen(app);
    try {
      const a = await post(port, { 'x-forwarded-for': '203.0.113.9' });
      const b = await post(port, { 'x-forwarded-for': '8.8.8.8' });
      assert.equal(a.status, 200, 'first request passes');
      assert.equal(b.status, 429, 'a DIFFERENT spoofed XFF head must still share the 127.0.0.1 bucket → 429');
    } finally {
      server.close();
    }
  } finally {
    if (savedLimit === undefined) delete process.env.WRITE_RATE_LIMIT;
    else process.env.WRITE_RATE_LIMIT = savedLimit;
  }
});

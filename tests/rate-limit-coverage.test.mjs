/**
 * Rate-limit coverage tripwire — review LOW #3 (REVIEW-2026-10-31-v1.264.1):
 * `writeRateLimit` covered only 2 of the 64 mutating registrations
 * (POST/PUT/DELETE/PATCH under server/lib/routes/). Every mutating
 * registration must now carry a limiter in its middleware chain:
 *
 *   - writeRateLimit() — unconditional (fires on loopback too), for routes
 *     that rewrite user data files or spawn subprocesses;
 *   - llmRateLimit — loopback-conditional, for pure-LLM-spend routes;
 *   - both stacked (writeRateLimit() first) when a route spends tokens AND
 *     writes files (/api/evaluate, /api/deep, /api/auto-pipeline).
 *
 * The completeness test extracts every app.(post|put|delete|patch)(
 * registration source-statically, cuts the middleware segment (path token →
 * first handler marker: `=>` / `async (` / `function (`), and requires a
 * limiter reference inside it. A registration with neither limiter must be
 * explicitly listed in ALLOWED_BARE — today exactly one route qualifies:
 * POST /api/apply-helper (pure local computation, no I/O, no spawn, no LLM).
 *
 * A new mutating route added without a limiter fails this test with a diff
 * list until it is wired or consciously allowlisted.
 *
 * The behavioral half pins the runtime contract on a fresh route
 * (POST /api/reports): limit requests reach the handler (its own 400 on
 * validation), limit+1 → 429 with a JSON error body + numeric Retry-After,
 * and buckets are per route — exhausting /api/reports does not throttle
 * PUT /api/career-plan and vice versa.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, WRITE_RATE_LIMIT env override
 * ("3/60s") set BEFORE the dynamic import (paths-once eager-import rule),
 * 127.0.0.1 listen(0), no network, __resetRateLimits() between the
 * isolation cases.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  readdirSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = join(__dirname, '..', 'server', 'lib', 'routes');

/**
 * The ONLY routes allowed to mutate without a limiter: pure local
 * computation — no file writes, no subprocess, no LLM spend, nothing a
 * runaway loop can saturate. Keep this table minimal; a new entry needs a
 * rationale comment at the registration site (see llm.mjs /api/apply-helper).
 */
const ALLOWED_BARE = new Set(['/api/apply-helper']);

// Mutating registrations only — GET is out of scope by design (read-only
// surfaces have no data to corrupt; llmRateLimit on them is best-effort).
const MUTATING_RE = /app\.(post|put|delete|patch)\(\s*('(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$.]*)/g;
// The handler begins at the first arrow / async / function marker after the
// path token; everything before it is the middleware segment.
const HANDLER_START_RE = /=>|async\s*\(|function\s*\(/;
const WINDOW_CAP = 400; // safety bound if no handler marker is found

/** Extract every mutating registration with its middleware segment. */
function extractMutating() {
  const found = [];
  for (const f of readdirSync(ROUTES_DIR).filter((n) => n.endsWith('.mjs')).sort()) {
    const src = readFileSync(join(ROUTES_DIR, f), 'utf8');
    MUTATING_RE.lastIndex = 0;
    let m;
    while ((m = MUTATING_RE.exec(src)) !== null) {
      const token = m[2];
      const path = token.startsWith("'") ? token.slice(1, -1) : token; // `def.route` stays symbolic
      const line = src.slice(0, m.index).split('\n').length;
      const after = src.slice(m.index + m[0].length);
      const hm = HANDLER_START_RE.exec(after);
      const segment = after.slice(0, hm ? Math.min(hm.index, WINDOW_CAP) : WINDOW_CAP);
      found.push({
        file: f, line, method: m[1].toUpperCase(), path,
        guarded: /writeRateLimit|llmRateLimit/.test(segment),
      });
    }
  }
  return found;
}

const fmt = (r) => `${r.file}:${r.line} ${r.method} ${r.path}`;

// ── 1. Completeness tripwire ─────────────────────────────────────────────

test('tripwire: every mutating registration carries writeRateLimit() or llmRateLimit', () => {
  const all = extractMutating();
  // 58 registration sites on this base; the inventory's "64 mutating
  // routes" unrolls the buffered loop (def.route → 7 /api/run/* POSTs),
  // which the static extractor sees as ONE site. Pin the lower bound so a
  // sweep that silently stops reading files cannot pass vacuously.
  assert.ok(all.length >= 58, `expected the full mutating surface (>=58), found ${all.length}`);
  const missing = all.filter((r) => !r.guarded && !ALLOWED_BARE.has(r.path));
  assert.deepEqual(
    missing.map(fmt),
    [],
    'these mutating registrations carry no rate limiter — wire writeRateLimit() '
      + '(file/spawn mutations), stack it before llmRateLimit (LLM + writes), or '
      + 'document a pure-local allowlist entry',
  );
});

test('tripwire: the bare allowlist is exactly the pure-local routes', () => {
  const bare = [...new Set(extractMutating().filter((r) => !r.guarded).map((r) => r.path))];
  assert.deepEqual(bare.sort(), [...ALLOWED_BARE].sort(),
    'a bare registration outside ALLOWED_BARE must be wired or consciously allowlisted');
});

test('source pin: llm.mjs documents the /api/apply-helper allowlist rationale', () => {
  const src = readFileSync(join(ROUTES_DIR, 'llm.mjs'), 'utf8');
  const at = src.indexOf("app.post('/api/apply-helper'");
  assert.ok(at > 0, '/api/apply-helper registration not found');
  const comment = src.slice(Math.max(0, at - 400), at);
  assert.match(comment, /ALLOWED BARE/,
    'the registration site must carry the allowlist rationale comment');
  assert.match(comment, /pure local|no I\/O|no spawn/i,
    'the rationale must state why the route is safe unthrottled');
});

test('source pin: /api/evaluate stacks writeRateLimit() BEFORE the loopback-conditional llmRateLimit', () => {
  const src = readFileSync(join(ROUTES_DIR, 'llm.mjs'), 'utf8');
  assert.match(src, /app\.post\('\/api\/evaluate', writeRateLimit\(\), llmRateLimit,/);
  assert.match(src, /app\.post\('\/api\/deep', writeRateLimit\(\), llmRateLimit,/);
});

test('source pin: /api/config rewrites .env behind writeRateLimit(), not the loopback-gated llmRateLimit', () => {
  const src = readFileSync(join(ROUTES_DIR, 'config.mjs'), 'utf8');
  assert.match(src, /app\.post\('\/api\/config', writeRateLimit\(\),/);
});

test('source pin: the buffered /api/run/* loop carries one writeRateLimit() for all seven routes', () => {
  const src = readFileSync(join(ROUTES_DIR, 'runners.mjs'), 'utf8');
  assert.match(src, /app\.post\(def\.route, writeRateLimit\(\),/);
});

// ── 2. Behavioral: 3 requests pass, the 4th is a 429, buckets are per route ──

let server, baseUrl, root;
const origRoot = process.env.CAREER_OPS_ROOT;
const origWriteLimit = process.env.WRITE_RATE_LIMIT;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'rl-coverage-'));
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
  // Small bucket so limit+1 is cheap. Read at writeRateLimit() factory time
  // (route registration), i.e. at the dynamic import below.
  process.env.WRITE_RATE_LIMIT = '3/60s';
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

after(async () => {
  if (server) await new Promise((r) => { server.closeIdleConnections?.(); server.close(r); });
  try {
    const rl = await import('../server/lib/rate-limit.mjs');
    rl.__resetRateLimits?.();
  } catch { /* belt-and-braces only */ }
  if (origRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = origRoot;
  if (origWriteLimit === undefined) delete process.env.WRITE_RATE_LIMIT;
  else process.env.WRITE_RATE_LIMIT = origWriteLimit;
  if (root) rmSync(root, { recursive: true, force: true });
});

const send = (method, path, body) => fetch(baseUrl + path, {
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// POST /api/reports 400s on validation (missing slug) BEFORE any write, but
// the limiter runs before the handler and still fills the bucket.
test('POST /api/reports: 3 requests reach the handler, the 4th is a 429 with JSON error + numeric Retry-After', async () => {
  for (let i = 0; i < 3; i += 1) {
    const r = await send('POST', '/api/reports', { markdown: '# x' }); // no slug → handler 400
    assert.notEqual(r.status, 429, `request #${i + 1} must not be throttled`);
    assert.equal(r.status, 400, `request #${i + 1} must reach the handler validation`);
  }
  const over = await send('POST', '/api/reports', { markdown: '# x' });
  assert.equal(over.status, 429);
  const body = await over.json();
  assert.ok(body && typeof body.error === 'string' && body.error.length > 0, '429 body must carry a JSON error');
  assert.match(over.headers.get('retry-after') || '', /^\d+$/, '429 must carry a numeric Retry-After');
});

test('route isolation: exhausting /api/reports must not throttle PUT /api/career-plan', async () => {
  const rl = await import('../server/lib/rate-limit.mjs');
  rl.__resetRateLimits();
  for (let i = 0; i < 4; i += 1) await send('POST', '/api/reports', { markdown: '# x' }); // fill + overflow
  const other = await send('PUT', '/api/career-plan', { markdown: '# Plan\n' });
  assert.notEqual(other.status, 429, 'a full bucket on /api/reports must not leak into /api/career-plan');
  assert.equal(other.status, 200, 'the sibling route must reach its handler normally');
});

test('route isolation: exhausting PUT /api/career-plan must not throttle POST /api/reports', async () => {
  const rl = await import('../server/lib/rate-limit.mjs');
  rl.__resetRateLimits();
  for (let i = 0; i < 4; i += 1) await send('PUT', '/api/career-plan', { markdown: '# Plan\n' }); // fill + overflow
  const fresh = await send('POST', '/api/reports', { slug: 'rl-isolation', markdown: '# t', overwrite: true });
  assert.notEqual(fresh.status, 429, 'a full bucket on /api/career-plan must not leak into /api/reports');
  assert.ok(fresh.status >= 200 && fresh.status < 300, 'the sibling route must reach its handler normally');
});

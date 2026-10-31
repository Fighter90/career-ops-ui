/**
 * writeRateLimit — the unconditional per-route limiter for the file-mutating
 * relay endpoints flagged by CodeQL #705/#703 (js/missing-rate-limiting):
 *
 *   POST /api/runners/report-links   (server/lib/routes/runners.mjs)
 *   POST /api/tracker/status         (server/lib/routes/tracker.mjs)
 *
 * llmRateLimit is deliberately NOT reused here: it is a no-op on loopback
 * (isPubliclyExposed gate), so on the default bind these endpoints were
 * unthrottled and the guard was conditional. writeRateLimit fires on every
 * path — 60 req/min per (route × IP), 429 + Retry-After on overflow —
 * while staying generous enough that no legitimate client or existing
 * test (≤12 calls per endpoint per process) ever trips it.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md + a minimal tracker table,
 * WRITE_RATE_LIMIT env override ("3/60s") so limit+1 is 4 requests, no
 * network, 127.0.0.1 bind, dynamic imports AFTER the env is set
 * (paths-once eager-import rule). No script spawn: the below-limit
 * requests use handler-rejected bodies (400), which still fill the
 * bucket because the limiter runs BEFORE the handler.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let server, baseUrl, root;
const origRoot = process.env.CAREER_OPS_ROOT;
const origWriteLimit = process.env.WRITE_RATE_LIMIT;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'write-rate-limit-'));
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
  // Small bucket so limit+1 is cheap. Read per request by writeRateLimit.
  process.env.WRITE_RATE_LIMIT = '3/60s';
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

after(async () => {
  // Server FIRST — everything below must never block its close (on
  // unpatched code __resetRateLimits does not exist yet; the limiter's
  // buckets die with the process).
  if (server) await new Promise((r) => { server.closeIdleConnections?.(); server.close(r); });
  try {
    const rl = await import('../server/lib/rate-limit.mjs');
    rl.__resetRateLimits?.();
  } catch { /* the module always imports; a future-shape guard only */ }
  if (origRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = origRoot;
  if (origWriteLimit === undefined) delete process.env.WRITE_RATE_LIMIT;
  else process.env.WRITE_RATE_LIMIT = origWriteLimit;
  if (root) rmSync(root, { recursive: true, force: true });
});

const post = (path, body) => fetch(baseUrl + path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

// ── Behavioral: limit requests pass (expected handler code), limit+1 → 429 ──

test('POST /api/runners/report-links: 3 requests pass with the handler code, the 4th is a 429', async () => {
  // Invalid mode → the handler's own 400 (no spawn) — the expected code
  // below the limit. The limiter runs first and still counts the request.
  for (let i = 0; i < 3; i += 1) {
    const r = await post('/api/runners/report-links', { mode: 'Apply' });
    assert.notEqual(r.status, 429, `request #${i + 1} must not be throttled`);
    assert.equal(r.status, 400, `request #${i + 1} must reach the handler validation`);
  }
  const over = await post('/api/runners/report-links', { mode: 'Apply' });
  assert.equal(over.status, 429);
  const body = await over.json();
  assert.ok(body && typeof body.error === 'string' && body.error.length > 0, '429 body must carry a JSON error');
  assert.match(over.headers.get('retry-after') || '', /^\d+$/, '429 must carry a numeric Retry-After');
});

test('POST /api/tracker/status: 3 requests pass with the handler code, the 4th is a 429', async () => {
  // Unknown state → the handler's own 400 (whitelist reject, no spawn).
  for (let i = 0; i < 3; i += 1) {
    const r = await post('/api/tracker/status', { row: 1, state: 'Promoted' });
    assert.notEqual(r.status, 429, `request #${i + 1} must not be throttled`);
    assert.equal(r.status, 400, `request #${i + 1} must reach the handler validation`);
  }
  const over = await post('/api/tracker/status', { row: 1, state: 'Promoted' });
  assert.equal(over.status, 429);
  const body = await over.json();
  assert.ok(body && typeof body.error === 'string' && body.error.length > 0, '429 body must carry a JSON error');
  assert.match(over.headers.get('retry-after') || '', /^\d+$/, '429 must carry a numeric Retry-After');
});

test('writeRateLimit buckets are per route — one endpoint filling does not throttle the other', async () => {
  // Unit-level: a 1-req bucket on route A must not block route B for the
  // same IP (per-route × IP keying — the two endpoints above each own a
  // bucket on the live server, so this contract is pinned here directly).
  process.env.WRITE_RATE_LIMIT = '1/60s';
  const { writeRateLimit } = await import('../server/lib/rate-limit.mjs');
  let passed = 0;
  const mkReq = (url) => ({ ip: '198.51.100.9', socket: { remoteAddress: '198.51.100.9' }, originalUrl: url, url });
  const res = { setHeader() {}, status() { return res; }, json() {} };
  writeRateLimit(mkReq('/api/runners/report-links'), res, () => { passed += 1; }); // fills route A
  writeRateLimit(mkReq('/api/tracker/status'), res, () => { passed += 1; });       // route B — fresh bucket
  assert.equal(passed, 2, 'a full bucket on one route must not leak into another');
});

// ── Source pin: both alerted mutations apply the unconditional limiter. ──

test('source: routes/tracker.mjs gates POST /api/tracker/status with writeRateLimit', () => {
  const src = readFileSync(join(__dirname, '..', 'server', 'lib', 'routes', 'tracker.mjs'), 'utf8');
  assert.match(src, /import \{ writeRateLimit \} from '\.\.\/rate-limit\.mjs';/);
  assert.match(src, /app\.post\('\/api\/tracker\/status', writeRateLimit,/);
  // The LLM limiter (loopback-conditional) no longer fronts this route —
  // the write limiter is the unconditional guard.
  assert.ok(!/app\.post\('\/api\/tracker\/status', llmRateLimit,/.test(src),
    'tracker/status must not depend on the loopback-conditional llmRateLimit');
});

test('source: routes/runners.mjs gates POST /api/runners/report-links with writeRateLimit', () => {
  const src = readFileSync(join(__dirname, '..', 'server', 'lib', 'routes', 'runners.mjs'), 'utf8');
  assert.match(src, /import \{ writeRateLimit \} from '\.\.\/rate-limit\.mjs';/);
  assert.match(src, /app\.post\('\/api\/runners\/report-links', writeRateLimit,/);
});

test('source: rate-limit.mjs exports the unconditional writeRateLimit + a test reset', () => {
  const src = readFileSync(join(__dirname, '..', 'server', 'lib', 'rate-limit.mjs'), 'utf8');
  assert.match(src, /export const writeRateLimit = makeRateLimiter\(\{/);
  assert.match(src, /export function __resetRateLimits\(/);
  // Unconditional: the write limiter's factory call carries no `gate` —
  // (the llm limiter keeps its isPubliclyExposed gate; the write guard
  // must hold on loopback too).
  const def = src.slice(src.indexOf('export const writeRateLimit'));
  const defBody = def.slice(0, def.indexOf('});'));
  assert.ok(!/gate:/.test(defBody), 'writeRateLimit must not gate on isPubliclyExposed');
});

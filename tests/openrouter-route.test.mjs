/**
 * GET /api/openrouter/models — v1.57.0. The server-side proxy that
 * feeds the /#/config OPENROUTER_MODEL dropdown. CI-isolated: no
 * network is assumed, so the route must degrade to the curated
 * fallback list and still answer 200 with a usable shape.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl, projectRoot, __resetModelsCache;
const savedRoot = process.env.CAREER_OPS_ROOT;
const trueFetch = globalThis.fetch;

before(async () => {
  // CI isolation: OpenRouter is unreachable for EVERY test — the default stub
  // makes the upstream catalogue call fail (offline), so the route serves the
  // curated fallback. Tests below swap in their own upstream via
  // withStubbedUpstream; localhost requests pass through to the real fetch.
  globalThis.fetch = async (u, o) => {
    if (String(u).startsWith('https://openrouter.ai/')) throw new Error('offline (test stub)');
    return trueFetch(u, o);
  };
  projectRoot = mkdtempSync(resolve(tmpdir(), 'or-route-'));
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# cv\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  ({ __resetModelsCache } = await import('../server/lib/routes/openrouter.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  globalThis.fetch = trueFetch;
  server?.close();
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = savedRoot;
  try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
});

test('GET /api/openrouter/models → 200 with a non-empty namespaced model list', async () => {
  const res = await fetch(`${baseUrl}/api/openrouter/models`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.models), 'models is an array');
  assert.ok(body.models.length > 0, 'never empty (fallback covers offline CI)');
  assert.ok(body.models.every((m) => typeof m.id === 'string' && m.id.includes('/')),
    'every id is vendor/model');
  assert.equal(typeof body.fallback, 'boolean');
  assert.equal(typeof body.cached, 'boolean');
});

test('GET /api/openrouter/models leaks no secret + JSON content-type', async () => {
  const res = await fetch(`${baseUrl}/api/openrouter/models`);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const raw = await res.text();
  assert.ok(!/sk-or-|api[_-]?key/i.test(raw), 'no key-shaped strings in the response');
});

// ── Deterministic cache + fallback behaviour (stubbed upstream) ──
// Replace global fetch with a delegating stub: OpenRouter catalogue
// calls hit the stub; the test's own localhost requests pass through.
const OR_URL = 'https://openrouter.ai/api/v1/models';

async function withStubbedUpstream(handler, fn) {
  const realFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (u, o) => {
    if (String(u).startsWith(OR_URL)) { upstreamCalls += 1; return handler(); }
    return realFetch(u, o);
  };
  try { return await fn(() => upstreamCalls); }
  finally { globalThis.fetch = realFetch; }
}

test('live catalogue parsed, then served from the in-memory cache (1 upstream hit for 2 requests)', async () => {
  __resetModelsCache();
  await withStubbedUpstream(
    () => new Response(JSON.stringify({ data: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', context_length: 1000000 },
      { id: 'openai/gpt-5', name: 'GPT-5' },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async (calls) => {
      const a = await (await fetch(`${baseUrl}/api/openrouter/models`)).json();
      assert.equal(a.fallback, false);
      assert.equal(a.cached, false);
      assert.deepEqual(a.models.map((m) => m.id), ['anthropic/claude-sonnet-4', 'openai/gpt-5']);
      const b = await (await fetch(`${baseUrl}/api/openrouter/models`)).json();
      assert.equal(b.cached, true, 'second request served from cache');
      assert.equal(b.fallback, false);
      assert.equal(calls(), 1, 'upstream hit exactly once across two requests');
    });
});

test('upstream failure → fallback list, and the fallback is NOT cached (retried next request)', async () => {
  __resetModelsCache();
  await withStubbedUpstream(
    () => { throw new Error('ECONNREFUSED'); },
    async (calls) => {
      const a = await (await fetch(`${baseUrl}/api/openrouter/models`)).json();
      assert.equal(a.fallback, true);
      assert.equal(a.cached, false);
      assert.ok(a.models.length > 0 && a.models.every((m) => m.id.includes('/')));
      const b = await (await fetch(`${baseUrl}/api/openrouter/models`)).json();
      assert.equal(b.fallback, true);
      assert.equal(b.cached, false, 'a transient outage must not pin the fallback');
      assert.equal(calls(), 2, 'upstream retried on the next request (fallback not cached)');
    });
});

test('upstream 500 → fallback (not a throw, still 200 to the SPA)', async () => {
  __resetModelsCache();
  await withStubbedUpstream(
    () => new Response('{"error":"boom"}', { status: 500, headers: { 'content-type': 'application/json' } }),
    async () => {
      const res = await fetch(`${baseUrl}/api/openrouter/models`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.fallback, true);
      assert.ok(body.models.length > 0);
    });
});

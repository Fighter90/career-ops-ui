/**
 * Request guard (DNS rebinding + CSRF) and async-route safety.
 *
 * CI-isolated: a temp CAREER_OPS_ROOT, an ephemeral loopback port, no network.
 * The server modules are imported inside before() so the env is set first.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir, guard, server, port, createApp;

function call({ method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolveP, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolveP({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}
const json = (o) => ({ body: JSON.stringify(o), headers: { 'content-type': 'application/json' } });

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'req-guard-'));
  for (const d of ['config', 'data', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;
  process.env.ALLOWED_HOSTS = 'resumecraft.ru';
  guard = await import('../server/lib/request-guard.mjs');
  ({ createApp } = await import('../server/index.mjs'));
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.ALLOWED_HOSTS;
  rmSync(dir, { recursive: true, force: true });
});

test('hostnameOf strips ports and brackets', () => {
  assert.equal(guard.hostnameOf('Localhost:4317'), 'localhost');
  assert.equal(guard.hostnameOf('[::1]:4317'), '::1');
  assert.equal(guard.hostnameOf('::1'), '::1');
  assert.equal(guard.hostnameOf('127.0.0.1'), '127.0.0.1');
  assert.equal(guard.hostnameOf(''), '');
  assert.equal(guard.hostnameOf('[broken'), '');
});

test('policy: loopback names, IP literals, bind host and ALLOWED_HOSTS pass; other names do not', () => {
  const p = guard.buildHostPolicy({ bindHost: 'ui.lan', allowedHosts: 'resumecraft.ru, Example.com:8080' });
  for (const ok of ['localhost:1', '127.0.0.1:1', '[::1]:1', '192.168.1.5', 'ui.lan', 'resumecraft.ru', 'example.com']) {
    assert.equal(guard.isAllowedHost(ok, p), true, ok);
  }
  for (const bad of ['rebind.evil.example', 'evil.localhost.example', '', undefined]) {
    assert.equal(guard.isAllowedHost(bad, p), false, String(bad));
  }
  assert.equal(guard.isAllowedHost('anything.example', guard.buildHostPolicy({ allowedHosts: '*' })), true);
  assert.equal(guard.isAllowedHost('0.0.0.0', guard.buildHostPolicy({ bindHost: '0.0.0.0' })), true, 'an IP literal is always fine');
});

test('isCrossSite: Origin must name this server; Sec-Fetch-Site cross-site is refused', () => {
  const p = guard.buildHostPolicy({ allowedHosts: 'resumecraft.ru' });
  const req = (headers) => ({ headers });
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1' }), p), false, 'no Origin at all (curl, CLI)');
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', origin: 'http://localhost:1' }), p), false);
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', origin: 'https://evil.example' }), p), true);
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', origin: 'null' }), p), true);
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', origin: 'not a url' }), p), true);
  // an Origin is never excused by the Host-header rules (IP literals, localhost, bind host)
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', origin: 'http://198.51.100.7' }), p), true, 'foreign IP literal');
  assert.equal(guard.isCrossSite(req({ host: '127.0.0.1:1', origin: 'http://127.0.0.1:9' }), p), true, 'another local app, other port');
  assert.equal(guard.isCrossSite(req({ host: '127.0.0.1:1', origin: 'http://localhost:9' }), p), true);
  assert.equal(guard.isCrossSite(req({ host: '192.168.1.5:4317', origin: 'http://192.168.1.5:4317' }), p), false, 'LAN use: exact host:port');
  assert.equal(guard.isCrossSite(req({ host: 'proxy:9', origin: 'https://resumecraft.ru' }), p), false, 'allowed public host behind a rewriting proxy');
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', 'sec-fetch-site': 'cross-site' }), p), true);
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1', 'sec-fetch-site': 'same-origin' }), p), false);
});

test('a rebound Host is refused with 421 on every route, a loopback or allowed Host passes', async () => {
  assert.equal((await call({ path: '/api/health', headers: { host: 'rebind.evil.example' } })).status, 421);
  assert.equal((await call({ path: '/', headers: { host: 'rebind.evil.example:4317' } })).status, 421);
  assert.equal((await call({ path: '/api/health' })).status, 200);
  assert.equal((await call({ path: '/api/health', headers: { host: 'resumecraft.ru' } })).status, 200);
});

test('a cross-site POST is refused before the route runs (nothing is written)', async () => {
  const r = await call({ method: 'POST', path: '/api/run/doctor', headers: { origin: 'https://evil.example', 'content-type': 'text/plain' }, body: 'x' });
  assert.equal(r.status, 403);
  const put = await call({ method: 'PUT', path: '/api/memory', headers: { host: `127.0.0.1:${port}`, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{"markdown":"pwned"}' });
  assert.equal(put.status, 403);
});

test('side-effecting GETs (/api/stream/*, /api/run/*) refuse Sec-Fetch-Site: cross-site', async () => {
  assert.equal((await call({ path: '/api/stream/scan-parent', headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await call({ path: '/api/run/doctor', headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  // an ordinary read is not an acting request: a cross-site GET of /api/health is not blocked here
  assert.equal((await call({ path: '/api/health', headers: { 'sec-fetch-site': 'cross-site' } })).status, 200);
});

test('the acting-GET match is case-insensitive like Express routing, and ignores the query string', async () => {
  for (const path of ['/API/STREAM/scan-parent', '/api/Stream/scan-parent', '/Api/Run/doctor']) {
    assert.equal((await call({ path, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403, path);
  }
  // a query that merely mentions the path does not turn a read into an acting request
  assert.equal((await call({ path: '/api/health?next=/api/run/x', headers: { 'sec-fetch-site': 'cross-site' } })).status, 200);
  // ...and hiding the acting path behind a query cannot disarm the check
  assert.equal((await call({ path: '/api/run/doctor?x=1', headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
});

test('a same-origin write passes the guard (unknown API route -> its own JSON 404)', async () => {
  const r = await call({ method: 'POST', path: '/api/definitely-not-a-route', headers: { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 404);
  assert.deepEqual(JSON.parse(r.text), { error: 'unknown api' });
});

test('async handlers: a throwing request becomes a JSON 500/400, never a process exit', async () => {
  const bodies = [
    ['/api/deep', { company: 123 }],
    ['/api/deep', { company: 'Acme', role: true }],
    ['/api/auto-pipeline', { url: { toString: 1 } }],
    ['/api/career-plan/generate', { horizon: { toString: 1 } }],
  ];
  for (const [path, b] of bodies) {
    const r = await call({ method: 'POST', path, ...json(b) });
    assert.ok(r.status >= 400 && r.status < 600, `${path} -> ${r.status}`);
    assert.doesNotThrow(() => JSON.parse(r.text), `${path} answers JSON`);
  }
  assert.equal((await call({ path: '/api/health' })).status, 200, 'the server is still up');
});

test('installAsyncRouteSafety forwards a rejected handler to the error middleware (own app)', async () => {
  const { installAsyncRouteSafety } = await import('../server/lib/async-safety.mjs');
  const express = (await import('express')).default;
  installAsyncRouteSafety();
  assert.equal(installAsyncRouteSafety(), false, 'second install is a no-op');
  const app = express();
  app.get('/boom', async () => { throw new Error('async boom'); });
  app.get('/sync', () => { throw new Error('sync boom'); });
  app.get('/ok', async (_req, res) => { res.json({ ok: true }); });
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const p = srv.address().port;
  const get = (path) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: p, path }, (r) => {
    let t = ''; r.on('data', (c) => (t += c)); r.on('end', () => res({ status: r.statusCode, body: JSON.parse(t) }));
  }).on('error', rej));
  try {
    assert.deepEqual(await get('/boom'), { status: 500, body: { error: 'async boom' } });
    assert.deepEqual(await get('/sync'), { status: 500, body: { error: 'sync boom' } });
    assert.deepEqual(await get('/ok'), { status: 200, body: { ok: true } });
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

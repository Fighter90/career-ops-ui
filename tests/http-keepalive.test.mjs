/**
 * Behind Caddy the server must not be the side that closes an idle
 * keep-alive socket. With Node's 5 s default, a busy event loop (the hourly
 * in-process scan) closed sockets Caddy had just reused, and Caddy answered
 * 502 "read: connection reset by peer" while the process stayed healthy.
 *
 * Boots the real app through the same `listen()` the server boot uses,
 * against an isolated CAREER_OPS_ROOT.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let createApp, listen, applyProxyTimeouts, KEEP_ALIVE_MS;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'http-keepalive-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ createApp } = await import('../server/index.mjs'));
  ({ listen, applyProxyTimeouts, KEEP_ALIVE_MS } = await import('../server/lib/http-timeouts.mjs'));
});

after(() => { delete process.env.CAREER_OPS_ROOT; });

const get = (agent, port) => new Promise((ok, fail) => {
  http.get({ host: '127.0.0.1', port, path: '/api/ping', agent }, (res) => {
    res.resume();
    res.on('end', () => ok(res.statusCode));
  }).on('error', fail);
});

test('idle timeout outlasts the proxy (Caddy keeps idle upstreams 2 min)', () => {
  const s = applyProxyTimeouts(http.createServer());
  assert.equal(s.keepAliveTimeout, KEEP_ALIVE_MS);
  assert.ok(KEEP_ALIVE_MS > 120_000, 'must exceed Caddy\'s 2-minute idle default');
  assert.ok(s.headersTimeout > s.keepAliveTimeout, 'headersTimeout must exceed keepAliveTimeout');
});

test('an idle keep-alive socket is still open after Node\'s default idle close (5 s + 1 s buffer)', async () => {
  const server = await new Promise((r) => { const s = listen(createApp(), 0, '127.0.0.1', () => r(s)); });
  let connections = 0;
  server.on('connection', () => { connections++; });
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  try {
    const port = server.address().port;
    assert.equal(await get(agent, port), 200);
    await new Promise((r) => setTimeout(r, 7_000));
    assert.equal(await get(agent, port), 200);
    assert.equal(connections, 1, 'the second request must reuse the first socket, as Caddy does');
  } finally {
    agent.destroy();
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});

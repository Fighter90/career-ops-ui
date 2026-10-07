/**
 * v1.241.0 review hardening — rate-limit.mjs + isPubliclyExposed().
 *
 *  - BUCKETS was never evicted: one entry per client address, forever.
 *  - IPv6 clients were keyed per /128 — any host owns a /64, so rotating the
 *    low bits gave an unlimited supply of fresh buckets.
 *  - isPubliclyExposed() read the live process.env.HOST, which POST /api/config
 *    rewrites, so a request could switch the exposed-only rate limit off while
 *    the socket still listened on 0.0.0.0. The bind host recorded at listen()
 *    now wins.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let rl;
let sec;
let httpTimeouts;
const origHost = process.env.HOST;
const origLimit = process.env.LLM_RATE_LIMIT;

before(async () => {
  rl = await import('../server/lib/rate-limit.mjs');
  sec = await import('../server/lib/security.mjs');
  httpTimeouts = await import('../server/lib/http-timeouts.mjs');
});
beforeEach(() => {
  rl._resetBuckets();
  sec.recordBindHost(null);
  process.env.HOST = '0.0.0.0';
  process.env.LLM_RATE_LIMIT = '2/60s';
});
after(() => {
  sec.recordBindHost(null);
  if (origHost === undefined) delete process.env.HOST; else process.env.HOST = origHost;
  if (origLimit === undefined) delete process.env.LLM_RATE_LIMIT; else process.env.LLM_RATE_LIMIT = origLimit;
});

function hit(ip) {
  let status = null;
  let passed = false;
  const res = { setHeader() {}, status(s) { status = s; return res; }, json() { return res; } };
  rl.llmRateLimit({ ip, socket: { remoteAddress: ip } }, res, () => { passed = true; });
  return passed ? 'pass' : status;
}

test('clientKey: IPv6 is keyed by /64, IPv4 and mapped IPv4 by address', () => {
  assert.equal(rl.clientKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(rl.clientKey('2001:DB8:1:2:ffff:ffff:ffff:ffff'), '2001:db8:1:2::/64');
  assert.equal(rl.clientKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(rl.clientKey('::1'), '0:0:0:0::/64');
  assert.equal(rl.clientKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(rl.clientKey('203.0.113.7'), '203.0.113.7');
  assert.equal(rl.clientKey(''), 'unknown');
  assert.equal(rl.clientKey('fe80::1%en0'), 'fe80:0:0:0::/64');
  assert.equal(rl.clientKey('not-an-ip'), 'not-an-ip');
});

test('rotating the low 64 bits of an IPv6 address does not mint fresh buckets', () => {
  assert.equal(hit('2001:db8:1:2::1'), 'pass');
  assert.equal(hit('2001:db8:1:2::2'), 'pass');
  assert.equal(hit('2001:db8:1:2::3'), 429);
  assert.equal(hit('2001:db8:1:3::1'), 'pass'); // a different /64 is a different client
});

test('expired buckets are evicted, and the map is hard-capped', () => {
  process.env.LLM_RATE_LIMIT = '5/1ms';
  for (let i = 0; i < 50; i++) hit(`198.51.100.${i}`);
  const t = Date.now(); while (Date.now() - t < 5) { /* let every bucket expire */ }
  hit('192.0.2.1'); // any request sweeps the expired ones
  assert.equal(rl._bucketCount(), 1);

  process.env.LLM_RATE_LIMIT = '5/60s';
  rl._resetBuckets();
  for (let i = 0; i < rl.MAX_BUCKETS + 25; i++) hit(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`);
  assert.ok(rl._bucketCount() <= rl.MAX_BUCKETS, `size ${rl._bucketCount()}`);
});

test('isPubliclyExposed follows the bind host recorded at listen(), not a later env edit', async () => {
  process.env.HOST = '127.0.0.1';
  assert.equal(sec.isPubliclyExposed(), false);
  sec.recordBindHost('0.0.0.0');
  process.env.HOST = '127.0.0.1'; // what POST /api/config would do
  assert.equal(sec.isPubliclyExposed(), true);
  assert.equal(hit('203.0.113.9'), 'pass');

  sec.recordBindHost('127.0.0.1');
  process.env.HOST = '0.0.0.0';
  assert.equal(sec.isPubliclyExposed(), false);

  sec.recordBindHost(undefined); // listen(port) with no host = every interface
  assert.equal(sec.isPubliclyExposed(), true);
});

test('listen() records the host it binds', async () => {
  const app = (req, res) => res.end('ok');
  const server = await new Promise((r) => { const s = httpTimeouts.listen({ listen: (...a) => http.createServer(app).listen(...a) }, 0, '127.0.0.1', () => r(s)); });
  try {
    process.env.HOST = '0.0.0.0';
    assert.equal(sec.isPubliclyExposed(), false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

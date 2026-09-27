/**
 * v1.238.0 — the DNS-rebinding guard must run on the transport the scanners
 * actually inject. http-json's guard only fires when handed the real global
 * `fetch`; both scanners hand sources `makeTimeoutFetch()` instead, so before
 * this the guard never ran on a real scan and a source could be pointed at a
 * host that resolves to a private address (found in the v1.238.0 review:
 * eploy accepts any branded host).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeTimeoutFetch } from '../server/lib/fetch-timeout.mjs';
import { fetchText } from '../server/lib/http-json.mjs';

let server;
let port;
before(async () => {
  server = http.createServer((_req, res) => { res.end('internal'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.close());

test('makeTimeoutFetch() on the real fetch refuses a host that resolves to loopback', async () => {
  await assert.rejects(
    makeTimeoutFetch()(`http://localhost:${port}/`),
    // `localhost` may resolve to 127.0.0.1 or ::1 depending on the host's
    // resolver order (GitHub runners list ::1 first) — both are loopback.
    (err) => err.code === 'ECAREEROPS_BLOCKED_ADDRESS' && ['127.0.0.1', '::1'].includes(err.address),
  );
});

test('fetchText through the scanner transport is refused too — the path every source takes', async () => {
  await assert.rejects(
    fetchText(makeTimeoutFetch(), `http://localhost:${port}/`),
    (err) => err.code === 'ECAREEROPS_BLOCKED_ADDRESS',
  );
});

test('an injected test transport is left alone (no DNS, stub hosts keep working)', async () => {
  let called = 0;
  const stub = async () => { called += 1; return new Response('ok'); };
  const res = await makeTimeoutFetch(stub)('https://stub.invalid/x');
  assert.equal(await res.text(), 'ok');
  assert.equal(called, 1);
});

test('a timeout that fires during the fetch itself (after the guard) rejects cleanly, no unhandled rejection', async () => {
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    const slow = (_u, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
    });
    await assert.rejects(makeTimeoutFetch(slow, 20)('https://stub.invalid/'), (e) => e.name === 'TimeoutError');
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

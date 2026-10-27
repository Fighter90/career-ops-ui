/**
 * FULL-M6 — safe-fetch redirect header leak (docs/sdd/BACKLOG.md).
 *
 *   (a) `safeGet` re-sends the caller's `opts.headers` VERBATIM on every
 *       redirect hop — including cross-host targets. A caller passing
 *       Authorization / Cookie (credentials aimed at the ORIGINAL origin)
 *       leaks them to whichever host the 302 points at. Fix: on a hop whose
 *       origin differs from the request's origin, credential-bearing
 *       headers are dropped; non-credential caller headers and Accept/UA
 *       still ride the chain. Same-origin hops stay verbatim.
 *
 * CI-isolated: injected DNS hook + injected transport, no network.
 * (The abort-listener half of FULL-M6 lives in this file too, added in a
 * second commit — see the FULL-M6b section.)
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { getEventListeners } from 'node:events';
import { safeGet, _setTransport, _setLookup, _defaultTransport } from '../server/lib/safe-fetch.mjs';

let restoreTransport = null;
let restoreLookup = null;

const withPublicDns = () => {
  restoreLookup = _setLookup(async () => ({ address: '93.184.216.34', family: 4 }));
};

function undo() {
  restoreTransport?.();
  restoreLookup?.();
  restoreTransport = null;
  restoreLookup = null;
}

beforeEach(() => { withPublicDns(); });
afterEach(() => { undo(); });

// ─── FULL-M6a: credential headers must not follow a cross-host redirect ───

test('FULL-M6a: a cross-host redirect hop must not receive Authorization/Cookie', async () => {
  const seen = [];
  restoreTransport = _setTransport(async (url, pinned, opts) => {
    seen.push({ url: url.href, headers: { ...opts.headers } });
    if (url.hostname === 'first.example.com') {
      return {
        status: 302,
        headers: { location: 'https://second.example.net/job' },
        body: Buffer.alloc(0),
        location: 'https://second.example.net/job',
      };
    }
    return { status: 200, headers: {}, body: Buffer.from('done', 'utf8') };
  });

  const r = await safeGet('https://first.example.com/a', {
    headers: {
      Authorization: 'Bearer secret-token',
      Cookie: 'session=abc123',
      'X-Custom-Trace': 'keep-me',
    },
  });

  assert.equal(r.status, 200);
  assert.equal(seen.length, 2, 'both hops are fetched');
  // Hop 1: credentials go to the origin the caller addressed — fine.
  assert.equal(seen[0].headers.Authorization, 'Bearer secret-token');
  assert.equal(seen[0].headers.Cookie, 'session=abc123');
  // Hop 2 (cross-host): credentials must be stripped…
  assert.equal(seen[1].headers.Authorization, undefined,
    'Authorization must not follow a cross-host redirect');
  assert.equal(seen[1].headers.Cookie, undefined,
    'Cookie must not follow a cross-host redirect');
  // …while non-credential caller headers survive the hop.
  assert.equal(seen[1].headers['X-Custom-Trace'], 'keep-me',
    'non-credential caller headers still ride the redirect');
  assert.equal(seen[1].headers.Accept, 'text/html,application/xhtml+xml,text/plain',
    'the built-in Accept header is unchanged on the redirected hop');
  assert.match(String(seen[1].headers['User-Agent']), /career-ops-ui|Mozilla/,
    'the built-in User-Agent is unchanged on the redirected hop');
});

test('FULL-M6a: a same-origin redirect hop keeps caller headers verbatim', async () => {
  const seen = [];
  restoreTransport = _setTransport(async (url, pinned, opts) => {
    seen.push({ url: url.href, headers: { ...opts.headers } });
    if (url.pathname === '/a') {
      return {
        status: 302,
        headers: { location: 'https://first.example.com/b' },
        body: Buffer.alloc(0),
        location: 'https://first.example.com/b',
      };
    }
    return { status: 200, headers: {}, body: Buffer.from('done', 'utf8') };
  });

  const r = await safeGet('https://first.example.com/a', {
    headers: {
      Authorization: 'Bearer secret-token',
      Cookie: 'session=abc123',
      'X-Custom-Trace': 'keep-me',
    },
  });

  assert.equal(r.status, 200);
  assert.equal(seen.length, 2);
  assert.equal(seen[1].url, 'https://first.example.com/b');
  assert.equal(seen[1].headers.Authorization, 'Bearer secret-token',
    'same-origin hops keep the caller headers untouched');
  assert.equal(seen[1].headers.Cookie, 'session=abc123');
  assert.equal(seen[1].headers['X-Custom-Trace'], 'keep-me');
});

// ─── FULL-M6b: the transport's abort listener must not pile up ────────────
//
// `defaultTransport` added one 'abort' listener per request with
// `{ once: true }` — removed only when it FIRES. A signal that never
// aborts kept every listener: the redirect loop calls the transport once
// per hop with the SAME signal, so an N-hop chain left N lingering
// listeners (each holding closures over a settled request). FULL-M6b
// pins the contract: exactly one add per request, one remove on settle,
// zero listeners left afterwards.

/** An AbortSignal that records add/remove while staying fully functional. */
function recordingSignal() {
  const ac = new AbortController();
  const added = [];
  const removed = [];
  const origAdd = ac.signal.addEventListener.bind(ac.signal);
  const origRemove = ac.signal.removeEventListener.bind(ac.signal);
  ac.signal.addEventListener = (type, fn, opts) => { added.push(fn); return origAdd(type, fn, opts); };
  ac.signal.removeEventListener = (type, fn, opts) => { removed.push(fn); return origRemove(type, fn, opts); };
  return { signal: ac.signal, abort: () => ac.abort(), added, removed };
}

/** CI-isolated loopback server: 127.0.0.1 bind, ephemeral port, no external net. */
async function startServer(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

const localPinned = (port) => ({ address: '127.0.0.1', family: 4 });
const localUrl = (port, path) => `http://127.0.0.1:${port}${path}`;

// FULL-M6 review — a PRE-aborted signal used to destroy the request before
// the error listener existed: Node emits 'error' asynchronously with no
// listener → uncaughtException → process crash. It must reject cleanly.
test('FULL-M6: a pre-aborted signal rejects without an uncaught exception', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(
    () => _defaultTransport(new URL('http://127.0.0.1:1/x'), localPinned(), { signal: ctrl.signal }),
    /aborted/,
  );
});

test('FULL-M6b: the abort listener is detached after the request settles', async () => {
  const server = await startServer((req, res) => { res.end('ok'); });
  try {
    const rec = recordingSignal();
    const res = await _defaultTransport(
      new URL(localUrl(server.address().port, '/')),
      localPinned(),
      { signal: rec.signal },
    );
    assert.equal(res.status, 200);
    assert.equal(rec.added.length, 1, 'exactly one abort listener is added');
    assert.equal(rec.removed.length, 1, 'the listener is removed on settle');
    assert.equal(rec.added[0], rec.removed[0], 'the SAME listener that was added is removed');
    assert.equal(getEventListeners(rec.signal).length, 0, 'no listener lingers on the signal');
  } finally { server.close(); }
});

test('FULL-M6b: two hops on one signal (the redirect-loop call pattern) leave zero listeners', async () => {
  const server = await startServer((req, res) => {
    if (req.url === '/hop1') {
      res.writeHead(302, { location: '/hop2' });
      res.end();
      return;
    }
    res.end('done');
  });
  try {
    const rec = recordingSignal();
    const port = server.address().port;
    // Mirror _safeGetInner's loop: sequential transport calls, SAME signal.
    const first = await _defaultTransport(new URL(localUrl(port, '/hop1')), localPinned(), { signal: rec.signal });
    assert.equal(first.status, 302);
    const second = await _defaultTransport(new URL(localUrl(port, first.location)), localPinned(), { signal: rec.signal });
    assert.equal(second.status, 200);
    assert.equal(rec.added.length, 2, 'one listener per hop');
    assert.equal(rec.removed.length, 2, 'each hop detaches its own listener');
    assert.equal(getEventListeners(rec.signal).length, 0,
      'the redirect loop must not pile listeners up on a shared signal');
  } finally { server.close(); }
});

test('FULL-M6b: the listener is detached when the request errors (connection refused)', async () => {
  // Reserve an ephemeral port, then close it so connecting fails fast on loopback.
  const server = await startServer(() => {});
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const rec = recordingSignal();
  await assert.rejects(
    () => _defaultTransport(new URL(localUrl(port, '/')), localPinned(), { signal: rec.signal }),
  );
  assert.equal(rec.added.length, 1);
  assert.equal(rec.removed.length, 1, 'the listener is removed on the error path too');
  assert.equal(getEventListeners(rec.signal).length, 0);
});

test('FULL-M6b: an abort mid-request still rejects and leaves zero listeners (contract lock)', async () => {
  const server = await startServer(() => {/* never responds */});
  try {
    const rec = recordingSignal();
    const settled = _defaultTransport(
      new URL(localUrl(server.address().port, '/')),
      localPinned(),
      { signal: rec.signal },
    );
    setTimeout(() => rec.abort(), 30);
    await assert.rejects(() => settled, /aborted/);
    // { once: true } removes the fired listener at runtime — the pre-fix
    // code passed this one; it stays to pin that the fix does not regress it.
    assert.equal(getEventListeners(rec.signal).length, 0);
  } finally { server.close(); }
});

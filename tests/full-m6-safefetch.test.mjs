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
import { safeGet, _setTransport, _setLookup } from '../server/lib/safe-fetch.mjs';

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

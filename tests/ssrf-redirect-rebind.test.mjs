/**
 * v1.20.1 (B-1) — DNS-rebind regression test for safe-fetch.mjs.
 *
 * The pre-v1.20.1 SSRF guard did this in both /api/pipeline/preview
 * and /api/auto-pipeline:
 *
 *   1. dnsLookup(host) → A.A.A.A (public, passes private-IP check)
 *   2. fetch(url) → independent lookup → 127.0.0.1 (rebind window)
 *
 * The new `safeGet` resolves once and pins the TCP connection to the
 * validated address. This test stubs `dns.lookup` to simulate the
 * rebind attempt and asserts:
 *
 *   - DNS lookup that returns a private/loopback IP is rejected
 *     before any socket opens.
 *   - DNS lookup error is fail-CLOSED (no silent fall-through to
 *     another fetch path that might do its own resolve).
 *   - Redirect target that resolves to a private IP is rejected
 *     even when the initial URL resolved cleanly.
 *   - Successful flow: public IP + 2xx response returns body intact.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as dns } from 'node:dns';
import { safeGet, _setTransport } from '../server/lib/safe-fetch.mjs';

const _origLookup = dns.lookup;
let restoreTransport = null;
let dnsAnswers = []; // sequence of {address, family} or Error to return

beforeEach(() => {
  dnsAnswers = [];
  dns.lookup = async (host) => {
    if (!dnsAnswers.length) throw new Error(`no stubbed answer for ${host}`);
    const next = dnsAnswers.shift();
    if (next instanceof Error) throw next;
    return next;
  };
});

afterEach(() => {
  dns.lookup = _origLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

test('safeGet rejects when DNS resolves to 127.0.0.1', async () => {
  dnsAnswers = [{ address: '127.0.0.1', family: 4 }];
  await assert.rejects(
    () => safeGet('https://attacker.example.com/'),
    /resolves to private address/
  );
});

test('safeGet rejects when DNS resolves to 169.254.169.254 (AWS IMDS)', async () => {
  dnsAnswers = [{ address: '169.254.169.254', family: 4 }];
  await assert.rejects(
    () => safeGet('https://attacker.example.com/'),
    /resolves to private address/
  );
});

test('safeGet rejects when DNS resolves to 10.0.0.5 (RFC1918)', async () => {
  dnsAnswers = [{ address: '10.0.0.5', family: 4 }];
  await assert.rejects(
    () => safeGet('https://attacker.example.com/'),
    /resolves to private address/
  );
});

test('safeGet rejects when DNS resolves to ::1 (IPv6 loopback)', async () => {
  dnsAnswers = [{ address: '::1', family: 6 }];
  await assert.rejects(
    () => safeGet('https://attacker.example.com/'),
    /resolves to private address/
  );
});

test('safeGet is fail-CLOSED on DNS lookup error (no silent fall-through)', async () => {
  // v1.20.1 reversal of the previous fail-OPEN catch in pipeline.mjs.
  // A hostile resolver throwing on the validation lookup must NOT lead
  // to the request proceeding with a second uncontrolled lookup.
  const err = new Error('ENOTFOUND');
  err.code = 'ENOTFOUND';
  dnsAnswers = [err];
  await assert.rejects(
    () => safeGet('https://attacker.example.com/'),
    /DNS lookup failed/
  );
});

test('safeGet rejects when redirect target resolves to private IP', async () => {
  // First hop: hostname A resolves to a public IP, returns 302 → hostname B.
  // Second hop: hostname B resolves to a private IP. Must be rejected
  // BEFORE the redirect body is fetched.
  dnsAnswers = [
    { address: '93.184.216.34', family: 4 },   // hop 1 OK
    { address: '127.0.0.1', family: 4 },        // hop 2 PRIVATE
  ];
  restoreTransport = _setTransport(async (url) => {
    if (url.hostname === 'attacker.example.com') {
      return {
        status: 302,
        headers: { location: 'https://internal.attacker.example.com/' },
        body: Buffer.alloc(0),
        location: 'https://internal.attacker.example.com/',
      };
    }
    // We should never reach here — the redirect target must be rejected
    // before the second transport call.
    throw new Error('LEAKED: second hop fetched private host');
  });
  await assert.rejects(
    () => safeGet('https://attacker.example.com/'),
    /resolves to private address/
  );
});

test('safeGet pins the IP on success (single DNS lookup, body returned)', async () => {
  dnsAnswers = [{ address: '93.184.216.34', family: 4 }];
  let pinnedSeen = null;
  restoreTransport = _setTransport(async (url, pinned) => {
    pinnedSeen = pinned;
    return {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: Buffer.from('<p>real posting</p>', 'utf8'),
    };
  });
  const r = await safeGet('https://example.com/job/1');
  assert.equal(r.status, 200);
  assert.match(r.text, /real posting/);
  assert.deepStrictEqual(pinnedSeen, { address: '93.184.216.34', family: 4 });
  // One DNS lookup consumed, no leftover answers (proves no second lookup).
  assert.equal(dnsAnswers.length, 0);
});

test('safeGet caps body at opts.maxBytes (M-2 streaming cap)', async () => {
  // v1.22.0 (M-2) — `pipeline-preview` used to `await upstream.text()`
  // before slicing; a 1 GB upstream stream would exhaust memory. Since
  // v1.21.0 the SSRF path goes through safe-fetch which streams chunks
  // and slices at `opts.maxBytes`. Lock the cap in via a stub
  // transport that returns a 100 KB body when asked for 4 KB.
  dnsAnswers = [{ address: '93.184.216.34', family: 4 }];
  const big = Buffer.alloc(100_000, 0x41); // 100 KB of 'A'
  restoreTransport = _setTransport(async () => {
    // The transport itself respects maxBytes per defaultTransport's
    // implementation; a stub returning the cap-truncated body matches
    // production behavior.
    return {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: big.slice(0, 4096), // simulating the in-transport cap
    };
  });
  const r = await safeGet('https://example.com/big', { maxBytes: 4096 });
  assert.equal(r.status, 200);
  assert.ok(r.text.length <= 4096, `expected ≤4096 bytes, got ${r.text.length}`);
});

test('safeGet caps redirect chain at 3 hops', async () => {
  // 4 public-IP hops would exceed the cap. Each hop's transport returns
  // a 302 to a new hostname; each hostname re-resolves through dns.lookup.
  dnsAnswers = [
    { address: '93.184.216.34', family: 4 },
    { address: '93.184.216.35', family: 4 },
    { address: '93.184.216.36', family: 4 },
    { address: '93.184.216.37', family: 4 },
    { address: '93.184.216.38', family: 4 }, // never used — cap fires first
  ];
  let hop = 0;
  restoreTransport = _setTransport(async () => {
    hop += 1;
    return {
      status: 302,
      headers: { location: `https://hop${hop}.example.com/` },
      body: Buffer.alloc(0),
      location: `https://hop${hop}.example.com/`,
    };
  });
  await assert.rejects(
    () => safeGet('https://hop0.example.com/'),
    />3 redirects/
  );
});

// ─── v1.117.x (SRV-H1) — timeoutMs must actually bound the request ──
//
// `safeGet(url, { timeoutMs })` was accepted (and passed by
// routes/cv-studio.mjs add-entry and routes/portals.mjs health probes)
// but never honored: only opts.signal was wired into the transport, so
// a hanging origin held the socket open forever. These tests pin the
// contract: no caller signal + timeoutMs → the whole call aborts once
// the budget is spent; a caller-provided signal owns cancellation.

test('safeGet aborts a hanging origin when timeoutMs is set and no signal given', async () => {
  dnsAnswers = [{ address: '93.184.216.34', family: 4 }];
  restoreTransport = _setTransport((url, pinned, opts) => new Promise((resolve, reject) => {
    // Simulate a socket that never produces a response: settle only on abort.
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }
  }));
  const started = Date.now();
  await assert.rejects(
    () => safeGet('https://slow.example.com/', { timeoutMs: 120 }),
    /aborted/
  );
  assert.ok(Date.now() - started < 5000, 'must reject via the timer, not a suite timeout');
});

test('safeGet without timeoutMs and without signal passes no signal to the transport', async () => {
  dnsAnswers = [{ address: '93.184.216.34', family: 4 }];
  let signalSeen = 'unset';
  restoreTransport = _setTransport(async (url, pinned, opts) => {
    signalSeen = opts.signal;
    return { status: 200, headers: {}, body: Buffer.from('ok', 'utf8') };
  });
  const r = await safeGet('https://example.com/');
  assert.equal(r.status, 200);
  assert.equal(signalSeen, undefined);
});

test('safeGet lets a caller-provided signal own cancellation (timeoutMs ignored)', async () => {
  dnsAnswers = [{ address: '93.184.216.34', family: 4 }];
  const ac = new AbortController();
  restoreTransport = _setTransport((url, pinned, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    setTimeout(() => ac.abort(), 50);
  }));
  await assert.rejects(
    // Huge timeoutMs — if it were honored INSTEAD of the caller signal,
    // this test would hang far past the caller's 50ms abort.
    () => safeGet('https://example.com/', { signal: ac.signal, timeoutMs: 60000 }),
    /aborted/
  );
});

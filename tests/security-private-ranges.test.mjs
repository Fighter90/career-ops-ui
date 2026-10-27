/**
 * FULL-M6 (CAR-165) — isPrivateOrLoopbackHost missing address ranges.
 *
 * The SSRF classifier covered RFC1918 / loopback / CGNAT / link-local and the
 * ULA part of IPv6, but four more "points inward" spaces resolved as public:
 *   - NAT64 64:ff9b::/96 — the last 32 bits are the embedded IPv4 host
 *     (RFC 6052), so `64:ff9b::7f00:1` reaches 127.0.0.1 through a NAT64 relay;
 *   - 6to4 2002::/16 — the embedded IPv4 sits in the next two hextets
 *     (RFC 3056);
 *   - benchmark 198.18.0.0/15 (RFC 2544);
 *   - reserved 240.0.0.0/4 (RFC 1112, incl. the 255.255.255.255 broadcast).
 * Public addresses that merely EMBED a public IPv4 (192.0.2.1, TEST-NET-1)
 * must stay public.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let security;

before(async () => {
  security = await import('../server/lib/security.mjs');
});

const PRIVATE = [
  // NAT64 — hex tail (the form `new URL().hostname` prints) and dotted tail
  '64:ff9b::7f00:1',       // → 127.0.0.1
  '64:ff9b::127.0.0.1',    // same, dotted-tail IPv6 syntax
  '64:ff9b::c0a8:101',     // → 192.168.1.1
  '64:ff9b:0:0:0:0:7f00:1' // fully expanded
  ,
  // 6to4 — embedded IPv4 in hextets 2-3
  '2002:7f00:1::',         // → 127.0.0.1
  '2002:7f00::',           // → 127.0.0.0 (trailing hextet omitted)
  '2002:c0a8:101::',       // → 192.168.1.1
  '2002:ac10:fe01::',      // → 172.16.254.1
  // Benchmark (RFC 2544)
  '198.18.0.1',
  '198.19.255.254',
  // Reserved (RFC 1112) + broadcast
  '240.0.0.1',
  '250.100.5.5',
  '255.255.255.255',
];

const PUBLIC = [
  '64:ff9b::c000:201',  // NAT64 wrapping 192.0.2.1 (TEST-NET-1) — still public
  '2002:c000:201::',    // 6to4 wrapping 192.0.2.1
  '2002:0808:808::',    // 6to4 wrapping 8.8.8.8
  '198.17.255.255',     // just below the benchmark block
  '239.255.255.250',    // multicast 224/4 — not in this fix's scope, stays as-is
  '8.8.8.8',
  '203.0.113.5',
];

test('private / loopback-embedded addresses from the missing ranges are refused', () => {
  for (const host of PRIVATE) {
    assert.equal(security.isPrivateOrLoopbackHost(host), true, host);
  }
});

test('public addresses (incl. public-embedded NAT64/6to4) stay public', () => {
  for (const host of PUBLIC) {
    assert.equal(security.isPrivateOrLoopbackHost(host), false, host);
  }
});

test('isValidJobUrl rejects a NAT64-wrapped loopback URL', () => {
  assert.equal(security.isValidJobUrl('http://[64:ff9b::7f00:1]/jobs/1'), false);
});

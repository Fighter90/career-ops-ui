/**
 * Personio adapter — explicit `personio: <slug>` tenant pin (parent parity).
 *
 * Many companies embed the Personio tenant as an IFRAME on a branded careers
 * page, so `careers_url` points at the company's own domain while the feed
 * actually lives at `<slug>.jobs.personio.de`. Without a pin those boards
 * resolve to nothing. The pin names the tenant directly and WINS over
 * `api`/`careers_url`.
 *
 * This is an SSRF-adjacent path, so the invariants under test are:
 *   - the slug is charset-restricted by an anchored allowlist;
 *   - a rejected slug FALLS THROUGH to the existing api/careers_url behaviour
 *     and is never interpolated into a host;
 *   - the built URL still passes the source's own `assertPersonioUrl` host
 *     allowlist (`<slug>.jobs.personio.(de|com)`, HTTPS only).
 *
 * CI-isolated: no network. `buildEndpoint`/`matches` are pure; the one fetch
 * test injects a recording `fetchImpl`. Hosts are extracted with `new URL()`
 * and compared with strict `===` — never a substring/unanchored regex.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { personioAdapter } from '../server/lib/portals/adapters/personio.mjs';
import { assertPersonioUrl } from '../server/lib/sources/personio.mjs';

const ep = (company) => personioAdapter.buildEndpoint(company);
/** Host of a built endpoint, or null when nothing was built. */
const epHost = (company) => {
  const url = ep(company);
  return url === null ? null : new URL(url).hostname;
};

/** The iframe case: a branded careers page on the company's own domain. */
const IFRAME_CAREERS_URL = 'https://careers.acme-company.com/en/jobs';
/** A legitimate Personio careers_url used to prove fall-through on a bad pin. */
const FALLBACK_CAREERS_URL = 'https://fallback.jobs.personio.de';

/**
 * Slugs that must NEVER be interpolated into a host. Each would either reach a
 * foreign host outright (`evil.com`), smuggle userinfo (`a@b`), a port
 * (`a:b`), a path (`a/b`, `../x`) — or is simply outside the allowlist.
 */
const HOSTILE_SLUGS = [
  ['evil.com', 'a dot escapes the tenant subdomain → foreign host'],
  ['a/b', 'a slash opens a path segment'],
  ['a@b', 'an @ smuggles userinfo before the real host'],
  ['a:b', 'a colon smuggles a port'],
  ['../x', 'dot-dot path traversal'],
  ['-lead', 'a leading hyphen is not a legal first char'],
  ['has space', 'whitespace inside the slug'],
  ['a'.repeat(64), 'over the 63-char limit'],
  ['', 'an empty string'],
  ['evil.com#', 'a fragment marker'],
  ['acme.jobs.personio.de', 'a full host is not a slug'],
  ['acme%2Eevil', 'a percent-escape'],
];

/** Non-string pins — a typed config accident or a hostile YAML value. */
const NON_STRING_PINS = [
  123,
  null,
  undefined,
  true,
  ['acme'],
  { toString: () => 'evil.com' },
];

// ───────────────────────────── the pin resolves ─────────────────────────────

test('personio pin: a valid slug resolves to exactly <slug>.jobs.personio.de', () => {
  assert.equal(ep({ personio: 'acmegroup' }), 'https://acmegroup.jobs.personio.de/xml');
  // Host compared strictly, not by substring.
  assert.equal(epHost({ personio: 'acmegroup' }), 'acmegroup.jobs.personio.de');
  assert.equal(epHost({ personio: 'a' }), 'a.jobs.personio.de');                       // 1 char
  assert.equal(epHost({ personio: '0-9-abc' }), '0-9-abc.jobs.personio.de');           // digits + hyphens
  assert.equal(epHost({ personio: 'a'.repeat(63) }), `${'a'.repeat(63)}.jobs.personio.de`); // 63 = max
  // Surrounding whitespace in a hand-edited config is trimmed, not rejected.
  assert.equal(epHost({ personio: '  acmegroup  ' }), 'acmegroup.jobs.personio.de');
  // A pinned tenant is a Personio board even with nothing else set.
  assert.equal(personioAdapter.matches({ personio: 'acmegroup' }), true);
});

test('personio pin: an uppercase slug normalises to the lowercase host the allowlist accepts', () => {
  // PERSONIO_HOST_RE in the source is case-SENSITIVE, so a pin echoed verbatim
  // would build a host that assertPersonioUrl then rejects at fetch time.
  assert.equal(epHost({ personio: 'AcmeGroup' }), 'acmegroup.jobs.personio.de');
  assert.doesNotThrow(() => assertPersonioUrl(ep({ personio: 'AcmeGroup' })));
});

test('personio pin: the pin WINS over a conflicting careers_url (the iframe case)', () => {
  // The whole reason the key exists: careers_url is the company's own domain.
  assert.equal(epHost({ personio: 'acmegroup', careers_url: IFRAME_CAREERS_URL }), 'acmegroup.jobs.personio.de');
  // …and over a conflicting api, and over both at once.
  assert.equal(epHost({ personio: 'acmegroup', api: 'https://other.jobs.personio.de/xml' }), 'acmegroup.jobs.personio.de');
  assert.equal(
    epHost({ personio: 'acmegroup', api: 'https://other.jobs.personio.com/xml', careers_url: IFRAME_CAREERS_URL }),
    'acmegroup.jobs.personio.de',
  );
  // Without the pin, the same iframe board resolves to nothing — the bug.
  assert.equal(ep({ careers_url: IFRAME_CAREERS_URL }), null);
  assert.equal(personioAdapter.matches({ careers_url: IFRAME_CAREERS_URL }), false);
  assert.equal(personioAdapter.matches({ personio: 'acmegroup', careers_url: IFRAME_CAREERS_URL }), true);
});

// ──────────────────────── no pin → behaviour unchanged ───────────────────────

test('personio pin: with no pin, api/careers_url behaviour is unchanged', () => {
  assert.equal(ep({ careers_url: 'https://acme.jobs.personio.de' }), 'https://acme.jobs.personio.de/xml');
  assert.equal(ep({ careers_url: 'https://acme.jobs.personio.com' }), 'https://acme.jobs.personio.com/xml');
  assert.equal(ep({ api: 'https://acme.jobs.personio.de/xml' }), 'https://acme.jobs.personio.de/xml');
  // api still beats careers_url when no pin is present.
  assert.equal(epHost({ api: 'https://fromapi.jobs.personio.de/xml', careers_url: 'https://fromcareers.jobs.personio.de' }),
    'fromapi.jobs.personio.de');
  // Non-Personio / malformed / non-HTTPS inputs still produce nothing.
  assert.equal(ep({ careers_url: 'https://acme.greenhouse.io/board' }), null);
  assert.equal(ep({ careers_url: 'http://acme.jobs.personio.de' }), null);
  assert.equal(ep({ careers_url: 'https://acme.jobs.personio.de.evil.com' }), null);
  assert.equal(ep({ careers_url: 'not a url' }), null);
  assert.equal(ep({}), null);
  // provider: personio with nothing to build from — matches, builds nothing.
  assert.equal(personioAdapter.matches({ provider: 'personio' }), true);
  assert.equal(ep({ provider: 'personio' }), null);
  assert.equal(personioAdapter.matches({ careers_url: 'https://acme.jobs.personio.de' }), true);
});

// ───────────────────────────── hostile slug table ────────────────────────────

test('personio pin: a hostile slug is rejected and never reaches a foreign host', () => {
  for (const [slug, why] of HOSTILE_SLUGS) {
    // Alone: nothing is built at all — no host to reach.
    assert.equal(ep({ personio: slug }), null, `must reject pin ${JSON.stringify(slug)} (${why})`);
    // With a legitimate Personio careers_url: falls THROUGH to it, unchanged.
    assert.equal(
      epHost({ personio: slug, careers_url: FALLBACK_CAREERS_URL }),
      'fallback.jobs.personio.de',
      `pin ${JSON.stringify(slug)} must fall through to careers_url (${why})`,
    );
    // With a company-domain careers_url (the iframe shape): still nothing.
    assert.equal(
      ep({ personio: slug, careers_url: IFRAME_CAREERS_URL }),
      null,
      `pin ${JSON.stringify(slug)} must not rescue a non-Personio careers_url (${why})`,
    );
  }
});

test('personio pin: a non-string pin is ignored, never coerced into a host', () => {
  for (const pin of NON_STRING_PINS) {
    assert.equal(ep({ personio: pin }), null, `must reject non-string pin ${String(pin)}`);
    assert.equal(
      epHost({ personio: pin, careers_url: FALLBACK_CAREERS_URL }),
      'fallback.jobs.personio.de',
      `non-string pin ${String(pin)} must fall through to careers_url`,
    );
  }
});

test('personio pin: every built endpoint passes the source host allowlist', () => {
  // Defence in depth: whatever the adapter builds — from a pin or not — must
  // survive assertPersonioUrl, the sole gate on the request URL.
  const built = [
    ep({ personio: 'acmegroup' }),
    ep({ personio: 'AcmeGroup', careers_url: IFRAME_CAREERS_URL }),
    ep({ personio: 'a'.repeat(63) }),
    ep({ careers_url: 'https://acme.jobs.personio.com' }),
  ];
  for (const url of built) {
    assert.notEqual(url, null);
    assert.doesNotThrow(() => assertPersonioUrl(url), `must pass the host allowlist: ${url}`);
  }
  // And the allowlist is still a real gate.
  assert.throws(() => assertPersonioUrl('https://evil.com/xml'), /untrusted hostname/);
});

// ───────────────────── the pinned URL is what actually ships ─────────────────

test('personio pin: the pinned host is the host actually fetched (injected fetch, no network)', async () => {
  const { fetchPersonio } = await import('../server/lib/sources/personio.mjs');
  const requested = [];
  const fetchImpl = async (url, opts) => {
    requested.push(url);
    assert.equal(opts.redirect, 'error'); // the redirect-SSRF defence is still on
    return { ok: true, text: async () => '<workzag-jobs><position><id>7</id><name>SWE</name><office>Berlin</office></position></workzag-jobs>' };
  };
  const url = ep({ personio: 'acmegroup', careers_url: IFRAME_CAREERS_URL });
  const jobs = await fetchPersonio(url, { fetchImpl, company: { name: 'Acme' } });

  assert.equal(requested.length, 1);
  assert.equal(new URL(requested[0]).hostname, 'acmegroup.jobs.personio.de');
  assert.equal(new URL(requested[0]).protocol, 'https:');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acmegroup.jobs.personio.de/job/7');
});

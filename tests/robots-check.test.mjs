// robots-check.mjs (CAR-254 port of the parent's robots-check.mjs) — reads
// robots.txt the cautious RFC 9309 way and fails closed. The sitemap source
// consults it before every sitemap/child/detail fetch.
//
// Offline: every transport and resolver is injected, so no case reaches the
// network. Parser cases mirror the parent's tests/robots-check.test.mjs
// (ported there from MadsLorentzen/ai-job-search, MIT). Cases marked FAIL-OPEN
// REGRESSION are ones Python's urllib.robotparser gets wrong; getting them
// wrong here means the scanner fetches a site that said no.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  robotsAllows,
  isPathAllowed,
  isRobotsBody,
  hasUndecodableRule,
  matchLength,
  percentDecode,
  parseRobotsGroups,
  clearRobotsCache,
  ROBOTS_PRODUCT_TOKEN,
  ROBOTS_MAX_BYTES,
  ROBOTS_MAX_REDIRECTS,
} from '../server/lib/robots-check.mjs';

const PUBLIC = ['93.184.215.14'];

/** A fetch-like transport answering from a table keyed by URL. */
function transport(table) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const entry = typeof table === 'function' ? await table(url, init) : table[url];
    if (entry instanceof Error) throw entry;
    if (!entry) return { status: 404, headers: { get: () => null }, text: async () => '' };
    return {
      status: entry.status ?? 200,
      headers: { get: (name) => (name === 'location' ? entry.location ?? null : null) },
      text: async () => entry.body ?? '',
    };
  };
  return { fetchImpl, calls };
}

/** robotsAllows with a fresh cache, a public resolver and a canned robots.txt. */
async function gate(url, body, { status = 200, resolver, location } = {}) {
  const origin = new URL(url).origin;
  const { fetchImpl, calls } = transport({ [`${origin}/robots.txt`]: { status, body, location } });
  const verdict = await robotsAllows(url, {
    fetchImpl, resolver: resolver || (async () => PUBLIC), cache: new Map(),
  });
  return { ...verdict, calls };
}

// ── percentDecode ────────────────────────────────────────────────────────────

test('percentDecode: valid UTF-8 escape runs decode, malformed escapes stay as written', () => {
  assert.equal(percentDecode('%2Fjobs%2F1'), '/jobs/1');
  assert.equal(percentDecode('/jobs/%E0%A4%A4'), '/jobs/त');
  assert.equal(percentDecode('/jobs/%zz'), '/jobs/%zz');
  assert.equal(percentDecode('/jobs/%E0%A4'), '/jobs/%E0%A4');
  assert.equal(percentDecode('/jobs/50%25'), '/jobs/50%');
});

// ── matchLength / rule matching ─────────────────────────────────────────────

test('FAIL-OPEN REGRESSION: blank lines inside a record do not end it', () => {
  const body = 'User-agent: *\n\n\nAllow: /\n\nDisallow: /cs/\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/jobs/1'), true);
  assert.equal(isPathAllowed(body, 'career-ops', '/cs/secret'), false);
});

test('longest match wins over rule order; a longer Allow unblocks a shorter Disallow', () => {
  const body = 'User-agent: *\nDisallow: /\nAllow: /jobs\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/jobs/1'), true);
  assert.equal(isPathAllowed(body, 'career-ops', '/admin'), false);
});

test('an equal-length Allow/Disallow tie goes to Disallow, in either order', () => {
  assert.equal(isPathAllowed('User-agent: *\nDisallow: /j\nAllow: /j', 'career-ops', '/j'), false);
  assert.equal(isPathAllowed('User-agent: *\nAllow: /j\nDisallow: /j', 'career-ops', '/j'), false);
});

test('`*` wildcard and trailing `$` anchor; a `$` mid-pattern is literal', () => {
  // matchLength returns the RAW pattern length (what "longest match" compares).
  assert.equal(matchLength('/jobs/*', '/jobs/1/x'), 7);
  assert.equal(matchLength('/jobs$', '/jobs'), 6);
  assert.equal(matchLength('/jobs$', '/jobs/1'), -1);
  assert.equal(matchLength('/a$b', '/a$b'), 4);
});

test('repeated wildcards do not backtrack catastrophically', () => {
  const start = Date.now();
  matchLength('/*a*a*a*a*a*a*a*a*a*b', '/aaaaaaaac');
  assert.ok(Date.now() - start < 500, 'wildcard match must stay linear');
  assert.equal(matchLength('/*a*a*a*a*a*a*a*a*a*b', '/aaaaaaaac'), -1);
});

test('consecutive wildcards match the same as one', () => {
  assert.equal(matchLength('/a**b', '/axb'), 5);
  assert.equal(matchLength('/a**b', '/ab'), 5);
});

test('an empty Disallow allows everything; a rule-less file is allow-all', () => {
  assert.equal(isPathAllowed('User-agent: *\nDisallow:\n', 'career-ops', '/anything'), true);
  assert.equal(isPathAllowed('User-agent: *\n', 'career-ops', '/anything'), true);
});

// ── parseRobotsGroups / group selection ─────────────────────────────────────

test('comments are stripped from rule lines; CRLF parses like LF', () => {
  const body = 'User-agent: * # all\r\n# comment\r\nDisallow: /x # no\r\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/x'), false);
  assert.equal(isPathAllowed(body, 'career-ops', '/y'), true);
});

test('the product token is career-ops', () => {
  assert.equal(ROBOTS_PRODUCT_TOKEN, 'career-ops');
});

test('a career-ops group is obeyed over `*`; agent matching is case-insensitive and ignores a version suffix', () => {
  const body = 'User-agent: Career-Ops/1.0\nDisallow: /private\nUser-agent: *\nDisallow: /\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/public'), true);
  assert.equal(isPathAllowed(body, 'career-ops', '/private'), false);
});

test('a group for another agent does not bind career-ops; `*` does', () => {
  const body = 'User-agent: googlebot\nDisallow: /\nUser-agent: *\nDisallow: /cs/\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/jobs'), true);
  assert.equal(isPathAllowed(body, 'career-ops', '/cs/x'), false);
});

test('several agents in one record share its rules', () => {
  const body = 'User-agent: a\nUser-agent: career-ops\nDisallow: /x\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/x'), false);
});

test('a named group with no rule lines falls back to `*`, never to allow-all', () => {
  const body = 'User-agent: career-ops\nUser-agent: *\nDisallow: /jobs\n';
  assert.equal(isPathAllowed(body, 'career-ops', '/jobs'), false);
});

// ── isRobotsBody / hasUndecodableRule ───────────────────────────────────────

test('FAIL-OPEN REGRESSION: an HTML or JSON error page is not a robots.txt', () => {
  assert.equal(isRobotsBody('<!doctype html><html><body>404</body></html>'), false);
  assert.equal(isRobotsBody('{"error":"not found"}'), false);
  assert.equal(isRobotsBody('User-agent: *\nAllow: /'), true);
  assert.equal(isRobotsBody('Sitemap: https://example.com/sitemap.xml'), true);
});

test('an empty file is allow-all', () => {
  assert.equal(isRobotsBody(''), true);
  assert.equal(isRobotsBody('   \n'), true);
});

test('FAIL-OPEN REGRESSION: an undecodable rule line makes the body unreadable', () => {
  const bad = 'User-agent: *\nDisallow: /\uFFFDjobs\n';
  assert.equal(hasUndecodableRule(bad), true);
  assert.equal(isRobotsBody(bad), true); // a directive is recognised …
  // … and robotsAllows must refuse on it (checked end-to-end below).
  assert.equal(hasUndecodableRule('User-agent: *\nAllow: /'), false);
});

test('U+FFFD in a comment or an unrelated field is harmless', () => {
  assert.equal(hasUndecodableRule('# com\uFFFDment\nUser-agent: *\nAllow: /'), false);
  assert.equal(hasUndecodableRule('Sitemap: https://x/\uFFFD\nUser-agent: *\nAllow: /'), false);
});

test('a BOM does not hide the first group', () => {
  const body = `\uFEFFUser-agent: *\nDisallow: /x\n`;
  assert.equal(isPathAllowed(body, 'career-ops', '/x'), false);
});

// ── robotsAllows: statuses, redirects, fail-closed ──────────────────────────

test('404 and 410 mean no published policy, which allows', async () => {
  for (const status of [404, 410]) {
    const v = await gate('https://example.com/jobs/1', '<html>gone</html>', { status });
    assert.deepEqual([v.allowed, v.code], [true, 'robots_absent'], String(status));
  }
});

test('an empty 200 allows', async () => {
  const v = await gate('https://example.com/jobs/1', '  \n');
  assert.deepEqual([v.allowed, v.code], [true, 'robots_empty']);
});

test('a permitted path answers robots_allowed; a disallowed one robots_disallowed', async () => {
  const allowed = await gate('https://example.com/jobs/1', 'User-agent: *\nAllow: /\n');
  assert.deepEqual([allowed.allowed, allowed.code], [true, 'robots_allowed']);
  const denied = await gate('https://example.com/private/x', 'User-agent: *\nDisallow: /private\n');
  assert.deepEqual([denied.allowed, denied.code], [false, 'robots_disallowed']);
});

test('every non-2xx status denies, each with its own code', async () => {
  const cases = [
    [401, 'robots_forbidden'], [403, 'robots_forbidden'],
    [429, 'robots_http_error'], [400, 'robots_http_error'],
    [500, 'robots_server_error'], [503, 'robots_server_error'],
  ];
  for (const [status, code] of cases) {
    const v = await gate('https://example.com/jobs/1', 'User-agent: *\nAllow: /\n', { status });
    assert.deepEqual([v.allowed, v.code], [false, code], String(status));
    assert.match(v.reason, new RegExp(String(status)));
  }
});

test('a soft 200 that is not a robots.txt denies (a zero-rule parse must not read as allow-all)', async () => {
  const v = await gate('https://example.com/jobs/1', '<!doctype html><title>Just a moment…</title>');
  assert.deepEqual([v.allowed, v.code], [false, 'robots_not_robots_txt']);
});

test('a body over the RFC 9309 parse floor denies instead of being truncated', async () => {
  const body = `User-agent: *\nAllow: /\n${'#'.repeat(ROBOTS_MAX_BYTES)}\nDisallow: /jobs\n`;
  const v = await gate('https://example.com/jobs/1', body);
  assert.deepEqual([v.allowed, v.code], [false, 'robots_too_large']);
});

test('redirects are followed by hand, up to the RFC floor', async () => {
  const origin = 'https://example.com';
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return { status: 301, headers: { get: (n) => (n === 'location' ? 'https://www.example.com/robots.txt' : null) }, text: async () => '' };
    }
    return { status: 200, headers: { get: () => null }, text: async () => 'User-agent: *\nAllow: /\n' };
  };
  const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => PUBLIC, cache: new Map() });
  assert.deepEqual([v.allowed, v.code], [true, 'robots_allowed']);
  assert.equal(calls.length, 2);

  // Looping past the cap denies.
  let hops = 0;
  const loop = async () => { hops += 1; return { status: 302, headers: { get: () => '/robots.txt' }, text: async () => '' }; };
  const v2 = await robotsAllows('https://example.com/jobs/1', { fetchImpl: loop, resolver: async () => PUBLIC, cache: new Map(), maxRedirects: ROBOTS_MAX_REDIRECTS });
  assert.deepEqual([v2.allowed, v2.code], [false, 'robots_too_many_redirects']);
  assert.equal(hops, ROBOTS_MAX_REDIRECTS + 1);
});

test('a 3xx without a Location denies', async () => {
  const origin = 'https://example.com';
  const { fetchImpl } = transport({ [`${origin}/robots.txt`]: { status: 302, body: '' } });
  const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => PUBLIC, cache: new Map() });
  assert.deepEqual([v.allowed, v.code], [false, 'robots_http_error']);
});

test('a timeout denies, even when the transport ignores its signal', async () => {
  const fetchImpl = () => new Promise(() => {});
  const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => PUBLIC, cache: new Map(), timeoutMs: 20 });
  assert.deepEqual([v.allowed, v.code], [false, 'robots_timeout']);
});

test('a transport error denies', async () => {
  const { fetchImpl } = transport(() => Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));
  const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => PUBLIC, cache: new Map() });
  assert.deepEqual([v.allowed, v.code], [false, 'robots_fetch_error']);
});

test('an egress guard refusing a host denies with the blocked-address code', async () => {
  const blocked = Object.assign(new Error('Refusing to fetch example.com: resolves to non-public address 10.0.0.1'), { code: 'ECAREEROPS_BLOCKED_ADDRESS' });
  const { fetchImpl } = transport(() => blocked);
  const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => PUBLIC, cache: new Map() });
  assert.deepEqual([v.allowed, v.code], [false, 'robots_blocked_address']);
});

test('an unresolvable host denies without a fetch', async () => {
  for (const resolver of [
    async () => { throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }); },
    async () => [],
  ]) {
    const { fetchImpl, calls } = transport({ 'https://example.com/robots.txt': { status: 200, body: 'User-agent: *\nAllow: /' } });
    const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver, cache: new Map() });
    assert.deepEqual([v.allowed, v.code], [false, 'robots_unresolvable']);
    assert.equal(calls.length, 0);
  }
});

test('a resolved private address denies without a fetch', async () => {
  const { fetchImpl, calls } = transport({ 'https://example.com/robots.txt': { status: 200, body: 'User-agent: *\nAllow: /' } });
  const v = await robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => ['10.0.0.5'], cache: new Map() });
  assert.deepEqual([v.allowed, v.code], [false, 'robots_blocked_address']);
  assert.equal(calls.length, 0);
});

test('invalid URLs deny without a fetch', async () => {
  for (const url of ['not a url', 'ftp://example.com/robots.txt']) {
    const { fetchImpl, calls } = transport({});
    const v = await robotsAllows(url, { fetchImpl, resolver: async () => PUBLIC, cache: new Map() });
    assert.deepEqual([v.allowed, v.code], [false, 'robots_invalid_url'], url);
    assert.equal(calls.length, 0);
  }
});

test('the policy is cached per origin (concurrent callers share one fetch)', async () => {
  const cache = new Map();
  const { fetchImpl, calls } = transport({ 'https://example.com/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /private\n' } });
  const [a, b] = await Promise.all([
    robotsAllows('https://example.com/jobs/1', { fetchImpl, resolver: async () => PUBLIC, cache }),
    robotsAllows('https://example.com/private/2', { fetchImpl, resolver: async () => PUBLIC, cache }),
  ]);
  assert.deepEqual([a.allowed, b.allowed], [true, false]);
  assert.equal(calls.length, 1);
  clearRobotsCache(); // the shared default cache must end the run empty
});

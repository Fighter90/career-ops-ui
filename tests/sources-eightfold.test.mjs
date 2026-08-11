/**
 * Eightfold AI source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops parity (#2684).
 *
 * Every fixture host is synthetic (acme/big.eightfold.ai). Nothing here touches
 * the network. Derived URLs are validated by PARSED hostname, never by
 * substring-matching the URL string (CodeQL js/incomplete-url-substring-
 * sanitization) — a trusted host fragment can hide in a hostile URL's path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchEightfold,
  normalizeEightfoldJob,
  resolveTenantHost,
  assertEightfoldUrl,
  buildApiUrl,
  buildJobUrl,
  EIGHTFOLD_HOST_RE,
  meta,
} from '../server/lib/sources/eightfold.mjs';
import { eightfoldAdapter } from '../server/lib/portals/adapters/eightfold.mjs';

const ENDPOINT = 'https://acme.eightfold.ai/api/apply/v2/jobs';
const TENANT = { host: 'acme.eightfold.ai', domain: null };
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };

// ---------------------------------------------------------------------------
// Fake response helpers — a fetchImpl that replays canned pages keyed by the
// `start` offset, recording every URL + options it is asked for.
// ---------------------------------------------------------------------------

function makePosition(overrides = {}) {
  return {
    id: 1001,
    name: 'Staff Backend Engineer',
    location: 'Berlin,Germany',
    locations: ['Berlin,Germany', 'Munich,Germany'],
    department: 'Engineering',
    business_unit: 'Platform',
    t_create: 1_780_000_000,
    t_update: 1_781_000_000,
    canonicalPositionUrl: 'https://careers.acme.example/careers/job/1001',
    ...overrides,
  };
}

/** positions of length n, ids `offset..offset+n-1`, id-based fallback URLs. */
function full(n, offset) {
  return Array.from({ length: n }, (_, i) => ({
    id: offset + i,
    name: `Role ${offset + i}`,
    location: 'Berlin,Germany',
  }));
}

function fakeFetch(pagesByStart) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const start = Number(new URL(url).searchParams.get('start') || '0');
    const body = pagesByStart[start] ?? { positions: [], count: 0 };
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

test('meta: value/label/region', () => {
  assert.deepEqual(meta, { value: 'eightfold', label: 'Eightfold', region: 'en' });
});

// ---------------------------------------------------------------------------
// assertEightfoldUrl / resolveTenantHost — SSRF host-pin
// ---------------------------------------------------------------------------

test('EIGHTFOLD_HOST_RE: exact single-label subdomain match only', () => {
  assert.ok(EIGHTFOLD_HOST_RE.test('acme.eightfold.ai'));
  assert.ok(!EIGHTFOLD_HOST_RE.test('eightfold.ai'));          // apex
  assert.ok(!EIGHTFOLD_HOST_RE.test('a.b.eightfold.ai'));       // multi-label
  assert.ok(!EIGHTFOLD_HOST_RE.test('acme.eightfold.ai.evil.example')); // lookalike suffix
});

test('assertEightfoldUrl: accepts the pinned host, rejects others', () => {
  assert.equal(assertEightfoldUrl(ENDPOINT), ENDPOINT);
  assert.throws(() => assertEightfoldUrl('https://evil.example/api'), /untrusted hostname/);
  assert.throws(() => assertEightfoldUrl('http://acme.eightfold.ai/api'), /HTTPS/);
  assert.throws(() => assertEightfoldUrl('not a url'), /invalid URL/);
});

test('resolveTenantHost: accepts tenant hosts, rejects off-host / non-https / apex / multi-label', () => {
  // accept — lowercases host, null domain when absent
  assert.deepEqual(
    resolveTenantHost('https://ACME.eightfold.ai/careers'),
    { host: 'acme.eightfold.ai', domain: null },
  );
  // accept — carries ?domain= through
  assert.deepEqual(
    resolveTenantHost('https://acme.eightfold.ai/careers?domain=acme.example'),
    { host: 'acme.eightfold.ai', domain: 'acme.example' },
  );
  // reject
  assert.equal(resolveTenantHost('https://careers.acme.example/careers'), null); // branded CNAME
  assert.equal(resolveTenantHost('https://evil.example/careers'), null);          // off-host
  assert.equal(resolveTenantHost('http://acme.eightfold.ai/careers'), null);      // non-https
  assert.equal(resolveTenantHost('https://eightfold.ai/careers'), null);          // apex
  assert.equal(resolveTenantHost('https://a.b.eightfold.ai/careers'), null);      // multi-label
  assert.equal(resolveTenantHost('https://acme.eightfold.ai.evil.example/x'), null); // lookalike
  assert.equal(resolveTenantHost('https://evil.example/acme.eightfold.ai/x'), null); // host in path
  assert.equal(resolveTenantHost('https://acme.eightfold.ai@evil.example/x'), null); // host in userinfo
  assert.equal(resolveTenantHost(''), null);
  assert.equal(resolveTenantHost(42), null);
  assert.equal(resolveTenantHost('not a url'), null);
});

// ---------------------------------------------------------------------------
// normalizeEightfoldJob — shape + drop rules
// ---------------------------------------------------------------------------

test('normalizeEightfoldJob: maps a full row into the web-ui job shape', () => {
  const job = normalizeEightfoldJob(makePosition(), TENANT, 'Acme');
  assert.equal(job.id, 'eightfold-1001');
  assert.equal(job.title, 'Staff Backend Engineer');
  assert.equal(job.company, 'Acme');
  // canonicalPositionUrl on a branded host is accepted for the display URL.
  assert.equal(job.url, 'https://careers.acme.example/careers/job/1001');
  assert.equal(job.salary, '');
  assert.equal(job.location, 'Berlin,Germany · Munich,Germany'); // locations[] folded in
  assert.equal(job.isRemote, false);
  assert.equal(job.workplaceType, '');
  assert.equal(job.relocates, false);
  // t_create is epoch SECONDS — converted to ISO ms, not left at 1970.
  assert.equal(job.date, new Date(1_780_000_000_000).toISOString());
  assert.match(job.snippet, /Engineering/);
  assert.match(job.snippet, /BU: Platform/);
  assert.equal(job.source, 'eightfold');
});

test('normalizeEightfoldJob: falls back to the tenant posting URL when canonical is absent', () => {
  const job = normalizeEightfoldJob(
    makePosition({ id: 1002, canonicalPositionUrl: undefined }),
    TENANT,
    'Acme',
  );
  assert.equal(job.url, buildJobUrl(TENANT, '1002'));
  assert.equal(hostOf(job.url), 'acme.eightfold.ai');
});

test('normalizeEightfoldJob: reads posting_name as a title fallback, omits date when undated', () => {
  const job = normalizeEightfoldJob(
    { id: 1003, posting_name: 'Product Manager', location: 'Munich,Germany' },
    TENANT,
    'Acme',
  );
  assert.equal(job.title, 'Product Manager');
  assert.equal(job.date, '');
});

test('normalizeEightfoldJob: flags remote from the location text', () => {
  const job = normalizeEightfoldJob(
    { id: 7, name: 'SRE', location: 'Remote - EU' },
    TENANT,
    'Acme',
  );
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
});

test('normalizeEightfoldJob: drops rows with no title / no id+URL / non-https canonical; tolerates junk', () => {
  // no title
  assert.equal(normalizeEightfoldJob({ id: 1, location: 'x' }, TENANT, 'Acme'), null);
  // title but no id and no usable URL
  assert.equal(normalizeEightfoldJob({ name: 'Ghost' }, TENANT, 'Acme'), null);
  // non-https canonical and no id to fall back on
  assert.equal(
    normalizeEightfoldJob({ name: 'Insecure', canonicalPositionUrl: 'http://x.example/job' }, TENANT, 'Acme'),
    null,
  );
  // non-object payloads
  for (const junk of [null, undefined, 'nope', 42, []]) {
    assert.equal(normalizeEightfoldJob(junk, TENANT, 'Acme'), null);
  }
});

// ---------------------------------------------------------------------------
// buildApiUrl
// ---------------------------------------------------------------------------

test('buildApiUrl: sets domain/start/num on the pinned host', () => {
  const u = new URL(buildApiUrl({ host: 'acme.eightfold.ai', domain: 'acme.example' }, 30, 10));
  assert.equal(u.hostname, 'acme.eightfold.ai');
  assert.equal(u.pathname, '/api/apply/v2/jobs');
  assert.equal(u.searchParams.get('start'), '30');
  assert.equal(u.searchParams.get('num'), '10');
  assert.equal(u.searchParams.get('domain'), 'acme.example');
});

// ---------------------------------------------------------------------------
// fetchEightfold — pagination, cap, stop, dead-board, partials, dedupe
// ---------------------------------------------------------------------------

test('fetchEightfold: paginates by start=, caps num=10, sends redirect/headers, aggregates', async () => {
  const fetchImpl = fakeFetch({
    0: { count: 25, positions: full(10, 0) },
    10: { count: 25, positions: full(10, 10) },
    20: { count: 25, positions: full(5, 20) }, // short page → stop
  });
  const jobs = await fetchEightfold(ENDPOINT, { fetchImpl, company: { name: 'Acme' } });

  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(jobs.length, 25);
  // only ever requests the pinned tenant host, num=10, redirect:error, headers
  for (const c of fetchImpl.calls) {
    assert.equal(hostOf(c.url), 'acme.eightfold.ai');
    assert.equal(new URL(c.url).searchParams.get('num'), '10');
    assert.equal(c.opts.redirect, 'error');
    assert.equal(c.opts.headers.accept, 'application/json');
    assert.ok(c.opts.headers['user-agent']);
  }
});

test('fetchEightfold: returns [] after a single request for an empty board', async () => {
  const fetchImpl = fakeFetch({ 0: { count: 0, positions: [] } });
  const jobs = await fetchEightfold(ENDPOINT, { fetchImpl });
  assert.equal(jobs.length, 0);
  assert.equal(fetchImpl.calls.length, 1);
});

test('fetchEightfold: honors max_pages even when the board claims more (safety cap)', async () => {
  const pages = {};
  for (let s = 0; s <= 500; s += 10) pages[s] = { count: 500, positions: full(10, s) };
  const fetchImpl = fakeFetch(pages);
  const jobs = await fetchEightfold(ENDPOINT, { fetchImpl, company: { max_pages: 4 } });
  assert.equal(fetchImpl.calls.length, 4);
  assert.equal(jobs.length, 40);
});

test('fetchEightfold: stops once paged past count (short/total stop)', async () => {
  const fetchImpl = fakeFetch({
    0: { count: 20, positions: full(10, 0) },
    10: { count: 20, positions: full(10, 10) }, // start+10 === 20 → stop
  });
  const jobs = await fetchEightfold(ENDPOINT, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 20);
});

test('fetchEightfold: dedupes by url across pages', async () => {
  const fetchImpl = fakeFetch({
    0: { count: 20, positions: full(10, 0) },  // ids 0..9
    10: { count: 20, positions: full(10, 5) }, // ids 5..14 — 5..9 repeat
  });
  const jobs = await fetchEightfold(ENDPOINT, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 15); // 0..14 unique, 5 dupes dropped
});

test('fetchEightfold: first-page failure throws (dead board)', async () => {
  const failing = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => fetchEightfold(ENDPOINT, { fetchImpl: failing }), /HTTP 404/);
});

test('fetchEightfold: a later-page failure keeps the jobs already collected (partials)', async () => {
  let call = 0;
  const blippy = async () => {
    call += 1;
    if (call === 1) return { ok: true, json: async () => ({ count: 100, positions: full(10, 0) }) };
    return { ok: false, status: 404 }; // page 1 dies after a full page 0
  };
  const jobs = await fetchEightfold(ENDPOINT, { fetchImpl: blippy });
  assert.equal(jobs.length, 10);
});

test('fetchEightfold: an off-host / underivable endpoint throws before any request', async () => {
  // assertEightfoldUrl rejects the off-host endpoint up front.
  let touched = false;
  const spy = async () => { touched = true; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(
    () => fetchEightfold('https://evil.example/api/apply/v2/jobs', { fetchImpl: spy }),
    /untrusted hostname/,
  );
  assert.equal(touched, false);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('eightfoldAdapter: matches provider or *.eightfold.ai host, builds a pinned endpoint', () => {
  assert.equal(eightfoldAdapter.id, 'eightfold');
  // matches
  assert.ok(eightfoldAdapter.matches({ provider: 'eightfold' }));
  assert.ok(eightfoldAdapter.matches({ careers_url: 'https://bayer.eightfold.ai/careers' }));
  assert.ok(eightfoldAdapter.matches({ api: 'https://bayer.eightfold.ai/api/apply/v2/jobs' }));
  // rejects — branded CNAME, off-host, host-in-path, apex, non-https
  assert.ok(!eightfoldAdapter.matches({ careers_url: 'https://careers.bayer.com/careers' }));
  assert.ok(!eightfoldAdapter.matches({ careers_url: 'https://evil.example/bayer.eightfold.ai/careers' }));
  assert.ok(!eightfoldAdapter.matches({ careers_url: 'https://eightfold.ai/careers' }));
  assert.ok(!eightfoldAdapter.matches({ careers_url: 'http://bayer.eightfold.ai/careers' }));
  assert.ok(!eightfoldAdapter.matches(null));

  // buildEndpoint — pinned jobs URL from careers_url
  const ep = eightfoldAdapter.buildEndpoint({ careers_url: 'https://bayer.eightfold.ai/careers' });
  assert.equal(hostOf(ep), 'bayer.eightfold.ai');
  assert.equal(new URL(ep).pathname, '/api/apply/v2/jobs');
  assert.equal(new URL(ep).searchParams.get('start'), '0');

  // buildEndpoint — carries ?domain= through, and lets entry.domain override
  const epDomain = eightfoldAdapter.buildEndpoint({
    careers_url: 'https://bayer.eightfold.ai/careers?domain=from-url.example',
    domain: 'explicit.example',
  });
  assert.equal(new URL(epDomain).searchParams.get('domain'), 'explicit.example');

  // buildEndpoint — off-host / unusable → null
  assert.equal(eightfoldAdapter.buildEndpoint({ careers_url: 'https://evil.example/careers' }), null);
  assert.equal(eightfoldAdapter.buildEndpoint({ careers_url: 'http://bayer.eightfold.ai/careers' }), null);
  assert.equal(eightfoldAdapter.buildEndpoint({}), null);
});

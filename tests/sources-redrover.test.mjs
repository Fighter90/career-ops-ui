/**
 * Red Rover K12 source + adapter — CI-isolated tests (fake fetchImpl, no
 * network, no parent-project dependency, no port binding, nothing reads
 * CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/redrover.test.mjs`: detect()
 * host/path gating, the response parser (public-only, closed rows, GraphQL
 * errors, hasMoreData) and the request guards (one POST to the fixed API host,
 * redirect:'error', retry on 5xx but not 4xx).
 *
 * URL assertions use strict equality, never `String.includes` or an unanchored
 * regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  API_URL,
  MAX_JOBS,
  isRedRoverHost,
  resolveRedRoverTarget,
  buildBoardUrl,
  assertRedRoverUrl,
  parseRedRoverResponse,
  fetchRedRover,
} from '../server/lib/sources/redrover.mjs';
import { redroverAdapter } from '../server/lib/portals/adapters/redrover.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const BOARD = 'https://jobs.redroverk12.com/org/4242';

const wrap = (results, extra = {}) => ({
  data: { jobSeekerSiteUnauthenticated: { jobPostingSearch: { results, hasMoreData: false, ...extra } } },
});
const posting = (over) => ({
  id: '9001', name: 'Math Teacher', organizationName: 'Example SD', location: { name: 'Example High' },
  activePublicOnDateUtc: '2026-09-09T07:00:00Z', closedOnDateUtc: null, allowsRemote: false, ...over,
});
const FIXTURE = wrap([
  posting({}),
  posting({ id: 9002, name: 'Remote Tutor', allowsRemote: true, activePublicOnDateUtc: 'garbage' }),
  posting({ id: '9003', name: 'Internal Only', activePublicOnDateUtc: null }), // internal → dropped
  posting({ id: '9004', name: 'Closed', closedOnDateUtc: '2026-09-01T00:00:00Z' }), // closed → dropped
  posting({ id: 'abc', name: 'Non-numeric id' }), // dropped
  posting({ id: '9005', name: '' }), // no name → dropped
  null, // junk → dropped
]);

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, headers: { get: () => null } };
}

/** Fake transport that records every call. */
function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { impl, calls };
}

const noSleep = { retryDelayMs: 0 };

// ── meta + adapter ───────────────────────────────────────────────────────

test('meta is the EN redrover source', () => {
  assert.deepEqual(meta, { value: 'redrover', label: 'Red Rover', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(redroverAdapter.id, 'redrover');
  assert.equal(redroverAdapter.label, 'Red Rover');
  assert.equal(redroverAdapter.fetch, fetchRedRover);
});

for (const url of [
  'https://jobs.redroverk12.com/org/4242',
  'https://jobs.redroverk12.com/org/4242/opening/9',
  'https://JOBS.redroverk12.com/org/4242/',
  '  https://jobs.redroverk12.com/org/4242?x=1  ',
]) {
  test(`adapter recognises and canonicalises ${JSON.stringify(url)}`, () => {
    const entry = { name: 'Acme', careers_url: url };
    assert.equal(redroverAdapter.matches(entry), true);
    assert.equal(redroverAdapter.buildEndpoint(entry), BOARD);
    assert.deepEqual(resolveRedRoverTarget(url), { origin: 'https://jobs.redroverk12.com', orgId: '4242' });
  });
}

const NEGATIVES = {
  'a non-Red Rover host': 'https://example.com/org/4242',
  'a path-spoofed URL': 'https://evil.example/jobs.redroverk12.com/org/4242',
  'a lookalike suffix host': 'https://jobs.redroverk12.com.evil.example/org/4242',
  'a lookalike prefix host': 'https://evil-jobs.redroverk12.com/org/4242',
  'a sibling subdomain': 'https://api.redroverk12.com/org/4242',
  'http': 'http://jobs.redroverk12.com/org/4242',
  'no org path': 'https://jobs.redroverk12.com/',
  'a non-numeric org id': 'https://jobs.redroverk12.com/org/abc',
  'an org id with trailing junk': 'https://jobs.redroverk12.com/org/42x',
  'a malformed URL': 'not a url',
  'null careers_url': null,
  'a non-string careers_url': 7,
  'an empty careers_url': '',
};
for (const [label, careers_url] of Object.entries(NEGATIVES)) {
  test(`adapter rejects ${label}`, () => {
    assert.equal(resolveRedRoverTarget(careers_url), null);
    assert.equal(buildBoardUrl(careers_url), null);
    assert.equal(redroverAdapter.matches({ name: 'X', careers_url }), false);
    assert.equal(redroverAdapter.buildEndpoint({ name: 'X', careers_url }), null);
    assert.throws(() => assertRedRoverUrl(careers_url, 'X'), /redrover: cannot derive org id for X/);
  });
}

test('adapter: explicit provider wins; missing careers_url / null entry are not claimed', () => {
  assert.equal(redroverAdapter.matches({ name: 'X', provider: 'redrover' }), true);
  assert.equal(redroverAdapter.buildEndpoint({ name: 'X', provider: 'redrover' }), null);
  assert.equal(redroverAdapter.matches({ name: 'X', provider: 'greenhouse', careers_url: BOARD }), false);
  assert.equal(redroverAdapter.matches({ name: 'X' }), false);
  assert.equal(redroverAdapter.matches(null), false);
  assert.equal(redroverAdapter.buildEndpoint(null), null);
});

test('isRedRoverHost is an anchored exact match', () => {
  assert.equal(isRedRoverHost('jobs.redroverk12.com'), true);
  assert.equal(isRedRoverHost('JOBS.REDROVERK12.COM'), true);
  assert.equal(isRedRoverHost('jobs.redroverk12.com.evil.example'), false);
  assert.equal(isRedRoverHost('xjobs.redroverk12.com'), false);
  assert.equal(isRedRoverHost(undefined), false);
});

// ── parser ───────────────────────────────────────────────────────────────

test('parser keeps public open postings with a numeric id + name, drops the rest', () => {
  const jobs = parseRedRoverResponse(FIXTURE, '4242', 'Acme');
  assert.equal(jobs.length, 2);
  assert.ok(!jobs.some((j) => j.title === 'Internal Only'));
  assert.ok(!jobs.some((j) => j.title === 'Closed'));
});

test('parser builds /org/<org>/opening/<id>, sets company and the web-ui job shape', () => {
  const [job] = parseRedRoverResponse(FIXTURE, '4242', 'Acme');
  assert.deepEqual(job, {
    id: 'redrover-4242-9001',
    title: 'Math Teacher',
    company: 'Acme',
    url: 'https://jobs.redroverk12.com/org/4242/opening/9001',
    salary: '',
    location: 'Example High - Example SD',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '2026-09-09',
    snippet: '',
    source: 'redrover',
  });
});

test('parser coerces a numeric id, tags allowsRemote, and leaves an unparseable date empty (NaN-safe)', () => {
  const jobs = parseRedRoverResponse(FIXTURE, '4242', 'Acme');
  assert.equal(jobs[1].url, 'https://jobs.redroverk12.com/org/4242/opening/9002');
  assert.equal(jobs[1].location, 'Example High - Example SD (Remote)');
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
  assert.equal(jobs[1].date, '');
});

test('parser joins only the location parts present and falls back to a default company', () => {
  const jobs = parseRedRoverResponse(wrap([posting({ location: null })]), '1');
  assert.equal(jobs[0].location, 'Example SD');
  assert.equal(jobs[0].company, 'Red Rover');
});

for (const [label, empty] of [
  ['results: []', wrap([])],
]) {
  test(`parser: ${label} → []`, () => {
    assert.deepEqual(parseRedRoverResponse(empty, '1', 'X'), []);
  });
}

// Phase-2 (v1.242.0 sources-6): a 200 with the wrong shape THROWS — the
// documented envelope is data.jobSeekerSiteUnauthenticated.jobPostingSearch
// with an array results; anything else is a drifted API, not an empty board.
for (const [label, bad] of [
  ['null', null],
  ['{}', {}],
  ['{data: null}', { data: null }],
  ['a string', 'nope'],
  ['no results', wrap(undefined)],
]) {
  test(`parser: ${label} → throws (Phase-2, never silent [])`, () => {
    assert.throws(() => parseRedRoverResponse(bad, '1', 'X'), (err) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /Red Rover/);
      return true;
    }, `expected a throw for ${label}`);
  });
}

for (const [label, bad, re] of [
  ['a GraphQL errors array', { errors: [{ message: 'Org not found' }] }, /redrover: API error: Org not found/],
  ['an errors array with no message', { errors: [{}] }, /unknown GraphQL error/],
  ['a site envelope with no jobPostingSearch', { data: { jobSeekerSiteUnauthenticated: { somethingElse: 1 } } }, /unexpected response shape.*somethingElse/],
  ['hasMoreData: true', wrap([posting({})], { hasMoreData: true }), /more postings than one response holds/],
]) {
  test(`parser throws a descriptive error for ${label}`, () => {
    assert.throws(() => parseRedRoverResponse(bad, '1', 'X'), re);
  });
}

test('parser caps rows at MAX_JOBS', () => {
  const rows = Array.from({ length: MAX_JOBS + 5 }, (_, i) => posting({ id: String(i + 1) }));
  assert.equal(parseRedRoverResponse(wrap(rows), '1', 'X').length, MAX_JOBS);
});

// ── fetch ────────────────────────────────────────────────────────────────

test('fetch makes one redirect-blocked POST to the fixed API host with the org id in the variables', async () => {
  const { impl, calls } = router(() => res(FIXTURE));
  const company = { name: 'Acme', careers_url: BOARD };
  const jobs = await fetchRedRover(redroverAdapter.buildEndpoint(company), { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, API_URL);
  assert.equal(calls[0].url, 'https://api.redroverk12.com/graphql');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.headers.Origin, 'https://jobs.redroverk12.com');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.operationName, 'GetJobPostings');
  assert.equal(sent.variables.search.orgId, '4242');
  assert.match(sent.query, /jobPostingSearch/);
});

test('fetch sends the org id even when the endpoint is a deeper board path', async () => {
  const { impl, calls } = router(() => res(wrap([])));
  await fetchRedRover('https://jobs.redroverk12.com/org/77/opening/9', { fetchImpl: impl, company: { name: 'A' }, ...noSleep });
  assert.equal(calls[0].url, API_URL);
  assert.equal(JSON.parse(calls[0].init.body).variables.search.orgId, '77');
});

test('fetch rejects a bad endpoint before any I/O', async () => {
  let io = 0;
  const impl = async () => { io += 1; return res(FIXTURE); };
  for (const url of [
    'https://evil.example/org/4242',
    'http://jobs.redroverk12.com/org/4242',
    'https://jobs.redroverk12.com.evil.example/org/4242',
    'https://169.254.169.254/org/4242',
    'not a url',
  ]) {
    await assert.rejects(
      fetchRedRover(url, { fetchImpl: impl, company: { name: 'Evil' }, ...noSleep }),
      /redrover: cannot derive org id for Evil/,
    );
  }
  assert.equal(io, 0);
});

test('a transient 502 is retried, then succeeds', async () => {
  let n = 0;
  const { impl, calls } = router(() => (++n === 1 ? res({}, 502) : res(FIXTURE)));
  const jobs = await fetchRedRover(BOARD, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 2);
});

test('a permanent 400 is not retried and propagates with its status', async () => {
  const { impl, calls } = router(() => res({}, 400));
  await assert.rejects(
    fetchRedRover(BOARD, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep }),
    (err) => err.status === 400,
  );
  assert.equal(calls.length, 1);
});

test('a refused redirect is not retried', async () => {
  const { impl, calls } = router(() => {
    throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  });
  await assert.rejects(fetchRedRover(BOARD, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep }), TypeError);
  assert.equal(calls.length, 1);
});

test('a GraphQL error in a 200 makes the fetch throw instead of reporting zero jobs', async () => {
  const { impl } = router(() => res({ errors: [{ message: 'Org not found' }] }));
  await assert.rejects(
    fetchRedRover(BOARD, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep }),
    /Org not found/,
  );
});

test('a bounded probe (maxPages: 1) stays on the single request', async () => {
  const { impl, calls } = router(() => res(FIXTURE));
  await fetchRedRover(BOARD, { fetchImpl: impl, maxPages: 1, company: { name: 'Acme' }, ...noSleep });
  assert.equal(calls.length, 1);
});

test('a transport rejection propagates unwrapped (same error object)', async () => {
  class ProbeSentinel extends Error {}
  const sentinel = new ProbeSentinel('budget');
  const { impl } = router(() => { throw sentinel; });
  await assert.rejects(
    fetchRedRover(BOARD, { fetchImpl: impl, maxPages: 1, company: { name: 'Acme' }, ...noSleep }),
    (err) => err === sentinel,
  );
});

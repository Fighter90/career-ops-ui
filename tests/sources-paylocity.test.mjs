/**
 * Paylocity source (v1.253.2 parent parity) — CI-isolated suite.
 * Ported from the parent's paylocity provider cases: board resolution (GUID
 * regex, https + host pin, rebuilt canonical URL that drops a trailing
 * company slug/query), the `window.pageData` blob parse (entity-decoded
 * titles, LocationName → City/State fallback, ShouldDisplayLocation:false,
 * IsRemote + IndeedRemoteType labels, IsInternal drops, surrogate-safe id
 * segment), the shape throws (no blob / no Jobs[] — a markup change must be
 * loud), the dead-board redirect mapped to a synthetic 404 (quarantine
 * convention) and never retried, the HTML sanity cap, the max_jobs cap with
 * the paylocityTruncated flag, and the abort semantics (an abort before the
 * request — or before the result is returned — fails loud). No network —
 * every parser is pure; fetchPaylocity runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePaylocityBoard,
  extractPageData,
  resolveBoardUrl,
  boardUrl,
  resolveMaxJobs,
  assertPaylocityUrl,
  isJobNotFoundRedirect,
  fetchPaylocity,
  HOST,
  ORIGIN,
  MAX_HTML_LENGTH,
  DEFAULT_MAX_JOBS,
  MAX_JOBS_CAP,
} from '../server/lib/sources/paylocity.mjs';
import { paylocityAdapter } from '../server/lib/portals/adapters/paylocity.mjs';

const GUID = '0f0e9d8c-7b6a-5432-1098-76543210fedc';
const BOARD_URL = `${ORIGIN}/Recruiting/Jobs/All/${GUID}`;
const ENTRY = { name: 'Acme', provider: 'paylocity', careers_url: BOARD_URL };

const row = (id, extra = {}) => ({
  JobId: id,
  JobTitle: `Role ${id}`,
  LocationName: 'Chicago, IL',
  PublishedDate: '2026-10-20T00:00:00-05:00',
  ...extra,
});
const boardPage = (rows, pageDataExtra = {}) =>
  `<html><head><script>window.pageData = ${JSON.stringify({ Jobs: rows, ModuleTitle: 'Acme Careers', ...pageDataExtra })};\n</script></head><body></body></html>`;

const okPage = (rows) => ({
  ok: true, status: 200,
  headers: { get: () => null },
  text: async () => boardPage(rows),
});

test('paylocity: boardUrl — canonical URL from a GUID, lowercase, null for anything else', () => {
  assert.equal(boardUrl(GUID.toUpperCase()), BOARD_URL, 'an uppercase GUID normalizes');
  assert.equal(boardUrl(`  ${GUID}  `), BOARD_URL, 'surrounding whitespace is trimmed');
  assert.equal(boardUrl('not-a-guid'), null);
  assert.equal(boardUrl('0f0e9d8c-7b6a-5432-1098-76543210ffe'), null, 'a short hex run is no GUID');
  assert.equal(boardUrl('42'), null);
  assert.equal(boardUrl(null), null);
  assert.equal(boardUrl(undefined), null);
});

test('paylocity: resolveBoardUrl — https + host + /Recruiting/Jobs/All/<guid> only', () => {
  assert.deepEqual(resolveBoardUrl(ENTRY)?.valueOf(), BOARD_URL);
  assert.equal(
    resolveBoardUrl({ careers_url: `${ORIGIN}/recruiting/jobs/all/${GUID}/acme?foo=1` }),
    BOARD_URL,
    'the path matches case-insensitively and a trailing slug + query are dropped');
  assert.equal(
    resolveBoardUrl({ api: BOARD_URL, careers_url: `${ORIGIN}/Recruiting/Jobs/All/11111111-2222-4333-8444-555555555555` }),
    BOARD_URL,
    'api wins over careers_url');
  assert.equal(resolveBoardUrl({ careers_url: `http://recruiting.paylocity.com/Recruiting/Jobs/All/${GUID}` }), null, 'http is refused');
  assert.equal(resolveBoardUrl({ careers_url: `https://evil.com/Recruiting/Jobs/All/${GUID}` }), null, 'foreign host refused');
  assert.equal(resolveBoardUrl({ careers_url: `${ORIGIN}/Recruiting/Jobs/All/not-a-guid` }), null);
  assert.equal(resolveBoardUrl({ careers_url: `${ORIGIN}/Recruiting/Jobs/Details/42` }), null, 'a detail path is no board');
  assert.equal(resolveBoardUrl({ careers_url: 'not a url' }), null);
  assert.equal(resolveBoardUrl({}), null);
  assert.equal(resolveBoardUrl(null), null);
});

test('paylocity: assertPaylocityUrl — HTTPS on the board host only, default port only', () => {
  assert.equal(assertPaylocityUrl(BOARD_URL), BOARD_URL);
  assert.throws(() => assertPaylocityUrl(`http://${HOST}/Recruiting/Jobs/All/${GUID}`), /must use HTTPS/);
  assert.throws(() => assertPaylocityUrl(`${ORIGIN}:8443/Recruiting/Jobs/All/${GUID}`), /non-default port/);
  for (const [label, url] of [
    ['a lookalike host', `https://${HOST}.attacker.example/Recruiting/Jobs/All/${GUID}`],
    ['a userinfo spoof', `https://${HOST}@attacker.example/Recruiting/Jobs/All/${GUID}`],
    ['a cloud metadata address', 'https://169.254.169.254/Recruiting/Jobs/All/x'],
  ]) {
    assert.throws(() => assertPaylocityUrl(url), /untrusted hostname/, label);
  }
  assert.throws(() => assertPaylocityUrl('not a url'), /invalid URL/);
});

test('paylocity: resolveMaxJobs — positive integer, capped at 10000', () => {
  assert.equal(resolveMaxJobs({}), DEFAULT_MAX_JOBS);
  assert.equal(resolveMaxJobs({}), 5000);
  assert.equal(resolveMaxJobs({ max_jobs: 3 }), 3);
  assert.equal(resolveMaxJobs({ max_jobs: 999_999 }), MAX_JOBS_CAP);
  assert.equal(resolveMaxJobs({ max_jobs: -1 }), DEFAULT_MAX_JOBS);
  assert.equal(resolveMaxJobs({ max_jobs: 0 }), DEFAULT_MAX_JOBS);
  assert.equal(resolveMaxJobs({ max_jobs: '5' }), DEFAULT_MAX_JOBS, 'a non-integer is ignored, not trusted');
  assert.equal(resolveMaxJobs(null), DEFAULT_MAX_JOBS);
});

test('paylocity: extractPageData — the blob parses; no blob or broken JSON is null; oversize throws', () => {
  assert.deepEqual(extractPageData(boardPage([row(1)])).Jobs.length, 1);
  assert.equal(extractPageData('<html><body>login page</body></html>'), null);
  assert.equal(extractPageData('<script>window.pageData = { broken );</script>'), null, 'invalid JSON is null');
  assert.equal(extractPageData('<script>window.pageData = {"Jobs":[]}</script>'), null,
    'a blob without the `;</script>` terminator is null');
  assert.equal(extractPageData(42), null);
  assert.throws(
    () => extractPageData('x'.repeat(MAX_HTML_LENGTH + 1)),
    /sanity cap/,
    'a page over the cap throws before the regex runs');
});

test('paylocity: parsePaylocityBoard — rows map to the normalized shape', () => {
  const jobs = parsePaylocityBoard(boardPage([row(101)]), 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Role 101');
  assert.equal(jobs[0].url, `${ORIGIN}/Recruiting/Jobs/Details/101`);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].location, 'Chicago, IL');
  assert.equal(jobs[0].date, '2026-10-20', 'PublishedDate folds to an ISO date');
});

test('paylocity: parsePaylocityBoard — id segment is percent-encoded; a lone surrogate drops its row', () => {
  const { 0: first, length } = parsePaylocityBoard(boardPage([
    row('a/b c'),
    row('\uD800lone'),
  ]), 'Acme');
  assert.equal(length, 1, 'the surrogate row drops, the rest survives');
  assert.equal(first.url, `${ORIGIN}/Recruiting/Jobs/Details/a%2Fb%20c`);
});

test('paylocity: parsePaylocityBoard — ModuleTitle names the company when the entry has no name', () => {
  const jobs = parsePaylocityBoard(boardPage([row(1)]), '');
  assert.equal(jobs[0].company, 'Acme Careers');
});

test('paylocity: parsePaylocityBoard — location falls back to City, State; hidden locations get no place', () => {
  const jobs = parsePaylocityBoard(boardPage([
    row(1, { LocationName: '' }),
    row(2, { LocationName: '', JobLocation: { City: 'Berlin', State: 'BE', Country: 'DEU' } }),
    row(3, { ShouldDisplayLocation: false }),
    row(4, { ShouldDisplayLocation: false, IsRemote: true, IndeedRemoteType: 2 }),
    row(5, { LocationName: '', JobLocation: { Country: 'USA' } }),
  ]), 'Acme');
  assert.equal(jobs[0].location, '', 'no place when LocationName is empty and no City/State exists');
  assert.equal(jobs[1].location, 'Berlin, BE', 'City/State when LocationName is empty');
  assert.equal(jobs[2].location, '', 'a hidden location shows no place');
  assert.equal(jobs[3].location, 'Remote', 'the remote label is shown even when the place is hidden');
  assert.equal(jobs[4].location, '', 'a Country-only JobLocation is no place — it is often the tenant default');
});

test('paylocity: parsePaylocityBoard — IsRemote + IndeedRemoteType label the way the board page does', () => {
  const jobs = parsePaylocityBoard(boardPage([
    row(1, { IsRemote: true, IndeedRemoteType: 0 }),
    row(2, { IsRemote: true, IndeedRemoteType: 1 }),
    row(3, { IsRemote: true, IndeedRemoteType: 2 }),
    row(4, { IsRemote: true, IndeedRemoteType: 7 }),
    row(5, { IsRemote: false, IndeedRemoteType: 2 }),
    row(6, { IsRemote: true, IndeedRemoteType: 2, LocationName: 'London, UK' }),
  ]), 'Acme');
  assert.equal(jobs[0].location, 'Chicago, IL, Remote', 'type 0 labels Remote');
  assert.equal(jobs[1].location, 'Chicago, IL, Hybrid', 'type 1 labels Hybrid');
  assert.equal(jobs[2].location, 'Chicago, IL, Remote', 'type 2 labels Remote');
  assert.equal(jobs[3].location, 'Chicago, IL', 'an unknown type labels nothing');
  assert.equal(jobs[4].location, 'Chicago, IL', 'a non-remote posting is never labelled');
  assert.equal(jobs[5].location, 'London, UK, Remote');
});

test('paylocity: parsePaylocityBoard — IsInternal rows, empty titles and empty JobIds drop', () => {
  const jobs = parsePaylocityBoard(boardPage([
    row(1, { IsInternal: true }),
    row(2, { JobTitle: '   ' }),
    row(3, { JobId: '' }),
    row(4, { JobId: null }),
    row(5),
  ]), 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Role 5');
});

test('paylocity: parsePaylocityBoard — JSON-borne strings decode-then-strip; an escaped tag never survives', () => {
  const jobs = parsePaylocityBoard(boardPage([
    row(1, { JobTitle: 'Engineer &lt;script&gt;alert(1)&lt;/script&gt; &amp; More' }),
    row(2, { LocationName: 'K&amp;#246;ln &lt;b&gt;' }),
  ]), 'Acme');
  assert.equal(jobs[0].title, 'Engineer & More', 'the decoded <script> is stripped with its contents');
  assert.ok(!jobs[0].title.includes('<'), 'no angle bracket survives in the title');
  assert.equal(jobs[1].location, 'Köln', 'the double-encoded locality decodes after the strip');
  assert.ok(!jobs[1].location.includes('<'), 'no angle bracket survives in the location');
});

test('paylocity: parsePaylocityBoard — a genuinely empty board is []; a markup change throws loud', () => {
  assert.deepEqual(parsePaylocityBoard(boardPage([]), 'Acme'), []);

  assert.throws(
    () => parsePaylocityBoard('<html><body>challenge page</body></html>', 'Acme'),
    /window\.pageData not found/);
  assert.throws(
    () => parsePaylocityBoard(
      '<script>window.pageData = {"ModuleTitle":"X","Counts":{"Jobs":5}};</script>', 'Acme'),
    /expected Jobs\[\], got: \[ModuleTitle, Counts\]/,
    'a blob without Jobs[] names what arrived');
});

test('paylocity: isJobNotFoundRedirect — only a 3xx on the host to /Recruiting/Jobs/JobNotFound', () => {
  const err = (status, location) => ({ status, location });
  assert.equal(isJobNotFoundRedirect(err(302, '/Recruiting/Jobs/JobNotFound/'), BOARD_URL), true, 'relative target');
  assert.equal(isJobNotFoundRedirect(err(302, `${ORIGIN}/recruiting/jobs/jobnotfound`), BOARD_URL), true, 'absolute target, case-insensitive');
  assert.equal(isJobNotFoundRedirect(err(302, '/Recruiting/Jobs/All/other'), BOARD_URL), false, 'a different path is not the dead-board signal');
  assert.equal(isJobNotFoundRedirect(err(302, 'https://evil.example/Recruiting/Jobs/JobNotFound'), BOARD_URL), false, 'an off-host redirect is never the signal');
  assert.equal(isJobNotFoundRedirect(err(404, '/Recruiting/Jobs/JobNotFound'), BOARD_URL), false, 'only a 3xx');
  assert.equal(isJobNotFoundRedirect(err(302, null), BOARD_URL), false, 'no Location header, no signal');
  assert.equal(isJobNotFoundRedirect(new Error('HTTP 500'), BOARD_URL), false);
});

test('paylocity: fetchPaylocity — ONE request, redirect:manual + browser UA, normalized rows', async () => {
  const requested = [];
  const fetchImpl = async (url, opts = {}) => {
    requested.push({ url, opts });
    return okPage([row(1, { IsRemote: true, IndeedRemoteType: 2, JobTitle: 'Remote Platform Engineer' })]);
  };
  const jobs = await fetchPaylocity(BOARD_URL, { fetchImpl, company: ENTRY });
  assert.equal(requested.length, 1, 'the board is one request — it is not paginated');
  assert.equal(requested[0].url, BOARD_URL);
  assert.equal(requested[0].opts.redirect, 'manual', 'the 3xx is surfaced, never followed');
  assert.ok(requested[0].opts.headers['User-Agent'], 'a browser-like UA is sent');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, `paylocity-${ORIGIN}/Recruiting/Jobs/Details/1`);
  assert.equal(jobs[0].source, 'paylocity');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].isRemote, true, 'the remote label lands in the location and flags isRemote');
  assert.equal(jobs[0].date, '2026-10-20');
  assert.equal(jobs[0].snippet, '');
  assert.equal(jobs.paylocityTruncated, undefined);
});

test('paylocity: fetchPaylocity asserts the endpoint before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchPaylocity('https://attacker.example/Recruiting/Jobs/All/x', { fetchImpl, company: ENTRY }),
    /untrusted hostname/);
});

test('paylocity: fetchPaylocity — an abort before the request fails loud (no empty board)', async () => {
  const ac = new AbortController();
  ac.abort();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return okPage([row(1)]); };
  await assert.rejects(() => fetchPaylocity(BOARD_URL, { fetchImpl, signal: ac.signal, company: ENTRY }));
  assert.equal(calls, 0, 'the aborted scan never reached the network');
});

test('paylocity: fetchPaylocity — an abort after the fetch fails loud before any return', async () => {
  const ac = new AbortController();
  const fetchImpl = async () => {
    ac.abort(); // aborted while the response is in hand
    return okPage([row(1)]);
  };
  await assert.rejects(
    () => fetchPaylocity(BOARD_URL, { fetchImpl, signal: ac.signal, company: ENTRY }),
    undefined,
    'a stale board must not be presented as a complete result');
});

test('paylocity: fetchPaylocity — a page without the blob throws (markup change, only page)', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200, headers: { get: () => null }, text: async () => '<html><body>maintenance</body></html>',
  });
  await assert.rejects(
    () => fetchPaylocity(BOARD_URL, { fetchImpl, company: ENTRY }),
    /window\.pageData not found/);
});

test('paylocity: fetchPaylocity — the dead-board 302 maps to a synthetic 404 and is never retried', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    const err = new Error(`HTTP 302 (${BOARD_URL})`);
    err.status = 302;
    err.location = '/Recruiting/Jobs/JobNotFound/';
    throw err;
  };
  await assert.rejects(
    () => fetchPaylocity(BOARD_URL, { fetchImpl, company: ENTRY }),
    (err) => err.status === 404 && /redirected to JobNotFound — no such board/.test(err.message),
    'quarantine trusts a literal 404, so the dead board maps to one');
  assert.equal(calls, 1, 'a 302 is not retried');
});

test('paylocity: fetchPaylocity — any other redirect keeps its own error (not a 404)', async () => {
  const fetchImpl = async () => {
    const err = new Error(`HTTP 302 (${BOARD_URL})`);
    err.status = 302;
    err.location = '/Recruiting/Jobs/All/somewhere-else';
    throw err;
  };
  await assert.rejects(
    () => fetchPaylocity(BOARD_URL, { fetchImpl, company: ENTRY }),
    (err) => err.status === 302 && !/JobNotFound/.test(err.message));
});

test('paylocity: fetchPaylocity — a transient 5xx retries; a permanent 4xx does not', async () => {
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls === 1) { const e = new Error('HTTP 503'); e.status = 503; throw e; }
    return okPage([row(1)]);
  };
  const jobs = await fetchPaylocity(BOARD_URL, { fetchImpl: flaky, company: ENTRY, retryDelayMs: 0 });
  assert.equal(calls, 2, 'the 503 was retried once');
  assert.equal(jobs.length, 1);

  calls = 0;
  const gone = async () => {
    calls += 1;
    const e = new Error('HTTP 404');
    e.status = 404;
    throw e;
  };
  await assert.rejects(() => fetchPaylocity(BOARD_URL, { fetchImpl: gone, company: ENTRY }), /HTTP 404/);
  assert.equal(calls, 1, 'a permanent 4xx is not retried');
});

test('paylocity: fetchPaylocity — a max_jobs cut tags the array paylocityTruncated (partial board)', async () => {
  const rows = [row(1), row(2), row(3)];
  const under = await fetchPaylocity(BOARD_URL, { fetchImpl: async () => okPage(rows), company: ENTRY });
  assert.equal(under.length, 3);
  assert.equal(under.paylocityTruncated, undefined);

  const capped = await fetchPaylocity(BOARD_URL, {
    fetchImpl: async () => okPage(rows),
    company: { ...ENTRY, max_jobs: 2 },
  });
  assert.equal(capped.length, 2, 'the cap stops the board');
  assert.equal(capped.paylocityTruncated, true, 'a cap cut is a partial board, never a quiet slice');
});

test('paylocity: fetchPaylocity — an entry without a resolvable board still fetches an asserted endpoint', async () => {
  // The endpoint is validated on its own merits; company only names the rows.
  const fetchImpl = async () => okPage([row(1)]);
  const jobs = await fetchPaylocity(BOARD_URL, { fetchImpl, company: {} });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Acme Careers', 'the board ModuleTitle names the company');
});

test('paylocity adapter: provider- or host-selected, endpoint resolved, invalid → null, null-safe matches', () => {
  assert.equal(paylocityAdapter.buildEndpoint(ENTRY), BOARD_URL);
  assert.equal(
    paylocityAdapter.buildEndpoint({ provider: 'paylocity', careers_url: `${ORIGIN}/recruiting/jobs/all/${GUID.toUpperCase()}/slug` }),
    BOARD_URL,
    'the canonical URL is rebuilt from the GUID alone');
  assert.equal(paylocityAdapter.buildEndpoint({ provider: 'paylocity', careers_url: `${ORIGIN}/Recruiting/Jobs/Details/1` }), null);
  assert.equal(paylocityAdapter.buildEndpoint({ provider: 'paylocity' }), null);
  assert.equal(paylocityAdapter.matches(ENTRY), true, 'provider-selected');
  assert.equal(paylocityAdapter.matches({ careers_url: BOARD_URL }), true, 'a Paylocity-hosted board URL auto-detects');
  assert.equal(paylocityAdapter.matches({ api: BOARD_URL }), true, 'an api: board URL auto-detects');
  assert.equal(paylocityAdapter.matches({ careers_url: `https://evil.com/Recruiting/Jobs/All/${GUID}` }), false, 'a foreign host is never claimed');
  assert.equal(paylocityAdapter.matches({ careers_url: 'not a url' }), false, 'an unparseable careers_url is never claimed');
  assert.equal(paylocityAdapter.matches({ provider: 'greenhouse' }), false);
  assert.equal(paylocityAdapter.matches(null), false, 'a null entry is false, never a throw');
  assert.equal(paylocityAdapter.matches(undefined), false);
  assert.equal(paylocityAdapter.matches(42), false);
});

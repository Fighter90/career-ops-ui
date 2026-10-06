/**
 * UKG Pro (UltiPro) source + adapter — CI-isolated tests (fake fetchImpl, no
 * network, no parent-project dependency, no port binding).
 *
 * Parity with parent career-ops `tests/providers/ultipro.test.mjs`. URL
 * assertions use strict equality, never `String.includes` over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveTenant,
  assertUltiproUrl,
  buildListUrl,
  extractLocations,
  parseListPage,
  extractCandidateOpportunityDetail,
  parseUltiproConfig,
  fetchUltipro,
  PAGE_SIZE,
} from '../server/lib/sources/ultipro.mjs';
import { ultiproAdapter } from '../server/lib/portals/adapters/ultipro.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const TENANT = 'EXA5001EXCO';
const BOARD = '11111111-2222-3333-4444-555555555555';
const boardUrl = (host) => `https://${host}/${TENANT}/JobBoard/${BOARD}/`;
const listUrl = (host) => `https://${host}/${TENANT}/JobBoard/${BOARD}/JobBoardView/LoadSearchResults`;
const detailUrl = (host, id) => `https://${host}/${TENANT}/JobBoard/${BOARD}/OpportunityDetail?opportunityId=${id}`;
const HOST = 'recruiting.ultipro.ca';
const ENTRY = { name: 'ExampleCo', careers_url: boardUrl(HOST) };
const noSleep = { sleep: async () => {}, retryDelayMs: 0 };

function res(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
    text: async () => String(body),
    headers: { get: () => null },
  };
}

function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { impl, calls };
}

const mkOpp = (id, title, o = {}) => ({
  Id: id,
  Title: title,
  Locations: o.locations ?? ['Toronto, ON'],
  PostedDate: o.postedDate ?? '2026-08-01',
  BriefDescription: o.brief ?? '',
});
const mkPage = (start, count) => Array.from({ length: count }, (_, i) => mkOpp(`opp-${start + i}`, `Job ${start + i}`));
const wrapHtml = (literal) => `<html><body><script>var x = new US.Opportunity.CandidateOpportunityDetail(${literal});</script></body></html>`;

test('meta is the EN ultipro source', () => {
  assert.deepEqual(meta, { value: 'ultipro', label: 'UKG Pro (UltiPro)', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(ultiproAdapter.id, 'ultipro');
  assert.equal(ultiproAdapter.label, 'UKG Pro (UltiPro)');
  assert.equal(ultiproAdapter.fetch, fetchUltipro);
});

for (const host of ['recruiting.ultipro.ca', 'recruiting.ultipro.com', 'recruiting2.ultipro.com', 'recruiting3.ultipro.com']) {
  test(`host pattern accepts ${host} and keeps the tenant's own host`, () => {
    const entry = { name: 'X', careers_url: boardUrl(host) };
    assert.equal(ultiproAdapter.matches(entry), true);
    assert.equal(ultiproAdapter.buildEndpoint(entry), listUrl(host));
  });
}

test('board URL without a trailing slash is accepted', () => {
  const entry = { careers_url: `https://${HOST}/${TENANT}/JobBoard/${BOARD}` };
  assert.equal(ultiproAdapter.buildEndpoint(entry), listUrl(HOST));
});

test('api: takes precedence over a non-UKG careers_url', () => {
  const entry = { careers_url: 'https://example.com/careers', api: boardUrl('recruiting.ultipro.com') };
  assert.equal(ultiproAdapter.matches(entry), true);
  assert.equal(ultiproAdapter.buildEndpoint(entry), listUrl('recruiting.ultipro.com'));
});

for (const url of [
  'https://recruitingxultipro.com/T/JobBoard/B/',
  'https://ultipro.com/T/JobBoard/B/',
  'https://recruiting.ultipro.com.evil.com/T/JobBoard/B/',
  'https://evil.com/recruiting.ultipro.com/T/JobBoard/B/',
  'http://recruiting.ultipro.com/T/JobBoard/B/',
  'https://user:pw@recruiting.ultipro.com/T/JobBoard/B/',
  'https://recruiting.ultipro.com:8443/T/JobBoard/B/',
  'https://recruiting.ultipro.com/T/',
  'not a url',
]) {
  test(`untrusted/malformed URL is never claimed: ${url}`, () => {
    assert.equal(resolveTenant({ careers_url: url }), null);
    assert.equal(ultiproAdapter.matches({ name: 'X', careers_url: url }), false);
    assert.equal(ultiproAdapter.buildEndpoint({ name: 'X', careers_url: url }), null);
  });
}

test('matches/buildEndpoint never throw on null/missing input; explicit other provider wins', () => {
  assert.equal(ultiproAdapter.matches(null), false);
  assert.equal(ultiproAdapter.matches(undefined), false);
  assert.equal(ultiproAdapter.matches({ name: 'X' }), false);
  assert.equal(ultiproAdapter.buildEndpoint(null), null);
  assert.equal(ultiproAdapter.buildEndpoint({ careers_url: null }), null);
  assert.equal(ultiproAdapter.matches({ provider: 'ultipro', careers_url: 'x' }), true);
  assert.equal(ultiproAdapter.matches({ provider: 'workday', careers_url: boardUrl(HOST) }), false);
});

test('assertUltiproUrl rejects off-allowlist hosts and non-HTTPS', () => {
  assert.throws(() => assertUltiproUrl('https://evil.com/T/JobBoard/B/'), /untrusted hostname/);
  assert.throws(() => assertUltiproUrl('http://recruiting.ultipro.com/T/JobBoard/B/'), /HTTPS/);
  assert.throws(() => assertUltiproUrl('nope'), /invalid URL/);
  assert.equal(assertUltiproUrl(listUrl(HOST)), listUrl(HOST));
});

test('fetch on an off-allowlist host throws before any network call', async () => {
  const { impl, calls } = router(() => res({ opportunities: [] }));
  await assert.rejects(
    fetchUltipro('https://evil.com/T/JobBoard/B/JobBoardView/LoadSearchResults', { fetchImpl: impl, company: ENTRY, ...noSleep }),
    /untrusted hostname/,
  );
  assert.equal(calls.length, 0);
});

test('extractLocations dedupes, reads City/State.Code, falls back to LocalizedName', () => {
  assert.equal(extractLocations(['Toronto, ON', 'Remote', 'Toronto, ON']), 'Toronto, ON / Remote');
  assert.equal(extractLocations([
    { LocalizedName: 'Central Fitness', Address: { City: 'Toronto', State: { Code: 'ON' } } },
    { LocalizedName: 'Wagner Green', Address: { City: 'Toronto', State: { Code: 'ON' } } },
  ]), 'Toronto, ON');
  assert.equal(extractLocations([{ LocalizedName: 'Branch With No Address' }]), 'Branch With No Address');
  assert.equal(extractLocations(undefined), '');
  assert.equal(extractLocations([]), '');
  assert.equal(extractLocations('nope'), '');
});

const CFG = { origin: 'https://recruiting.ultipro.ca', tenant: TENANT, boardId: BOARD, companyName: 'ExampleCo' };

test('parseListPage: empty array is a valid empty result', () => {
  const r = parseListPage({ opportunities: [], totalCount: 0 }, CFG);
  assert.deepEqual(r.jobs, []);
  assert.equal(r.total, 0);
});

test('parseListPage maps the 12-field shape and drops rows without Id/Title', () => {
  const r = parseListPage({
    opportunities: [
      mkOpp('opp-1', 'Instructional Designer', { brief: '<p>Great <b>role</b> &amp; team.</p>' }),
      mkOpp(2001, 'Numeric Id Role'),
      { Id: '', Title: 'No Id' },
      { Id: 'abc', Title: '' },
      null,
    ],
    totalCount: 37,
  }, CFG);
  assert.equal(r.jobs.length, 2);
  assert.equal(r.total, 37);
  assert.equal(r.rawCount, 5);
  assert.deepEqual(r.ids, ['opp-1', '2001']);
  const [a, b] = r.jobs;
  assert.equal(a.url, detailUrl('recruiting.ultipro.ca', 'opp-1'));
  assert.equal(b.url, detailUrl('recruiting.ultipro.ca', '2001'));
  assert.equal(a.id, `ultipro-${TENANT}-opp-1`);
  assert.equal(a.description, 'Great role & team.');
  assert.equal(a.snippet, 'Great role & team.');
  assert.equal(a.company, 'ExampleCo');
  assert.equal(a.location, 'Toronto, ON');
  assert.equal(a.date, '2026-08-01');
  assert.equal(a.source, 'ultipro');
  assert.equal(a.isRemote, false);
  assert.equal(b.description, undefined);
});

test('parseListPage throws on null, scalar, array and no-opportunities bodies', () => {
  for (const bad of [null, 'str', 42, true, [], { unexpectedShape: true }, { totalCount: 5 }]) {
    assert.throws(() => parseListPage(bad, CFG), /unrecognized LoadSearchResults response/);
  }
});

test('parseListPage drops a lone-surrogate Id and keeps its sibling', () => {
  const r = parseListPage({
    opportunities: [mkOpp('opp-\uD800', 'Lone Surrogate'), mkOpp('opp-2', 'Clean')],
    totalCount: 2,
  }, CFG);
  assert.equal(r.jobs.length, 1);
  assert.equal(r.jobs[0].title, 'Clean');
});

test('fetch pages by Top/Skip (Skip advances by 50), POSTs JSON, strips nothing internal', async () => {
  const skips = [];
  const pages = [{ opportunities: mkPage(1, 50), totalCount: 70 }, { opportunities: mkPage(51, 20), totalCount: 70 }];
  const { impl, calls } = router((url, init, n) => {
    skips.push(JSON.parse(init.body).opportunitySearch.Skip);
    return res(pages[n - 1]);
  });
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.deepEqual(skips, [0, 50]);
  assert.equal(jobs.length, 70);
  assert.equal(calls[0].url, listUrl(HOST));
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(JSON.parse(calls[0].init.body).opportunitySearch.Top, PAGE_SIZE);
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(jobs.every((j) => j._id === undefined && j.ultiproTruncated === undefined), true);
  assert.equal(jobs.ultiproTruncated, undefined);
});

test('a short page stops pagination regardless of totalCount', async () => {
  const { impl, calls } = router(() => res({ opportunities: mkPage(1, 10), totalCount: 999 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(jobs.length, 10);
  assert.equal(calls.length, 1);
});

test('an empty page stops pagination even when totalCount claims more', async () => {
  const { impl, calls } = router(() => res({ opportunities: [], totalCount: 500 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(jobs.length, 0);
  assert.equal(calls.length, 1);
});

test('a duplicate Id repeated across pages is deduped', async () => {
  const pages = [
    { opportunities: mkPage(1, 50), totalCount: 55 },
    { opportunities: [mkOpp('opp-50', 'Job 50 dup'), ...mkPage(51, 4)], totalCount: 55 },
  ];
  const { impl } = router((u, i, n) => res(pages[n - 1] ?? { opportunities: [], totalCount: 55 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(jobs.length, 54);
});

test('a full page with no fresh ids stops and flags the result truncated', async () => {
  const { impl, calls } = router(() => res({ opportunities: mkPage(1, 50), totalCount: 500 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 50);
  assert.equal(jobs.ultiproTruncated, true);
});

test('hitting max_pages before the board ends tags the array ultiproTruncated', async () => {
  const { impl, calls } = router((u, i, n) => res({ opportunities: mkPage((n - 1) * 50 + 1, 50), totalCount: 999999 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: { ...ENTRY, max_pages: 3 }, ...noSleep });
  assert.equal(calls.length, 3);
  assert.equal(jobs.length, 150);
  assert.equal(jobs.ultiproTruncated, true);
});

test('a full page at the cap is potentially truncated even if totalCount says complete', async () => {
  const { impl } = router(() => res({ opportunities: mkPage(1, 50), totalCount: 50 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: { ...ENTRY, max_pages: 1 }, ...noSleep });
  assert.equal(jobs.ultiproTruncated, true);
});

test('maxPages probe stops after one page and is not tagged truncated', async () => {
  const { impl, calls } = router(() => res({ opportunities: mkPage(1, 50), totalCount: 500 }));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, maxPages: 1, ...noSleep });
  assert.equal(calls.length, 1);
  assert.equal(jobs.ultiproTruncated, undefined);
});

test('max_pages override is clamped to the hard ceiling', async () => {
  const { impl, calls } = router((u, i, n) => res(n < 4 ? { opportunities: mkPage(n * 50, 50) } : { opportunities: [] }));
  await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: { ...ENTRY, max_pages: 999999 }, ...noSleep });
  assert.equal(calls.length, 4);
});

test('an unrecognized response shape throws, never a silent zero-job board', async () => {
  const { impl } = router(() => res({ unexpectedShape: true }));
  await assert.rejects(fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep }), /unrecognized/);
});

test('a permanent 4xx propagates without retry', async () => {
  const { impl, calls } = router(() => res({}, 404));
  await assert.rejects(fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep }), /HTTP 404/);
  assert.equal(calls.length, 1);
});

for (const status of [429, 503]) {
  test(`an exhausted ${status} propagates after 1+2 attempts`, async () => {
    const { impl, calls } = router(() => res({}, status));
    await assert.rejects(fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep }), new RegExp(`HTTP ${status}`));
    assert.equal(calls.length, 3);
  });
}

test('a transient 503 followed by success is retried', async () => {
  const { impl, calls } = router((u, i, n) => (n === 1 ? res({}, 503) : res({ opportunities: mkPage(1, 3) })));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(jobs.length, 3);
  assert.equal(calls.length, 2);
});

test('a non-JSON 2xx propagates', async () => {
  const { impl } = router(() => res(new SyntaxError('Unexpected token <')));
  await assert.rejects(fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: ENTRY, ...noSleep }), /non-JSON 2xx/);
});

test('extractCandidateOpportunityDetail balances braces/quotes inside JD text', () => {
  const detail = {
    Id: 'opp-1', Title: 'Designer',
    Description: 'Covers {curriculum design} and a \\"quoted\\" term, edge cases like } and {.',
  };
  const r = extractCandidateOpportunityDetail(wrapHtml(JSON.stringify(detail)), 'opp-1');
  assert.equal(r.status, 'ok');
  assert.equal(r.detail.Description, detail.Description);
});

test('extractCandidateOpportunityDetail throws on malformed, unbalanced, mismatched, incomplete', () => {
  assert.throws(() => extractCandidateOpportunityDetail(`<script>new X.CandidateOpportunityDetail({Id: 'a', Title: nope});</script>`, 'a'), /malformed detail JSON/);
  assert.throws(() => extractCandidateOpportunityDetail(`<script>new X.CandidateOpportunityDetail({"Id": "a", "Title": "U"</script>`, 'a'), /unbalanced/);
  assert.throws(() => extractCandidateOpportunityDetail(wrapHtml(JSON.stringify({ Id: 'other', Title: 'W' })), 'opp-1'), /ID mismatch/);
  assert.throws(() => extractCandidateOpportunityDetail(wrapHtml(JSON.stringify({ Title: 'No Id' })), 'opp-1'), /missing Id\/Title/);
  assert.throws(() => extractCandidateOpportunityDetail(wrapHtml(JSON.stringify({ Id: 'opp-1' })), 'opp-1'), /missing Id\/Title/);
  assert.throws(() => extractCandidateOpportunityDetail('CandidateOpportunityDetail(', 'a'), /no JSON object/);
});

test('extractCandidateOpportunityDetail: marker absent or non-string html is not-found', () => {
  assert.equal(extractCandidateOpportunityDetail('<html><div id="app"></div></html>', 'a').status, 'not-found');
  assert.equal(extractCandidateOpportunityDetail('', 'a').status, 'not-found');
  assert.equal(extractCandidateOpportunityDetail(null, 'a').status, 'not-found');
});

test('extractCandidateOpportunityDetail matches a numeric detail Id against a string expectedId', () => {
  assert.equal(extractCandidateOpportunityDetail(wrapHtml(JSON.stringify({ Id: 2001, Title: 'N' })), '2001').status, 'ok');
});

test('parseUltiproConfig defaults and clamps', () => {
  assert.deepEqual(parseUltiproConfig({}), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseUltiproConfig({ ultipro: { fetchDetails: true, detailLimit: 9999 } }), { fetchDetails: true, detailLimit: 100 });
  assert.deepEqual(parseUltiproConfig({ ultipro: { fetchDetails: 'yes', detailLimit: 0 } }), { fetchDetails: false, detailLimit: 1 });
  assert.deepEqual(parseUltiproConfig(null), { fetchDetails: false, detailLimit: 25 });
});

const detailHtml = wrapHtml(JSON.stringify({ Id: 'opp-1', Title: 'Designer', Description: '<p>Great <b>role</b> &amp; team.</p>' }));
const oneJobList = { opportunities: [mkOpp('opp-1', 'Designer')], totalCount: 1 };
const withDetails = { ...ENTRY, ultipro: { fetchDetails: true, detailLimit: 5 } };

test('fetchDetails:true enriches description and snippet, redirect:error on the detail GET', async () => {
  const { impl, calls } = router((url) => (url.endsWith('LoadSearchResults') ? res(oneJobList) : res(detailHtml)));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: withDetails, ...noSleep });
  assert.equal(jobs[0].description, 'Great role & team.');
  assert.equal(jobs[0].snippet, 'Great role & team.');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, detailUrl(HOST, 'opp-1'));
  assert.equal(calls[1].init.method, 'GET');
  assert.equal(calls.every((c) => c.init.redirect === 'error'), true);
});

test('no detail request without fetchDetails, nor while probing', async () => {
  const a = router(() => res(oneJobList));
  await fetchUltipro(listUrl(HOST), { fetchImpl: a.impl, company: ENTRY, ...noSleep });
  assert.equal(a.calls.length, 1);
  const b = router(() => res(oneJobList));
  await fetchUltipro(listUrl(HOST), { fetchImpl: b.impl, company: withDetails, maxPages: 1, ...noSleep });
  assert.equal(b.calls.length, 1);
});

test('detail failure keeps the listing row', async () => {
  const { impl } = router((url) => (url.endsWith('LoadSearchResults') ? res(oneJobList) : res({}, 500)));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: withDetails, ...noSleep });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, undefined);
});

test('a 200-but-marker-absent detail page is not-found, not an empty description', async () => {
  const { impl } = router((url) => (url.endsWith('LoadSearchResults') ? res(oneJobList) : res('<html><div id="app"></div></html>')));
  const jobs = await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: withDetails, ...noSleep });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, undefined);
});

test('detailLimit bounds the number of detail fetches', async () => {
  const list = { opportunities: mkPage(1, 5), totalCount: 5 };
  const { impl, calls } = router((url) => (url.endsWith('LoadSearchResults') ? res(list) : res('<html></html>')));
  await fetchUltipro(listUrl(HOST), { fetchImpl: impl, company: { ...ENTRY, ultipro: { fetchDetails: true, detailLimit: 2 } }, ...noSleep });
  assert.equal(calls.length, 1 + 2);
});

test('buildListUrl uses the resolved tenant verbatim', () => {
  assert.equal(buildListUrl(resolveTenant(ENTRY)), listUrl(HOST));
});

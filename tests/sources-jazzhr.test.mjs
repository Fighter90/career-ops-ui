/**
 * JazzHR source + adapter — CI-isolated tests (fake fetchImpl, no network, no
 * parent-project dependency, no port binding, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/jazzhr.test.mjs`; the HTML
 * fixtures are inlined copies of the parent's.
 *
 * URL assertions use strict equality, never `String.includes` or an unanchored
 * regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveOrigin,
  assertJazzHRUrl,
  parseJazzHRList,
  parseJazzHRDetail,
  parseJazzHRConfig,
  fetchJazzHR,
  DETAIL_FETCH_DELAY_MS,
} from '../server/lib/sources/jazzhr.mjs';
import { jazzhrAdapter } from '../server/lib/portals/adapters/jazzhr.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const BOARD = 'https://exampleco.applytojob.com/apply';

const LIST = `<ul><li class="list-group-item"><h3 class="list-group-item-heading"><a href="https://exampleco.applytojob.com/apply/A1/Learning-Designer">Learning &amp; Development Designer</a></h3><ul><li><i class="fa fa-map-marker"></i>Toronto, ON</li></ul></li><li class="list-group-item"><h3><a href="/apply/B2/Analyst">Analyst</a></h3><ul><li><i class="fa fa-map-marker"></i>Remote</li></ul></li></ul>`;

const DETAIL = `<script type="application/ld+json">${JSON.stringify({
  '@type': 'JobPosting',
  title: 'Learning & Development Designer',
  description: '<p>Build &amp; deliver courses.</p>',
  datePosted: '2026-08-30',
  jobLocation: { address: { addressLocality: 'Toronto', addressRegion: 'ON', addressCountry: 'CA' } },
})}</script>`;

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: () => null } };
}

function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { impl, calls };
}

const noSleep = { sleep: async () => {}, retryDelayMs: 0 };

test('meta is the EN jazzhr source', () => {
  assert.deepEqual(meta, { value: 'jazzhr', label: 'JazzHR', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(jazzhrAdapter.id, 'jazzhr');
  assert.equal(jazzhrAdapter.label, 'JazzHR');
  assert.equal(jazzhrAdapter.fetch, fetchJazzHR);
});

for (const [label, url] of [
  ['bare host with trailing slash', 'https://exampleco.applytojob.com/'],
  ['bare host without trailing slash', 'https://exampleco.applytojob.com'],
  ['already /apply', 'https://exampleco.applytojob.com/apply'],
  ['/apply with a trailing slash', 'https://exampleco.applytojob.com/apply/'],
  ['an unrelated path', 'https://exampleco.applytojob.com/login'],
  ['a posting permalink, not the board root', 'https://exampleco.applytojob.com/apply/D4/Some-Posting'],
  ['a non-default port (dropped; origin rebuilt from hostname)', 'https://exampleco.applytojob.com:8443/apply'],
]) {
  test(`buildEndpoint resolves ${label} to the board root`, () => {
    const entry = { name: 'Example', careers_url: url };
    assert.equal(jazzhrAdapter.matches(entry), true);
    assert.equal(jazzhrAdapter.buildEndpoint(entry), BOARD);
  });
}

test('an explicit api: URL takes precedence over careers_url', () => {
  const entry = {
    name: 'X',
    api: 'https://apiside.applytojob.com/apply',
    careers_url: 'https://careerside.applytojob.com/apply',
  };
  assert.equal(jazzhrAdapter.buildEndpoint(entry), 'https://apiside.applytojob.com/apply');
  // An untrusted api falls through to a trusted careers_url.
  assert.equal(
    jazzhrAdapter.buildEndpoint({ api: 'https://evil.example/apply', careers_url: 'https://careerside.applytojob.com' }),
    'https://careerside.applytojob.com/apply',
  );
});

for (const bad of [
  'http://exampleco.applytojob.com/apply',
  'https://evil.example/apply',
  'https://x.applytojob.com.evil.com/apply',
  'https://x.applytojob.com@evil/apply',
  'https://evilapplytojob.com/apply',
  'https://applytojob.com/apply',
  null,
  7,
]) {
  test(`rejects untrusted careers_url ${String(bad)}`, () => {
    const entry = { name: 'X', careers_url: bad };
    assert.equal(resolveOrigin(entry), null);
    assert.equal(jazzhrAdapter.buildEndpoint(entry), null);
    assert.equal(jazzhrAdapter.matches(entry), false);
  });
}

test('matches/buildEndpoint tolerate null and undefined entries without throwing', () => {
  assert.equal(jazzhrAdapter.matches(null), false);
  assert.equal(jazzhrAdapter.matches(undefined), false);
  assert.equal(jazzhrAdapter.buildEndpoint(null), null);
  assert.equal(jazzhrAdapter.buildEndpoint(undefined), null);
});

test('explicit provider: jazzhr matches even with an untrusted URL, but yields no endpoint', () => {
  const entry = { provider: 'jazzhr', careers_url: 'https://evil.example/apply' };
  assert.equal(jazzhrAdapter.matches(entry), true);
  assert.equal(jazzhrAdapter.buildEndpoint(entry), null);
  assert.equal(jazzhrAdapter.matches({ provider: 'lever', careers_url: 'https://evil.example' }), false);
});

test('assertJazzHRUrl accepts trusted hosts (any path) and rejects the rest', () => {
  assert.equal(assertJazzHRUrl(`${BOARD}/D4/Role`).href, 'https://exampleco.applytojob.com/apply/D4/Role');
  for (const u of ['http://x.applytojob.com/apply', 'https://evil.example/apply', 'nope', '']) {
    assert.throws(() => assertJazzHRUrl(u), /jazzhr: untrusted or invalid public board URL/);
  }
});

test('list parser: titles, entities, locations, relative and absolute links', () => {
  const jobs = parseJazzHRList(LIST, BOARD, 'Example Co');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Learning & Development Designer');
  assert.equal(jobs[0].location, 'Toronto, ON');
  assert.equal(jobs[0].company, 'Example Co');
  assert.equal(jobs[0].url, 'https://exampleco.applytojob.com/apply/A1/Learning-Designer');
  assert.equal(jobs[1].url, 'https://exampleco.applytojob.com/apply/B2/Analyst');
});

test('list parser pins posting URLs to the board origin and strips the query', () => {
  const html = `<li class="list-group-item"><a href="https://evil.example/apply/Z9/Off">Off Host</a></li>
    <li class="list-group-item"><a href="/apply/Q1/Role?ref=abc">Role</a></li>`;
  const jobs = parseJazzHRList(html, BOARD, 'X');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://exampleco.applytojob.com/apply/Q1/Role');
});

test('empty / contentless board returns []', () => {
  assert.deepEqual(parseJazzHRList('', BOARD, 'X'), []);
  assert.deepEqual(parseJazzHRList('<html>no openings</html>', BOARD, 'X'), []);
  assert.deepEqual(parseJazzHRList(null, BOARD, 'X'), []);
});

test('a genuinely empty board with a bare-root nav link returns [] instead of throwing', () => {
  const empty = `<a href="https://exampleco.applytojob.com/apply/" id='resumator-back-button' class="btn btn-link hidden">Back</a><div class='jobs-list'><h2 class='page-title'>There are no open positions at this time.</h2></div>`;
  assert.deepEqual(parseJazzHRList(empty, BOARD, 'X'), []);
});

test('a card with no title is skipped, the rest kept', () => {
  const html = `<ul><li class="list-group-item"><h3><a href="https://exampleco.applytojob.com/apply/C3/"></a></h3><ul><li><i class="fa fa-map-marker"></i>Remote</li></ul></li><li class="list-group-item"><h3><a href="/apply/B2/Analyst">Analyst</a></h3><ul><li><i class="fa fa-map-marker"></i>Remote</li></ul></li></ul>`;
  const jobs = parseJazzHRList(html, BOARD, 'X');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Analyst');
});

test('wrapper-less markup falls back to a bare /apply/ anchor (title only)', () => {
  const html = '<div>ignore this list-group-item text, no real card here</div><a href="/apply/D4/Support-Engineer">Support Engineer</a>';
  const jobs = parseJazzHRList(html, BOARD, 'X');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Support Engineer');
  assert.equal(jobs[0].location, '');
});

test('hrefs that collapse to the board root are not postings and trip the broken-markup throw', () => {
  assert.throws(() => parseJazzHRList('<a href="/apply/?ref=1">Board root, not a posting</a>', BOARD, 'X'), /could not parse any posting cards/);
  assert.throws(() => parseJazzHRList('<a href="/apply//">Double slash, not a posting</a>', BOARD, 'X'), /could not parse any posting cards/);
});

test('a partial redesign recovers the unwrapped posting alongside wrapped cards', () => {
  const jobs = parseJazzHRList(`${LIST}<a href="/apply/E5/Support-Engineer">Support Engineer</a>`, BOARD, 'X');
  assert.equal(jobs.length, 3);
  assert.ok(jobs.some((j) => j.title === 'Support Engineer' && j.location === ''));
});

test('the fallback pass does not duplicate or downgrade a wrapped posting', () => {
  const jobs = parseJazzHRList(LIST, BOARD, 'X');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].location, 'Toronto, ON');
});

test('links present but no title parses throws (broken markup, not an empty board)', () => {
  assert.throws(() => parseJazzHRList('<a href="/apply/1/role"></a>', BOARD, 'X'), /could not parse any posting cards/);
});

test('detail parser: JSON-LD description and date, existing list location kept', () => {
  const [first] = parseJazzHRList(LIST, BOARD, 'Example Co');
  const enriched = parseJazzHRDetail(DETAIL, { ...first });
  assert.equal(enriched.description, 'Build & deliver courses.');
  assert.equal(enriched.postedAt, Date.parse('2026-08-30'));
  assert.equal(enriched.location, 'Toronto, ON');
});

test('detail parser: a sparser detail location never downgrades a fuller list location', () => {
  const sparse = `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Berlin Role', jobLocation: { address: { addressLocality: 'Berlin' } } })}</script>`;
  const full = parseJazzHRDetail(sparse, { title: 'Berlin Role', location: 'Berlin, Berlin, Germany' });
  assert.equal(full.location, 'Berlin, Berlin, Germany');
  const empty = parseJazzHRDetail(sparse, { title: 'Berlin Role', location: '' });
  assert.equal(empty.location, 'Berlin');
  const na = parseJazzHRDetail(sparse, { title: 'Berlin Role', location: ' N/A ' });
  assert.equal(na.location, 'Berlin');
});

test('detail parser handles @graph, typed arrays and ignores unrelated or malformed JSON-LD', () => {
  const graph = `<script type='application/ld+json'>{"@graph":[{"@type":"Organization"},{"@type":["JobPosting"],"title":"QA Lead","jobLocation":[{"address":{}},{"address":{"addressLocality":"York"}}]}]}</script>`;
  const job = parseJazzHRDetail(graph, { title: '', location: '' });
  assert.equal(job.title, 'QA Lead');
  assert.equal(job.location, 'York');
  const untouched = { title: 'T', location: 'L' };
  assert.deepEqual(parseJazzHRDetail('<script type="application/ld+json">oops</script>', { ...untouched }), untouched);
  assert.deepEqual(parseJazzHRDetail('<html></html>', { ...untouched }), untouched);
});

test('parseJazzHRConfig: opt-in details, detailLimit default 25, capped at 100, positive integers only', () => {
  assert.deepEqual(parseJazzHRConfig({}), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseJazzHRConfig(null), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseJazzHRConfig({ jazzhr: { fetchDetails: 'true' } }), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseJazzHRConfig({ jazzhr: { fetchDetails: true, detailLimit: 2 } }), { fetchDetails: true, detailLimit: 2 });
  assert.deepEqual(parseJazzHRConfig({ jazzhr: { detailLimit: 1000 } }), { fetchDetails: false, detailLimit: 100 });
  assert.deepEqual(parseJazzHRConfig({ jazzhr: { detailLimit: 0 } }), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseJazzHRConfig({ jazzhr: { detailLimit: 7.9 } }), { fetchDetails: false, detailLimit: 25 });
});

test('default fetch makes one redirect-blocked board request with the browser UA and 12-field rows', async () => {
  const { impl, calls } = router(() => res(LIST));
  const company = { name: 'Example Co', provider: 'jazzhr', careers_url: 'https://exampleco.applytojob.com/' };
  const jobs = await fetchJazzHR(jazzhrAdapter.buildEndpoint(company), { fetchImpl: impl, company, ...noSleep });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BOARD);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(jobs.length, 2);
  assert.deepEqual(Object.keys(jobs[0]).sort(), [
    'company', 'date', 'id', 'isRemote', 'location', 'relocates', 'salary',
    'snippet', 'source', 'title', 'url', 'workplaceType',
  ]);
  assert.equal(jobs[0].source, 'jazzhr');
  assert.equal(jobs[0].company, 'Example Co');
  assert.equal(jobs[0].id, 'jazzhr-exampleco.applytojob.com-A1/Learning-Designer');
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
});

test('fetch rebuilds the board from the endpoint hostname, whatever path it carries', async () => {
  const { impl, calls } = router(() => res(LIST));
  await fetchJazzHR('https://exampleco.applytojob.com/apply/A1/x?y=1', { fetchImpl: impl, company: { name: 'X' }, ...noSleep });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BOARD);
});

test('opt-in details: bounded, paced 200 ms, redirect-safe, enrich date/snippet/description', async () => {
  const sleeps = [];
  const { impl, calls } = router((url) => (url === BOARD ? res(LIST) : res(DETAIL)));
  const company = { name: 'Example Co', jazzhr: { fetchDetails: true, detailLimit: 2 } };
  const jobs = await fetchJazzHR(BOARD, {
    fetchImpl: impl, company, retryDelayMs: 0, sleep: async (ms) => { sleeps.push(ms); },
  });
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.init.redirect === 'error'));
  assert.deepEqual(sleeps, [DETAIL_FETCH_DELAY_MS]);
  assert.equal(DETAIL_FETCH_DELAY_MS, 200);
  assert.equal(calls[1].url, 'https://exampleco.applytojob.com/apply/A1/Learning-Designer');
  assert.equal(jobs[0].description, 'Build & deliver courses.');
  assert.equal(jobs[0].snippet, 'Build & deliver courses.');
  assert.equal(jobs[0].date, '2026-08-30');
  assert.equal(jobs[0].location, 'Toronto, ON'); // list location wins
});

test('detailLimit caps how many postings get a detail request', async () => {
  const { impl, calls } = router((url) => (url === BOARD ? res(LIST) : res(DETAIL)));
  await fetchJazzHR(BOARD, {
    fetchImpl: impl, company: { name: 'X', jazzhr: { fetchDetails: true, detailLimit: 1 } }, ...noSleep,
  });
  assert.equal(calls.length, 2);
});

test('detail failure is fail-soft: the list row survives untouched, transient errors retried, 4xx not', async () => {
  const detailCalls = [];
  const { impl } = router((url) => {
    if (url === BOARD) return res(LIST);
    detailCalls.push(url);
    return url.endsWith('/A1/Learning-Designer') ? res('down', 503) : res('gone', 404);
  });
  const jobs = await fetchJazzHR(BOARD, {
    fetchImpl: impl, company: { name: 'X', jazzhr: { fetchDetails: true } }, ...noSleep,
  });
  // 3 attempts on the 503, 1 on the 404.
  assert.equal(detailCalls.length, 4);
  assert.equal(jobs.length, 2);
  assert.equal('description' in jobs[0], false);
  assert.equal(jobs[0].date, '');
  assert.equal(jobs[0].title, 'Learning & Development Designer');
});

test('a bounded probe (maxPages) stays on the single board request and skips details', async () => {
  const { impl, calls } = router(() => res(LIST));
  const jobs = await fetchJazzHR(BOARD, {
    fetchImpl: impl, maxPages: 1, company: { name: 'X', jazzhr: { fetchDetails: true } }, ...noSleep,
  });
  assert.equal(calls.length, 1);
  assert.equal(jobs.length, 2);
});

test('board transient error is retried, then succeeds', async () => {
  let n = 0;
  const { impl, calls } = router(() => (++n === 1 ? res('busy', 503) : res(LIST)));
  const jobs = await fetchJazzHR(BOARD, { fetchImpl: impl, company: { name: 'X' }, ...noSleep });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 2);
});

test('board permanent failure propagates with its status (dead-board contract)', async () => {
  const { impl, calls } = router(() => res('nope', 404));
  await assert.rejects(
    fetchJazzHR(BOARD, { fetchImpl: impl, company: { name: 'X' }, ...noSleep }),
    (err) => err.status === 404,
  );
  assert.equal(calls.length, 1);
});

test('a refused redirect on the board is not retried', async () => {
  const { impl, calls } = router(() => {
    throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  });
  await assert.rejects(fetchJazzHR(BOARD, { fetchImpl: impl, company: { name: 'X' }, ...noSleep }), TypeError);
  assert.equal(calls.length, 1);
});

test('broken markup on a 200 makes the fetch throw instead of reporting zero jobs', async () => {
  const { impl } = router(() => res('<a href="/apply/1/role"></a>'));
  await assert.rejects(
    fetchJazzHR(BOARD, { fetchImpl: impl, company: { name: 'X' }, ...noSleep }),
    /could not parse any posting cards/,
  );
});

test('SSRF guard rejects untrusted endpoints before any I/O', async () => {
  let io = 0;
  const impl = async () => { io += 1; return res(LIST); };
  for (const url of [
    'https://evil.example/apply',
    'http://exampleco.applytojob.com/apply',
    'https://x.applytojob.com.evil.com/apply',
    'https://169.254.169.254/apply',
  ]) {
    await assert.rejects(fetchJazzHR(url, { fetchImpl: impl, company: { name: 'Bad' }, ...noSleep }), /jazzhr:/);
  }
  assert.equal(io, 0);
});

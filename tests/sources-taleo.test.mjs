/**
 * Taleo source + adapter — CI-isolated tests (fake fetchImpl, no network, no
 * parent-project dependency, no port binding, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/taleo.test.mjs`. URL
 * assertions use extraction + strict equality, never String.includes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, parseBoardUrl, resolveBoard, assertTaleoUrl, extractPortal, extractHeadings,
  parseTaleoResponse, parseTaleoDetail, parseTaleoConfig, buildSearchUrl, buildBody,
  fetchTaleo,
} from '../server/lib/sources/taleo.mjs';
import { taleoAdapter } from '../server/lib/portals/adapters/taleo.mjs';

const URL_OK = 'https://example.taleo.net/careersection/demo/jobsearch.ftl?lang=en';
const BOARD = { url: new URL(URL_OK), section: 'demo' };
const SHELL = '<form action="/careersection/rest/jobboard/searchjobs?portal=8100120144"><table><th>Requisition Title</th><th>Location</th><th>Posting Date</th></table></form>';
const RESPONSE = {
  requisitionList: [
    { jobId: '2601', contestNo: 'R-1', column: ['Learning Designer', 'Toronto', '2026-09-01'] },
    { jobId: '2602', column: ['&amp; Engineer', 'London', 'not-a-date'] },
    { jobId: '', column: ['Dropped', 'X', ''] },
  ],
  pagingData: { currentPageNo: 1, pageSize: 25, totalCount: 2 },
};
const DETAIL_HTML = '<script type="application/ld+json">{"@type":"JobPosting","description":"%3Cp%3EBuild%20R%26amp%3BD%20systems.%3C%2Fp%3E"}</script>';

const noSleep = { sleep: async () => {}, retryDelayMs: 0 };

function res(body, status = 200) {
  return {
    ok: status >= 200 && status < 300, status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    headers: { get: () => null },
  };
}

/** Fake transport: `shell`/`detail` handlers for GET, `list(pageNo, init)` for the POST. */
function transport({ shell = () => SHELL, detail = () => DETAIL_HTML, list = () => RESPONSE } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    const call = { url, method: init.method || 'GET', init, path: u.pathname, search: u.search };
    calls.push(call);
    if (u.pathname === '/careersection/rest/jobboard/searchjobs') {
      call.page = JSON.parse(init.body).pageNo;
      return res(await list(call.page, init));
    }
    if (u.pathname.endsWith('/jobsearch.ftl')) return res(await shell(url));
    return res(await detail(url));
  };
  return { impl, calls };
}

const run = (company, t, extra = {}) =>
  fetchTaleo(URL_OK, { fetchImpl: t.impl, company, ...noSleep, ...extra });

test('meta is the EN taleo source', () => {
  assert.deepEqual(meta, { value: 'taleo', label: 'Taleo', region: 'en' });
});

test('adapter shape and endpoint', () => {
  assert.equal(taleoAdapter.id, 'taleo');
  assert.equal(taleoAdapter.label, 'Taleo');
  assert.equal(taleoAdapter.fetch, fetchTaleo);
  const entry = { name: 'Example', careers_url: URL_OK };
  assert.equal(taleoAdapter.matches(entry), true);
  assert.equal(taleoAdapter.buildEndpoint(entry), URL_OK);
  assert.equal(taleoAdapter.matches({ provider: 'taleo', careers_url: 'https://evil.example/x' }), true);
  assert.equal(taleoAdapter.buildEndpoint({ provider: 'taleo', careers_url: 'https://evil.example/careersection/demo/jobsearch.ftl' }), null);
  assert.equal(taleoAdapter.matches({ name: 'Other', careers_url: 'https://boards.greenhouse.io/x' }), false);
  assert.equal(taleoAdapter.matches(null), false);
  assert.equal(taleoAdapter.matches(undefined), false);
});

test('api: takes precedence over careers_url', () => {
  const api = 'https://other.taleo.net/careersection/ext/jobsearch.ftl';
  assert.equal(taleoAdapter.buildEndpoint({ api, careers_url: URL_OK }), api);
  assert.equal(taleoAdapter.buildEndpoint({ api: 'https://evil.example/x', careers_url: URL_OK }), URL_OK);
});

for (const bad of [
  'http://example.taleo.net/careersection/demo/jobsearch.ftl',
  'https://tre.taleo.net/careersection/demo/jobsearch.ftl',
  'https://evil.example/careersection/demo/jobsearch.ftl',
  'https://example.taleo.net.evil.example/careersection/demo/jobsearch.ftl',
  'https://evil.example/x.taleo.net/careersection/demo/jobsearch.ftl',
  'https://user:pw@example.taleo.net/careersection/demo/jobsearch.ftl',
  'https://example.taleo.net:8443/careersection/demo/jobsearch.ftl',
  'https://example.taleo.net/careersection/demo/login.ftl',
  null, 7, '', 'not a url',
]) {
  test(`rejects ${String(bad)}`, () => {
    assert.equal(resolveBoard({ name: 'X', careers_url: bad }), null);
    assert.equal(taleoAdapter.buildEndpoint({ name: 'X', careers_url: bad }), null);
    assert.equal(parseBoardUrl(bad), null);
  });
}

test('assertTaleoUrl throws on untrusted URL and returns board otherwise', () => {
  assert.throws(() => assertTaleoUrl('https://evil.example/careersection/demo/jobsearch.ftl'), /untrusted or invalid TEE URL/);
  assert.equal(assertTaleoUrl(URL_OK).section, 'demo');
});

test('parses dynamic columns, IDs, location and date', () => {
  const jobs = parseTaleoResponse(RESPONSE, BOARD, extractHeadings(SHELL), 'Example');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Learning Designer');
  assert.equal(jobs[0].location, 'Toronto');
  assert.equal(jobs[0].date, '2026-09-01');
  assert.equal(jobs[0].company, 'Example');
  assert.equal(jobs[0].source, 'taleo');
  assert.equal(jobs[1].date, '');
});

test('builds canonical contestNo detail URLs and decodes HTML entities', () => {
  const jobs = parseTaleoResponse(RESPONSE, BOARD, extractHeadings(SHELL), 'Example');
  const u0 = new URL(jobs[0].url);
  assert.equal(u0.origin, 'https://example.taleo.net');
  assert.equal(u0.pathname, '/careersection/demo/jobdetail.ftl');
  assert.equal(u0.searchParams.get('job'), 'R-1');
  assert.equal(u0.searchParams.get('lang'), 'en');
  assert.equal(new URL(jobs[1].url).searchParams.get('job'), '2602');
  assert.equal(jobs[1].title, '& Engineer');
});

test('null/empty/array response gives []', () => {
  assert.deepEqual(parseTaleoResponse({}, BOARD, [], 'X'), []);
  assert.deepEqual(parseTaleoResponse(null, BOARD, [], 'X'), []);
  assert.deepEqual(parseTaleoResponse([], BOARD, [], 'X'), []);
});

test('wrong response envelope throws descriptively', () => {
  assert.throws(() => parseTaleoResponse({ requisitionList: {} }, BOARD, [], 'X'), /requisitionList/);
  assert.throws(() => parseTaleoResponse('oops', BOARD, [], 'X'), /unexpected API response/);
});

test('uses positional columns when the shell has no headings', () => {
  const jobs = parseTaleoResponse({ requisitionList: [{ jobId: '2603', column: ['Positional title', 'Vancouver', '2026-09-02'] }] }, BOARD, [], 'X');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Positional title');
  assert.equal(jobs[0].location, 'Vancouver');
});

test('JSON-array location column is joined; plain and empty handled', () => {
  const r = { requisitionList: [
    { jobId: 'a', column: ['One', '["AB-Calgary"]', ''] },
    { jobId: 'b', column: ['Two', '["AB-Calgary","AB-Edmonton"]', ''] },
    { jobId: 'c', column: ['Three', '[]', ''] },
    { jobId: 'd', column: ['Four', 'Toronto', ''] },
    { jobId: 'e', column: ['Five', 'Remote - Canada', ''] },
  ] };
  const jobs = parseTaleoResponse(r, BOARD, extractHeadings(SHELL), 'X');
  assert.deepEqual(jobs.map((j) => j.location), ['AB-Calgary', 'AB-Calgary; AB-Edmonton', '', 'Toronto', 'Remote - Canada']);
  assert.equal(jobs[4].isRemote, true);
  assert.equal(jobs[4].workplaceType, 'Remote');
  assert.equal(jobs[3].isRemote, false);
});

test('extractPortal and buildSearchUrl/buildBody', () => {
  assert.equal(extractPortal(SHELL), '8100120144');
  assert.equal(extractPortal('<input name="portal" value="42">'), '42');
  assert.equal(extractPortal('var cfg = {"portalId": "77"};'), '77');
  assert.equal(extractPortal('<html>Sign in</html>'), '');
  const su = new URL(buildSearchUrl(BOARD, '8100120144'));
  assert.equal(su.origin, 'https://example.taleo.net');
  assert.equal(su.pathname, '/careersection/rest/jobboard/searchjobs');
  assert.equal(su.searchParams.get('portal'), '8100120144');
  assert.equal(su.searchParams.get('lang'), 'en');
  assert.equal(buildBody(3).pageNo, 3);
});

test('detail JSON-LD: URL-encoded HTML is decoded', () => {
  assert.equal(parseTaleoDetail(DETAIL_HTML), 'Build R&D systems.');
  assert.equal(parseTaleoDetail('<html></html>'), '');
  assert.equal(parseTaleoDetail(null), '');
  const graph = '<script type="application/ld+json">{"@graph":[{"@type":["Thing","JobPosting"],"description":"<b>Hi</b> there"}]}</script>';
  assert.equal(parseTaleoDetail(graph), 'Hi there');
  const bad = '<script type="application/ld+json">{nope</script>' + DETAIL_HTML;
  assert.equal(parseTaleoDetail(bad), 'Build R&D systems.');
});

test('parseTaleoConfig reads block, falls back to top-level, clamps', () => {
  assert.deepEqual(parseTaleoConfig({}), { maxPages: 100, fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseTaleoConfig({ fetchDetails: true, detailLimit: 500, max_pages: 3 }), { maxPages: 3, fetchDetails: true, detailLimit: 100 });
  assert.deepEqual(parseTaleoConfig({ taleo: { fetchDetails: true, detailLimit: 2 } }), { maxPages: 100, fetchDetails: true, detailLimit: 2 });
});

test('fetch: shell + search + bounded details, redirect:error, POST body', async () => {
  const t = transport();
  const jobs = await run({ name: 'Example', fetchDetails: true }, t);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.description === 'Build R&D systems.'));
  assert.equal(t.calls.length, 4);
  assert.equal(t.calls[0].url, URL_OK);
  assert.equal(t.calls[1].method, 'POST');
  assert.equal(t.calls[1].page, 1);
  assert.ok(t.calls.every((c) => c.init.redirect === 'error'));
  const su = new URL(t.calls[1].url);
  assert.equal(su.pathname, '/careersection/rest/jobboard/searchjobs');
  assert.equal(su.searchParams.get('portal'), '8100120144');
  assert.equal(t.calls[1].init.headers['Content-Type'], 'application/json');
  assert.equal(new URL(t.calls[2].url).searchParams.get('job'), 'R-1');
});

test('fetch: no details without opt-in; block opt-in works', async () => {
  const t = transport();
  const jobs = await run({ name: 'NoOptIn' }, t);
  assert.equal(jobs.length, 2);
  assert.equal(t.calls.length, 2);
  assert.equal(jobs[0].description, undefined);
  const t2 = transport();
  const jobs2 = await run({ name: 'Block', taleo: { fetchDetails: true } }, t2);
  assert.equal(t2.calls.length, 4);
  assert.equal(jobs2[0].snippet, 'Build R&D systems.');
});

test('fetch: SSRF guard rejects untrusted host before any I/O', async () => {
  let calls = 0;
  const impl = async () => { calls += 1; throw new Error('must not fetch'); };
  await assert.rejects(
    fetchTaleo('https://evil.example/careersection/demo/jobsearch.ftl', { fetchImpl: impl, ...noSleep }),
    /untrusted or invalid TEE URL/,
  );
  await assert.rejects(
    fetchTaleo('http://example.taleo.net/careersection/demo/jobsearch.ftl', { fetchImpl: impl, ...noSleep }),
    /untrusted or invalid TEE URL/,
  );
  assert.equal(calls, 0);
});

test('fetch: empty public board returns []; private shell throws', async () => {
  const empty = transport({ list: () => ({ requisitionList: [], pagingData: { totalCount: 0, pageSize: 25 } }) });
  assert.deepEqual(await run({ name: 'EmptyCo' }, empty), []);
  const priv = transport({ shell: () => '<html><title>Sign in</title></html>' });
  await assert.rejects(run({ name: 'PrivateCo' }, priv), /portal id|private|unavailable/i);
  assert.equal(priv.calls.length, 1);
});

const one = (id, title) => ({ requisitionList: [{ jobId: id, column: [title, 'Toronto', '2026-09-01'] }] });

test('fetch: paginates until reported total is reached', async () => {
  const t = transport({ list: (p) => ({ ...one(String(p), `Job ${p}`), pagingData: { totalCount: 2, pageSize: 1 } }) });
  const jobs = await run({ name: 'PagedCo' }, t);
  assert.equal(jobs.length, 2);
  assert.deepEqual(t.calls.filter((c) => c.page).map((c) => c.page), [1, 2]);
});

test('fetch: ctx maxPages probe limits to one list request and skips details', async () => {
  const t = transport({ list: (p) => ({ ...one(String(p), `Job ${p}`), pagingData: { totalCount: 5, pageSize: 1 } }) });
  const jobs = await run({ name: 'PagedCo', max_pages: 100, fetchDetails: true }, t, { maxPages: 1 });
  assert.equal(jobs.length, 1);
  assert.deepEqual(t.calls.filter((c) => c.page).map((c) => c.page), [1]);
  assert.equal(t.calls.length, 2);
});

test('fetch: entry max_pages caps pagination when total is unknown', async () => {
  const t = transport({ list: (p) => one(String(p), `Job ${p}`) });
  const jobs = await run({ name: 'CapCo', max_pages: 3 }, t);
  assert.equal(jobs.length, 3);
  assert.deepEqual(t.calls.filter((c) => c.page).map((c) => c.page), [1, 2, 3]);
});

test('fetch: raw page length, not normalized rows, controls termination', async () => {
  const t = transport({
    list: (p) => (p === 1
      ? { requisitionList: [{ jobId: '', column: ['Malformed', 'X', ''] }, { jobId: '3', column: ['Three', 'Ottawa', '2026-09-03'] }], pagingData: { totalCount: 3, pageSize: 2 } }
      : { requisitionList: [{ jobId: '4', column: ['Four', 'Montreal', '2026-09-04'] }], pagingData: { totalCount: 3, pageSize: 2 } }),
  });
  const jobs = await run({ name: 'MalformedCo' }, t, { maxPages: 2 });
  assert.equal(jobs.length, 2);
  assert.deepEqual(t.calls.filter((c) => c.page).map((c) => c.page), [1, 2]);
});

test('fetch: under-reported page size does not end pagination early', async () => {
  const mk = (prefix, n) => Array.from({ length: n }, (_, i) => ({ jobId: `${prefix}${i}`, column: [`${prefix} ${i}`, 'Calgary', '2026-09-01'] }));
  const t = transport({
    list: (p) => ({ requisitionList: p === 1 ? mk('f', 14) : mk('s', 16), pagingData: { totalCount: 30, pageSize: 25 } }),
  });
  const jobs = await run({ name: 'UnderReportCo' }, t);
  assert.equal(jobs.length, 30);
  assert.deepEqual(t.calls.filter((c) => c.page).map((c) => c.page), [1, 2]);
});

test('fetch: null and empty totals paginate until an empty page', async () => {
  const t = transport({
    list: (p) => {
      if (p === 1) return { ...one('n1', 'First'), pagingData: { totalCount: null } };
      if (p === 2) return { ...one('n2', 'Second'), pagingData: { totalCount: '' } };
      return { requisitionList: [], pagingData: { totalCount: null } };
    },
  });
  const jobs = await run({ name: 'NullTotalCo' }, t);
  assert.equal(jobs.length, 2);
  assert.deepEqual(t.calls.filter((c) => c.page).map((c) => c.page), [1, 2, 3]);
});

test('fetch: detailLimit bounds enrichment; failed detail keeps listing and continues', async () => {
  const t = transport({ detail: (u) => { if (new URL(u).searchParams.get('job') === 'R-1') { throw Object.assign(new Error('nf'), { status: 404 }); } return DETAIL_HTML; } });
  const bounded = await run({ name: 'B', fetchDetails: true, detailLimit: 1 }, transport());
  assert.ok(bounded[0].description);
  assert.equal(bounded[1].description, undefined);
  const failed = await run({ name: 'F', fetchDetails: true }, t);
  assert.equal(failed.length, 2);
  assert.equal(failed[0].description, undefined);
  assert.equal(failed[1].description, 'Build R&D systems.');
});

test('fetch: detail fetch is not made to an off-host job URL', async () => {
  const t = transport({ list: () => RESPONSE });
  await run({ name: 'Host', fetchDetails: true }, t);
  assert.ok(t.calls.every((c) => new URL(c.url).hostname === 'example.taleo.net'));
});

test('fetch: retries a transient 503 once, never a permanent 4xx', async () => {
  let n = 0;
  const impl = async (url, init = {}) => {
    if (new URL(url).pathname.endsWith('searchjobs')) {
      n += 1;
      return n === 1 ? res('busy', 503) : res(RESPONSE);
    }
    return res(SHELL);
  };
  const jobs = await fetchTaleo(URL_OK, { fetchImpl: impl, company: { name: 'RetryCo' }, ...noSleep });
  assert.equal(jobs.length, 2);
  assert.equal(n, 2);
  let m = 0;
  const impl404 = async (url) => {
    if (new URL(url).pathname.endsWith('searchjobs')) { m += 1; return res('gone', 404); }
    return res(SHELL);
  };
  await assert.rejects(fetchTaleo(URL_OK, { fetchImpl: impl404, company: { name: 'X' }, ...noSleep }), /HTTP 404/);
  assert.equal(m, 1);
});

test('fetch: probe/list errors propagate with a status', async () => {
  const impl = async (url) => (new URL(url).pathname.endsWith('searchjobs') ? res('boom', 500) : res(SHELL));
  await assert.rejects(
    fetchTaleo(URL_OK, { fetchImpl: impl, company: { name: 'E' }, maxPages: 1, ...noSleep }),
    (err) => err.status === 500,
  );
});

// ── Phase 2 (v1.242.0): heading extraction, French columns, date TZ ──

const JOBS_TABLE_SHELL = (thead) =>
  `<html><body><nav><label>Language</label><label>Actions</label></nav>` +
  `<table id="jobs"><thead><tr>${thead}</tr></thead></table>` +
  `<footer><label>Newsletter</label></footer></body></html>`;

test('extractHeadings: labels are read ONLY from the jobs table, never from the page chrome', () => {
  const headings = extractHeadings(
    JOBS_TABLE_SHELL('<th>Requisition Title</th><th>Location</th><th>Posting Date</th>'),
  );
  assert.deepEqual(headings, ['Requisition Title', 'Location', 'Posting Date']);
  // Chrome labels (nav/footer) must not leak into the column map.
  assert.ok(!headings.includes('Language'));
  assert.ok(!headings.includes('Newsletter'));
});

test('extractHeadings: no jobs table → [] (positional fallback), never a scan of the whole shell', () => {
  assert.deepEqual(extractHeadings('<html><nav><label>Sign in</label></nav><div>jobs</div></html>'), []);
  assert.deepEqual(extractHeadings(SHELL), [], 'the bare fixture has no id="jobs" table');
  assert.deepEqual(extractHeadings(null), []);
});

test('French column headings map to title/location/posted', () => {
  const headings = ['Titre du poste', 'Emplacement', "Date d'affichage"];
  const jobs = parseTaleoResponse(
    { requisitionList: [{ jobId: 'fr1', column: ['Ingénieur', 'Paris', '15/07/2026'] }] },
    BOARD, headings, 'X',
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Ingénieur');
  assert.equal(jobs[0].location, 'Paris');
  assert.equal(jobs[0].date, '2026-07-15');
});

test('unrecognized headings still fall back to positional columns — rows are not dropped', () => {
  const jobs = parseTaleoResponse(
    { requisitionList: [{ jobId: 'z1', column: ['Mystery Title', 'Mystery City', '2026-07-15'] }] },
    BOARD, ['Foo', 'Bar', 'Baz'], 'X',
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Mystery Title');
  assert.equal(jobs[0].location, 'Mystery City');
});

test('fetch: a French shell without a jobs table parses every row (rawCount > 0 ⇒ rows survive)', async () => {
  const frenchShell = '<form action="/careersection/rest/jobboard/searchjobs?portal=8100120144">' +
    '<label>Langue</label><div>postes</div></form>';
  const t = transport({
    shell: () => frenchShell,
    list: (p) => (p === 1
      ? { requisitionList: [
          { jobId: 'a', column: ['Ingénieur logiciel', 'Montréal', '2026-09-01'] },
          { jobId: 'b', column: ['Analyste', 'Québec', '2026-09-02'] },
        ], pagingData: { totalCount: 2 } }
      : { requisitionList: [], pagingData: { totalCount: 2 } }),
  });
  const jobs = await run({ name: 'FR' }, t);
  assert.equal(jobs.length, 2, 'no heading match must not silently drop the whole page');
  assert.equal(jobs[0].title, 'Ingénieur logiciel');
  assert.equal(jobs[1].location, 'Québec');
});

test('posting dates are UTC date-only: no off-by-one from the process timezone', () => {
  const mk = (posted) => parseTaleoResponse(
    { requisitionList: [{ jobId: 'd1', column: ['T', 'Toronto', posted] }] },
    BOARD, [], 'X',
  )[0].date;
  assert.equal(mk('7/15/2026'), '2026-07-15', 'US M/D/Y must not shift a day in UTC+ timezones');
  assert.equal(mk('2026-07-15'), '2026-07-15', 'ISO date passes through unchanged');
  assert.equal(mk('Jul 15, 2026'), '2026-07-15', 'month-name form');
  assert.equal(mk('15 Jul 2026'), '2026-07-15', 'day-first month-name form');
  assert.equal(mk('not-a-date'), '');
  // A full timestamp still parses (legacy behavior), via the Date.parse fallback.
  assert.equal(mk('2026-07-15T00:00:00Z'), '2026-07-15');
});

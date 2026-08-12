/**
 * Jobvite source — CI-isolated tests (no network, no parent-project dependency,
 * no fixed port). Covers the #2623 migration to the public XML feed:
 * companyEId resolution (config / ?c= / board-discovery scrape), the two-host
 * SSRF guard, XML parsing into the web-ui job shape, and empty-feed handling.
 * Parent career-ops `tests/providers/jobvite.test.mjs` parity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchJobvite,
  parseJobviteXml,
  resolveConfiguredEid,
  resolveSlug,
  slugFromBoardUrl,
  extractEidFromBoard,
  buildFeedUrl,
  buildBoardUrl,
  buildBoardFetchUrl,
  isEmptyBoardRedirect,
  assertJobviteUrl,
  BOARD_HOST,
  FEED_HOST,
  ALLOWED_HOSTS,
  MAX_JOBS,
  meta,
} from '../server/lib/sources/jobvite.mjs';
import { jobviteAdapter } from '../server/lib/portals/adapters/jobvite.mjs';

const EID = 'q6NaVfwI';
const CAREERS = 'https://jobs.jobvite.com/acme';
const FEED = `https://app.jobvite.com/CompanyJobs/Xml.aspx?c=${EID}`;

// Validate derived URLs by their parsed hostname, never by substring-matching
// the whole URL string (CodeQL js/incomplete-url-substring-sanitization).
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };

// ---------------------------------------------------------------------------
// XML fixture — 5 jobs, 3 survive (no-title + no-url + bad-detail-url paths).
// ---------------------------------------------------------------------------

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <job>
    <id>101</id>
    <title>Senior Software Engineer</title>
    <category>Engineering</category>
    <location>San Francisco, CA</location>
    <date>6/2/2025</date>
    <detail-url><![CDATA[https://jobs.jobvite.com/acme/job/senior-swe]]></detail-url>
    <apply-url><![CDATA[https://app.jobvite.com/acme/apply/senior-swe]]></apply-url>
  </job>
  <job>
    <id>102</id>
    <title>Product Manager &#8211; Growth</title>
    <category>Product</category>
    <location>Remote - US</location>
    <date>not-a-date</date>
    <apply-url><![CDATA[http://careers.acme.com/apply/pm]]></apply-url>
  </job>
  <job>
    <id>103</id>
    <title></title>
    <location>New York, NY</location>
    <detail-url>https://jobs.jobvite.com/acme/job/blank</detail-url>
  </job>
  <job>
    <id>104</id>
    <title>No URL Role</title>
    <location>Austin, TX</location>
  </job>
  <job>
    <id>105</id>
    <title>Bad Detail URL Role</title>
    <location>Los Angeles, CA</location>
    <detail-url>ftp://example.com/nope</detail-url>
    <apply-url><![CDATA[https://jobs.jobvite.com/acme/job/fallback]]></apply-url>
  </job>
</result>`;

const BOARD_HTML = `<!doctype html><html><head><script>
  window.jvConfig = { companyEId: '${EID}', locale: 'en' };
</script></head><body>…</body></html>`;

/**
 * URL-routing fake fetch. `routes` is an array of
 * `{ test(url)->bool, ok?, status?, location?, body? }`; first match wins.
 * Records every call so the transport contract can be asserted. No network.
 */
function makeFetch(routes) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    for (const r of routes) {
      if (r.test(url)) {
        return {
          ok: r.ok !== false,
          status: r.status ?? 200,
          headers: { get: (k) => (String(k).toLowerCase() === 'location' ? (r.location ?? null) : null) },
          text: async () => r.body ?? '',
        };
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

const isFeed = (u) => hostOf(u) === FEED_HOST;
const isBoard = (u) => hostOf(u) === BOARD_HOST;

// ---------------------------------------------------------------------------
// meta — source-registry contract (registry count must stay unchanged).
// ---------------------------------------------------------------------------

test('meta: jobvite / Jobvite / en', () => {
  assert.deepEqual(meta, { value: 'jobvite', label: 'Jobvite', region: 'en' });
});

// ---------------------------------------------------------------------------
// assertJobviteUrl — the two-host SSRF guard (security core).
// ---------------------------------------------------------------------------

test('assertJobviteUrl: pins BOTH hosts over HTTPS; rejects a 3rd host, HTTP, spoofs, junk', () => {
  assert.equal(assertJobviteUrl(`https://${BOARD_HOST}/acme`), `https://${BOARD_HOST}/acme`);
  assert.equal(assertJobviteUrl(FEED), FEED);
  assert.deepEqual([...ALLOWED_HOSTS].sort(), ['app.jobvite.com', 'jobs.jobvite.com']);

  // A third jobvite-ish host is NOT allowed — only the exact two.
  assert.throws(() => assertJobviteUrl('https://careers.jobvite.com/acme'), /untrusted hostname/);
  // Host-suffix spoof: trusted fragment inside a longer evil host.
  assert.throws(() => assertJobviteUrl('https://jobs.jobvite.com.evil.example/acme'), /untrusted hostname/);
  assert.throws(() => assertJobviteUrl('https://app.jobvite.com.evil.example/x'), /untrusted hostname/);
  // Path spoof: jobvite host in the path, not the host.
  assert.throws(() => assertJobviteUrl('https://evil.example/app.jobvite.com/x'), /untrusted hostname/);
  // http:// is refused on both hosts.
  assert.throws(() => assertJobviteUrl(`http://${BOARD_HOST}/acme`), /HTTPS/);
  assert.throws(() => assertJobviteUrl(`http://${FEED_HOST}/x`), /HTTPS/);
  assert.throws(() => assertJobviteUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// companyEId / slug resolution (all no-network).
// ---------------------------------------------------------------------------

test('resolveConfiguredEid: company_eid wins, else api ?c= (host-pinned), else null', () => {
  assert.equal(resolveConfiguredEid({ company_eid: '  q6NaVfwI  ' }), 'q6NaVfwI');
  assert.equal(resolveConfiguredEid({ api: FEED }), EID);
  // company_eid takes precedence over a differing api ?c=.
  assert.equal(resolveConfiguredEid({ company_eid: 'AAAA', api: FEED }), 'AAAA');
  // ?c= on the board host is fine too (we only read the value, then rebuild).
  assert.equal(resolveConfiguredEid({ api: `https://${BOARD_HOST}/CompanyJobs/Xml.aspx?c=${EID}` }), EID);
  // Rejections.
  assert.equal(resolveConfiguredEid({}), null);
  assert.equal(resolveConfiguredEid(null), null);
  assert.equal(resolveConfiguredEid({ company_eid: 42 }), null);
  assert.equal(resolveConfiguredEid({ api: `https://evil.example/x?c=${EID}` }), null); // off-host ?c=
  assert.equal(resolveConfiguredEid({ api: `http://${FEED_HOST}/x?c=${EID}` }), null); // http ?c=
  assert.equal(resolveConfiguredEid({ api: FEED.replace(`?c=${EID}`, '') }), null); // no c param
});

test('resolveSlug / slugFromBoardUrl: reads the vanity slug, null off-host/http/api/junk', () => {
  assert.equal(resolveSlug({ careers_url: CAREERS }), 'acme');
  assert.equal(resolveSlug({ careers_url: `${CAREERS}/jobs` }), 'acme');
  assert.equal(slugFromBoardUrl(CAREERS), 'acme');
  assert.equal(slugFromBoardUrl(`https://evil.example/acme`), null);
  assert.equal(slugFromBoardUrl(`http://${BOARD_HOST}/acme`), null);
  assert.equal(slugFromBoardUrl(`https://${BOARD_HOST}/api/company/acme/jobs`), null);
  assert.equal(slugFromBoardUrl(`https://${BOARD_HOST}/`), null);
  assert.equal(slugFromBoardUrl(''), null);
  assert.equal(slugFromBoardUrl(42), null);
  assert.equal(resolveSlug({}), null);
});

test('extractEidFromBoard: scrapes companyEId from inline JS (tolerant of quoting)', () => {
  assert.equal(extractEidFromBoard(BOARD_HTML), EID);
  assert.equal(extractEidFromBoard(`x companyEId="AbCd_12-3" y`), 'AbCd_12-3');
  assert.equal(extractEidFromBoard(`companyEId = 'ZZ99zz'`), 'ZZ99zz');
  assert.equal(extractEidFromBoard('<html>no id here</html>'), null);
  assert.equal(extractEidFromBoard(''), null);
  assert.equal(extractEidFromBoard(null), null);
});

test('buildFeedUrl / buildBoardUrl / buildBoardFetchUrl: canonical, host-pinned', () => {
  assert.equal(buildFeedUrl(EID), FEED);
  assert.equal(hostOf(buildFeedUrl('a b/c')), FEED_HOST);
  assert.equal(buildBoardUrl('acme'), `https://${BOARD_HOST}/acme`);
  assert.equal(hostOf(buildBoardUrl('a b/c')), BOARD_HOST);
  const bf = buildBoardFetchUrl('acme');
  assert.equal(hostOf(bf), BOARD_HOST);
  const p = new URL(bf);
  assert.equal(p.searchParams.get('fr'), 'true');
  assert.equal(p.searchParams.get('nl'), '1');
});

// ---------------------------------------------------------------------------
// parseJobviteXml
// ---------------------------------------------------------------------------

test('parseJobviteXml: maps XML into the web-ui job shape, drops invalid rows (3 of 5)', () => {
  const jobs = parseJobviteXml(SAMPLE_XML, 'Acme');
  assert.equal(jobs.length, 3); // dropped: no-title (103), no-url (104)... 105 recovers via apply-url

  const [a, b, c] = jobs;
  // Row 101 — detail-url preferred over apply-url, date parsed to ISO.
  assert.equal(a.id, 'jobvite-101');
  assert.equal(a.title, 'Senior Software Engineer');
  assert.equal(a.company, 'Acme');
  assert.equal(a.url, 'https://jobs.jobvite.com/acme/job/senior-swe');
  assert.equal(a.location, 'San Francisco, CA');
  assert.equal(a.snippet, 'Engineering');
  assert.equal(a.salary, '');
  assert.equal(a.isRemote, false);
  assert.equal(a.workplaceType, '');
  assert.equal(a.relocates, false);
  assert.equal(a.source, 'jobvite');
  assert.equal(hostOf(a.url), 'jobs.jobvite.com');
  assert.equal(new Date(a.date).getUTCFullYear(), 2025); // 6/2/2025 → ISO

  // Row 102 — numeric entity decoded, http:→https: upgrade, remote detection,
  // unparseable date → ''.
  assert.equal(b.title, 'Product Manager – Growth'); // &#8211; → en dash
  assert.equal(b.url, 'https://careers.acme.com/apply/pm'); // http upgraded, branded off-host OK
  assert.equal(b.isRemote, true);
  assert.equal(b.workplaceType, 'Remote');
  assert.equal(b.date, '');

  // Row 105 — bad detail-url (ftp) discarded, apply-url used instead.
  assert.equal(c.title, 'Bad Detail URL Role');
  assert.equal(c.url, 'https://jobs.jobvite.com/acme/job/fallback');
});

test('parseJobviteXml: empty <result/> and empty string → [] (empty-feed handling)', () => {
  assert.deepEqual(parseJobviteXml('<result></result>', 'X'), []);
  assert.deepEqual(parseJobviteXml('<result/>', 'X'), []);
  assert.deepEqual(parseJobviteXml('', 'X'), []);
  assert.deepEqual(parseJobviteXml(null, 'X'), []);
});

test('parseJobviteXml: unterminated final <job> block is ignored, not looped', () => {
  const xml = '<result><job><id>1</id><title>A</title><detail-url>https://jobs.jobvite.com/x/1</detail-url></job>'
    + '<job><id>2</id><title>Truncated</title>';
  const jobs = parseJobviteXml(xml, 'X');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'A');
});

test('parseJobviteXml: output capped at MAX_JOBS', () => {
  let xml = '<result>';
  for (let i = 0; i < MAX_JOBS + 25; i += 1) {
    xml += `<job><id>${i}</id><title>Role ${i}</title><detail-url>https://jobs.jobvite.com/x/${i}</detail-url></job>`;
  }
  xml += '</result>';
  assert.equal(parseJobviteXml(xml, 'X').length, MAX_JOBS);
});

// ---------------------------------------------------------------------------
// isEmptyBoardRedirect
// ---------------------------------------------------------------------------

test('isEmptyBoardRedirect: true only for a feed-host 3xx → NoJobs.htm', () => {
  assert.equal(isEmptyBoardRedirect({ status: 302, location: 'NoJobs.htm' }, FEED), true);
  assert.equal(isEmptyBoardRedirect({ status: 301, location: `https://${FEED_HOST}/NoJobs.htm` }, FEED), true);
  // Wrong target page, wrong host, non-3xx, or no location → false.
  assert.equal(isEmptyBoardRedirect({ status: 302, location: '/somethingelse.htm' }, FEED), false);
  assert.equal(isEmptyBoardRedirect({ status: 302, location: 'https://evil.example/NoJobs.htm' }, FEED), false);
  assert.equal(isEmptyBoardRedirect({ status: 503 }, FEED), false);
  assert.equal(isEmptyBoardRedirect({ status: 302 }, FEED), false);
  assert.equal(isEmptyBoardRedirect({}, FEED), false);
});

// ---------------------------------------------------------------------------
// fetchJobvite — resolution paths, SSRF, empty-board, error propagation
// ---------------------------------------------------------------------------

test('fetchJobvite: configured company_eid → single feed fetch, no discovery', async () => {
  const fetchImpl = makeFetch([{ test: isFeed, body: SAMPLE_XML }]);
  const jobs = await fetchJobvite(FEED, { fetchImpl, company: { name: 'Acme', company_eid: EID } });
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(fetchImpl.calls.length, 1); // no board request
  const { url, opts } = fetchImpl.calls[0];
  assert.equal(url, FEED);
  assert.equal(hostOf(url), FEED_HOST);
  assert.equal(opts.redirect, 'manual'); // reads Location without following it
  assert.match(opts.headers['User-Agent'], /career-ops-web-ui/);
});

test('fetchJobvite: eId from the endpoint ?c= param alone (no company_eid on entry)', async () => {
  const fetchImpl = makeFetch([{ test: isFeed, body: SAMPLE_XML }]);
  const jobs = await fetchJobvite(FEED, { fetchImpl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 3);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, FEED);
});

test('fetchJobvite: board discovery — scrapes companyEId, then fetches the feed', async () => {
  const fetchImpl = makeFetch([
    { test: isBoard, body: BOARD_HTML },
    { test: isFeed, body: SAMPLE_XML },
  ]);
  const jobs = await fetchJobvite(CAREERS, { fetchImpl, company: { name: 'Acme', careers_url: CAREERS } });
  assert.equal(jobs.length, 3);
  assert.equal(fetchImpl.calls.length, 2);

  // 1st call: board page with fr=true&nl=1, redirect:'error' (retired slug fails loud).
  const board = fetchImpl.calls[0];
  assert.equal(hostOf(board.url), BOARD_HOST);
  const bp = new URL(board.url);
  assert.equal(bp.searchParams.get('fr'), 'true');
  assert.equal(bp.searchParams.get('nl'), '1');
  assert.equal(board.opts.redirect, 'error');

  // 2nd call: the canonical feed URL built from the scraped eId.
  const feed = fetchImpl.calls[1];
  assert.equal(feed.url, FEED);
  assert.equal(hostOf(feed.url), FEED_HOST);
  assert.equal(feed.opts.redirect, 'manual');
});

test('fetchJobvite: discovery that cannot find an eId throws (no silent zero)', async () => {
  const fetchImpl = makeFetch([{ test: isBoard, body: '<html>no id</html>' }]);
  await assert.rejects(
    () => fetchJobvite(CAREERS, { fetchImpl, company: { careers_url: CAREERS } }),
    /could not find companyEId/,
  );
});

test('fetchJobvite: un-derivable entry throws before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, text: async () => '' }; };
  await assert.rejects(
    () => fetchJobvite('https://evil.example/acme', { fetchImpl, company: { name: 'X' } }),
    /cannot derive a company id/,
  );
  assert.equal(called, false);
});

test('fetchJobvite: empty board (feed 302 → NoJobs.htm) resolves to []', async () => {
  const fetchImpl = makeFetch([{ test: isFeed, ok: false, status: 302, location: 'NoJobs.htm' }]);
  const jobs = await fetchJobvite(FEED, { fetchImpl, company: { company_eid: EID } });
  assert.deepEqual(jobs, []);
});

test('fetchJobvite: a non-redirect feed error (503) propagates with .status', async () => {
  const fetchImpl = makeFetch([{ test: isFeed, ok: false, status: 503 }]);
  await assert.rejects(() => fetchJobvite(FEED, { fetchImpl, company: { company_eid: EID } }), (err) => {
    assert.match(err.message, /HTTP 503/);
    assert.equal(err.status, 503);
    return true;
  });
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('jobviteAdapter: matches provider / configured-eid / jobvite-host careers_url', () => {
  assert.equal(jobviteAdapter.id, 'jobvite');
  assert.equal(jobviteAdapter.label, 'Jobvite');
  assert.ok(jobviteAdapter.matches({ provider: 'jobvite' }));
  assert.ok(jobviteAdapter.matches({ company_eid: EID }));
  assert.ok(jobviteAdapter.matches({ api: FEED }));
  assert.ok(jobviteAdapter.matches({ careers_url: CAREERS }));
  assert.ok(!jobviteAdapter.matches({ careers_url: 'https://jobs.lever.co/acme' }));
  assert.ok(!jobviteAdapter.matches({ careers_url: 'https://jobs.jobvite.com.evil.example/acme' }));
  assert.ok(!jobviteAdapter.matches({ careers_url: `http://${BOARD_HOST}/acme` }));
  assert.ok(!jobviteAdapter.matches({}));
  assert.ok(!jobviteAdapter.matches(null));
});

test('jobviteAdapter: buildEndpoint returns feed URL when eId known, else board URL, else null', () => {
  // Configured eId → canonical feed URL.
  assert.equal(jobviteAdapter.buildEndpoint({ company_eid: EID }), FEED);
  assert.equal(jobviteAdapter.buildEndpoint({ api: FEED }), FEED);
  // Only a vanity slug → the board URL (discovery happens at fetch time).
  assert.equal(jobviteAdapter.buildEndpoint({ careers_url: CAREERS }), buildBoardUrl('acme'));
  assert.equal(jobviteAdapter.buildEndpoint({ careers_url: `${CAREERS}/jobs` }), buildBoardUrl('acme'));
  // Explicit provider with an un-pinnable URL → null endpoint (never fetched).
  assert.equal(jobviteAdapter.buildEndpoint({ provider: 'jobvite', careers_url: 'https://careers.branded.com' }), null);
  assert.equal(jobviteAdapter.buildEndpoint({}), null);
  assert.equal(jobviteAdapter.buildEndpoint(null), null);
});

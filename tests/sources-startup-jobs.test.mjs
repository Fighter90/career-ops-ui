/**
 * Startup Jobs source + adapter — CI-isolated tests (fake fetchImpl, no network,
 * no parent-project dependency, no port binding, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/startup-jobs.test.mjs` at its
 * post-merge review fix (08fe5d06). Fixtures are inlined copies of the parent's.
 *
 * URL assertions use strict equality on extracted/parsed values, never
 * `String.includes` or an unanchored regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  FEED_HOST,
  assertStartupJobsUrl,
  buildFeedUrl,
  splitTitleCompany,
  extractLocation,
  cleanUrl,
  parseStartupJobsFeed,
  fetchStartupJobs,
} from '../server/lib/sources/startup-jobs.mjs';
import { startupJobsAdapter } from '../server/lib/portals/adapters/startup-jobs.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const BARE_FEED = 'https://startup.jobs/feeds/jobs';

const sampleXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
  '<title>Startup Jobs</title>',
  '<item>',
  '  <title>Senior Platform Engineer at Acme &amp; Co</title>',
  '  <link>https://startup.jobs/senior-platform-engineer-acme-10260824?utm_source=rss&amp;utm_medium=feed</link>',
  '  <guid isPermaLink="true">https://startup.jobs/senior-platform-engineer-acme-10260824</guid>',
  '  <pubDate>Thu, 01 Oct 2026 08:19:06 +0000</pubDate>',
  '  <description><![CDATA[Own the platform that powers the whole engineering org.',
  '',
  'Amsterdam, Netherlands · €130,000 – €160,000 per year]]></description>',
  '  <category>Engineering</category>',
  '</item>',
  '<item>',
  '  <title>Remote SRE at Beta Labs</title>',
  '  <link>https://startup.jobs/remote-sre-beta-labs-10260825</link>',
  '  <pubDate>Thu, 01 Oct 2026 08:10:00 +0000</pubDate>',
  '  <description>Remote, Germany</description>',
  '</item>',
  '<item>',
  '  <title>No At Segment Here</title>',
  '  <link>https://startup.jobs/no-at-segment-10260826</link>',
  '  <description>Some body text.',
  '',
  'Remote, U.S.</description>',
  '</item>',
  '<item>',
  '  <title>Ghost (no link)</title>',
  '</item>',
  '</channel></rss>',
].join('\n');

const wrap = (...items) => `<rss><channel>${items.join('\n')}</channel></rss>`;
const item = (title, link, extra = '') => `<item><title>${title}</title><link>${link}</link>${extra}</item>`;

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: () => null } };
}

test('meta + adapter surface', () => {
  assert.deepEqual(meta, { value: 'startup-jobs', label: 'Startup Jobs', region: 'en' });
  assert.equal(startupJobsAdapter.id, 'startup-jobs');
  assert.equal(startupJobsAdapter.label, 'Startup Jobs');
  assert.equal(startupJobsAdapter.fetch, fetchStartupJobs);
  assert.equal(FEED_HOST, 'startup.jobs');
});

test('adapter matches only an explicit provider:startup-jobs', () => {
  assert.equal(startupJobsAdapter.matches({ name: 'Startup Jobs', provider: 'startup-jobs' }), true);
  assert.equal(startupJobsAdapter.matches({ name: 'X' }), false);
  assert.equal(startupJobsAdapter.matches({ careers_url: 'https://startup.jobs/' }), false);
  assert.equal(startupJobsAdapter.matches({}), false);
  assert.equal(startupJobsAdapter.matches(null), false);
});

test('buildEndpoint: bare feed with no config, always a string', () => {
  const url = startupJobsAdapter.buildEndpoint({ name: 'Startup Jobs', provider: 'startup-jobs' });
  assert.equal(url, BARE_FEED);
  assert.equal(typeof url, 'string');
  assert.equal(startupJobsAdapter.buildEndpoint(null), BARE_FEED);
});

test('buildEndpoint: role + workplace from entry.startup_jobs', () => {
  const entry = { provider: 'startup-jobs', startup_jobs: { role: 'platform-engineer', workplace: 'remote' } };
  assert.equal(startupJobsAdapter.buildEndpoint(entry), `${BARE_FEED}?role=platform-engineer&workplace=remote`);
  assert.equal(buildFeedUrl({ startup_jobs: { role: '  sre  ' } }), `${BARE_FEED}?role=sre`);
});

test('buildEndpoint: country is a confirmed upstream no-op and is ignored', () => {
  const entry = { provider: 'startup-jobs', startup_jobs: { role: 'platform-engineer', country: 'NL' } };
  assert.equal(buildFeedUrl(entry), `${BARE_FEED}?role=platform-engineer`);
});

test('buildEndpoint: a role cannot smuggle a host or extra params', () => {
  const url = new URL(buildFeedUrl({ startup_jobs: { role: 'x&workplace=evil#@evil.example/' } }));
  assert.equal(url.hostname, 'startup.jobs');
  assert.equal(url.pathname, '/feeds/jobs');
  assert.deepEqual([...url.searchParams.keys()], ['role']);
  assert.equal(url.searchParams.get('role'), 'x&workplace=evil#@evil.example/');
});

test('assertStartupJobsUrl: pins host and HTTPS', () => {
  assert.equal(assertStartupJobsUrl(BARE_FEED), BARE_FEED);
  assert.throws(() => assertStartupJobsUrl('http://startup.jobs/feeds/jobs'), /HTTPS/);
  assert.throws(() => assertStartupJobsUrl('https://evil.example/feeds/jobs'), /untrusted hostname/);
  assert.throws(() => assertStartupJobsUrl('https://startup.jobs.evil.com/feeds/jobs'), /untrusted hostname/);
  assert.throws(() => assertStartupJobsUrl('https://evilstartup.jobs/feeds/jobs'), /untrusted hostname/);
  assert.throws(() => assertStartupJobsUrl('https://api.startup.jobs/feeds/jobs'), /untrusted hostname/);
  assert.throws(() => assertStartupJobsUrl('not a url'), /invalid URL/);
});

test('parse: company/title split, entities, location, utm stripped, date', () => {
  const jobs = parseStartupJobsFeed(sampleXml);
  assert.equal(jobs.length, 2, 'link-less and unattributed rows dropped');
  const [a, b] = jobs;
  assert.equal(a.title, 'Senior Platform Engineer');
  assert.equal(a.company, 'Acme & Co');
  assert.equal(a.location, 'Amsterdam, Netherlands');
  assert.equal(a.url, 'https://startup.jobs/senior-platform-engineer-acme-10260824');
  assert.equal(new URL(a.url).search, '');
  assert.equal(a.id, 'startup-jobs-https://startup.jobs/senior-platform-engineer-acme-10260824');
  assert.equal(a.date, '2026-10-01');
  assert.equal(a.source, 'startup-jobs');
  assert.equal(a.isRemote, false);
  assert.equal(a.workplaceType, '');
  assert.equal(
    a.description,
    'Own the platform that powers the whole engineering org. Amsterdam, Netherlands · €130,000 – €160,000 per year',
  );
  assert.equal(a.snippet, a.description);

  assert.equal(b.title, 'Remote SRE');
  assert.equal(b.company, 'Beta Labs');
  assert.equal(b.location, 'Remote, Germany');
  assert.equal(b.isRemote, true);
  assert.equal(b.workplaceType, 'Remote');
});

test('parse: unattributed title (no " at ") is skipped, not filed under the board', () => {
  const jobs = parseStartupJobsFeed(sampleXml);
  assert.ok(jobs.every((j) => j.title !== 'No At Segment Here'));
  assert.equal(splitTitleCompany('No At Segment Here'), null);
  assert.equal(splitTitleCompany('Role at '), null);
  assert.equal(splitTitleCompany(' at Co'), null);
});

test('parse: splits on the LAST " at " (quirk) and strips a leading "bei "', () => {
  assert.deepEqual(splitTitleCompany('Engineer at Scale at Acme'), { title: 'Engineer at Scale', company: 'Acme' });
  const jobs = parseStartupJobsFeed(wrap(item(
    'Quality Assurance Engineer (m/w/d) - remote DE at bei PROLOGA', 'https://startup.jobs/qa-engineer-prologa-10260833',
  )));
  assert.equal(jobs[0].company, 'PROLOGA');
});

test('parse: entity-encoded "&amp;" in the title decodes', () => {
  const jobs = parseStartupJobsFeed(wrap(item('R&amp;D Engineer at Acme', 'https://startup.jobs/r-and-d-engineer-acme-10260832')));
  assert.equal(jobs[0].title, 'R&D Engineer');
  assert.equal(jobs[0].company, 'Acme');
  assert.ok(jobs[0].title.toLowerCase().includes('r&d'), 'a positive "r&d" title filter would match');
});

test('parse: description markup is stripped; missing/empty description keeps the row', () => {
  const jobs = parseStartupJobsFeed(wrap(
    item('Backend Engineer at Gamma', 'https://startup.jobs/backend-engineer-gamma-10260827',
      '<description>&lt;p&gt;We sponsor &lt;strong&gt;visas&lt;/strong&gt; for this role.&lt;/p&gt;\n\nBerlin, Germany</description>'),
    item('Data Engineer at Delta', 'https://startup.jobs/data-engineer-delta-10260828'),
    item('Designer at Epsilon', 'https://startup.jobs/designer-epsilon-10260829', '<description></description>'),
  ));
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].description, 'We sponsor visas for this role. Berlin, Germany');
  assert.equal(jobs[0].location, 'Berlin, Germany');
  for (const j of jobs.slice(1)) {
    assert.equal('description' in j, false);
    assert.equal(j.location, '');
    assert.equal(j.snippet, '');
  }
});

test('parse: snippet is capped at 500 chars while description stays whole', () => {
  const long = 'word '.repeat(300).trim();
  const jobs = parseStartupJobsFeed(wrap(item('Eng at Co', 'https://startup.jobs/eng-co-1', `<description>${long}</description>`)));
  assert.equal(jobs[0].snippet.length, 500);
  assert.equal(jobs[0].description, long);
});

test('parse: bad dates give an empty date, never throw', () => {
  const jobs = parseStartupJobsFeed(wrap(item('Eng at Co', 'https://startup.jobs/eng-co-1', '<pubDate>not a date</pubDate>')));
  assert.equal(jobs[0].date, '');
});

test('extractLocation: last non-empty line, comp stripped', () => {
  assert.equal(extractLocation(''), '');
  assert.equal(extractLocation('Body\n\nParis, France · $100k'), 'Paris, France');
  assert.equal(extractLocation('Just a location'), 'Just a location');
});

test('envelope validation: malformed bodies throw, never a quiet []', () => {
  assert.throws(() => parseStartupJobsFeed(''), /unexpected feed response/);
  assert.throws(() => parseStartupJobsFeed(null), /unexpected feed response/);
  assert.throws(() => parseStartupJobsFeed(undefined), /unexpected feed response/);
  assert.throws(() => parseStartupJobsFeed('<html><body>502 Bad Gateway</body></html>'), /unexpected feed response/);
  assert.throws(() => parseStartupJobsFeed('<item><title>Bare at Co</title></item>'), /unexpected feed response/);
});

test('envelope validation: a valid empty channel is a genuinely empty board', () => {
  assert.deepEqual(parseStartupJobsFeed('<rss><channel></channel></rss>'), []);
});

test('XML comment mentioning <item> does not false-positive the truncation check', () => {
  assert.deepEqual(parseStartupJobsFeed('<rss><channel><!-- example <item> --></channel></rss>'), []);
});

test('feed truncated mid-item (unclosed <item>) throws', () => {
  const truncated = [
    '<rss><channel>',
    '<item>',
    '  <title>Platform Engineer at Zeta</title>',
    '  <link>https://startup.jobs/platform-engineer-zeta-10260830</link>',
    '</channel></rss>',
  ].join('\n');
  assert.throws(() => parseStartupJobsFeed(truncated), /truncated response/);
});

test('CDATA containing <item>/</item> text neither trips truncation nor cuts the block short', () => {
  const xml = [
    '<rss><channel>',
    '<item>',
    '  <title>XML Integration Engineer at Eta</title>',
    '  <link>https://startup.jobs/xml-integration-engineer-eta-10260831</link>',
    '  <description><![CDATA[Experience with <item> elements and </item> closing tags in RSS feeds.',
    '',
    'Remote, Canada]]></description>',
    '</item>',
    '</channel></rss>',
  ].join('\n');
  const jobs = parseStartupJobsFeed(xml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Eta');
  assert.equal(jobs[0].description, 'Experience with elements and closing tags in RSS feeds. Remote, Canada');
  assert.equal(jobs[0].location, 'Remote, Canada');
});

test('cleanUrl / parse: off-host or non-HTTPS links are dropped', () => {
  assert.equal(cleanUrl('https://startup.jobs/a-1?utm_source=rss'), 'https://startup.jobs/a-1');
  assert.equal(cleanUrl('https://evil.example.com/job/1'), '');
  assert.equal(cleanUrl('https://startup.jobs.evil.com/job/1'), '');
  assert.equal(cleanUrl('https://evilstartup.jobs/job/1'), '');
  assert.equal(cleanUrl('https://api.startup.jobs/job/1'), '');
  assert.equal(cleanUrl('http://startup.jobs/job/1'), '');
  assert.equal(cleanUrl('javascript:alert(1)'), '');
  assert.equal(cleanUrl(''), '');
  assert.equal(cleanUrl(null), '');
  assert.deepEqual(parseStartupJobsFeed(wrap(item('Evil at Co', 'https://evil.example.com/job/1'))), []);
});

test('fetch: one host-pinned request, redirect:error, browser UA, parsed jobs', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return res(sampleXml); };
  const endpoint = startupJobsAdapter.buildEndpoint({ provider: 'startup-jobs', startup_jobs: { role: 'platform-engineer' } });
  const jobs = await startupJobsAdapter.fetch(endpoint, { fetchImpl });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${BARE_FEED}?role=platform-engineer`);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
});

test('fetch: an off-host endpoint is refused before any I/O', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return res(sampleXml); };
  await assert.rejects(fetchStartupJobs('https://evil.example/feeds/jobs', { fetchImpl }), /untrusted hostname/);
  await assert.rejects(fetchStartupJobs('http://startup.jobs/feeds/jobs', { fetchImpl }), /HTTPS/);
  assert.equal(called, false);
});

test('fetch: HTTP errors propagate (unknown role slug = 404 fails loud)', async () => {
  const fetchImpl = async () => res('nope', 404);
  await assert.rejects(
    fetchStartupJobs(`${BARE_FEED}?role=nonsense`, { fetchImpl }),
    (err) => err.status === 404,
  );
});

test('fetch: an HTML error page served with 200 throws instead of reading as empty', async () => {
  const fetchImpl = async () => res('<html><body>maintenance</body></html>');
  await assert.rejects(fetchStartupJobs(BARE_FEED, { fetchImpl }), /unexpected feed response/);
});

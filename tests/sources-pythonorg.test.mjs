/**
 * Python.org Jobs source + adapter — CI-isolated tests (fake fetchImpl, no
 * network, no parent-project dependency, no port binding).
 *
 * Parent career-ops `providers/pythonorg.mjs` parity at its hardened HEAD. The
 * fixtures mirror shapes measured on the live RSS feed — including the ones
 * that decide the source's design, and each of the six commits that hardened
 * it:
 *
 *   a7d9185c  the provider itself (RSS parse, SSRF guard, NaN-safe dates)
 *   7283db62  employer attribution is MANDATORY + careers_url is PARSED
 *   317e4808  the location line goes through the shared htmlToText
 *   6032f86d  detection requires https AND a /jobs path boundary
 *   0622e41e  the description body is sanitized with htmlToText
 *   1102a14a  the location precedes the HTML body with no newline between them
 *
 * URL assertions use extraction + strict equality (never `String.includes` or
 * an unanchored regex over a URL) — CodeQL flags the loose forms.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePythonOrgFeed,
  parseLocation,
  splitTitle,
  cleanUrl,
  assertPythonOrgUrl,
  matchesPythonOrgCareersUrl,
  fetchPythonOrg,
  FEED_URL,
  meta,
} from '../server/lib/sources/pythonorg.mjs';
import { pythonorgAdapter } from '../server/lib/portals/adapters/pythonorg.mjs';

// Shape measured on the live feed: item 1 puts the location on its own line,
// item 2 glues the HTML body straight onto it (the 1102a14a case), item 3 has
// no employer in the title, item 4 has no link, item 5 has an empty title.
const sampleXml = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
  '<title>Python.org Jobs Feed</title>',
  '<link>https://www.python.org/jobs/</link>',
  '<item>',
  '  <title>Agentic Python Engineer, ExampleCo</title>',
  '  <link>https://www.python.org/jobs/8133/</link>',
  '  <description>Remote, Remote/Worldwide, Remote',
  '&lt;p&gt;ExampleCo builds intelligent developer tools.&lt;/p&gt;',
  '  </description>',
  '  <guid>https://www.python.org/jobs/8133/</guid>',
  '  <pubDate>Mon, 14 Sep 2026 08:29:07 +0000</pubDate>',
  '</item>',
  '<item>',
  '  <title>Backend &amp; ML Developer, Acme AI</title>',
  '  <link>https://www.python.org/jobs/8132/</link>',
  '  <description>San Francisco, CA, USA&lt;p&gt;Looking for senior engineers.&lt;/p&gt;</description>',
  '</item>',
  '<item>',
  '  <title>Single Title Without Comma</title>',
  '  <link>https://www.python.org/jobs/8131/</link>',
  '  <description>&lt;p&gt;Description without location line.&lt;/p&gt;</description>',
  '</item>',
  '<item>',
  '  <title>Ghost Role (no link), NoLinkCo</title>',
  '  <description>Somewhere</description>',
  '</item>',
  '<item>',
  '  <title></title>',
  '  <link>https://www.python.org/jobs/8130/</link>',
  '</item>',
  '</channel></rss>',
].join('\n');

/** One `<item>` block, for the single-shape cases below. */
const item = (inner) => `<rss><channel><item>${inner}</item></channel></rss>`;

/** Fake transport: answers every request with `body` and records the call. */
function recorder(body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => body,
    };
  };
  return { impl, calls };
}

// ---------------------------------------------------------------------------
// meta + adapter surface
// ---------------------------------------------------------------------------

test('meta: value/label/region + FEED_URL + adapter id/label', () => {
  assert.equal(meta.value, 'pythonorg');
  assert.equal(meta.label, 'Python.org Jobs');
  assert.equal(meta.region, 'en');
  assert.equal(FEED_URL, 'https://www.python.org/jobs/feed/rss/');
  assert.equal(pythonorgAdapter.id, 'pythonorg');
  assert.equal(pythonorgAdapter.label, 'Python.org Jobs');
  assert.equal(typeof pythonorgAdapter.matches, 'function');
  assert.equal(typeof pythonorgAdapter.buildEndpoint, 'function');
  assert.equal(typeof pythonorgAdapter.fetch, 'function');
});

test('adapter.matches: provider:pythonorg and the board\'s own /jobs careers_url', () => {
  assert.equal(pythonorgAdapter.matches({ name: 'Python.org Jobs', provider: 'pythonorg' }), true);
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://www.python.org/jobs/' }), true);
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://python.org/jobs' }), true);
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://www.python.org/jobs/8133/' }), true);
});

test('adapter.matches: the careers_url is PARSED, not string-matched (parent 7283db62)', () => {
  // The board's address carried in a QUERY PARAMETER of a hostile host is the
  // exact case an unanchored /python\.org\/jobs/ regex would have admitted.
  assert.equal(
    pythonorgAdapter.matches({ careers_url: 'https://evil.com/?redirect=https://python.org/jobs' }),
    false,
  );
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://evilpython.org/jobs/' }), false);
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://python.org.evil.com/jobs/' }), false);
  assert.equal(pythonorgAdapter.matches({ careers_url: 'not-a-valid-url' }), false, 'malformed URL must not throw');
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://example.com' }), false);
  assert.equal(pythonorgAdapter.matches({}), false);
  assert.equal(pythonorgAdapter.matches(null), false);
});

test('adapter.matches: https and a /jobs path BOUNDARY are both required (parent 6032f86d)', () => {
  assert.equal(pythonorgAdapter.matches({ careers_url: 'http://python.org/jobs/' }), false, 'plain HTTP');
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://python.org/jobs-archive' }), false, '/jobs-archive is not /jobs');
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://python.org/jobsearch' }), false);
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://python.org/downloads' }), false);
  // Subdomains of the board are not the board's own jobs page.
  assert.equal(pythonorgAdapter.matches({ careers_url: 'https://docs.python.org/jobs/' }), false);
});

test('matchesPythonOrgCareersUrl: the shared predicate rejects non-strings', () => {
  assert.equal(matchesPythonOrgCareersUrl('https://www.python.org/jobs/'), true);
  assert.equal(matchesPythonOrgCareersUrl(undefined), false);
  assert.equal(matchesPythonOrgCareersUrl(null), false);
  assert.equal(matchesPythonOrgCareersUrl(''), false);
  assert.equal(matchesPythonOrgCareersUrl(42), false);
});

test('adapter.buildEndpoint: returns a STRING (never an object) — default, override, off-host', () => {
  assert.equal(pythonorgAdapter.buildEndpoint({ provider: 'pythonorg' }), FEED_URL);
  assert.equal(typeof pythonorgAdapter.buildEndpoint({ provider: 'pythonorg' }), 'string');

  const mirror = 'https://www.python.org/jobs/feed/rss/?mirror=1';
  assert.equal(pythonorgAdapter.buildEndpoint({ pythonorg: mirror }), mirror);
  assert.equal(pythonorgAdapter.buildEndpoint({ api: mirror }), mirror);

  assert.equal(pythonorgAdapter.buildEndpoint({ api: 'https://evil.com/x' }), FEED_URL, 'off-host ignored');
  assert.equal(pythonorgAdapter.buildEndpoint({ api: 'https://evilpython.org/x' }), FEED_URL, 'prefix-spoof ignored');
  assert.equal(pythonorgAdapter.buildEndpoint({ api: 'https://python.org.evil.com/x' }), FEED_URL, 'suffix-spoof ignored');
  assert.equal(pythonorgAdapter.buildEndpoint({ pythonorg: 'http://www.python.org/x' }), FEED_URL, 'non-HTTPS ignored');
  assert.equal(pythonorgAdapter.buildEndpoint({ api: 'not-a-url' }), FEED_URL, 'malformed ignored');
  assert.equal(pythonorgAdapter.buildEndpoint({}), FEED_URL);
});

// ---------------------------------------------------------------------------
// assertPythonOrgUrl — the hard SSRF guard
// ---------------------------------------------------------------------------

test('assertPythonOrgUrl: accepts the board over HTTPS, apex and www alike', () => {
  assert.equal(assertPythonOrgUrl(FEED_URL), FEED_URL);
  assert.equal(
    assertPythonOrgUrl('https://python.org/jobs/feed/rss/'),
    'https://python.org/jobs/feed/rss/',
  );
});

test('assertPythonOrgUrl: rejects http:// (no downgrade to a plaintext fetch)', () => {
  assert.throws(
    () => assertPythonOrgUrl('http://www.python.org/jobs/feed/rss/'),
    /must use HTTPS/,
  );
});

test('assertPythonOrgUrl: rejects an evil host outright', () => {
  assert.throws(() => assertPythonOrgUrl('https://evil.com/jobs/feed/rss/'), /untrusted hostname/);
  assert.throws(() => assertPythonOrgUrl('https://169.254.169.254/latest/meta-data/'), /untrusted hostname/);
});

test('assertPythonOrgUrl: the allowlist is ANCHORED at both ends', () => {
  // Prefix spoof — `(^|\.)` must refuse a host merely ENDING in python.org.
  assert.throws(() => assertPythonOrgUrl('https://evilpython.org/jobs/feed/rss/'), /untrusted hostname/);
  // Suffix spoof — `$` must refuse a host merely CONTAINING python.org.
  assert.throws(() => assertPythonOrgUrl('https://python.org.evil.com/jobs/feed/rss/'), /untrusted hostname/);
});

test('assertPythonOrgUrl: a malformed URL throws its own error, not a TypeError', () => {
  assert.throws(() => assertPythonOrgUrl('not-a-url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// cleanUrl — the same allowlist applied to feed-supplied links
// ---------------------------------------------------------------------------

test('cleanUrl: accepts python.org HTTPS links, apex and www alike', () => {
  assert.equal(cleanUrl('https://www.python.org/jobs/8000/'), 'https://www.python.org/jobs/8000/');
  assert.equal(cleanUrl('https://python.org/jobs/8000/'), 'https://python.org/jobs/8000/');
  assert.equal(cleanUrl('  https://www.python.org/jobs/8000/  '), 'https://www.python.org/jobs/8000/', 'trimmed');
});

test('cleanUrl: rejects spoofs, http, and junk with \'\' (pins against de-anchoring)', () => {
  assert.equal(cleanUrl('https://evilpython.org/jobs/8000/'), '', 'prefix spoof');
  assert.equal(cleanUrl('https://python.org.evil.com/jobs/8000/'), '', 'suffix spoof');
  assert.equal(cleanUrl('https://evil.com/jobs/8000/'), '');
  assert.equal(cleanUrl('http://www.python.org/jobs/8000/'), '', 'non-HTTPS');
  assert.equal(cleanUrl('/jobs/8000/'), '', 'relative');
  assert.equal(cleanUrl('javascript:alert(1)'), '');
  assert.equal(cleanUrl(''), '');
  assert.equal(cleanUrl(null), '');
  assert.equal(cleanUrl(undefined), '');
});

// ---------------------------------------------------------------------------
// splitTitle — employer attribution is mandatory (parent 7283db62)
// ---------------------------------------------------------------------------

test('splitTitle: "{Role}, {Company}" splits cleanly', () => {
  assert.deepEqual(splitTitle('Agentic Python Engineer, ExampleCo'), {
    title: 'Agentic Python Engineer',
    company: 'ExampleCo',
  });
  assert.deepEqual(splitTitle('  Backend Developer ,  Acme AI  '), {
    title: 'Backend Developer',
    company: 'Acme AI',
  });
});

test('splitTitle: null when no employer can be isolated', () => {
  assert.equal(splitTitle('Single Title Without Comma'), null);
  assert.equal(splitTitle(', OrphanCompany'), null, 'leading comma leaves no role');
  assert.equal(splitTitle('Role Without Employer,'), null, 'trailing comma leaves no employer');
  assert.equal(splitTitle('Role,   '), null);
  assert.equal(splitTitle(''), null);
  assert.equal(splitTitle(null), null);
});

test('splitTitle: splits on the LAST comma — a ported parent quirk', () => {
  // "Senior Engineer, Acme, Inc." therefore attributes to "Inc.". The feed has
  // no separate employer field to disambiguate with, and splitting on the FIRST
  // comma would mis-split the far more common "Engineer, Data" style role.
  assert.deepEqual(splitTitle('Senior Engineer, Acme, Inc.'), {
    title: 'Senior Engineer, Acme',
    company: 'Inc.',
  });
});

// ---------------------------------------------------------------------------
// parseLocation — 317e4808 (htmlToText) + 1102a14a (single-line feeds)
// ---------------------------------------------------------------------------

test('parseLocation: takes the line before the body on a multi-line description', () => {
  assert.equal(
    parseLocation('Remote, Remote/Worldwide, Remote\n<p>Body text.</p>'),
    'Remote, Remote/Worldwide, Remote',
  );
  assert.equal(parseLocation('Berlin, Germany\r\n<p>Body.</p>'), 'Berlin, Germany', 'CRLF too');
});

test('parseLocation: stops at the body when NO newline separates them (parent 1102a14a)', () => {
  assert.equal(parseLocation('San Francisco, CA, USA<p>Looking for senior engineers.</p>'), 'San Francisco, CA, USA');
  // A double-encoded feed leaves the tag as `&lt;p&gt;` after one decode pass.
  assert.equal(parseLocation('Lisbon, Portugal&lt;p&gt;Body.&lt;/p&gt;'), 'Lisbon, Portugal');
  assert.equal(parseLocation('Paris, France<!-- comment -->'), 'Paris, France');
});

test('parseLocation: a description that STARTS with markup has no location line', () => {
  assert.equal(parseLocation('<p>Description without location line.</p>'), '');
  assert.equal(parseLocation('   <div>Body.</div>'), '');
  assert.equal(parseLocation('&lt;p&gt;Body.&lt;/p&gt;'), '');
  assert.equal(parseLocation(''), '');
  assert.equal(parseLocation(null), '');
});

test('parseLocation: normalizes the line through the shared htmlToText (parent 317e4808)', () => {
  // Whitespace is collapsed and the chunk trimmed…
  assert.equal(parseLocation('  Berlin,   Germany  \n<p>Body.</p>'), 'Berlin, Germany');
  // …and a second entity pass runs, so a letter entity lands as the letter
  // rather than as `&eacute;` in the tracker and every generated document.
  assert.equal(parseLocation('Montr&eacute;al, Canada\n<p>Body.</p>'), 'Montréal, Canada');
});

test('parseLocation: markup NEVER reaches the location, even at the cost of truncating', () => {
  // The chunk ends at the FIRST opening tag in either spelling, so a location
  // line that embeds inline markup is cut short there. That is the deliberate
  // trade: `location` is what the location filter matches on, and a paragraph
  // of body prose (or a script tag) in that field is far worse than a short one.
  assert.equal(parseLocation('Oslo, <b>Norway</b>\n<p>Body.</p>'), 'Oslo,');
  assert.equal(parseLocation('Remote &lt;script&gt;alert(1)&lt;/script&gt;'), 'Remote');
});

// ---------------------------------------------------------------------------
// parsePythonOrgFeed — the feed as a whole
// ---------------------------------------------------------------------------

test('parsePythonOrgFeed: keeps only the employer-attributed, linked, titled rows', () => {
  const jobs = parsePythonOrgFeed(sampleXml);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.company), ['ExampleCo', 'Acme AI']);
});

test('parsePythonOrgFeed: a row without an identifiable employer is DROPPED, not backfilled', () => {
  // The parent's Source Indexing Policy: no employer → no listing. It is NOT
  // filed under the portal entry's own name, which is why this source takes no
  // `defaultCompany` fallback at all.
  const xml = item('<title>Engineer Without Company</title><link>https://www.python.org/jobs/9999/</link>');
  assert.deepEqual(parsePythonOrgFeed(xml), []);
});

test('parsePythonOrgFeed: maps the first item into the exact web-ui job shape', () => {
  const [job] = parsePythonOrgFeed(sampleXml);
  assert.deepEqual(Object.keys(job).sort(), [
    'company', 'date', 'id', 'isRemote', 'location', 'relocates',
    'salary', 'snippet', 'source', 'title', 'url', 'workplaceType',
  ]);
  assert.equal(job.title, 'Agentic Python Engineer');
  assert.equal(job.company, 'ExampleCo');
  assert.equal(job.url, 'https://www.python.org/jobs/8133/');
  assert.equal(job.id, 'pythonorg-https://www.python.org/jobs/8133/');
  assert.equal(job.location, 'Remote, Remote/Worldwide, Remote');
  assert.equal(job.date, '2026-09-14');
  assert.equal(job.salary, '');
  assert.equal(job.relocates, false);
  assert.equal(job.source, 'pythonorg');
});

test('parsePythonOrgFeed: decodes XML entities in the title before splitting it', () => {
  const [, job] = parsePythonOrgFeed(sampleXml);
  assert.equal(job.title, 'Backend & ML Developer');
  assert.equal(job.company, 'Acme AI');
  assert.equal(job.url, 'https://www.python.org/jobs/8132/');
});

test('parsePythonOrgFeed: location survives both feed layouts', () => {
  const [multiLine, singleLine] = parsePythonOrgFeed(sampleXml);
  assert.equal(multiLine.location, 'Remote, Remote/Worldwide, Remote');
  assert.equal(singleLine.location, 'San Francisco, CA, USA');
});

test('parsePythonOrgFeed: the body is sanitized into snippet (parent 0622e41e)', () => {
  const [first, second] = parsePythonOrgFeed(sampleXml);
  assert.equal(first.snippet, 'Remote, Remote/Worldwide, Remote ExampleCo builds intelligent developer tools.');
  assert.equal(second.snippet, 'San Francisco, CA, USA Looking for senior engineers.');
  for (const job of [first, second]) {
    assert.ok(!job.snippet.includes('<p>'), 'raw markup leaked into snippet');
    assert.ok(!job.snippet.includes('&lt;'), 'encoded markup leaked into snippet');
  }
});

test('parsePythonOrgFeed: an active-markup body cannot survive into snippet', () => {
  const xml = item([
    '<title>Engineer, EvilCo</title>',
    '<link>https://www.python.org/jobs/7000/</link>',
    '<description>Remote&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=1&gt;</description>',
  ].join(''));
  const [job] = parsePythonOrgFeed(xml);
  assert.equal(job.location, 'Remote');
  assert.ok(!job.snippet.includes('<script'), `snippet kept a script tag: ${job.snippet}`);
  assert.ok(!job.snippet.includes('<img'), `snippet kept an img tag: ${job.snippet}`);
});

test('parsePythonOrgFeed: snippet is capped at 500 chars', () => {
  const xml = item([
    '<title>Engineer, LongCo</title>',
    '<link>https://www.python.org/jobs/7001/</link>',
    `<description>Remote\n&lt;p&gt;${'x'.repeat(2000)}&lt;/p&gt;</description>`,
  ].join(''));
  const [job] = parsePythonOrgFeed(xml);
  assert.equal(job.snippet.length, 500);
});

test('parsePythonOrgFeed: isRemote / workplaceType come from the location line only', () => {
  const [remote, onsite] = parsePythonOrgFeed(sampleXml);
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  // Mixed board with no telecommute flag in the feed: unknown stays '', it is
  // never asserted as "Onsite".
  assert.equal(onsite.isRemote, false);
  assert.equal(onsite.workplaceType, '');
});

test('parsePythonOrgFeed: date is NaN-safe — a missing or junk pubDate yields \'\'', () => {
  const [, noDate] = parsePythonOrgFeed(sampleXml);
  assert.equal(noDate.date, '', 'item with no pubDate');

  const junk = item([
    '<title>Engineer, JunkCo</title>',
    '<link>https://www.python.org/jobs/7002/</link>',
    '<pubDate>not a date</pubDate>',
  ].join(''));
  assert.equal(parsePythonOrgFeed(junk)[0].date, '');
});

test('parsePythonOrgFeed: falls back to dc:date when there is no pubDate', () => {
  const xml = item([
    '<title>Engineer, DublinCore</title>',
    '<link>https://www.python.org/jobs/7003/</link>',
    '<dc:date>2026-02-03T10:00:00Z</dc:date>',
  ].join(''));
  assert.equal(parsePythonOrgFeed(xml)[0].date, '2026-02-03');
});

test('parsePythonOrgFeed: falls back to <guid> when <link> is absent', () => {
  const xml = item([
    '<title>Engineer, GuidCo</title>',
    '<guid>https://www.python.org/jobs/7004/</guid>',
  ].join(''));
  const [job] = parsePythonOrgFeed(xml);
  assert.equal(job.url, 'https://www.python.org/jobs/7004/');
});

test('parsePythonOrgFeed: an OFF-HOST <link> is dropped — feed links are host-controlled', () => {
  const evil = item([
    '<title>Engineer, EvilCo</title>',
    '<link>https://evil.com/jobs/1/</link>',
  ].join(''));
  assert.deepEqual(parsePythonOrgFeed(evil), []);

  // …and a bad link does not poison the rest of the feed.
  const mixed = [
    '<rss><channel>',
    '<item><title>Bad, EvilCo</title><link>https://evil.com/jobs/1/</link></item>',
    '<item><title>Good, GoodCo</title><link>https://www.python.org/jobs/7005/</link></item>',
    '</channel></rss>',
  ].join('');
  const jobs = parsePythonOrgFeed(mixed);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://www.python.org/jobs/7005/');
});

test('parsePythonOrgFeed: unwraps a CDATA title', () => {
  const xml = item([
    '<title><![CDATA[Data Engineer, CDATA Corp]]></title>',
    '<link>https://www.python.org/jobs/7006/</link>',
  ].join(''));
  const [job] = parsePythonOrgFeed(xml);
  assert.equal(job.title, 'Data Engineer');
  assert.equal(job.company, 'CDATA Corp');
});

test('parsePythonOrgFeed: empty / non-string / itemless input yields [] without throwing', () => {
  assert.deepEqual(parsePythonOrgFeed(''), []);
  assert.deepEqual(parsePythonOrgFeed(null), []);
  assert.deepEqual(parsePythonOrgFeed(undefined), []);
  assert.deepEqual(parsePythonOrgFeed(42), []);
  assert.deepEqual(parsePythonOrgFeed({}), []);
  assert.deepEqual(parsePythonOrgFeed('<rss><channel></channel></rss>'), []);
  assert.deepEqual(parsePythonOrgFeed('<html>not a feed at all'), []);
});

// ---------------------------------------------------------------------------
// fetchPythonOrg — one host-pinned request, fake transport
// ---------------------------------------------------------------------------

test('fetchPythonOrg: requests exactly the official feed URL and parses the response', async () => {
  const { impl, calls } = recorder(sampleXml);
  const jobs = await fetchPythonOrg(undefined, { fetchImpl: impl });

  assert.equal(calls.length, 1, 'the feed is a SINGLE request — no pagination');
  assert.equal(calls[0].url, FEED_URL);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].url, 'https://www.python.org/jobs/8133/');
});

test('fetchPythonOrg: sends redirect:"error" — a server-side redirect is an SSRF vector', async () => {
  const { impl, calls } = recorder(sampleXml);
  await fetchPythonOrg(FEED_URL, { fetchImpl: impl });
  assert.equal(calls[0].init.redirect, 'error');
  assert.match(calls[0].init.headers.accept, /application\/rss\+xml/);
});

test('fetchPythonOrg: forwards the abort signal', async () => {
  const { impl, calls } = recorder(sampleXml);
  const controller = new AbortController();
  await fetchPythonOrg(FEED_URL, { fetchImpl: impl, signal: controller.signal });
  assert.equal(calls[0].init.signal, controller.signal);
});

test('fetchPythonOrg: an evil host is rejected BEFORE any request is made', async () => {
  const { impl, calls } = recorder(sampleXml);
  await assert.rejects(
    () => fetchPythonOrg('https://evil.com/jobs/feed/rss/', { fetchImpl: impl }),
    /untrusted hostname/,
  );
  await assert.rejects(
    () => fetchPythonOrg('https://python.org.evil.com/jobs/feed/rss/', { fetchImpl: impl }),
    /untrusted hostname/,
  );
  assert.equal(calls.length, 0, 'the guard must fire before the transport is touched');
});

test('fetchPythonOrg: an http:// endpoint is rejected before any request is made', async () => {
  const { impl, calls } = recorder(sampleXml);
  await assert.rejects(
    () => fetchPythonOrg('http://www.python.org/jobs/feed/rss/', { fetchImpl: impl }),
    /must use HTTPS/,
  );
  assert.equal(calls.length, 0);
});

test('fetchPythonOrg: a dead board surfaces as a failure, not as an empty run', async () => {
  const impl = async () => ({ ok: false, status: 503, headers: { get: () => null }, text: async () => '' });
  await assert.rejects(() => fetchPythonOrg(FEED_URL, { fetchImpl: impl }), /HTTP 503/);
});

test('fetchPythonOrg: honours a host-pinned endpoint override from the adapter', async () => {
  const mirror = 'https://www.python.org/jobs/feed/rss/?mirror=1';
  const { impl, calls } = recorder(sampleXml);
  await fetchPythonOrg(pythonorgAdapter.buildEndpoint({ pythonorg: mirror }), { fetchImpl: impl });
  assert.equal(calls[0].url, mirror);
});

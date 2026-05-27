/**
 * Tests for the generic RSS adapter (v1.62.0).
 *
 * All tests are CI-isolated: HTTP is never hit; a fake fetchImpl is
 * injected. Uses node --test (no external framework).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRss, parseRss } from '../server/lib/sources/rss.mjs';
import { rssAdapter } from '../server/lib/portals/adapters/rss.mjs';

// ── sample RSS payload ───────────────────────────────────────────────

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>LaraJobs</title>
    <link>https://larajobs.com</link>
    <description>Laravel jobs board</description>

    <item>
      <title>Senior Laravel Developer</title>
      <link>https://larajobs.com/job/1</link>
      <guid>https://larajobs.com/job/1</guid>
      <pubDate>Mon, 26 May 2026 12:00:00 +0000</pubDate>
      <description><![CDATA[<p>Great <strong>remote</strong> job for a Senior Laravel Developer.</p>]]></description>
      <dc:creator>Acme Corp</dc:creator>
      <category>Remote</category>
    </item>

    <item>
      <title>Acme Inc — PHP Backend Engineer</title>
      <link>https://larajobs.com/job/2</link>
      <guid>job-2-guid</guid>
      <pubDate>Tue, 27 May 2026 08:00:00 +0000</pubDate>
      <description>On-site PHP role in San Francisco. Visa sponsorship available.</description>
    </item>

    <item>
      <title>Go Engineer at RemoteCo</title>
      <link>https://larajobs.com/job/3</link>
      <guid>job-3-guid</guid>
      <pubDate>Wed, 28 May 2026 09:00:00 +0000</pubDate>
      <description>Fully remote Go position anywhere in the world.</description>
    </item>

    <item>
      <title>HTML Entities &amp; CDATA Test</title>
      <link>https://larajobs.com/job/4</link>
      <guid>job-4-guid</guid>
      <pubDate>Thu, 29 May 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[Role with &lt;special&gt; chars &amp; entities.]]></description>
      <dc:creator>Entity &amp; Co</dc:creator>
    </item>
  </channel>
</rss>`;

// ── helper: fake fetchImpl ───────────────────────────────────────────

function makeFakeFetch(xml) {
  return async () => ({ ok: true, text: async () => xml });
}

// ── fetchRss integration tests ───────────────────────────────────────

test('fetchRss: returns correct number of items', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  assert.equal(jobs.length, 4);
});

test('fetchRss: first item has correct title and url', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  assert.equal(jobs[0].title, 'Senior Laravel Developer');
  assert.equal(jobs[0].url, 'https://larajobs.com/job/1');
});

test('fetchRss: source is "rss" on every item', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  for (const j of jobs) {
    assert.equal(j.source, 'rss', `expected source=rss on "${j.title}"`);
  }
});

test('fetchRss: isRemote=true for item with "remote" in description', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // First item: CDATA description contains "remote"
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
});

test('fetchRss: isRemote=false for plain onsite item (no remote signal)', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // Second item: on-site SF role — no "remote/anywhere/удалённо" in title or desc
  assert.equal(jobs[1].isRemote, false);
  assert.equal(jobs[1].workplaceType, 'Onsite');
});

test('fetchRss: isRemote=true for "anywhere in the world" item', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // Third item: "Fully remote … anywhere in the world"
  assert.equal(jobs[2].isRemote, true);
});

test('fetchRss: relocates=true when description mentions visa sponsorship', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // Second item mentions "Visa sponsorship"
  assert.equal(jobs[1].relocates, true);
});

test('fetchRss: id is stable and starts with "rss-"', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  for (const j of jobs) {
    assert.match(j.id, /^rss-[a-z0-9]+$/);
  }
  // Ids are unique across items
  const ids = jobs.map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
});

test('fetchRss: company from dc:creator', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  assert.equal(jobs[0].company, 'Acme Corp');
});

test('fetchRss: company parsed from "Company — Role" title pattern', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // Second item title: "Acme Inc — PHP Backend Engineer"
  assert.equal(jobs[1].company, 'Acme Inc');
});

test('fetchRss: company parsed from "Role at Company" title pattern', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // Third item title: "Go Engineer at RemoteCo"
  assert.equal(jobs[2].company, 'RemoteCo');
});

test('fetchRss: falls back to feed hostname when no company signal', async () => {
  const minimal = `<rss version="2.0"><channel>
    <item>
      <title>Some Job</title>
      <link>https://example.com/job/99</link>
      <guid>99</guid>
    </item>
  </channel></rss>`;
  const jobs = await fetchRss('https://example.com/feed', {
    fetchImpl: makeFakeFetch(minimal),
  });
  assert.equal(jobs[0].company, 'example.com');
});

test('fetchRss: CDATA is unwrapped and HTML tags stripped from snippet', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // First item: CDATA with <p> and <strong> tags
  assert.doesNotMatch(jobs[0].snippet, /<[^>]+>/);
  assert.ok(jobs[0].snippet.length > 0);
});

test('fetchRss: HTML entities decoded in title and company', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  // Fourth item title has &amp; and CDATA description with &lt; &gt; &amp;
  assert.equal(jobs[3].title, 'HTML Entities & CDATA Test');
  assert.equal(jobs[3].company, 'Entity & Co');
  assert.doesNotMatch(jobs[3].snippet, /&amp;|&lt;|&gt;/);
});

test('fetchRss: pubDate exposed as date field', async () => {
  const jobs = await fetchRss('https://larajobs.com/feed', {
    fetchImpl: makeFakeFetch(SAMPLE_RSS),
  });
  assert.ok(jobs[0].date.length > 0, 'date should be non-empty');
});

test('fetchRss: throws on HTTP error with .status attached', async () => {
  const fakeFetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(
    () => fetchRss('https://larajobs.com/feed', { fetchImpl: fakeFetch }),
    (err) => {
      assert.equal(err.status, 404);
      assert.match(err.message, /404/);
      return true;
    },
  );
});

test('fetchRss: throws on 500 with .status=500', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(
    () => fetchRss('https://x', { fetchImpl: fakeFetch }),
    (err) => {
      assert.equal(err.status, 500);
      return true;
    },
  );
});

// ── parseRss unit tests ──────────────────────────────────────────────

test('parseRss: empty feed returns empty array', () => {
  const jobs = parseRss('<rss version="2.0"><channel></channel></rss>');
  assert.deepEqual(jobs, []);
});

test('parseRss: handles feed with no items gracefully', () => {
  const jobs = parseRss(`<rss version="2.0"><channel>
    <title>Empty Board</title>
  </channel></rss>`);
  assert.equal(jobs.length, 0);
});

// ── rssAdapter contract tests ────────────────────────────────────────

test('rssAdapter: id and label are correct', () => {
  assert.equal(rssAdapter.id, 'rss');
  assert.equal(rssAdapter.label, 'RSS');
});

test('rssAdapter.matches: true for provider=rss', () => {
  assert.equal(rssAdapter.matches({ provider: 'rss', rss: 'https://x/feed' }), true);
});

test('rssAdapter.matches: true for rss field only', () => {
  assert.equal(rssAdapter.matches({ name: 'X', rss: 'https://x/feed' }), true);
});

test('rssAdapter.matches: true for feed_url field only', () => {
  assert.equal(rssAdapter.matches({ name: 'X', feed_url: 'https://x/feed' }), true);
});

test('rssAdapter.matches: false for plain ATS company (no rss/feed_url/provider)', () => {
  assert.equal(rssAdapter.matches({ name: 'Stripe', careers_url: 'https://job-boards.greenhouse.io/stripe' }), false);
});

test('rssAdapter.matches: false for empty company object', () => {
  assert.equal(rssAdapter.matches({}), false);
});

test('rssAdapter.buildEndpoint: returns rss field when present', () => {
  assert.equal(
    rssAdapter.buildEndpoint({ provider: 'rss', rss: 'https://larajobs.com/feed' }),
    'https://larajobs.com/feed',
  );
});

test('rssAdapter.buildEndpoint: falls back to feed_url', () => {
  assert.equal(
    rssAdapter.buildEndpoint({ provider: 'rss', feed_url: 'https://weworkremotely.com/feed' }),
    'https://weworkremotely.com/feed',
  );
});

test('rssAdapter.buildEndpoint: returns null when neither rss nor feed_url set', () => {
  assert.equal(rssAdapter.buildEndpoint({ provider: 'rss' }), null);
});

test('rssAdapter.fetch is the fetchRss function', () => {
  assert.equal(typeof rssAdapter.fetch, 'function');
  assert.equal(rssAdapter.fetch, fetchRss);
});

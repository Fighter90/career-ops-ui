/**
 * Jobspresso source — board-wide remote RSS feed; provider-selected.
 * CI-isolated (fake fetchImpl, no network, no parent-project dependency).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJobspressoFeed,
  fetchJobspresso,
  assertJobspressoUrl,
  FEED_URL,
} from '../server/lib/sources/jobspresso.mjs';
import { jobspressoAdapter } from '../server/lib/portals/adapters/jobspresso.mjs';

// Two good items, one linkless (dropped), one bad-host (dropped).
// The two good items mirror the REAL feed (fetched 2026-10-07): WP Job Manager
// emits namespaced `<job_listing:location>` / `<job_listing:company>` CDATA
// elements — there is no `job_listing_location` (underscore) and no `<category>`
// element — and titles carry no "Company: Role" prefix when the company tag exists.
const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:job_listing="https://jobspresso.co"><channel>
  <item>
    <title>Acme Corp: Senior Frontend Engineer</title>
    <link>https://jobspresso.co/jobs/acme-frontend</link>
    <category>Europe</category>
    <pubDate>Mon, 23 Jun 2026 10:00:00 +0000</pubDate>
  </item>
  <item>
    <title>Backend Developer</title>
    <link>https://jobspresso.co/listings/globex-be</link>
    <job_listing:location><![CDATA[Worldwide]]></job_listing:location>
    <job_listing:company><![CDATA[Globex]]></job_listing:company>
  </item>
  <item>
    <title>No Link Dropped</title>
  </item>
  <item>
    <title>Bad Host</title>
    <link>https://evil.com/steal</link>
  </item>
</channel></rss>`;

test('parseJobspressoFeed: Company:Role split, CDATA, location, drops bad/linkless', () => {
  const jobs = parseJobspressoFeed(RSS);
  assert.equal(jobs.length, 2); // evil.com + no-link dropped
  const [first, second] = jobs;

  // First item
  assert.equal(first.company, 'Acme Corp');
  assert.equal(first.title, 'Senior Frontend Engineer');
  assert.equal(first.location, 'Europe');
  assert.equal(first.date, '2026-06-23');
  assert.equal(first.isRemote, true);
  assert.equal(first.workplaceType, 'Remote');
  assert.equal(first.relocates, false);
  assert.equal(first.salary, '');
  assert.equal(first.snippet, '');
  assert.equal(first.source, 'jobspresso');
  assert.ok(first.id.startsWith('jobspresso-'));
  assert.equal(first.url, 'https://jobspresso.co/jobs/acme-frontend');

  // Second item — the REAL feed: namespaced job_listing tags. The company
  // comes from <job_listing:company> and the title is used as-is.
  assert.equal(second.company, 'Globex');
  assert.equal(second.title, 'Backend Developer');
  assert.equal(second.location, 'Worldwide');
});

test('parseJobspressoFeed: job_listing:company wins over the title colon-split', () => {
  const xml = `<rss><channel>
    <item>
      <title>Initech: Support Engineer</title>
      <link>https://jobspresso.co/jobs/initech-support</link>
      <job_listing:company><![CDATA[Initech LLC]]></job_listing:company>
      <job_listing:location><![CDATA[Austin, TX]]></job_listing:location>
    </item>
  </channel></rss>`;
  const [job] = parseJobspressoFeed(xml);
  assert.equal(job.company, 'Initech LLC'); // the structured tag, not the title prefix
  assert.equal(job.title, 'Initech: Support Engineer'); // title untouched
  assert.equal(job.location, 'Austin, TX');
});

test('parseJobspressoFeed: location falls back to category, then Remote', () => {
  const xml = `<rss><channel>
    <item>
      <title>Tagless Role</title>
      <link>https://jobspresso.co/jobs/tagless</link>
    </item>
  </channel></rss>`;
  assert.equal(parseJobspressoFeed(xml)[0].location, 'Remote');
});

test('parseJobspressoFeed: unsplittable title uses fallback company', () => {
  const xml = `<rss><channel>
    <item>
      <title>Solo Role No Colon</title>
      <link>https://jobspresso.co/jobs/solo</link>
    </item>
  </channel></rss>`;
  const jobs = parseJobspressoFeed(xml, 'My Board');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'My Board');
  assert.equal(jobs[0].title, 'Solo Role No Colon');
});

test('parseJobspressoFeed: default fallback when no fallbackCompany given', () => {
  const xml = `<rss><channel>
    <item>
      <title>Plain Title</title>
      <link>https://jobspresso.co/jobs/plain</link>
    </item>
  </channel></rss>`;
  const jobs = parseJobspressoFeed(xml);
  assert.equal(jobs[0].company, 'Jobspresso');
});

test('parseJobspressoFeed: 12-field shape present on every job', () => {
  const jobs = parseJobspressoFeed(RSS);
  const FIELDS = ['id', 'title', 'company', 'url', 'salary', 'location', 'isRemote',
    'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const job of jobs) {
    for (const f of FIELDS) {
      assert.ok(Object.prototype.hasOwnProperty.call(job, f), `missing field: ${f}`);
    }
  }
});

test('parseJobspressoFeed: XML entity decoding', () => {
  const xml = `<rss><channel>
    <item>
      <title>Smith &amp; Co: Engineer &lt;Senior&gt;</title>
      <link>https://jobspresso.co/jobs/smith</link>
    </item>
  </channel></rss>`;
  const jobs = parseJobspressoFeed(xml);
  assert.equal(jobs[0].company, 'Smith & Co');
  assert.equal(jobs[0].title, 'Engineer <Senior>');
});

test('parseJobspressoFeed: id is stable hash of URL', () => {
  const jobs = parseJobspressoFeed(RSS);
  // Same URL must produce the same id across two parses
  const jobs2 = parseJobspressoFeed(RSS);
  assert.equal(jobs[0].id, jobs2[0].id);
  // Different URLs produce different ids
  assert.notEqual(jobs[0].id, jobs[1].id);
});

test('fetchJobspresso: normalizes via fake fetchImpl', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => RSS });
  const jobs = await fetchJobspresso(FEED_URL, { fetchImpl });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.isRemote && j.source === 'jobspresso'));
});

test('fetchJobspresso: a 200 HTML challenge page throws instead of reading as an empty board', async () => {
  const challenge = '<html><head><title>Access denied</title></head><body>Checking your browser…</body></html>';
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => challenge });
  await assert.rejects(() => fetchJobspresso(FEED_URL, { fetchImpl }), /challenge page/);
});

test('fetchJobspresso: a 200 non-feed body throws (no silent zero)', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => 'Not Found' });
  await assert.rejects(() => fetchJobspresso(FEED_URL, { fetchImpl }), /answered no feed/);
});

test('assertJobspressoUrl: pins host to jobspresso.co', () => {
  assert.equal(assertJobspressoUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertJobspressoUrl('https://evil.com/feed'), /untrusted hostname/);
  assert.throws(() => assertJobspressoUrl('http://jobspresso.co/feed'), /must use HTTPS/);
  assert.throws(() => assertJobspressoUrl('not-a-url'), /invalid URL/);
});

test('adapter: matches only on provider=jobspresso, fixed feed endpoint', () => {
  assert.ok(jobspressoAdapter.matches({ provider: 'jobspresso' }));
  assert.equal(jobspressoAdapter.matches({ careers_url: 'https://jobspresso.co' }), false);
  assert.equal(jobspressoAdapter.matches({ provider: 'other' }), false);
  assert.equal(jobspressoAdapter.buildEndpoint({ provider: 'jobspresso' }), FEED_URL);
  // Override via jobspresso or api fields
  assert.equal(
    jobspressoAdapter.buildEndpoint({ provider: 'jobspresso', jobspresso: 'https://jobspresso.co/custom-feed' }),
    'https://jobspresso.co/custom-feed',
  );
  assert.equal(
    jobspressoAdapter.buildEndpoint({ provider: 'jobspresso', api: 'https://jobspresso.co/alt' }),
    'https://jobspresso.co/alt',
  );
});

test('adapter: id and label', () => {
  assert.equal(jobspressoAdapter.id, 'jobspresso');
  assert.equal(jobspressoAdapter.label, 'Jobspresso');
});

test('meta: value, label, region', async () => {
  const { meta } = await import('../server/lib/sources/jobspresso.mjs');
  assert.equal(meta.value, 'jobspresso');
  assert.equal(meta.label, 'Jobspresso');
  assert.equal(meta.region, 'en');
});

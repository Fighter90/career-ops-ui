/**
 * We Work Remotely source — CI-isolated test for the v1.242.0 Phase-2 shape
 * rule: a 200 whose body is not RSS (Cloudflare/WAF challenge HTML, a JSON
 * error page) must THROW, not parse as an empty board. Feed parsing itself is
 * covered by tests/weworkremotely-source.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWwrFeed, fetchWeWorkRemotely, FEED_URL } from '../server/lib/sources/weworkremotely.mjs';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>Acme: Go Engineer</title><link>https://weworkremotely.com/remote-jobs/acme-go</link></item>
</channel></rss>`;

const okText = (body) => async () => ({ ok: true, text: async () => body });

test('fetchWeWorkRemotely: throws on a challenge-HTML 200 (no <rss> marker)', async () => {
  await assert.rejects(
    () => fetchWeWorkRemotely(FEED_URL, { fetchImpl: okText('<!doctype html><html><body>Just a moment…</body></html>') }),
    (err) => {
      assert.match(err.message, /weworkremotely/);
      assert.match(err.message, /RSS/);
      return true;
    },
  );
});

test('fetchWeWorkRemotely: throws on a JSON-error 200', async () => {
  await assert.rejects(
    () => fetchWeWorkRemotely(FEED_URL, { fetchImpl: okText('{"error":"rate limited"}') }),
    /RSS/,
  );
});

test('fetchWeWorkRemotely: a valid feed with zero items is a legit empty board', () => {
  const jobs = parseWwrFeed('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
  assert.deepEqual(jobs, []);
});

test('fetchWeWorkRemotely: still parses a normal feed', async () => {
  const jobs = await fetchWeWorkRemotely(FEED_URL, { fetchImpl: okText(RSS) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Go Engineer');
});

// ── Description passthrough (parent #6568) ─────────────────────────────────
// Every item's <description> carries the posting's HTML, in the feed already
// fetched. The row must carry it as plain text so the en-scanner's
// content_filter (`j.description ?? j.snippet`) can read it.

test('parseWwrFeed: an entity-escaped description arrives as plain text with entities decoded', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title>Acme: Go Engineer</title>
    <link>https://weworkremotely.com/remote-jobs/acme-go</link>
    <description>&lt;p&gt;&lt;strong&gt;Requirements:&lt;/strong&gt; Go &amp;amp; Postgres&lt;/p&gt;&lt;p&gt;Remote-first.&lt;/p&gt;</description>
  </item>
</channel></rss>`;
  const jobs = parseWwrFeed(xml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, 'Requirements: Go & Postgres Remote-first.');
});

test('parseWwrFeed: a CDATA description arrives as plain text too', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title><![CDATA[Globex: Support Engineer]]></title>
    <link>https://weworkremotely.com/remote-jobs/globex-support</link>
    <description><![CDATA[<p>We run <b>Intercom</b> for customers.</p>]]></description>
  </item>
</channel></rss>`;
  const jobs = parseWwrFeed(xml);
  assert.equal(jobs.length, 1);
  assert.ok(jobs[0].description.includes('Intercom'), 'the body keyword must reach the row');
  assert.equal(jobs[0].description, 'We run Intercom for customers.');
});

test('parseWwrFeed: absent, empty, whitespace or markup-only description stays empty', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>A: One</title><link>https://weworkremotely.com/remote-jobs/one</link></item>
  <item><title>A: Two</title><link>https://weworkremotely.com/remote-jobs/two</link><description></description></item>
  <item><title>A: Three</title><link>https://weworkremotely.com/remote-jobs/three</link><description>   </description></item>
  <item><title>A: Four</title><link>https://weworkremotely.com/remote-jobs/four</link><description>&lt;br&gt;&lt;img src="x"&gt;</description></item>
</channel></rss>`;
  const jobs = parseWwrFeed(xml);
  assert.deepEqual(jobs.map((j) => j.description), ['', '', '', '']);
});

/**
 * LaraJobs source — CI-isolated tests (fake fetchImpl, no network).
 *
 * v1.242.0: a 200 that is not the feed (a Cloudflare challenge, an HTML error
 * page, an empty body) has no <item>s and read as an empty board forever —
 * fetchLarajobs now throws unless the body carries the RSS skeleton.
 * (<rss / <channel). The pure parser stays tolerant: sources-parity-v1118c
 * pins parseLarajobsFeed('', null, and bare-item XML as non-throwing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLarajobsFeed,
  fetchLarajobs,
  assertLarajobsUrl,
  FEED_URL,
  meta,
} from '../server/lib/sources/larajobs.mjs';

const RSS = `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Senior Laravel Engineer</title>
    <link>https://larajobs.com/job/101</link>
    <pubDate>Thu, 02 Jul 2026 00:00:00 +0000</pubDate>
    <job:company>Acme PHP</job:company>
    <job:location>Remote (EU)</job:location>
  </item>
  <item>
    <title>PHP Backend Developer</title>
    <link>https://larajobs.com/job/102</link>
    <dc:creator>Creator Co</dc:creator>
  </item>
  <item>
    <title>Ghost Job</title>
  </item>
  <item>
    <title>Bad Host</title>
    <link>https://evil.com/job/1</link>
  </item>
</channel></rss>`;

const fakeText = (body) => async () => ({ ok: true, text: async () => body });

// ---------------------------------------------------------------------------
// parseLarajobsFeed — tolerant pure parser
// ---------------------------------------------------------------------------

test('parseLarajobsFeed: job: namespace company/location, dc:creator fallback, drops bad rows', () => {
  const jobs = parseLarajobsFeed(RSS, 'LaraJobs');
  assert.equal(jobs.length, 2); // ghost (no link) + off-host link dropped
  assert.equal(jobs[0].title, 'Senior Laravel Engineer');
  assert.equal(jobs[0].company, 'Acme PHP');
  assert.equal(jobs[0].url, 'https://larajobs.com/job/101');
  assert.equal(jobs[0].location, 'Remote (EU)');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[0].date, '2026-07-02');
  assert.equal(jobs[0].source, 'larajobs');
  assert.equal(jobs[1].company, 'Creator Co'); // dc:creator fallback
  assert.equal(jobs[1].location, '');
  assert.equal(jobs[1].isRemote, false);
});

test('parseLarajobsFeed: empty/non-string bodies stay tolerant (no throw)', () => {
  assert.deepEqual(parseLarajobsFeed('', 'X'), []);
  assert.deepEqual(parseLarajobsFeed(null, 'X'), []);
});

// ---------------------------------------------------------------------------
// fetchLarajobs — the feed guard
// ---------------------------------------------------------------------------

test('fetchLarajobs: a non-feed 200 (challenge/error page) throws, never reads as an empty board', async () => {
  await assert.rejects(
    () => fetchLarajobs(FEED_URL, { fetchImpl: fakeText('<!DOCTYPE html><html><body>Checking your browser…</body></html>') }),
    /larajobs: response is not an RSS feed/,
  );
  await assert.rejects(
    () => fetchLarajobs(FEED_URL, { fetchImpl: fakeText('') }),
    /not an RSS feed/,
  );
});

test('fetchLarajobs: a real feed still normalizes', async () => {
  const jobs = await fetchLarajobs(FEED_URL, { fetchImpl: fakeText(RSS) });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.source === 'larajobs' && new URL(j.url).hostname === 'larajobs.com'));
});

// ---------------------------------------------------------------------------
// assertLarajobsUrl — host pin
// ---------------------------------------------------------------------------

test('assertLarajobsUrl: pins the exact larajobs.com host over HTTPS', () => {
  assert.equal(assertLarajobsUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertLarajobsUrl('https://evil.com/feed'), /untrusted hostname/);
  assert.throws(() => assertLarajobsUrl('https://larajobs.com.evil.com/feed'), /untrusted hostname/);
  assert.throws(() => assertLarajobsUrl('http://larajobs.com/feed'), /must use HTTPS/);
  assert.throws(() => assertLarajobsUrl('not a url'), /invalid URL/);
});

test('meta: id/label/region', () => {
  assert.deepEqual(meta, { value: 'larajobs', label: 'LaraJobs', region: 'en' });
});

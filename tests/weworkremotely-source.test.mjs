/**
 * We Work Remotely source (v1.79.0 — parent career-ops v1.14.0 parity).
 * Board-wide remote RSS feed; provider-selected. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWwrFeed, fetchWeWorkRemotely, assertWwrUrl, FEED_URL } from '../server/lib/sources/weworkremotely.mjs';
import { weworkremotelyAdapter } from '../server/lib/portals/adapters/weworkremotely.mjs';

const RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>Acme: Senior Go Engineer</title><link>https://weworkremotely.com/remote-jobs/acme-go</link><region>Europe</region><pubDate>Wed, 25 Jun 2026 00:00:00 +0000</pubDate></item>
  <item><title><![CDATA[Globex: Backend Developer]]></title><link>https://weworkremotely.com/listings/globex-be</link><category>Anywhere</category></item>
  <item><title>Just A Title No Company</title><link>https://weworkremotely.com/remote-jobs/solo</link></item>
  <item><title>No Link Dropped</title></item>
  <item><title>Bad Host</title><link>https://evil.com/x</link></item>
</channel></rss>`;

test('parseWwrFeed: Company:Role split, CDATA, region/category location, drops bad/linkless', () => {
  const jobs = parseWwrFeed(RSS);
  assert.equal(jobs.length, 3); // evil.com + no-link dropped
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].title, 'Senior Go Engineer');
  assert.equal(jobs[0].location, 'Europe');
  assert.equal(jobs[0].date, '2026-06-25');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[0].source, 'weworkremotely');
  assert.equal(jobs[1].company, 'Globex'); // CDATA split
  assert.equal(jobs[2].company, 'We Work Remotely'); // unsplittable → fallback
});

test('parseWwrFeed: custom fallback company for unsplittable titles', () => {
  const jobs = parseWwrFeed('<rss><channel><item><title>Solo Role</title><link>https://weworkremotely.com/x</link></item></channel></rss>', 'My Board');
  assert.equal(jobs[0].company, 'My Board');
});

test('fetchWeWorkRemotely: normalizes via fake fetchImpl', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => RSS });
  const jobs = await fetchWeWorkRemotely(FEED_URL, { fetchImpl });
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every((j) => j.isRemote && j.source === 'weworkremotely'));
});

test('assertWwrUrl: pins host to weworkremotely.com', () => {
  assert.equal(assertWwrUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertWwrUrl('https://evil.com/remote-jobs.rss'), /untrusted hostname/);
  assert.throws(() => assertWwrUrl('http://weworkremotely.com/x'), /must use HTTPS/);
});

test('adapter: matches only on provider=weworkremotely, fixed feed endpoint', () => {
  assert.ok(weworkremotelyAdapter.matches({ provider: 'weworkremotely' }));
  assert.equal(weworkremotelyAdapter.matches({ careers_url: 'https://weworkremotely.com' }), false);
  assert.equal(weworkremotelyAdapter.buildEndpoint({ provider: 'weworkremotely' }), FEED_URL);
});

/**
 * NoDesk source (v1.82.0 — parent career-ops v1.15.0 parity).
 * Board-wide remote RSS feed; provider-selected. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNodeskFeed,
  fetchNodesk,
  assertNodeskUrl,
  FEED_URL,
  meta,
} from '../server/lib/sources/nodesk.mjs';
import { nodeskAdapter } from '../server/lib/portals/adapters/nodesk.mjs';

const RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>Senior Go Engineer at Acme</title><link>https://nodesk.co/remote-jobs/senior-go-acme</link><pubDate>Wed, 25 Jun 2026 00:00:00 +0000</pubDate></item>
  <item><title><![CDATA[Backend Developer at Globex]]></title><link>https://nodesk.co/remote-jobs/backend-globex</link></item>
  <item><title>Just A Title No Company</title><link>https://nodesk.co/remote-jobs/solo</link></item>
  <item><title>No Link Dropped at Nowhere</title></item>
  <item><title>Bad Host at Evil</title><link>https://evil.com/x</link></item>
</channel></rss>`;

test('parseNodeskFeed: "Role at Company" split, CDATA, drops bad/linkless rows', () => {
  const jobs = parseNodeskFeed(RSS);
  assert.equal(jobs.length, 3); // evil.com + no-link dropped
  assert.equal(jobs[0].title, 'Senior Go Engineer');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].location, ''); // NoDesk has no location tag
  assert.equal(jobs[0].date, '2026-06-25');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[0].source, 'nodesk');
  assert.equal(jobs[0].id, 'nodesk-https://nodesk.co/remote-jobs/senior-go-acme');
  assert.equal(jobs[1].title, 'Backend Developer'); // CDATA split
  assert.equal(jobs[1].company, 'Globex');
  assert.equal(jobs[2].company, 'NoDesk'); // unsplittable → fallback
  assert.equal(jobs[2].title, 'Just A Title No Company');
});

test('parseNodeskFeed: splits on the LAST " at " and honors custom fallback company', () => {
  const xml = '<rss><channel><item><title>Engineer at Data at Scale</title><link>https://nodesk.co/x</link></item>' +
              '<item><title>Solo Role</title><link>https://nodesk.co/y</link></item></channel></rss>';
  const jobs = parseNodeskFeed(xml, 'My Board');
  assert.equal(jobs[0].title, 'Engineer at Data');
  assert.equal(jobs[0].company, 'Scale');
  assert.equal(jobs[1].company, 'My Board');
});

test('fetchNodesk: normalizes via fake fetchImpl (fetchText path)', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => RSS });
  const jobs = await fetchNodesk(FEED_URL, { fetchImpl });
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every((j) => j.isRemote && j.source === 'nodesk'));
  assert.ok(jobs.every((j) => new URL(j.url).hostname === 'nodesk.co'));
});

test('fetchNodesk: threads company.name as the fallback company', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => '<rss><channel><item><title>Solo Role</title><link>https://nodesk.co/z</link></item></channel></rss>' });
  const jobs = await fetchNodesk(FEED_URL, { fetchImpl, company: { name: 'Threaded Co' } });
  assert.equal(jobs[0].company, 'Threaded Co');
});

// ---------------------------------------------------------------------------
// v1.242.0 — a 200 that is not the feed throws instead of reading as empty
// ---------------------------------------------------------------------------

test('fetchNodesk: a non-feed 200 (challenge/error page) throws, never reads as an empty board', async () => {
  await assert.rejects(
    () => fetchNodesk(FEED_URL, {
      fetchImpl: async () => ({ ok: true, text: async () => '<!DOCTYPE html><html><body>Just a moment…</body></html>' }),
    }),
    /nodesk: response is not an RSS feed/,
  );
  await assert.rejects(
    () => fetchNodesk(FEED_URL, { fetchImpl: async () => ({ ok: true, text: async () => '' }) }),
    /not an RSS feed/,
  );
});

test('fetchNodesk: parse stays tolerant — a feed with zero items is an empty board', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => '<?xml version="1.0"?><rss><channel><title>NoDesk</title></channel></rss>' });
  const jobs = await fetchNodesk(FEED_URL, { fetchImpl });
  assert.deepEqual(jobs, []);
});

test('assertNodeskUrl: pins host to nodesk.co over HTTPS', () => {
  assert.equal(assertNodeskUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertNodeskUrl('https://evil.com/remote-jobs/index.xml'), /untrusted hostname/);
  assert.throws(() => assertNodeskUrl('http://nodesk.co/remote-jobs/index.xml'), /must use HTTPS/);
  assert.throws(() => assertNodeskUrl('not a url'), /invalid URL/);
});

test('adapter: matches only on provider=nodesk; never careers_url', () => {
  assert.ok(nodeskAdapter.matches({ provider: 'nodesk' }));
  assert.equal(nodeskAdapter.matches({ careers_url: 'https://nodesk.co' }), false);
  assert.equal(nodeskAdapter.matches({}), false);
});

test('adapter.buildEndpoint: FEED_URL by default; honors on-host override; rejects off-host', () => {
  assert.equal(nodeskAdapter.buildEndpoint({ provider: 'nodesk' }), FEED_URL);
  const mirror = 'https://nodesk.co/remote-jobs/index.xml?mirror=1';
  assert.equal(nodeskAdapter.buildEndpoint({ nodesk: mirror }), mirror);
  assert.equal(nodeskAdapter.buildEndpoint({ api: 'https://evil.com/index.xml' }), FEED_URL);
  assert.equal(nodeskAdapter.buildEndpoint({ api: 'http://nodesk.co/index.xml' }), FEED_URL);
  // Subdomain override is rejected too — the adapter's host rule matches the
  // source's exact-host assertNodeskUrl, so what the adapter accepts always fetches.
  assert.equal(nodeskAdapter.buildEndpoint({ nodesk: 'https://sub.nodesk.co/index.xml' }), FEED_URL);
});

test('meta: id/label/region', () => {
  assert.equal(meta.value, 'nodesk');
  assert.equal(meta.label, 'NoDesk');
  assert.equal(meta.region, 'en');
  assert.equal(nodeskAdapter.id, 'nodesk');
});

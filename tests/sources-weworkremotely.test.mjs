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

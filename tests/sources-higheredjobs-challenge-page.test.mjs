/**
 * higheredjobs parent parity (#3637): an Incapsula challenge page answered
 * with 200 must be an error, not an empty board. Stubbed transport only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchHigherEdJobs, feedUrlFor } from '../server/lib/sources/higheredjobs.mjs';

const textResponse = (s) => ({ ok: true, status: 200, text: async () => s });
const fetchWith = (body) => fetchHigherEdJobs(feedUrlFor(), { fetchImpl: async () => textResponse(body), company: { name: 'HEJ Board' } });

test('challenge page throws instead of reading as an empty board', async () => {
  const challenge = '<html>\n<head>\n<META NAME="robots" CONTENT="noindex,nofollow">\n<script src="/_Incapsula_Resource?SWJIYLWA=x">\n</script>\n<body>\n</body></html>\n';
  await assert.rejects(() => fetchWith(challenge), /challenge page, not a feed/);
});

test('empty body throws "answered no feed"', async () => {
  await assert.rejects(() => fetchWith(''), /answered no feed/);
});

test('a real feed with no items stays an empty board', async () => {
  const jobs = await fetchWith('<?xml version="1.0"?>\n<rss version="2.0"><channel><title>HEJ</title></channel></rss>');
  assert.deepEqual(jobs, []);
});

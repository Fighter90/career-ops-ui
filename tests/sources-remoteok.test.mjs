/**
 * RemoteOK source — description passthrough suite (parent #6565 parity).
 *
 * Every row of RemoteOK's feed carries the posting's HTML in `description`,
 * in the response the provider already fetches. The row must carry it as
 * plain text so the en-scanner's content_filter (`j.description ?? j.snippet`)
 * and the years_min reader can match on it. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRemoteOk } from '../server/lib/sources/remoteok.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });

const ROW = { id: 1, position: 'ML Engineer', company: 'Acme', url: 'https://remoteok.com/l/1', location: 'Worldwide' };

test('fetchRemoteOk: the HTML description reaches the row as plain text with entities decoded', async () => {
  const feed = [
    { legal: 'meta' },
    { ...ROW, description: '<p><strong>Requirements:</strong> Rust &amp; Kubernetes experience</p><p>Remote-first.</p>' },
  ];
  const jobs = await fetchRemoteOk(undefined, { fetchImpl: okJson(feed) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, 'Requirements: Rust & Kubernetes experience Remote-first.');
});

test('fetchRemoteOk: the description text is matchable by the content_filter contract', async () => {
  // The scanner reads j.description ?? j.snippet — a keyword in the posting
  // body must be findable in the row the fetch returns.
  const feed = [
    { legal: 'meta' },
    { ...ROW, description: '<p>We build payment rails with <b>Stripe</b> and <b>Plaid</b>.</p>' },
  ];
  const jobs = await fetchRemoteOk(undefined, { fetchImpl: okJson(feed) });
  assert.ok(jobs[0].description.includes('Stripe'), 'the body keyword must reach the row');
  // Script/style contents are dropped, not passed through as text.
  const noisy = [
    { legal: 'meta' },
    { ...ROW, url: 'https://remoteok.com/l/2', description: '<script>var x="Stripe";</script><p>No mention here.</p>' },
  ];
  const jobs2 = await fetchRemoteOk(undefined, { fetchImpl: okJson(noisy) });
  assert.equal(jobs2[0].description, 'No mention here.');
});

test('fetchRemoteOk: absent, empty, whitespace, non-string or markup-only description stays empty', async () => {
  const feed = [
    { legal: 'meta' },
    { ...ROW, url: 'https://remoteok.com/l/1' }, // absent
    { ...ROW, url: 'https://remoteok.com/l/2', description: '' }, // empty
    { ...ROW, url: 'https://remoteok.com/l/3', description: '   ' }, // whitespace
    { ...ROW, url: 'https://remoteok.com/l/4', description: null }, // non-string
    { ...ROW, url: 'https://remoteok.com/l/5', description: '<br><img src="x">' }, // markup-only → no text
  ];
  const jobs = await fetchRemoteOk(undefined, { fetchImpl: okJson(feed) });
  assert.deepEqual(jobs.map((j) => j.description), ['', '', '', '', '']);
});

test('fetchRemoteOk: description normalization does not disturb the pinned fields', async () => {
  const feed = [
    { legal: 'meta' },
    { ...ROW, description: '<p>Body text</p>' },
  ];
  const jobs = await fetchRemoteOk(undefined, { fetchImpl: okJson(feed) });
  const j = jobs[0];
  assert.equal(j.title, 'ML Engineer');
  assert.equal(j.company, 'Acme');
  assert.equal(j.url, 'https://remoteok.com/l/1');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.snippet, '');
  assert.equal(j.source, 'remoteok');
});

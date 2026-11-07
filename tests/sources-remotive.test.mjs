/**
 * Remotive source — description passthrough suite (parent #6566 parity).
 *
 * Every job in Remotive's feed carries the posting's HTML in `description`,
 * in the response the provider already fetches. The row must carry it as
 * plain text so the en-scanner's content_filter (`j.description ?? j.snippet`)
 * and the years_min reader can match on it. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRemotive } from '../server/lib/sources/remotive.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });

const ROW = { id: 1, title: 'AI Engineer', company_name: 'Gamma', url: 'https://remotive.com/j/1', candidate_required_location: 'EU' };

test('fetchRemotive: the HTML description reaches the row as plain text with entities decoded', async () => {
  const feed = {
    jobs: [
      { ...ROW, description: '<p><strong>Requirements:</strong> Python &amp; LLM evaluation</p><p>Remote.</p>' },
    ],
  };
  const jobs = await fetchRemotive(undefined, { fetchImpl: okJson(feed) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, 'Requirements: Python & LLM evaluation Remote.');
});

test('fetchRemotive: the description text is matchable by the content_filter contract', async () => {
  const feed = {
    jobs: [
      { ...ROW, description: '<p>Experience with <b>vector databases</b> required.</p>' },
    ],
  };
  const jobs = await fetchRemotive(undefined, { fetchImpl: okJson(feed) });
  assert.ok(jobs[0].description.includes('vector databases'), 'the body keyword must reach the row');
});

test('fetchRemotive: absent, empty, whitespace, non-string or markup-only description stays empty', async () => {
  const feed = {
    jobs: [
      { ...ROW, url: 'https://remotive.com/j/1' }, // absent
      { ...ROW, url: 'https://remotive.com/j/2', description: '' }, // empty
      { ...ROW, url: 'https://remotive.com/j/3', description: '   ' }, // whitespace
      { ...ROW, url: 'https://remotive.com/j/4', description: 42 }, // non-string
      { ...ROW, url: 'https://remotive.com/j/5', description: '<br><img src="x">' }, // markup-only
    ],
  };
  const jobs = await fetchRemotive(undefined, { fetchImpl: okJson(feed) });
  assert.deepEqual(jobs.map((j) => j.description), ['', '', '', '', '']);
});

test('fetchRemotive: description normalization does not disturb the pinned fields', async () => {
  const feed = { jobs: [{ ...ROW, description: '<p>Body text</p>' }] };
  const jobs = await fetchRemotive(undefined, { fetchImpl: okJson(feed) });
  const j = jobs[0];
  assert.equal(j.title, 'AI Engineer');
  assert.equal(j.company, 'Gamma');
  assert.equal(j.url, 'https://remotive.com/j/1');
  assert.equal(j.location, 'EU');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.snippet, '');
  assert.equal(j.source, 'remotive');
});

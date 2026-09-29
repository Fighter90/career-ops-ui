/**
 * Greenhouse embed boards — careers_url → boards-api slug (parent 3e028d9).
 *
 * An embed board (`…greenhouse.io/embed/job_board?for=<slug>`) carries the
 * board token in `?for=`; the path segment is literally `embed`, which names no
 * board. `?for=` is honoured ONLY on a genuine Greenhouse host — on any other
 * site it is an unrelated param and must not select another company's board.
 * CI-isolated: pure URL parsing, no network, no parent checkout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greenhouseAdapter } from '../server/lib/portals/adapters/greenhouse.mjs';

const ep = (careers_url) => greenhouseAdapter.buildEndpoint({ name: 'X', careers_url });
const API = (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

test('embed board on job-boards.greenhouse.io reads the slug from ?for=', () => {
  const url = 'https://job-boards.greenhouse.io/embed/job_board?for=stripe';
  assert.equal(ep(url), API('stripe'));
  assert.equal(greenhouseAdapter.matches({ careers_url: url }), true);
});

test('embed board ignores extra query params (office filters)', () => {
  assert.equal(
    ep('https://job-boards.greenhouse.io/embed/job_board?for=databricks&offices%5B%5D=4002841002'),
    API('databricks'));
});

test('embed board on the classic boards.greenhouse.io and the EU host', () => {
  assert.equal(ep('https://boards.greenhouse.io/embed/job_board?for=stripe'), API('stripe'));
  assert.equal(ep('https://job-boards.eu.greenhouse.io/embed/job_board?for=acme'), API('acme'));
});

test('?for= on a non-Greenhouse host never selects a board', () => {
  for (const url of [
    'https://example.com/jobs?for=stripe',
    'https://example.com/job-boards.greenhouse.io/embed/job_board?for=stripe',
    'https://job-boards.greenhouse.io.evil.com/embed/job_board?for=stripe',
    'https://evil.com/?x=job-boards.greenhouse.io/embed&for=stripe',
  ]) {
    assert.equal(ep(url), null, url);
    assert.equal(greenhouseAdapter.matches({ careers_url: url }), false, url);
  }
});

test('"embed" itself is never a slug; plain-HTTP or junk ?for= is refused', () => {
  assert.equal(ep('https://job-boards.greenhouse.io/embed/job_board'), null);
  assert.equal(ep('https://job-boards.greenhouse.io/embed/job_board?for=embed'), null);
  assert.equal(ep('http://job-boards.greenhouse.io/embed/job_board?for=stripe'), null);
  assert.equal(ep('https://job-boards.greenhouse.io/embed/job_board?for=../../x'), null);
});

test('regular job-boards URLs are unchanged', () => {
  assert.equal(ep('https://job-boards.greenhouse.io/stripe'), API('stripe'));
  assert.equal(ep('https://job-boards.eu.greenhouse.io/acme/jobs/123'), API('acme'));
  assert.equal(ep('job-boards.greenhouse.io/stripe'), API('stripe')); // scheme-less, as before
  assert.equal(ep('https://evil.com/?x=job-boards.greenhouse.io/stripe'), null); // substring look-alike
  assert.equal(greenhouseAdapter.buildEndpoint({ api: 'https://boards-api.greenhouse.io/v1/boards/x/jobs' }),
    'https://boards-api.greenhouse.io/v1/boards/x/jobs');
});

test('?for=. and ?for=.. are refused — they would normalise the boards-api path', () => {
  for (const tok of ['.', '..', '.stripe']) {
    const url = `https://job-boards.greenhouse.io/embed/job_board?for=${tok}`;
    assert.equal(greenhouseAdapter.buildEndpoint({ careers_url: url }), null, tok);
  }
});

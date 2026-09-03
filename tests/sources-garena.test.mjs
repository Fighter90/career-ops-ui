/**
 * Garena source — ported from parent career-ops v1.31.0.
 *
 * The fixtures encode the two decisions worth pinning:
 *   - `office` shapes the job LINK, never the listing (the upstream author
 *     verified live that every office code, invented ones included, returns the
 *     same board) — so a wrong office must break links, not results;
 *   - an unexpected payload THROWS. Returning [] would render a changed
 *     endpoint as a company with no openings, which is indistinguishable from a
 *     quiet board and is the failure mode that makes a source untrustworthy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, assertGarenaUrl, resolveOffice, urlSegment, buildGarenaUrl,
  parseGarenaResponse, fetchGarena,
} from '../server/lib/sources/garena.mjs';
import { garenaAdapter } from '../server/lib/portals/adapters/garena.mjs';

const page = (jobs) => ({ jobs });

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'garena', label: 'Garena', region: 'en' });
});

test('the host is pinned to careers.garena.com exactly', () => {
  for (const bad of [
    'https://careers.garena.com.evil.test/api',
    'https://evil.test/careers.garena.com/api',
    'http://careers.garena.com/api',
  ]) {
    assert.throws(() => assertGarenaUrl(bad), /garena:/, `must reject ${bad}`);
  }
  assert.equal(assertGarenaUrl('https://careers.garena.com/api/job/list'),
    'https://careers.garena.com/api/job/list');
});

test('office defaults to global and is carried into the endpoint', () => {
  assert.equal(resolveOffice({}), 'global');
  assert.equal(resolveOffice({ garena: { office: '  singapore ' } }), 'singapore');
  assert.equal(buildGarenaUrl({}), 'https://careers.garena.com/api/job/list?office=global');
  assert.match(buildGarenaUrl({ garena: { office: 'sg' } }), /\?office=sg$/);
});

test('a traversal segment is refused rather than escaped', () => {
  // encodeURIComponent leaves `.` and `..` intact, so escaping alone would
  // still hand the URL a traversal segment.
  assert.throws(() => urlSegment('office', '..'), /not a usable URL segment/);
  assert.throws(() => urlSegment('office', '.'), /not a usable URL segment/);
  assert.equal(urlSegment('office', 'a/b'), 'a%2Fb');
});

test('a posting yields the web-ui job shape, with the office in the link', () => {
  const [job] = parseGarenaResponse(
    page([{ id: 42, title: ' Backend Engineer ', tags: { location: ['Singapore'] }, description: '&lt;p&gt;Build&lt;/p&gt;' }]),
    { name: 'Garena', garena: { office: 'sg' } },
  );
  assert.equal(job.title, 'Backend Engineer');
  assert.equal(job.company, 'Garena');
  assert.equal(job.url, 'https://careers.garena.com/sg/careers/42');
  assert.equal(job.location, 'Singapore');
  assert.equal(job.description, 'Build');
  assert.equal(job.source, 'garena');
  assert.equal(job.id, 'garena-42');
});

test('multiple locations join, and a remote one sets isRemote', () => {
  const [job] = parseGarenaResponse(
    page([{ id: 1, title: 'Dev', tags: { location: ['Singapore', 'Remote'] } }]), {},
  );
  assert.equal(job.location, 'Singapore, Remote');
  assert.equal(job.isRemote, true);
});

test('rows without a title or an id are skipped, not emitted blank', () => {
  const rows = parseGarenaResponse(page([
    { id: 1, title: '' },
    { id: null, title: 'No id' },
    { title: 'No id key' },
    { id: 2, title: 'Keeper' },
  ]), {});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Keeper');
});

test('an unexpected payload throws instead of reporting an empty board', () => {
  assert.throws(() => parseGarenaResponse({ results: [] }, {}), /expected jobs\[\]/);
  assert.throws(() => parseGarenaResponse(null, {}), /expected jobs\[\]/);
});

test('fetchGarena POSTs an empty object and refuses redirects', async () => {
  let seen = null;
  const fake = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => page([{ id: 7, title: 'Dev' }]) };
  };
  const rows = await fetchGarena('https://careers.garena.com/api/job/list?office=global', { fetchImpl: fake });
  assert.equal(rows.length, 1);
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.body, '{}');
  assert.equal(seen.opts.redirect, 'error', 'a redirect must not be followed to a private address');
});

test('adapter matches an explicit provider and the pinned host, nothing else', () => {
  assert.equal(garenaAdapter.matches({ provider: 'garena' }), true);
  assert.equal(garenaAdapter.matches({ careers_url: 'https://careers.garena.com/global' }), true);
  assert.equal(garenaAdapter.matches({ careers_url: 'https://careers.garena.com.evil.test/' }), false);
  assert.equal(garenaAdapter.matches({ name: 'Garena' }), false);
});

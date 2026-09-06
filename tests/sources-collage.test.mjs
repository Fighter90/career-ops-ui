// tests/sources-collage.test.mjs — Collage HR public job-site API.
//
// CI-isolated: every fetch is a fake, no network.
//
// The value worth pinning here is that the job-site address is never GUESSED.
// It is an identifier the tenant chose, so an entry that names neither an
// `api:` nor a `secure.collage.co/jobs/<address>` careers_url must fail loudly
// rather than scan an address invented from the company name — which would be
// somebody else's board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCollageApiUrl,
  resolveCollageApiUrl,
  parseCollageResponse,
  buildCollageUrl,
  fetchCollage,
} from '../server/lib/sources/collage.mjs';
import { collageAdapter } from '../server/lib/portals/adapters/collage.mjs';

const ok = (json) => async () => ({ ok: true, status: 200, json: async () => json });

test('collage pins the host exactly — a suffix lookalike is refused', () => {
  assert.throws(() => assertCollageApiUrl('https://api.collage.co.evil.test/v1/positions/acme'), /untrusted hostname/);
  assert.throws(() => assertCollageApiUrl('http://api.collage.co/v1/positions/acme'), /must use HTTPS/);
  assert.equal(assertCollageApiUrl('https://api.collage.co/v1/positions/acme'), 'https://api.collage.co/v1/positions/acme');
});

test('collage pins the path shape, so a non-board page on the same host is refused', () => {
  // Without this, /login on api.collage.co would be accepted as a job board.
  assert.throws(() => assertCollageApiUrl('https://api.collage.co/login'), /must be \/v1\/positions/);
  assert.throws(() => assertCollageApiUrl('https://api.collage.co/v1/positions/acme/extra'), /must be \/v1\/positions/);
});

test('collage derives the API URL from a careers URL', () => {
  assert.equal(
    resolveCollageApiUrl({ careers_url: 'https://secure.collage.co/jobs/acme' }),
    'https://api.collage.co/v1/positions/acme',
  );
  assert.equal(
    resolveCollageApiUrl({ careers_url: 'https://secure.collage.co/jobs/acme/' }),
    'https://api.collage.co/v1/positions/acme',
  );
});

test('collage refuses to invent a job-site address', () => {
  // The whole point: no address, no scan. Guessing it from `name` would scan
  // a board belonging to whoever happens to own that address.
  assert.equal(resolveCollageApiUrl({ name: 'Acme' }), null);
  assert.throws(() => buildCollageUrl({ name: 'Acme' }), /set `api:`|secure\.collage\.co/);
});

test('collage refuses a careers URL that is not a job-site page', () => {
  assert.equal(resolveCollageApiUrl({ careers_url: 'https://secure.collage.co/' }), null);
  assert.equal(resolveCollageApiUrl({ careers_url: 'https://secure.collage.co/jobs/' }), null);
  assert.equal(resolveCollageApiUrl({ careers_url: 'https://evil.test/jobs/acme' }), null);
  assert.equal(resolveCollageApiUrl({ careers_url: 'http://secure.collage.co/jobs/acme' }), null);
  // A dot in the segment means a hostname slipped into the path.
  assert.equal(resolveCollageApiUrl({ careers_url: 'https://secure.collage.co/jobs/evil.test' }), null);
});

test('collage accepts both response envelopes the endpoint has served', () => {
  const row = { title: 'Engineer', hostedUrl: 'https://secure.collage.co/jobs/acme/1' };
  assert.equal(parseCollageResponse([row], 'Acme').length, 1);
  assert.equal(parseCollageResponse({ positions: [row] }, 'Acme').length, 1);
});

test('collage rejects an unrecognized envelope instead of reading it as an empty board', () => {
  // A changed API must not look like a tenant with no openings — that is the
  // failure mode that makes a scraped source untrustworthy.
  assert.throws(() => parseCollageResponse({ data: [] }, 'Acme'), /unrecognized response envelope/);
  assert.throws(() => parseCollageResponse(null, 'Acme'), /unrecognized response envelope/);
});

test('collage drops a posting with no applicable link', () => {
  const rows = [
    { title: 'No link' },
    { title: 'Insecure', hostedUrl: 'http://secure.collage.co/jobs/acme/1' },
    { title: 'Credentials', hostedUrl: 'https://user:pw@secure.collage.co/jobs/acme/2' },
    { title: 'Good', hostedUrl: 'https://secure.collage.co/jobs/acme/3' },
  ];
  const jobs = parseCollageResponse(rows, 'Acme');
  assert.deepEqual(jobs.map((j) => j.title), ['Good']);
});

test('collage prefers hostedUrl, then url, then applyUrl', () => {
  const [j] = parseCollageResponse([{
    title: 'T',
    hostedUrl: 'https://secure.collage.co/jobs/acme/hosted',
    url: 'https://secure.collage.co/jobs/acme/plain',
    applyUrl: 'https://secure.collage.co/jobs/acme/apply',
  }], 'Acme');
  assert.equal(j.url, 'https://secure.collage.co/jobs/acme/hosted');
});

test('collage joins a multi-value location and folds metadata into the description', () => {
  const [j] = parseCollageResponse([{
    title: 'T',
    hostedUrl: 'https://secure.collage.co/jobs/acme/1',
    location: ['Toronto', 'Remote'],
    department: 'Eng',
    commitment: 'Full-time',
    descriptionPlain: 'Body text',
  }], 'Acme');
  assert.equal(j.location, 'Toronto; Remote');
  assert.match(j.description, /Body text/);
  assert.match(j.description, /Department: Eng/);
  assert.match(j.description, /Commitment: Full-time/);
  assert.equal(j.isRemote, true, 'Remote in the location marks the row remote');
});

test('collage keeps an unparseable date as an empty field, not epoch zero', () => {
  // A recency filter must not read "no date" as 1970 and treat every such row
  // as ancient.
  const [j] = parseCollageResponse([{ title: 'T', hostedUrl: 'https://secure.collage.co/jobs/acme/1', createdDate: 'not a date' }], 'Acme');
  assert.equal(j.date, '');
  const [k] = parseCollageResponse([{ title: 'T', hostedUrl: 'https://secure.collage.co/jobs/acme/2', createdDate: '2026-09-01T00:00:00Z' }], 'Acme');
  assert.equal(k.date, '2026-09-01T00:00:00.000Z');
});

test('collage accepts a seconds-precision epoch as well as milliseconds', () => {
  const secs = 1788000000;
  const [j] = parseCollageResponse([{ title: 'T', hostedUrl: 'https://secure.collage.co/jobs/acme/1', createdAt: secs }], 'Acme');
  assert.equal(j.date, new Date(secs * 1000).toISOString());
});

test('collage adapter matches by provider and by either host', () => {
  assert.equal(collageAdapter.matches({ provider: 'collage' }), true);
  assert.equal(collageAdapter.matches({ api: 'https://api.collage.co/v1/positions/acme' }), true);
  assert.equal(collageAdapter.matches({ careers_url: 'https://secure.collage.co/jobs/acme' }), true);
  assert.equal(collageAdapter.matches({ careers_url: 'https://api.collage.co.evil.test/x' }), false);
  assert.equal(collageAdapter.matches({ provider: 'greenhouse' }), false);
});

test('collage fetch normalizes a live-shaped response', async () => {
  const jobs = await fetchCollage('', {
    fetchImpl: ok([{ title: 'Staff Engineer', hostedUrl: 'https://secure.collage.co/jobs/acme/9', location: 'Toronto' }]),
    company: { name: 'Acme', careers_url: 'https://secure.collage.co/jobs/acme' },
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].source, 'collage');
  assert.equal(jobs[0].url, 'https://secure.collage.co/jobs/acme/9');
});

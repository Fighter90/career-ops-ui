/**
 * Remote-com source (upstream #6392 port) — CI-isolated suite.
 * Remote's own in-house ATS at apply.remote.com (NOT the remoteok/remotive
 * job boards): one undocumented, unauthenticated, unpaginated endpoint,
 * GET https://apply.remote.com/api/public/jobs → { jobs: [...] }. Location
 * eligibility is region codes ("EMEA", "NORAM", …) which are kept AND
 * spelled out; a workplace label and the region expansions form the
 * location. The jobs[] envelope fails CLOSED (a shape change must surface,
 * never read as an empty board); closed rows and rows without a title or
 * public_id are dropped. No network — parseRemoteJobs is pure;
 * fetchRemoteCom runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  API_URL,
  POSTING_BASE,
  COMPANY,
  formatRemoteLocation,
  isRemoteAtsUrl,
  parseRemoteJobs,
  fetchRemoteCom,
} from '../server/lib/sources/remote-com.mjs';
import { remoteComAdapter } from '../server/lib/portals/adapters/remote-com.mjs';

// ── fixtures ─────────────────────────────────────────────────────────────────

function row(over = {}) {
  return {
    public_id: 'r-001',
    title: 'Compliance Associate',
    location: 'EMEA, NORAM',
    workplace: 'remote',
    opened_at: '2026-09-15T08:00:00.000Z',
    accepting_applications: true,
    status: 'open',
    ...over,
  };
}

// ── registry + adapter contract ──────────────────────────────────────────────

test('remote-com: meta — value, label, region en', () => {
  assert.deepEqual(meta, { value: 'remote-com', label: 'Remote', region: 'en' });
  assert.equal(remoteComAdapter.id, 'remote-com');
  assert.equal(remoteComAdapter.label, 'Remote');
});

test('remote-com: adapter matches any-path https on apply.remote.com; endpoint is the fixed API URL', () => {
  assert.equal(remoteComAdapter.matches({ name: 'Remote', careers_url: 'https://apply.remote.com/jobs' }), true);
  assert.equal(remoteComAdapter.matches({ name: 'Remote', careers_url: 'https://apply.remote.com/jobs/r-001' }), true, 'a posting link is the same board');
  assert.equal(remoteComAdapter.matches({ name: 'Remote', api: 'https://apply.remote.com/api/public/jobs' }), true);
  assert.equal(remoteComAdapter.matches({ name: 'X', careers_url: 'https://apply.remote.com.evil.example/jobs' }), false, 'suffix-spoofed host');
  assert.equal(remoteComAdapter.matches({ name: 'X', careers_url: 'https://evil-apply.remote.com/jobs' }), false, 'prefix-spoofed host');
  assert.equal(remoteComAdapter.matches({ name: 'X', careers_url: 'http://apply.remote.com/jobs' }), false, 'non-https');
  assert.equal(remoteComAdapter.matches({ name: 'X', careers_url: 'https://remoteok.com' }), false, 'the remoteok job board is a different beast');
  assert.equal(remoteComAdapter.matches(null), false);
  assert.equal(remoteComAdapter.matches('apply.remote.com'), false);
  const endpoint = remoteComAdapter.buildEndpoint({ name: 'Remote', careers_url: 'https://apply.remote.com/jobs' });
  assert.equal(typeof endpoint, 'string');
  assert.equal(endpoint, API_URL);
  assert.equal(remoteComAdapter.buildEndpoint({ name: 'X', careers_url: 'https://example.com' }), API_URL, 'a matched entry always resolves the one fixed board');
});

// ── isRemoteAtsUrl ───────────────────────────────────────────────────────────

test('remote-com: isRemoteAtsUrl — https on the exact host, any path, case-insensitive host', () => {
  assert.equal(isRemoteAtsUrl('https://apply.remote.com/jobs'), true);
  assert.equal(isRemoteAtsUrl('https://APPLY.REMOTE.COM/jobs'), true);
  assert.equal(isRemoteAtsUrl('  https://apply.remote.com/  '), true, 'whitespace trimmed');
  assert.equal(isRemoteAtsUrl('https://apply.remote.com.evil.example'), false);
  assert.equal(isRemoteAtsUrl('http://apply.remote.com'), false);
  assert.equal(isRemoteAtsUrl('not a url'), false);
  assert.equal(isRemoteAtsUrl(null), false);
  assert.equal(isRemoteAtsUrl(7), false);
  assert.equal(isRemoteAtsUrl(''), false);
});

// ── formatRemoteLocation ─────────────────────────────────────────────────────

test('remote-com: region codes are kept AND spelled out, so either vocabulary matches a filter', () => {
  assert.equal(formatRemoteLocation('EMEA, NORAM', 'remote'), 'Remote · EMEA (Europe, Middle East & Africa) / NORAM (North America)');
  assert.equal(formatRemoteLocation('LATAM', 'remote'), 'Remote · LATAM (Latin America)');
  assert.equal(formatRemoteLocation('APAC', 'hybrid'), 'Hybrid · APAC (Asia-Pacific)');
});

test('remote-com: unknown codes pass verbatim; duplicates fold; empty parts drop out', () => {
  assert.equal(formatRemoteLocation('BENELUX', 'remote'), 'Remote · BENELUX', 'an unknown code is never dropped');
  assert.equal(formatRemoteLocation('emea, EMEA , latam', 'remote'), 'Remote · EMEA (Europe, Middle East & Africa) / LATAM (Latin America)', 'case-insensitive dedupe');
  assert.equal(formatRemoteLocation('  ', ''), '', 'no regions, no workplace → empty location');
  assert.equal(formatRemoteLocation(undefined, 'onsite'), 'On-site');
  assert.equal(formatRemoteLocation('EMEA', 'nonsense'), 'EMEA (Europe, Middle East & Africa)', 'an unknown workplace is left out');
});

// ── parseRemoteJobs ──────────────────────────────────────────────────────────

test('remote-com: parse maps live rows — posting url, company, location, opened_at', () => {
  const jobs = parseRemoteJobs({ jobs: [row()] });
  assert.equal(jobs.length, 1);
  assert.deepEqual(
    { title: jobs[0].title, url: jobs[0].url, company: jobs[0].company, location: jobs[0].location, externalId: jobs[0].externalId, postedAt: jobs[0].postedAt },
    {
      title: 'Compliance Associate',
      url: `${POSTING_BASE}r-001`,
      company: COMPANY,
      location: 'Remote · EMEA (Europe, Middle East & Africa) / NORAM (North America)',
      externalId: 'r-001',
      postedAt: Date.parse('2026-09-15T08:00:00.000Z'),
    },
  );
});

test('remote-com: closed rows are dropped; an unseen status value is not taken to mean closed', () => {
  const jobs = parseRemoteJobs({ jobs: [
    row({ public_id: 'r-010', title: 'Closed flag', accepting_applications: false }),
    row({ public_id: 'r-011', title: 'Closed status', status: 'closed' }),
    row({ public_id: 'r-012', title: 'Open with an exotic status', status: 'in_review' }),
  ] });
  assert.deepEqual(jobs.map((j) => j.externalId), ['r-012'], 'only the known closed signals drop a row');
});

test('remote-com: rows without a title or public_id are dropped; ids are URL-encoded', () => {
  const jobs = parseRemoteJobs({ jobs: [
    row({ title: '   ' }),
    row({ public_id: '' }),
    row({ public_id: 'weird id/2' }),
    'junk',
    null,
  ] });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, `${POSTING_BASE}${encodeURIComponent('weird id/2')}`);
});

test('remote-com: a lone-surrogate public_id drops the one row, not the board', () => {
  const jobs = parseRemoteJobs({ jobs: [row({ public_id: '\uD800bad' }), row({ public_id: 'ok-2', title: 'Good' })] });
  assert.deepEqual(jobs.map((j) => j.externalId), ['ok-2']);
});

test('remote-com: parse fails CLOSED on a missing jobs envelope; a present-and-empty array is a real empty board', () => {
  assert.throws(() => parseRemoteJobs({ unexpected: {} }), /remote-com jobs.*expected an array/);
  assert.throws(() => parseRemoteJobs(null), /expected an array/);
  assert.throws(() => parseRemoteJobs({ jobs: 'many' }), /expected an array/);
  assert.deepEqual(parseRemoteJobs({ jobs: [] }), []);
});

// ── fetchRemoteCom — the web-ui fetch contract ───────────────────────────────

test('remote-com: fetch issues exactly one request to the fixed API URL with accept json + redirect:"error"', async () => {
  const seen = [];
  const jobs = await fetchRemoteCom(API_URL, {
    fetchImpl: async (url, opts) => { seen.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ jobs: [row(), row({ public_id: 'r-002', title: 'Payroll', workplace: 'hybrid', location: 'APAC' })] }) }; },
    company: { name: 'Remote', careers_url: 'https://apply.remote.com/jobs' },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, API_URL);
  assert.equal(seen[0].opts.redirect, 'error');
  assert.equal(seen[0].opts.headers.accept, 'application/json');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, `remote-com-${POSTING_BASE}r-001`);
  assert.equal(jobs[0].source, 'remote-com');
  assert.equal(jobs[0].company, 'Remote');
  assert.equal(jobs[0].date, new Date(Date.parse('2026-09-15T08:00:00.000Z')).toISOString());
  assert.equal(jobs[0].snippet, '', 'the opening paragraph is left off — it is not the posting text');
  assert.equal(jobs[1].isRemote, false, 'hybrid is not remote');
  assert.equal(jobs[1].location, 'Hybrid · APAC (Asia-Pacific)');
  assert.equal(jobs[0].isRemote, true, 'remote comes from the workplace field');
});

test('remote-com: fetch wraps a 200 whose body is broken — the parse throws, never an empty board', async () => {
  await assert.rejects(
    () => fetchRemoteCom(API_URL, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ oops: [] }) }) }),
    /expected an array/,
  );
});

test('remote-com: fetch fails loud when the signal is already aborted, and propagates HTTP errors', async () => {
  const controller = new AbortController();
  controller.abort();
  let touched = 0;
  await assert.rejects(
    () => fetchRemoteCom(API_URL, { fetchImpl: async () => { touched += 1; return { ok: true, json: async () => ({ jobs: [] }) }; }, signal: controller.signal }),
    /abort/i,
  );
  assert.equal(touched, 0);
  await assert.rejects(
    () => fetchRemoteCom(API_URL, { fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => '' }) }),
    /HTTP 404/,
  );
});

/**
 * Atlassian source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's atlassian provider cases: the bare-array feed
 * (shape-throw naming keys), the portalUrl → applyUrl posting link with an
 * http(s)-only guard, whitespace-heavy location collapse, malformed rows
 * skipped (never the board), no postedAt (the feed only carries an edit
 * date), and the single-request fetch contract. No network — the parse
 * functions are pure; fetchAtlassian runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAtlassianListings,
  formatLocation,
  postingUrl,
  assertAtlassianUrl,
  fetchAtlassian,
  LISTINGS_URL,
  ALLOWED_HOST,
} from '../server/lib/sources/atlassian.mjs';

const row = (extra = {}) => ({
  id: '12345',
  title: 'Senior Engineer',
  locations: ['San Francisco - United States -   San Francisco, California 94104 United States'],
  portalJobPost: { portalUrl: 'https://www.atlassian.com/company/careers/12345/job' },
  applyUrl: 'https://www.atlassian.com/company/careers/12345/job?mode=apply',
  ...extra,
});

test('atlassian: parse keeps the posting page, collapses locations, carries the id', () => {
  const rows = parseAtlassianListings([row()], 'Atlassian');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Senior Engineer');
  assert.equal(rows[0].url, 'https://www.atlassian.com/company/careers/12345/job', 'the posting page wins over the apply form');
  assert.equal(rows[0].company, 'Atlassian');
  assert.equal(rows[0].location, 'San Francisco - United States - San Francisco, California 94104 United States');
  assert.equal(rows[0].externalId, '12345');
});

test('atlassian: applyUrl is the fallback when portalUrl is missing', () => {
  const r = parseAtlassianListings([row({ portalJobPost: {} })], 'Atlassian');
  assert.equal(r[0].url, 'https://www.atlassian.com/company/careers/12345/job?mode=apply');
});

test('atlassian: numeric id is coerced; absent id is absent (no placeholder)', () => {
  const r = parseAtlassianListings([row({ id: 99 }), row({ id: '  ' }), row({ id: {} })], 'Atlassian');
  assert.equal(r[0].externalId, '99');
  assert.equal(r[1].externalId, undefined);
  assert.equal(r[2].externalId, undefined);
});

test('atlassian: multi-location postings join with "; " and whitespace collapses', () => {
  const loc = formatLocation(row({
    locations: ['  Sydney   -  Australia ', '', 'Remote'],
  }));
  assert.equal(loc, 'Sydney - Australia; Remote');
});

test('atlassian: a messy locations field never throws', () => {
  assert.equal(formatLocation({ locations: 'not an array' }), '');
  assert.equal(formatLocation({}), '');
  assert.equal(formatLocation(null), '');
});

test('atlassian: postingUrl drops relative, non-string and javascript: candidates', () => {
  assert.equal(postingUrl(row({ portalJobPost: { portalUrl: '/relative/job' }, applyUrl: 'javascript:alert(1)' })), null);
  assert.equal(postingUrl(row({ portalJobPost: { portalUrl: 42 }, applyUrl: '' })), null);
  assert.equal(postingUrl({}), null);
  assert.equal(postingUrl(row({ portalJobPost: { portalUrl: 'http://legacy.example/job' } })), 'http://legacy.example/job', 'absolute http(s) qualifies');
});

test('atlassian: malformed rows are skipped, never the board', () => {
  const rows = parseAtlassianListings([
    null,
    'a string',
    42,
    row({ title: '   ' }),
    row({ portalJobPost: {}, applyUrl: '/relative' }),
    row(),
  ], 'Atlassian');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].externalId, '12345');
});

test('atlassian: a non-array feed throws naming what arrived (never a silent empty board)', () => {
  assert.throws(
    () => parseAtlassianListings({ jobs: [], total: 0 }, 'Atlassian'),
    /did not return an array of listings — got jobs, total/);
  assert.throws(
    () => parseAtlassianListings('maintenance page', 'Atlassian'),
    /got string/);
});

test('atlassian: assertAtlassianUrl — HTTPS on the feed host only', () => {
  assert.equal(assertAtlassianUrl(LISTINGS_URL), LISTINGS_URL);
  assert.throws(() => assertAtlassianUrl('http://www.atlassian.com/endpoint/careers/listings'), /must use HTTPS/);
  assert.throws(() => assertAtlassianUrl('https://evil.example/endpoint/careers/listings'), /untrusted hostname/);
  assert.throws(() => assertAtlassianUrl('not a url'), /invalid URL/);
  assert.equal(ALLOWED_HOST, 'www.atlassian.com');
});

test('atlassian: fetchAtlassian — one request, normalized rows', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => [row({ title: 'Remote Data Engineer' }), row({
        id: '7',
        title: 'Backend',
        portalJobPost: { portalUrl: 'https://www.atlassian.com/company/careers/7/job' },
        applyUrl: 'https://www.atlassian.com/company/careers/7/job?mode=apply',
      })],
    };
  };
  const jobs = await fetchAtlassian(LISTINGS_URL, { fetchImpl, company: { name: 'Atlassian' } });
  assert.equal(calls.length, 1, 'the whole board arrives in a single request');
  assert.equal(calls[0].url, LISTINGS_URL);
  assert.equal(calls[0].opts.redirect, 'error', 'SSRF: redirects are refused');
  assert.ok(calls[0].opts.headers['User-Agent'], 'a browser-like UA is sent');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'atlassian-12345', 'the feed id becomes the row id');
  assert.equal(jobs[0].title, 'Remote Data Engineer');
  assert.equal(jobs[0].isRemote, true, 'isRemote follows the title');
  assert.equal(jobs[1].id, 'atlassian-7');
  assert.equal(jobs[1].isRemote, false);
  assert.equal(jobs[1].source, 'atlassian');
  assert.equal(jobs[1].company, 'Atlassian');
  assert.equal(jobs[1].date, '', 'no postedAt — the feed only carries an edit date, never read as publication');
  assert.equal(jobs[1].url, 'https://www.atlassian.com/company/careers/7/job');
});

test('atlassian: fetchAtlassian — a shape-changed feed rejects (there is no later page to salvage)', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ error: 'gone' }) });
  await assert.rejects(
    () => fetchAtlassian(LISTINGS_URL, { fetchImpl }),
    /did not return an array of listings — got error/);
});

test('atlassian: fetchAtlassian — a transport failure propagates', async () => {
  const fetchImpl = async () => { throw new Error('socket hang up'); };
  await assert.rejects(() => fetchAtlassian(LISTINGS_URL, { fetchImpl }), /socket hang up/);
});

test('atlassian: fetchAtlassian asserts the endpoint before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchAtlassian('https://evil.example/listings', { fetchImpl }),
    /untrusted hostname/);
});

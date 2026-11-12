/**
 * SEEK host migration (v1.237.1). SEEK is moving www.seek.com.au -> au.seek.com and
 * www.seek.co.nz -> nz.seek.com. The transport refuses redirects (`redirect:'error'`),
 * so the new hosts must be allowlisted BEFORE the API path starts redirecting, or an
 * AU/NZ entry fails with no way to migrate. Both hosts serve the v5 API today.
 * The old hosts stay allowed: existing config and already-built job links use them.
 * CI-isolated: no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertJobstreetUrl, parseJobstreetItem, fetchJobstreet } from '../server/lib/sources/jobstreet.mjs';

const API = '/api/jobsearch/v5/search';

test('the new SEEK hosts are accepted as API endpoints', () => {
  for (const host of ['au.seek.com', 'nz.seek.com']) {
    assert.doesNotThrow(() => assertJobstreetUrl(`https://${host}${API}`), host);
  }
});

test('the old SEEK hosts stay accepted — existing config must not break', () => {
  for (const host of ['www.seek.com.au', 'www.seek.co.nz']) {
    assert.doesNotThrow(() => assertJobstreetUrl(`https://${host}${API}`), host);
  }
});

test('the new hosts build /job/<id> links, not the Indonesian /id/job/ form', () => {
  for (const host of ['au.seek.com', 'nz.seek.com']) {
    const j = parseJobstreetItem({ id: '94036672', title: 'Engineer' }, `https://${host}`, 'X');
    assert.equal(j.url, `https://${host}/job/94036672`);
  }
});

test('a look-alike host is still refused', () => {
  for (const host of ['au.seek.com.evil.com', 'seek.com', 'au-seek.com', 'http://au.seek.com']) {
    const url = host.startsWith('http') ? `${host}${API}` : `https://${host}${API}`;
    assert.throws(() => assertJobstreetUrl(url), host);
  }
});

// SEEK moved its AU API to au.seek.com; www.seek.com.au now answers 308 there
// and requests refuse redirects (parent #6854). A fetch against the new host
// must keep the /job/ detail links on the LEGACY host so scan-history and
// tracker URLs keep deduplicating against listings recorded before the move.
test('fetchJobstreet: au.seek.com api config — search on the new host, links stay on www.seek.com.au', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return { ok: true, json: async () => ({ data: [{ id: '95650205', title: 'Technical Business Analyst' }], totalCount: 1 }) };
  };
  const jobs = await fetchJobstreet(`https://au.seek.com${API}`, {
    fetchImpl,
    company: { name: 'SEEK AU', jobstreet: { siteKey: 'AU-Main', searchKeywords: 'business analyst' } },
  });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).hostname, 'au.seek.com', 'the search hits au.seek.com');
  assert.equal(calls[0].init.redirect, 'error', 'the guarded transport never follows a 3xx');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://www.seek.com.au/job/95650205', 'the detail link stays on the legacy host');
});

test('fetchJobstreet: a config still naming www.seek.com.au is sent to au.seek.com, links unchanged', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return { ok: true, json: async () => ({ data: [{ id: '95650205', title: 'Technical Business Analyst' }], totalCount: 1 }) };
  };
  const jobs = await fetchJobstreet(`https://www.seek.com.au${API}`, {
    fetchImpl,
    company: { name: 'SEEK AU', jobstreet: { siteKey: 'AU-Main', searchKeywords: 'business analyst' } },
  });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).hostname, 'au.seek.com', 'the old API host is aliased to the new one');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://www.seek.com.au/job/95650205', 'detail links unchanged');
});

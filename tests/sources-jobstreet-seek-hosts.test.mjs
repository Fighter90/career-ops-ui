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
import { assertJobstreetUrl, parseJobstreetItem } from '../server/lib/sources/jobstreet.mjs';

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

/**
 * Get on Board source + adapter (v1.87.0 — parent career-ops v1.16.0 parity).
 * Board-wide public JSON:API, provider-selected. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGetonbrdJob, fetchGetonbrd, assertGetonbrdUrl, FEED_BASE, meta,
} from '../server/lib/sources/getonbrd.mjs';
import { getonbrdAdapter } from '../server/lib/portals/adapters/getonbrd.mjs';

const resource = (over = {}, url = 'https://www.getonbrd.com/jobs/senior-go-acme') => ({
  attributes: {
    title: 'Senior Go Engineer',
    remote: true,
    published_at: 1782000000,
    company: { data: { attributes: { name: 'Acme' } } },
    ...over,
  },
  links: { public_url: url },
});

const jsonFetch = (byPage) => async (url) => {
  const p = Number((url.match(/[?&]page=(\d+)/) || [])[1] || 1); // avoid matching per_page=
  return { ok: true, status: 200, json: async () => ({ data: byPage[p] || [] }) };
};

test('meta + adapter surface: provider-selected, host-pinned', () => {
  assert.equal(meta.value, 'getonbrd');
  assert.equal(meta.region, 'en');
  assert.equal(getonbrdAdapter.id, 'getonbrd');
  assert.ok(getonbrdAdapter.matches({ provider: 'getonbrd' }));
  assert.ok(!getonbrdAdapter.matches({ careers_url: 'https://x.com' }));
  assert.equal(getonbrdAdapter.buildEndpoint({}), FEED_BASE);
  assert.equal(getonbrdAdapter.buildEndpoint({ getonbrd: 'https://evil.com/x' }), FEED_BASE); // off-host override ignored
});

test('normalizeGetonbrdJob: field mapping, remote, country join, drops bad rows', () => {
  const j = normalizeGetonbrdJob(resource());
  assert.equal(j.title, 'Senior Go Engineer');
  assert.equal(j.company, 'Acme');
  assert.equal(j.url, 'https://www.getonbrd.com/jobs/senior-go-acme');
  assert.equal(j.location, 'Remote');
  assert.equal(j.isRemote, true);
  assert.equal(j.source, 'getonbrd');
  assert.match(j.date, /^\d{4}-\d{2}-\d{2}$/);

  // non-remote with a countries array → joined, isRemote false
  const c = normalizeGetonbrdJob(resource({ remote: false, countries: ['Chile', 'Peru'] }));
  assert.equal(c.location, 'Chile, Peru');
  assert.equal(c.isRemote, false);

  // company fallback when the embed is missing
  const f = normalizeGetonbrdJob(resource({ company: undefined }), 'Fallback Co');
  assert.equal(f.company, 'Fallback Co');

  // dropped: no title, off-host url, malformed url
  assert.equal(normalizeGetonbrdJob(resource({ title: '' })), null);
  assert.equal(normalizeGetonbrdJob(resource({}, 'https://evil.com/x')), null);
  assert.equal(normalizeGetonbrdJob(resource({}, 'not a url')), null);
  assert.equal(normalizeGetonbrdJob(null), null);
});

test('assertGetonbrdUrl: https + host-pinned to www.getonbrd.com', () => {
  assert.equal(assertGetonbrdUrl(FEED_BASE), FEED_BASE);
  assert.throws(() => assertGetonbrdUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertGetonbrdUrl('http://www.getonbrd.com/x'), /HTTPS/);
  assert.throws(() => assertGetonbrdUrl('nonsense'), /invalid URL/);
});

test('fetchGetonbrd: paginates until a short page, CI-isolated', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => resource({ title: `Role ${i}` }, `https://www.getonbrd.com/jobs/p1-${i}`));
  const page2 = [resource({ title: 'Last' }, 'https://www.getonbrd.com/jobs/p2-0')];
  let calls = 0;
  const fetchImpl = (url, opts) => { calls += 1; assert.equal(opts.redirect, 'error'); return jsonFetch({ 1: page1, 2: page2 })(url); };
  const jobs = await fetchGetonbrd(FEED_BASE, { fetchImpl });
  assert.equal(calls, 2);              // page 2 is short → stop
  assert.equal(jobs.length, 101);
  assert.ok(jobs.every((j) => j.source === 'getonbrd'));
});

test('fetchGetonbrd: throws on a non-{data:[]} payload', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ oops: true }) });
  await assert.rejects(() => fetchGetonbrd(FEED_BASE, { fetchImpl }), /unexpected API response/);
});

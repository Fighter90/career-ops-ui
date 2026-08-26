/**
 * Torre source + adapter — the public opportunity search behind torre.ai
 * (POST https://search.torre.co/opportunities/_search). Board-wide public JSON
 * API, provider-selected. CI-isolated (fake fetchImpl, no network, no parent).
 * Ported from the parent career-ops providers/torre.test.mjs, adapted to the
 * web-ui source contract (rich job objects + a fake fetch that returns a
 * Response-like shape for http-json.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTorreQuery,
  normalizeTorreOpportunity,
  fetchTorre,
  assertTorreUrl,
  SEARCH_ENDPOINT,
  meta,
} from '../server/lib/sources/torre.mjs';
import { torreAdapter } from '../server/lib/portals/adapters/torre.mjs';

const REQUEST_URL = 'https://search.torre.co/opportunities/_search?offset=0&size=20';

// A fetchImpl that returns http-json's expected Response-like shape and records
// the (url, opts) of each call.
const okJsonSpy = (payload, capture) => (url, opts) => {
  capture.calls = (capture.calls || 0) + 1;
  capture.urls = capture.urls || [];
  capture.urls.push(url);
  capture.lastUrl = url;
  capture.lastOpts = opts;
  return Promise.resolve({ ok: true, status: 200, json: async () => payload });
};

test('meta + adapter surface: provider-selected, host-pinned', () => {
  assert.equal(meta.value, 'torre');
  assert.equal(meta.label, 'Torre');
  assert.equal(meta.region, 'en'); // registry validateMeta only accepts 'en' | 'ru'
  assert.equal(torreAdapter.id, 'torre');
  assert.equal(torreAdapter.label, 'Torre');
  assert.ok(torreAdapter.matches({ provider: 'torre' }));
  assert.ok(!torreAdapter.matches({ careers_url: 'https://search.torre.co/x' })); // never careers_url-detected
  assert.ok(!torreAdapter.matches({}));
  assert.equal(torreAdapter.buildEndpoint({}), SEARCH_ENDPOINT);
  // off-host override ignored → canonical endpoint
  assert.equal(torreAdapter.buildEndpoint({ torre: 'https://evil.com/x' }), SEARCH_ENDPOINT);
  assert.equal(torreAdapter.buildEndpoint({ api: 'not a url' }), SEARCH_ENDPOINT);
  // on-host https override honoured
  assert.equal(
    torreAdapter.buildEndpoint({ torre: 'https://search.torre.co/mirror/_search' }),
    'https://search.torre.co/mirror/_search',
  );
});

test('buildTorreQuery: only filters that move `total` are emitted', () => {
  // Empty body when nothing is configured.
  assert.equal(JSON.stringify(buildTorreQuery({})), '{}');

  // search → skill/role, trimmed, with the REQUIRED paired experience (a hard
  // 500 on the live API without it → always emitted).
  assert.equal(
    JSON.stringify(buildTorreQuery({ search: '  engineering manager  ' })),
    '{"skill/role":{"text":"engineering manager","experience":"1-plus-year"}}',
  );

  // Never emits skill/role.text without an experience (live 500 guard).
  const everPaired = ['a', 'kubernetes', 'x y z']
    .map((s) => buildTorreQuery({ search: s })['skill/role'])
    .every((f) => f && typeof f.experience === 'string' && f.experience);
  assert.ok(everPaired);

  // Honours a configured experience level.
  assert.equal(
    JSON.stringify(buildTorreQuery({ search: 'x', experience: '3-plus-years' })),
    '{"skill/role":{"text":"x","experience":"3-plus-years"}}',
  );

  // Rejects an experience value the API would refuse.
  assert.throws(() => buildTorreQuery({ search: 'x', experience: 'senior' }), /invalid experience/);

  // Ignores experience when no search is configured.
  assert.equal(JSON.stringify(buildTorreQuery({ experience: '3-plus-years' })), '{}');

  // remote_only:true → remote filter.
  assert.equal(JSON.stringify(buildTorreQuery({ remote_only: true })), '{"remote":{"term":true}}');

  // Any non-true remote_only omits the remote key entirely (no unverified filter).
  const notRemote = [
    buildTorreQuery({ remote_only: false }),
    buildTorreQuery({ remote_only: 'yes' }),
    buildTorreQuery({ remote_only: 0 }),
  ];
  assert.ok(notRemote.every((b) => !('remote' in b)));

  // Never sends the silently-ignored `objective` filter.
  assert.ok(!('objective' in buildTorreQuery({ search: 'x' })));
});

test('assertTorreUrl: https + host-pinned to search.torre.co', () => {
  assert.equal(assertTorreUrl(SEARCH_ENDPOINT), SEARCH_ENDPOINT);
  assert.throws(() => assertTorreUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertTorreUrl('http://search.torre.co/x'), /HTTPS/);
  assert.throws(() => assertTorreUrl('nonsense'), /invalid URL/);
});

test('normalizeTorreOpportunity: web-ui shape, remote, country join, org fallback, drops bad rows', () => {
  const remote = normalizeTorreOpportunity({
    id: 'NwBp2Axr',
    objective: '  Engineering Manager  ',
    status: 'open',
    remote: true,
    locations: ['Colombia', 'Uruguay'],
    created: '2026-08-06T17:48:17.000Z',
    organizations: [{ name: 'Torre.ai' }],
  });
  assert.equal(remote.title, 'Engineering Manager'); // trimmed
  assert.equal(remote.url, 'https://torre.ai/post/NwBp2Axr'); // built from id
  assert.equal(remote.id, 'torre-https://torre.ai/post/NwBp2Axr'); // dedup key
  assert.equal(remote.company, 'Torre.ai');
  assert.equal(remote.location, 'Remote — Colombia, Uruguay'); // remote keeps country list
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  assert.equal(remote.relocates, false);
  assert.equal(remote.salary, '');
  assert.equal(remote.snippet, '');
  assert.equal(remote.source, 'torre');
  assert.equal(remote.date, new Date(Date.parse('2026-08-06T17:48:17.000Z')).toISOString());

  // Non-remote row: joined locations, isRemote false, first unnamed org skipped.
  const onsite = normalizeTorreOpportunity({
    id: 'Ab12cd34',
    objective: 'Staff Backend Engineer',
    status: 'open',
    remote: false,
    locations: ['Montevideo, Uruguay'],
    organizations: [{ name: '  ' }, { name: 'dLocal' }],
  });
  assert.equal(onsite.location, 'Montevideo, Uruguay');
  assert.equal(onsite.company, 'dLocal'); // first org unnamed → next wins
  assert.equal(onsite.isRemote, false);
  assert.equal(onsite.workplaceType, '');
  assert.equal(onsite.date, ''); // no created → omitted (empty)

  // Absent status is treated as open.
  const noStatus = normalizeTorreOpportunity({ id: 'Zz99yy88', objective: 'Role', remote: true });
  assert.equal(noStatus.url, 'https://torre.ai/post/Zz99yy88');

  // Company defaults to "Torre" with no org and no entry name.
  assert.equal(
    normalizeTorreOpportunity({ id: 'Qq11ww22', objective: 'Solo Role', status: 'open' }).company,
    'Torre',
  );
  // Entry-name fallback used when no org.
  assert.equal(
    normalizeTorreOpportunity({ id: 'Qq11ww22', objective: 'Solo Role', status: 'open' }, 'Fallback Co').company,
    'Fallback Co',
  );

  // Dropped rows.
  assert.equal(normalizeTorreOpportunity({ id: 'Cc44dd55', objective: 'Closed', status: 'closed' }), null); // not open
  assert.equal(normalizeTorreOpportunity({ id: 'Ee66ff77', objective: '', status: 'open' }), null); // no title
  assert.equal(normalizeTorreOpportunity({ id: '', objective: 'No Id', status: 'open' }), null); // no id
  assert.equal(normalizeTorreOpportunity({ id: '../../admin', objective: 'Path Injection', status: 'open' }), null); // bad id
  assert.equal(normalizeTorreOpportunity(null), null);
});

test('fetchTorre: single capped POST, correct url/body/redirect, drops bad rows', async () => {
  const sample = {
    results: [
      {
        id: 'NwBp2Axr',
        objective: 'Engineering Manager',
        status: 'open',
        remote: true,
        locations: ['Colombia', 'Uruguay'],
        created: '2026-08-06T17:48:17.000Z',
        organizations: [{ name: 'Torre.ai' }],
      },
      {
        id: 'Ab12cd34',
        objective: 'Staff Backend Engineer',
        status: 'open',
        remote: false,
        locations: ['Montevideo, Uruguay'],
        organizations: [{ name: 'dLocal' }],
      },
      { id: 'Cc44dd55', objective: 'Closed Role', status: 'closed', remote: true }, // dropped
      { id: 'Ee66ff77', objective: '', status: 'open', remote: true }, // dropped
      { id: '', objective: 'No Id Role', status: 'open', remote: true }, // dropped
      { id: '../../admin', objective: 'Path Injection', status: 'open' }, // dropped
    ],
  };

  const cap = {};
  const jobs = await fetchTorre(SEARCH_ENDPOINT, {
    fetchImpl: okJsonSpy(sample, cap),
    company: { name: 'Torre Feed', provider: 'torre', search: 'engineering manager' },
  });

  // Requests the search endpoint at offset=0 with the 20-row cap.
  assert.equal(cap.lastUrl, REQUEST_URL);
  // POSTs the JSON query body.
  assert.equal(cap.lastOpts.method, 'POST');
  assert.equal(cap.lastOpts.headers['Content-Type'], 'application/json');
  assert.equal(
    cap.lastOpts.body,
    JSON.stringify({ 'skill/role': { text: 'engineering manager', experience: '1-plus-year' } }),
  );
  // Passes redirect:'error' (SSRF guard).
  assert.equal(cap.lastOpts.redirect, 'error');

  // Keeps 2 valid rows (drops closed, untitled, id-less and bad-id rows).
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Engineering Manager');
  assert.equal(jobs[0].url, 'https://torre.ai/post/NwBp2Axr');
  assert.equal(jobs[0].company, 'Torre.ai');
  assert.equal(jobs[0].location, 'Remote — Colombia, Uruguay');
  assert.equal(jobs[1].company, 'dLocal');
  assert.equal(jobs[1].location, 'Montevideo, Uruguay');
  assert.ok(jobs.every((j) => j.source === 'torre'));
});

test('fetchTorre: exactly one request even on a full 20-row page (no paging)', async () => {
  const mkRow = (i) => ({ id: `Id${String(i).padStart(6, '0')}`, objective: `Role ${i}`, status: 'open', remote: true });
  const fullPage = { results: Array.from({ length: 20 }, (_, i) => mkRow(i)) };

  const cap = {};
  const single = await fetchTorre(SEARCH_ENDPOINT, { fetchImpl: okJsonSpy(fullPage, cap), company: { name: 'T' } });
  assert.equal(cap.calls, 1); // one request on a full page
  assert.equal(single.length, 20);

  // max_pages must not resurrect a paging loop that cannot advance.
  const cap2 = {};
  await fetchTorre(SEARCH_ENDPOINT, { fetchImpl: okJsonSpy(fullPage, cap2), company: { name: 'T', max_pages: 10 } });
  assert.equal(cap2.calls, 1);
});

test('fetchTorre: dedups a repeated opportunity within a page', async () => {
  const dupRow = { id: 'Id000001', objective: 'Role 1', status: 'open', remote: true };
  const cap = {};
  const deduped = await fetchTorre(SEARCH_ENDPOINT, {
    fetchImpl: okJsonSpy({ results: [dupRow, dupRow, { id: 'Id000002', objective: 'Role 2', status: 'open', remote: true }] }, cap),
    company: { name: 'T' },
  });
  assert.equal(deduped.length, 2);
});

test('fetchTorre: throws on an unexpected API response shape', async () => {
  const cap = {};
  await assert.rejects(
    () => fetchTorre(SEARCH_ENDPOINT, { fetchImpl: okJsonSpy({ wrong: true }, cap), company: {} }),
    /unexpected API response/,
  );
});

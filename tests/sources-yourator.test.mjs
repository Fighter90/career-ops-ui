/**
 * Yourator source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchYourator,
  parseYouratorPage,
  normalizeYouratorJob,
  resolveYouratorUrl,
  assertYouratorUrl,
  meta,
  FEED_URL,
} from '../server/lib/sources/yourator.mjs';
import { youratorAdapter } from '../server/lib/portals/adapters/yourator.mjs';

// ---------------------------------------------------------------------------
// Fake response helpers
// ---------------------------------------------------------------------------

function makeJob(overrides = {}) {
  return {
    id: 101,
    name: '前端工程師 Frontend Engineer',
    path: '/companies/acme/jobs/101',
    salary: '月薪 60,000 - 90,000 TWD',
    location: '臺北市',
    company: { brand: 'Acme Taiwan' },
    thirdPartyUrl: 'https://acme.teamdoor.io/jobs/101',
    ...overrides,
  };
}

function makePage(jobs, hasMore = false) {
  return { payload: { jobs, hasMore, currentPage: 1, nextPage: hasMore ? 2 : null } };
}

function fakeFetch(bodies) {
  let call = 0;
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const body = bodies[Math.min(call, bodies.length - 1)];
    call++;
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

test('meta: self-describing shape for auto-discovery', () => {
  assert.deepEqual(meta, { value: 'yourator', label: 'Yourator', region: 'en' });
});

// ---------------------------------------------------------------------------
// assertYouratorUrl — SSRF host-pin
// ---------------------------------------------------------------------------

test('assertYouratorUrl: accepts yourator.co (with/without www), rejects others', () => {
  assert.equal(assertYouratorUrl(FEED_URL), FEED_URL);
  assert.equal(assertYouratorUrl('https://yourator.co/api/v4/jobs'), 'https://yourator.co/api/v4/jobs');
  assert.throws(() => assertYouratorUrl('http://www.yourator.co/api'), /HTTPS/);
  assert.throws(() => assertYouratorUrl('https://evil.com/api'), /untrusted hostname/);
  // suffix-spoof + subdomain-suffix attacks must be rejected
  assert.throws(() => assertYouratorUrl('https://notyourator.co/api'), /untrusted hostname/);
  assert.throws(() => assertYouratorUrl('https://yourator.co.evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertYouratorUrl('https://www.yourator.co.evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertYouratorUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// resolveYouratorUrl — canonical URL resolution (parent-quirk parity)
// ---------------------------------------------------------------------------

test('resolveYouratorUrl: prefers thirdPartyUrl (any https origin, NOT host-pinned)', () => {
  assert.equal(
    resolveYouratorUrl(makeJob()),
    'https://acme.teamdoor.io/jobs/101',
  );
});

test('resolveYouratorUrl: strips only utm_* params, keeps functional query params', () => {
  const url = resolveYouratorUrl(makeJob({
    thirdPartyUrl: 'https://boards.greenhouse.io/acme/jobs/42?utm_source=yourator&utm_medium=ads&gh_jid=42',
  }));
  const u = new URL(url);
  assert.equal(u.searchParams.get('utm_source'), null);
  assert.equal(u.searchParams.get('utm_medium'), null);
  assert.equal(u.searchParams.get('gh_jid'), '42');
});

test('resolveYouratorUrl: falls back to the board page when thirdPartyUrl is absent/non-https', () => {
  assert.equal(
    resolveYouratorUrl(makeJob({ thirdPartyUrl: undefined })),
    'https://www.yourator.co/companies/acme/jobs/101',
  );
  // non-https thirdPartyUrl is not trusted → fall back to the board page
  assert.equal(
    resolveYouratorUrl(makeJob({ thirdPartyUrl: 'http://acme.teamdoor.io/jobs/101' })),
    'https://www.yourator.co/companies/acme/jobs/101',
  );
});

test('resolveYouratorUrl: rejects protocol-relative / backslash paths and non-usable rows', () => {
  assert.equal(resolveYouratorUrl({ thirdPartyUrl: '', path: '//evil.example/x' }), '');
  assert.equal(resolveYouratorUrl({ thirdPartyUrl: '', path: '/\\evil.example/x' }), '');
  assert.equal(resolveYouratorUrl({ thirdPartyUrl: '', path: 'not-absolute' }), '');
  assert.equal(resolveYouratorUrl({}), '');
});

// ---------------------------------------------------------------------------
// normalizeYouratorJob
// ---------------------------------------------------------------------------

test('normalizeYouratorJob: maps a row into the web-ui job shape', () => {
  const j = normalizeYouratorJob(makeJob(), 'Portal Fallback');
  assert.equal(j.id, 'yourator-101');
  assert.equal(j.title, '前端工程師 Frontend Engineer');
  assert.equal(j.company, 'Acme Taiwan');
  assert.equal(j.url, 'https://acme.teamdoor.io/jobs/101');
  assert.equal(j.salary, '月薪 60,000 - 90,000 TWD');
  assert.equal(j.location, '臺北市');
  assert.equal(j.isRemote, false);
  assert.equal(j.workplaceType, 'Onsite');
  assert.equal(j.relocates, false);
  assert.equal(j.date, ''); // no absolute postedAt in the payload
  assert.equal(j.source, 'yourator');
});

test('normalizeYouratorJob: company falls back to entry name then "Yourator"', () => {
  assert.equal(normalizeYouratorJob(makeJob({ company: {} }), 'Portal Fallback').company, 'Portal Fallback');
  assert.equal(normalizeYouratorJob(makeJob({ company: undefined })).company, 'Yourator');
});

test('normalizeYouratorJob: drops rows without a title or a usable URL; tolerates junk', () => {
  assert.equal(normalizeYouratorJob(makeJob({ name: '' })), null);
  assert.equal(normalizeYouratorJob(makeJob({ name: '  ' })), null);
  assert.equal(normalizeYouratorJob(makeJob({ thirdPartyUrl: '', path: '//evil/x' })), null);
  assert.equal(normalizeYouratorJob(null), null);
  assert.equal(normalizeYouratorJob('nope'), null);
});

test('normalizeYouratorJob: synthesizes a stable id when the native id is missing', () => {
  const j = normalizeYouratorJob(makeJob({ id: undefined }));
  assert.match(j.id, /^yourator-[a-z0-9]+$/);
  // deterministic — same row → same id
  assert.equal(j.id, normalizeYouratorJob(makeJob({ id: undefined })).id);
});

// ---------------------------------------------------------------------------
// parseYouratorPage
// ---------------------------------------------------------------------------

test('parseYouratorPage: surfaces jobs + the hasMore end-of-board flag', () => {
  const { jobs, hasMore } = parseYouratorPage(makePage([makeJob(), makeJob({ id: 102 })], true));
  assert.equal(jobs.length, 2);
  assert.equal(hasMore, true);
});

test('parseYouratorPage: tolerates a malformed payload (empty jobs, hasMore false)', () => {
  assert.deepEqual(parseYouratorPage(null), { jobs: [], hasMore: false });
  assert.deepEqual(parseYouratorPage({}), { jobs: [], hasMore: false });
  assert.deepEqual(parseYouratorPage({ payload: {} }), { jobs: [], hasMore: false });
  assert.deepEqual(parseYouratorPage({ payload: { jobs: 'nope', hasMore: true } }), { jobs: [], hasMore: false });
});

// ---------------------------------------------------------------------------
// fetchYourator — pagination walk, fail-soft, page cap
// ---------------------------------------------------------------------------

test('fetchYourator: GETs the page-1 feed and normalizes it', async () => {
  const fetchImpl = fakeFetch([makePage([makeJob()], false)]);
  const jobs = await fetchYourator(FEED_URL, { fetchImpl, company: { name: 'Yourator' } });
  assert.equal(jobs.length, 1);
  assert.equal(fetchImpl.calls.length, 1);
  const u = new URL(fetchImpl.calls[0].url);
  assert.equal(u.hostname, 'www.yourator.co');
  assert.equal(u.searchParams.get('page'), '1');
  assert.equal(fetchImpl.calls[0].opts.redirect, 'error');
});

test('fetchYourator: walks every page until hasMore turns false (no dedup)', async () => {
  const page1 = makePage([makeJob({ id: 1 }), makeJob({ id: 2 })], true);
  const page2 = makePage([makeJob({ id: 3 }), makeJob({ id: 4 })], true);
  const page3 = makePage([makeJob({ id: 5 })], false);
  const fetchImpl = fakeFetch([page1, page2, page3]);
  const jobs = await fetchYourator(FEED_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 3);
  assert.deepEqual(fetchImpl.calls.map((c) => new URL(c.url).searchParams.get('page')), ['1', '2', '3']);
  assert.equal(jobs.length, 5); // 2 + 2 + 1, walk stopped by hasMore:false on page 3
});

test('fetchYourator: honors max_pages from the entry even when hasMore stays true', async () => {
  const fullPage = makePage([makeJob({ id: 1 })], true); // always hasMore
  const fetchImpl = fakeFetch([fullPage]);
  await fetchYourator(FEED_URL, { fetchImpl, company: { max_pages: 2 } });
  assert.equal(fetchImpl.calls.length, 2);
});

test('fetchYourator: first-page failure throws; a mid-run blip keeps collected jobs', async () => {
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchYourator(FEED_URL, { fetchImpl: failing }), /HTTP 503/);

  const page1 = makePage([makeJob({ id: 1 }), makeJob({ id: 2 })], true);
  let call = 0;
  const blippy = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => page1 };
    return { ok: false, status: 429 };
  };
  const jobs = await fetchYourator(FEED_URL, { fetchImpl: blippy });
  assert.equal(jobs.length, 2);
});

test('fetchYourator: refuses an off-host endpoint before fetching', async () => {
  const fetchImpl = fakeFetch([makePage([makeJob()], false)]);
  await assert.rejects(
    () => fetchYourator('https://evil.com/api/v4/jobs', { fetchImpl }),
    /untrusted hostname/,
  );
  assert.equal(fetchImpl.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('youratorAdapter: matches provider or a yourator.co host', () => {
  assert.equal(youratorAdapter.id, 'yourator');
  assert.ok(youratorAdapter.matches({ provider: 'yourator' }));
  assert.ok(youratorAdapter.matches({ careers_url: 'https://www.yourator.co/jobs' }));
  assert.ok(youratorAdapter.matches({ api: 'https://yourator.co/api/v4/jobs' }));
  assert.ok(!youratorAdapter.matches({ careers_url: 'https://zhaopin.meituan.com/web/social' }));
  assert.ok(!youratorAdapter.matches({ careers_url: 'https://evil.com/yourator.co' }));
  assert.ok(!youratorAdapter.matches(null));
});

test('youratorAdapter: buildEndpoint pins to the canonical feed, honors an on-host override', () => {
  assert.equal(youratorAdapter.buildEndpoint({ provider: 'yourator' }), FEED_URL);
  // on-host override (www-less) is accepted verbatim
  assert.equal(
    youratorAdapter.buildEndpoint({ yourator: 'https://yourator.co/api/v4/jobs' }),
    'https://yourator.co/api/v4/jobs',
  );
  // off-host override is ignored → canonical feed
  assert.equal(youratorAdapter.buildEndpoint({ api: 'https://evil.com/api' }), FEED_URL);
  assert.equal(youratorAdapter.fetch, fetchYourator);
});

/**
 * JustJoin.it source + adapter — CI-isolated tests (no network, no parent project).
 *
 * v1.242.0: the live candidate-api answers a cursor-paginated envelope
 *   { data: [...offers], meta: { next: { cursor, itemsCount } } }
 * with camelCase rows (employmentTypes[].from/to/currency), NOT the bare
 * snake_case array the v1.80 fixture pinned — the old single fetch threw on
 * every scan and would have seen only the default first page anyway.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchJustJoin,
  assertJustJoinUrl,
  API_URL,
  JOB_BASE,
  JUSTJOIN_HOST_RE,
} from '../server/lib/sources/justjoin.mjs';
import { justjoinAdapter } from '../server/lib/portals/adapters/justjoin.mjs';

// ---------------------------------------------------------------------------
// Fixtures — live camelCase row shape
// ---------------------------------------------------------------------------
const OFFERS = [
  {
    slug: 'acme-senior-go-engineer',
    title: 'Senior Go Engineer',
    companyName: 'Acme Corp',
    city: 'Warsaw',
    workplaceType: 'hybrid',
    publishedAt: '2026-06-25T10:00:00Z',
    employmentTypes: [{ type: 'b2b', from: 18000, to: 24000, currency: 'pln' }],
  },
  {
    slug: 'globex-backend',
    title: 'Backend Developer',
    companyName: 'Globex',
    city: '',
    workplaceType: 'remote',
    publishedAt: '2026-06-20T00:00:00Z',
    employmentTypes: [],
  },
  {
    // no slug — id is the fallback key
    id: 'fallback-id',
    title: 'Data Analyst',
    companyName: 'Initech',
    city: 'Kraków',
    workplaceType: 'full-time',
    publishedAt: null,
    employmentTypes: [{ type: 'permanent', from: 8000, currency: 'pln' }],
  },
];

/** Legacy snake_case row shape (pre-envelope API) — still normalized. */
const LEGACY_OFFERS = [
  {
    slug: 'legacy-role',
    title: 'Legacy Engineer',
    company_name: 'Old Corp',
    city: 'Gdańsk',
    workplace_type: 'remote',
    published_at: '2026-05-01T00:00:00Z',
    employment_types: [{ type: 'b2b', salary: { from: 10000, to: 15000, currency: 'pln' } }],
  },
];

const envelopeOf = (offers, next = null) => ({
  data: offers,
  meta: next ? { next } : {},
});

const fakeFetch = async () => ({ ok: true, json: async () => envelopeOf(OFFERS) });

/** fetchImpl(url) → envelope served per call by `handler(callNumber)`; records calls. */
function pagedFetch(handler) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const page = handler(calls.length);
    if (page instanceof Error) throw page;
    return { ok: true, json: async () => page };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// Source — fetchJustJoin: envelope + normalization
// ---------------------------------------------------------------------------
test('fetchJustJoin: reads the {data, meta} envelope and returns 12-field normalized offers', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs.length, 3);

  const REQUIRED_FIELDS = ['id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const job of jobs) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(Object.hasOwn(job, field), `missing field: ${field}`);
    }
  }
});

test('fetchJustJoin: camelCase live fields normalize (companyName, workplaceType, publishedAt)', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].company, 'Acme Corp');
  assert.equal(jobs[0].workplaceType, 'Hybrid');
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[1].workplaceType, 'Remote');
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[2].workplaceType, 'Onsite');
  assert.equal(jobs[2].isRemote, false);
  assert.equal(jobs[0].date, '2026-06-25');
  assert.equal(jobs[2].date, ''); // null publishedAt
});

test('fetchJustJoin: salary from employmentTypes[].from/to/currency (live shape)', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].salary, '18000–24000 PLN');
  assert.equal(jobs[1].salary, '');          // no employmentTypes
  assert.equal(jobs[2].salary, '≥ 8000 PLN');
});

test('fetchJustJoin: legacy snake_case rows still normalize (employment_types[].salary)', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: async () => ({ ok: true, json: async () => envelopeOf(LEGACY_OFFERS) }) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Old Corp');
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[0].salary, '10000–15000 PLN');
  assert.equal(jobs[0].location, 'Gdańsk');
});

test('fetchJustJoin: url built from JOB_BASE + slug (id fallback)', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].url, `${JOB_BASE}acme-senior-go-engineer`);
  assert.equal(jobs[2].url, `${JOB_BASE}fallback-id`);
  assert.ok(jobs.every((j) => j.url.startsWith('https://justjoin.it/job-offer/')));
});

test('fetchJustJoin: ids prefixed, source pinned, relocates/snippet constants', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.ok(jobs.every((j) => j.id.startsWith('justjoin-') && j.source === 'justjoin'));
  assert.ok(jobs.every((j) => j.relocates === false && j.snippet === ''));
});

test('fetchJustJoin: offers with no slug/id are dropped (stable dedup, never a random id)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => envelopeOf([
    { slug: 'real-role', title: 'Real', companyName: 'Acme' },
    { id: 'abc123', title: 'Id Only', companyName: 'Initech' }, // id falls back as the key → kept
    { title: 'No Key', companyName: 'Ghost' }, // no slug AND no id → dropped
  ]) });
  const jobs = await fetchJustJoin(API_URL, { fetchImpl });
  assert.equal(jobs.length, 2); // real-role + abc123 kept; keyless dropped
  assert.equal(jobs[0].id, 'justjoin-real-role');
  assert.equal(jobs[1].id, 'justjoin-abc123');
});

// ---------------------------------------------------------------------------
// fetchJustJoin — cursor pagination (the parent's walk, v1.242.0)
// ---------------------------------------------------------------------------

test('fetchJustJoin: follows meta.next.cursor via ?from= until it disappears', async () => {
  const fetchImpl = pagedFetch((n) => {
    if (n === 1) return envelopeOf(OFFERS.slice(0, 1), { cursor: 1, itemsCount: 1 });
    if (n === 2) return envelopeOf(OFFERS.slice(1, 3), { cursor: 3, itemsCount: 2 });
    return envelopeOf([OFFERS[0]]); // last page: no meta.next
  });
  const jobs = await fetchJustJoin(API_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(jobs.length, 3); // 1 + 2 + 1, distinct slugs (dup slug on page 3 deduped)
  const first = new URL(fetchImpl.calls[0]);
  assert.equal(first.searchParams.get('from'), '0');
  assert.equal(first.searchParams.get('itemsCount'), '100');
  assert.equal(first.searchParams.get('sortBy'), 'publishedAt');
  const second = new URL(fetchImpl.calls[1]);
  assert.equal(second.searchParams.get('from'), '1'); // the served cursor
});

test('fetchJustJoin: stops on an empty page even when a cursor is offered', async () => {
  const fetchImpl = pagedFetch((n) => (n === 1
    ? envelopeOf(OFFERS.slice(0, 2), { cursor: 2 })
    : envelopeOf([])));
  const jobs = await fetchJustJoin(API_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 2);
});

test('fetchJustJoin: page cap stops the walk (50 pages) even with a permanent cursor', async () => {
  const fetchImpl = pagedFetch(() => envelopeOf(
    [{ slug: `page-${Math.random()}`, title: 'T', companyName: 'C' }],
    { cursor: Math.floor(Math.random() * 100000) },
  ));
  const jobs = await fetchJustJoin(API_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 50);
  assert.equal(jobs.length, 50);
});

test('fetchJustJoin: first-page failure throws; mid-walk failure keeps collected jobs', async () => {
  await assert.rejects(
    () => fetchJustJoin(API_URL, { fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );

  const flaky = pagedFetch((n) => (n === 1 ? envelopeOf(OFFERS.slice(0, 1), { cursor: 1 }) : new Error('boom 429')));
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: flaky });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].slug ?? jobs[0].title, 'Senior Go Engineer');
});

// ---------------------------------------------------------------------------
// Phase-2 shape guards — a 200 that is not the envelope THROWS
// ---------------------------------------------------------------------------

test('fetchJustJoin: throws when the API answers a bare array (stale shape)', async () => {
  const badFetch = async () => ({ ok: true, json: async () => OFFERS });
  await assert.rejects(
    () => fetchJustJoin(API_URL, { fetchImpl: badFetch }),
    /JustJoin offers: expected a JSON object, got an array/,
  );
});

test('fetchJustJoin: throws when the envelope has no data array', async () => {
  const badFetch = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(
    () => fetchJustJoin(API_URL, { fetchImpl: badFetch }),
    /JustJoin offers: expected an array/,
  );
});

test('fetchJustJoin: throws on non-OK response', async () => {
  const badFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchJustJoin(API_URL, { fetchImpl: badFetch }),
    /HTTP 503/,
  );
});

// ---------------------------------------------------------------------------
// assertJustJoinUrl — host-lock
// ---------------------------------------------------------------------------
test('assertJustJoinUrl: accepts valid justjoin.it HTTPS URLs', () => {
  assert.doesNotThrow(() => assertJustJoinUrl(API_URL));
  assert.doesNotThrow(() => assertJustJoinUrl('https://justjoin.it/job-offers/x'));
});

test('assertJustJoinUrl: throws on evil.com', () => {
  assert.throws(() => assertJustJoinUrl('https://evil.com/api/candidate-api/offers'), /untrusted hostname/);
});

test('assertJustJoinUrl: throws on http://', () => {
  assert.throws(() => assertJustJoinUrl('http://justjoin.it/api/candidate-api/offers'), /must use HTTPS/);
});

test('assertJustJoinUrl: throws on invalid URL', () => {
  assert.throws(() => assertJustJoinUrl('not-a-url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// JUSTJOIN_HOST_RE
// ---------------------------------------------------------------------------
test('JUSTJOIN_HOST_RE: matches justjoin.it and subdomains, rejects others', () => {
  assert.ok(JUSTJOIN_HOST_RE.test('justjoin.it'));
  assert.ok(JUSTJOIN_HOST_RE.test('www.justjoin.it'));
  assert.ok(!JUSTJOIN_HOST_RE.test('evil.com'));
  assert.ok(!JUSTJOIN_HOST_RE.test('justjoin.it.evil.com'));
});

// ---------------------------------------------------------------------------
// Adapter — matches + buildEndpoint
// ---------------------------------------------------------------------------
test('adapter.matches: true for provider=justjoin', () => {
  assert.ok(justjoinAdapter.matches({ provider: 'justjoin' }));
});

test('adapter.matches: true for careers_url on justjoin.it', () => {
  assert.ok(justjoinAdapter.matches({ careers_url: 'https://justjoin.it/job-offers/x' }));
});

test('adapter.matches: true for api on justjoin.it', () => {
  assert.ok(justjoinAdapter.matches({ api: API_URL }));
});

test('adapter.matches: false for empty company', () => {
  assert.equal(justjoinAdapter.matches({}), false);
});

test('adapter.matches: false for unrelated provider', () => {
  assert.equal(justjoinAdapter.matches({ provider: 'greenhouse' }), false);
});

test('adapter.buildEndpoint: returns API_URL when no api override', () => {
  assert.equal(justjoinAdapter.buildEndpoint({ provider: 'justjoin' }), API_URL);
});

test('adapter.buildEndpoint: returns API_URL when careers_url is browser URL', () => {
  assert.equal(
    justjoinAdapter.buildEndpoint({ careers_url: 'https://justjoin.it/job-offers/my-company' }),
    API_URL,
  );
});

test('adapter.buildEndpoint: returns custom api if host is justjoin.it', () => {
  const custom = 'https://justjoin.it/api/candidate-api/offers?city=Warsaw';
  assert.equal(justjoinAdapter.buildEndpoint({ api: custom }), custom);
});

test('adapter.buildEndpoint: browser api/careers URL falls back to API_URL (never a fetch endpoint)', () => {
  // A justjoin.it browser job-offers URL passes the host check but is NOT the
  // candidate-api endpoint — it must fall back so fetchJustJoin gets JSON.
  assert.equal(justjoinAdapter.buildEndpoint({ api: 'https://justjoin.it/job-offers/my-company' }), API_URL);
  assert.equal(justjoinAdapter.buildEndpoint({ careers_url: 'https://justjoin.it/job-offers/x' }), API_URL);
});

test('adapter: id and label', () => {
  assert.equal(justjoinAdapter.id, 'justjoin');
  assert.equal(justjoinAdapter.label, 'JustJoin.it');
});

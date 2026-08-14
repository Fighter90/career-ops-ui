/**
 * JustJoin.it source + adapter — CI-isolated tests (no network, no parent project).
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
// Fixtures
// ---------------------------------------------------------------------------
const OFFERS = [
  {
    slug: 'acme-senior-go-engineer',
    title: 'Senior Go Engineer',
    company_name: 'Acme Corp',
    city: 'Warsaw',
    workplace_type: 'hybrid',
    published_at: '2026-06-25T10:00:00Z',
    employment_types: [{ type: 'b2b', salary: { from: 18000, to: 24000, currency: 'pln' } }],
  },
  {
    slug: 'globex-backend',
    title: 'Backend Developer',
    company_name: 'Globex',
    city: '',
    workplace_type: 'remote',
    published_at: '2026-06-20T00:00:00Z',
    employment_types: [],
  },
  {
    // no slug — url should be empty string
    id: 'fallback-id',
    title: 'Data Analyst',
    company_name: 'Initech',
    city: 'Kraków',
    workplace_type: 'full-time',
    published_at: null,
    employment_types: [{ type: 'permanent', salary: { from: 8000, currency: 'pln' } }],
  },
];

const fakeFetch = async () => ({ ok: true, json: async () => OFFERS });

// ---------------------------------------------------------------------------
// Source — fetchJustJoin
// ---------------------------------------------------------------------------
test('fetchJustJoin: returns array of 12-field normalized offers', async () => {
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

test('fetchJustJoin: url built from JOB_BASE + slug', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].url, `${JOB_BASE}acme-senior-go-engineer`);
  assert.equal(jobs[1].url, `${JOB_BASE}globex-backend`);
  // no slug but has id → url built from JOB_BASE + id (normalize uses slug || id)
  assert.equal(jobs[2].url, `${JOB_BASE}fallback-id`);
});

test('fetchJustJoin: source field is always "justjoin"', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.ok(jobs.every((j) => j.source === 'justjoin'));
});

test('fetchJustJoin: id prefixed with "justjoin-"', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.ok(jobs[0].id.startsWith('justjoin-'));
  assert.ok(jobs[1].id.startsWith('justjoin-'));
});

test('fetchJustJoin: offers with no slug/id are dropped (stable dedup, never a random id)', async () => {
  // Previously a missing slug/id minted a random id + empty url, so the same
  // posting got a new id every scan and dedup never matched. Such rows are
  // now dropped, like every other source.
  const fetchImpl = async () => ({ ok: true, json: async () => [
    { slug: 'real-role', title: 'Real', company_name: 'Acme' },
    { id: 'abc123', title: 'Id Only', company_name: 'Initech' }, // id falls back as the key → kept
    { title: 'No Key', company_name: 'Ghost' }, // no slug AND no id → dropped
  ] });
  const jobs = await fetchJustJoin(API_URL, { fetchImpl });
  assert.equal(jobs.length, 2); // real-role + abc123 kept; keyless dropped
  assert.equal(jobs[0].id, 'justjoin-real-role');
  assert.equal(jobs[1].id, 'justjoin-abc123'); // slug = o.slug || o.id
  assert.ok(jobs.every((j) => j.url && /^https:\/\/justjoin\.it\/job-offer\//.test(j.url)));
});

test('fetchJustJoin: workplace type mapping', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].workplaceType, 'Hybrid');
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[1].workplaceType, 'Remote');
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[2].workplaceType, 'Onsite');
  assert.equal(jobs[2].isRemote, false);
});

test('fetchJustJoin: salary formatted from employment_types', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].salary, '18000–24000 PLN');
  assert.equal(jobs[1].salary, '');          // no employment_types
  assert.equal(jobs[2].salary, '≥ 8000 PLN');
});

test('fetchJustJoin: date formatted as YYYY-MM-DD', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.equal(jobs[0].date, '2026-06-25');
  assert.equal(jobs[1].date, '2026-06-20');
  assert.equal(jobs[2].date, '');            // null published_at
});

test('fetchJustJoin: relocates is always false, snippet always empty string', async () => {
  const jobs = await fetchJustJoin(API_URL, { fetchImpl: fakeFetch });
  assert.ok(jobs.every((j) => j.relocates === false));
  assert.ok(jobs.every((j) => j.snippet === ''));
});

test('fetchJustJoin: throws on non-OK response', async () => {
  const badFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchJustJoin(API_URL, { fetchImpl: badFetch }),
    /HTTP 503/
  );
});

test('fetchJustJoin: throws when API returns object instead of array', async () => {
  const badFetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
  await assert.rejects(
    () => fetchJustJoin(API_URL, { fetchImpl: badFetch }),
    /expected array/
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
    API_URL
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

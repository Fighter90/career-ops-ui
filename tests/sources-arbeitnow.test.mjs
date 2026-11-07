/**
 * Arbeitnow source tests (v1.80.0).
 * Board-wide JSON API; CI-isolated — no network, fake fetchImpl throughout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchArbeitnow,
  assertArbeitnowUrl,
  FEED_URL,
} from '../server/lib/sources/arbeitnow.mjs';
import { arbeitnowAdapter } from '../server/lib/portals/adapters/arbeitnow.mjs';

// ---------------------------------------------------------------------------
// Sample payload matching the real Arbeitnow API shape.
// ---------------------------------------------------------------------------
const SAMPLE_DATA = [
  {
    slug: 'senior-backend-engineer-acme-12345',
    company_name: 'Acme Corp',
    title: 'Senior Backend Engineer',
    url: 'https://www.arbeitnow.com/jobs/acme-corp/senior-backend-engineer-12345',
    location: 'Berlin',
    remote: true,
    created_at: 1750000000, // epoch seconds
    tags: ['python', 'django'],
    job_types: ['full-time'],
  },
  {
    slug: 'data-analyst-globex-67890',
    company_name: 'Globex',
    title: 'Data Analyst',
    url: 'https://www.arbeitnow.com/jobs/globex/data-analyst-67890',
    location: 'Munich',
    remote: false,
    created_at: 1750100000,
  },
  {
    // missing title → dropped
    slug: 'no-title',
    company_name: 'Ghost Corp',
    url: 'https://www.arbeitnow.com/jobs/ghost/no-title',
    location: 'Remote',
    remote: true,
    created_at: 1750200000,
  },
  {
    // off-host url → dropped
    slug: 'evil-job',
    company_name: 'Evil Corp',
    title: 'Phishing Engineer',
    url: 'https://evil.com/jobs/phishing',
    location: 'Somewhere',
    remote: false,
    created_at: 1750300000,
  },
  {
    // no url at all → dropped
    slug: 'no-url',
    company_name: 'Mystery Inc',
    title: 'Unknown Role',
    location: 'Nowhere',
    remote: false,
    created_at: 1750400000,
  },
];

function fakeFetch(data = SAMPLE_DATA) {
  return async () => ({
    ok: true,
    json: async () => ({ data }),
  });
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
test('fetchArbeitnow: returns only valid rows (drops no-title, off-host url, no-url)', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.equal(jobs.length, 2);
});

test('fetchArbeitnow: all 12 fields present on every job', async () => {
  const REQUIRED = ['id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  for (const job of jobs) {
    for (const field of REQUIRED) {
      assert.ok(Object.prototype.hasOwnProperty.call(job, field), `missing field: ${field}`);
    }
  }
});

test('fetchArbeitnow: source field is "arbeitnow" on all jobs', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.ok(jobs.every((j) => j.source === 'arbeitnow'));
});

test('fetchArbeitnow: id uses slug prefix', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.ok(jobs[0].id.startsWith('arbeitnow-senior-backend-engineer-acme-12345'));
});

test('fetchArbeitnow: remote flag drives isRemote + workplaceType', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  // First job: remote: true
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
  // Second job: remote: false
  assert.equal(jobs[1].isRemote, false);
  assert.equal(jobs[1].workplaceType, 'Onsite');
});

test('fetchArbeitnow: location appends "Remote" when remote flag is true', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.ok(jobs[0].location.includes('Remote'));
  assert.equal(jobs[1].location, 'Munich');
});

test('fetchArbeitnow: date is YYYY-MM-DD string from epoch seconds', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.match(jobs[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(jobs[1].date, /^\d{4}-\d{2}-\d{2}$/);
});

test('fetchArbeitnow: salary and snippet are empty strings', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.ok(jobs.every((j) => j.salary === '' && j.snippet === ''));
});

test('fetchArbeitnow: relocates is false', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  assert.ok(jobs.every((j) => j.relocates === false));
});

test('fetchArbeitnow: url host-locked to www.arbeitnow.com', async () => {
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch() });
  for (const job of jobs) {
    const host = new URL(job.url).hostname;
    assert.equal(host, 'www.arbeitnow.com');
  }
});

test('fetchArbeitnow: company falls back to "Arbeitnow" when company_name absent', async () => {
  const data = [{
    slug: 'no-company',
    title: 'Orphan Role',
    url: 'https://www.arbeitnow.com/jobs/orphan',
    location: '',
    remote: false,
    created_at: 1750000000,
  }];
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: fakeFetch(data) });
  assert.equal(jobs[0].company, 'Arbeitnow');
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
test('fetchArbeitnow: throws on non-ok HTTP response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchArbeitnow(FEED_URL, { fetchImpl }),
    /HTTP 503/,
  );
});

test('fetchArbeitnow: throws on unexpected response shape (no data array)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ jobs: [] }) });
  await assert.rejects(
    () => fetchArbeitnow(FEED_URL, { fetchImpl }),
    /unexpected API response/,
  );
});

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------
test('assertArbeitnowUrl: accepts valid FEED_URL', () => {
  assert.equal(assertArbeitnowUrl(FEED_URL), FEED_URL);
});

test('assertArbeitnowUrl: rejects non-https URL', () => {
  assert.throws(
    () => assertArbeitnowUrl('http://www.arbeitnow.com/api/job-board-api'),
    /must use HTTPS/,
  );
});

test('assertArbeitnowUrl: rejects off-host URL', () => {
  assert.throws(
    () => assertArbeitnowUrl('https://evil.com/api/job-board-api'),
    /untrusted hostname/,
  );
});

test('assertArbeitnowUrl: rejects invalid URL string', () => {
  assert.throws(
    () => assertArbeitnowUrl('not-a-url'),
    /invalid URL/,
  );
});

test('fetchArbeitnow: rejects SSRF attempt via off-host feedUrl', async () => {
  await assert.rejects(
    () => fetchArbeitnow('https://evil.com/api/job-board-api', { fetchImpl: fakeFetch() }),
    /untrusted hostname/,
  );
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
test('adapter: matches only on provider=arbeitnow', () => {
  assert.ok(arbeitnowAdapter.matches({ provider: 'arbeitnow' }));
  assert.equal(arbeitnowAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(arbeitnowAdapter.matches({ careers_url: 'https://www.arbeitnow.com' }), false);
  assert.equal(arbeitnowAdapter.matches({}), false);
});

test('adapter: buildEndpoint returns FEED_URL by default', () => {
  assert.equal(arbeitnowAdapter.buildEndpoint({ provider: 'arbeitnow' }), FEED_URL);
});

test('adapter: buildEndpoint prefers arbeitnow override, then api', () => {
  const custom = 'https://www.arbeitnow.com/api/job-board-api?page=2';
  assert.equal(arbeitnowAdapter.buildEndpoint({ provider: 'arbeitnow', arbeitnow: custom }), custom);
  assert.equal(arbeitnowAdapter.buildEndpoint({ provider: 'arbeitnow', api: custom }), custom);
});

test('adapter: id, label correct', () => {
  assert.equal(arbeitnowAdapter.id, 'arbeitnow');
  assert.equal(arbeitnowAdapter.label, 'Arbeitnow');
});

test('adapter: fetch is fetchArbeitnow', async () => {
  const jobs = await arbeitnowAdapter.fetch(FEED_URL, { fetchImpl: fakeFetch() });
  assert.equal(jobs.length, 2);
});

// ── Description passthrough (parent #6439) ─────────────────────────────────
// The description ships in the list payload, so it costs no extra request.
// The row must carry it (HTML-stripped) so the en-scanner's content_filter
// (`j.description ?? j.snippet`) and the years_min reader can match on it.

const okArbeitnowJson = (data) => async () => ({ ok: true, json: async () => data });

test('fetchArbeitnow: the HTML description reaches the row as plain text with entities decoded', async () => {
  const json = {
    data: [{
      slug: 'desc-acme',
      company_name: 'Acme',
      title: 'Backend Engineer',
      url: 'https://www.arbeitnow.com/jobs/acme/backend',
      location: 'Berlin',
      remote: false,
      description: '<p><strong>Stack:</strong> TypeScript &amp; Postgres</p><p>Visa sponsorship offered.</p>',
      created_at: 1750000000,
    }],
  };
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: okArbeitnowJson(json) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, 'Stack: TypeScript & Postgres Visa sponsorship offered.');
});

test('fetchArbeitnow: absent, empty, whitespace, non-string or markup-only description stays empty', async () => {
  const mk = (slug, description) => ({
    slug, company_name: 'Acme', title: `Role ${slug}`,
    url: `https://www.arbeitnow.com/jobs/acme/${slug}`, description,
  });
  const json = {
    data: [
      mk('absent'), // absent
      mk('empty', ''),
      mk('ws', '   '),
      mk('num', 42),
      mk('markup', '<br><img src="x">'),
    ],
  };
  const jobs = await fetchArbeitnow(FEED_URL, { fetchImpl: okArbeitnowJson(json) });
  assert.deepEqual(jobs.map((j) => j.description), ['', '', '', '', '']);
});

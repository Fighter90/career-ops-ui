/**
 * Jobicy source (v1.80.0 — parent career-ops parity).
 * Board-wide remote JSON feed; provider-selected. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJobicy, assertJobicyUrl, FEED_URL } from '../server/lib/sources/jobicy.mjs';
import { jobicyAdapter } from '../server/lib/portals/adapters/jobicy.mjs';

// Minimal fake API payload matching Jobicy's actual JSON shape
const FAKE_RESPONSE = {
  jobs: [
    {
      id: 101,
      jobTitle: 'Senior Go Engineer',
      companyName: 'Acme Corp',
      url: 'https://jobicy.com/jobs/101-senior-go-engineer',
      jobGeo: 'Worldwide',
      pubDate: 'Wed, 25 Jun 2026 00:00:00 +0000',
      annualSalaryMin: 120000,
      annualSalaryMax: 160000,
    },
    {
      id: 102,
      jobTitle: 'Backend Developer',
      companyName: 'Globex',
      url: 'https://jobicy.com/jobs/102-backend-developer',
      jobGeo: 'USA Only',
      pubDate: 'Thu, 26 Jun 2026 12:00:00 +0000',
      annualSalaryMin: 0,
      annualSalaryMax: 0,
    },
    {
      // Missing title — should be dropped
      id: 103,
      jobTitle: '',
      companyName: 'Bad Co',
      url: 'https://jobicy.com/jobs/103-empty-title',
    },
    {
      // Bad host — should be dropped
      id: 104,
      jobTitle: 'Sneaky Role',
      companyName: 'Evil Inc',
      url: 'https://evil.com/jobs/104',
    },
    {
      // No URL — should be dropped
      id: 105,
      jobTitle: 'No Link Role',
      companyName: 'Ghost Co',
    },
    {
      // annualSalaryMin only
      id: 106,
      jobTitle: 'Part Salary Role',
      companyName: 'Half Pay Ltd',
      url: 'https://jobicy.com/jobs/106-part-salary',
      jobGeo: 'Remote',
      annualSalaryMin: 80000,
    },
  ],
};

test('fetchJobicy: normalizes valid rows, drops bad rows', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });

  // Only 3 valid rows: id 101, 102, 106 (103 empty title, 104 evil host, 105 no url dropped)
  assert.equal(jobs.length, 3);
});

test('fetchJobicy: 12-field shape on first job', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  const j = jobs[0];

  // All 12 required fields present
  const fields = ['id', 'title', 'company', 'url', 'salary', 'location', 'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const f of fields) {
    assert.ok(Object.prototype.hasOwnProperty.call(j, f), `missing field: ${f}`);
  }

  assert.equal(j.id, 'jobicy-101');
  assert.equal(j.title, 'Senior Go Engineer');
  assert.equal(j.company, 'Acme Corp');
  assert.equal(j.url, 'https://jobicy.com/jobs/101-senior-go-engineer');
  assert.equal(j.location, 'Worldwide');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.relocates, false);
  assert.equal(j.date, '2026-06-25');
  assert.equal(j.snippet, '');
  assert.equal(j.source, 'jobicy');
});

test('fetchJobicy: salary formatted correctly from min+max', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  const j = jobs[0]; // Acme Corp with min=120000 max=160000
  assert.match(j.salary, /120/); // contains 120k value
  assert.match(j.salary, /160/); // contains 160k value
});

test('fetchJobicy: zero salary fields produce empty string', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  const j = jobs[1]; // Globex with min=0 max=0
  assert.equal(j.salary, '');
});

test('fetchJobicy: annualSalaryMin only produces "+" format', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  const j = jobs[2]; // Half Pay Ltd with min=80000 only
  assert.match(j.salary, /80/);
  assert.match(j.salary, /\+/);
});

test('fetchJobicy: annualSalaryMax only produces a "≤ $" figure (keeps the currency marker)', async () => {
  const MAX_ONLY = { jobs: [{
    id: 107, jobTitle: 'Capped Role', companyName: 'Ceiling Co',
    url: 'https://jobicy.com/jobs/107-capped', jobGeo: 'Remote', annualSalaryMax: 90000,
  }] };
  const fetchImpl = async () => ({ ok: true, json: async () => MAX_ONLY });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  assert.equal(jobs[0].salary, '≤ $90,000'); // locale-neutral operator, en-US grouped, $ retained
});

test('fetchJobicy: drops rows with empty title', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  assert.ok(jobs.every((j) => j.title.length > 0));
});

test('fetchJobicy: drops rows with bad host in URL', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => FAKE_RESPONSE });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  assert.ok(jobs.every((j) => new URL(j.url).hostname === 'jobicy.com'));
});

test('fetchJobicy: throws on non-ok HTTP response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchJobicy(FEED_URL, { fetchImpl }),
    /Jobicy: HTTP 503/,
  );
});

test('fetchJobicy: throws on unexpected API shape', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(
    () => fetchJobicy(FEED_URL, { fetchImpl }),
    /unexpected API response/,
  );
});

test('fetchJobicy: missing companyName falls back to "Jobicy"', async () => {
  const payload = {
    jobs: [
      {
        id: 200,
        jobTitle: 'Orphan Role',
        url: 'https://jobicy.com/jobs/200-orphan',
        jobGeo: '',
      },
    ],
  };
  const fetchImpl = async () => ({ ok: true, json: async () => payload });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  assert.equal(jobs[0].company, 'Jobicy');
});

test('fetchJobicy: unparseable pubDate yields empty date string', async () => {
  const payload = {
    jobs: [
      {
        id: 201,
        jobTitle: 'Date Test',
        companyName: 'Date Co',
        url: 'https://jobicy.com/jobs/201-date-test',
        pubDate: 'not-a-date',
      },
    ],
  };
  const fetchImpl = async () => ({ ok: true, json: async () => payload });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  assert.equal(jobs[0].date, '');
});

test('assertJobicyUrl: allows jobicy.com over HTTPS', () => {
  assert.equal(assertJobicyUrl(FEED_URL), FEED_URL);
  assert.equal(assertJobicyUrl('https://jobicy.com/api/v2/remote-jobs?count=100'), 'https://jobicy.com/api/v2/remote-jobs?count=100');
  assert.equal(assertJobicyUrl('https://www.jobicy.com/api/v2/remote-jobs'), 'https://www.jobicy.com/api/v2/remote-jobs');
});

test('assertJobicyUrl: rejects HTTP (non-HTTPS)', () => {
  assert.throws(
    () => assertJobicyUrl('http://jobicy.com/api/v2/remote-jobs?count=50'),
    /must use HTTPS/,
  );
});

test('assertJobicyUrl: rejects untrusted hostname', () => {
  assert.throws(
    () => assertJobicyUrl('https://evil.com/jobicy-mirror'),
    /untrusted hostname/,
  );
});

test('adapter: matches only on provider=jobicy', () => {
  assert.ok(jobicyAdapter.matches({ provider: 'jobicy' }));
  assert.equal(jobicyAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(jobicyAdapter.matches({ careers_url: 'https://jobicy.com' }), false);
});

test('adapter: buildEndpoint returns FEED_URL by default', () => {
  assert.equal(jobicyAdapter.buildEndpoint({ provider: 'jobicy' }), FEED_URL);
});

test('adapter: buildEndpoint prefers jobicy field over api over default', () => {
  const custom = 'https://jobicy.com/api/v2/remote-jobs?count=100';
  assert.equal(jobicyAdapter.buildEndpoint({ provider: 'jobicy', jobicy: custom }), custom);
  const via = 'https://jobicy.com/api/v2/remote-jobs?count=20';
  assert.equal(jobicyAdapter.buildEndpoint({ provider: 'jobicy', api: via }), via);
});

test('adapter: id, label, fetch wired correctly', () => {
  assert.equal(jobicyAdapter.id, 'jobicy');
  assert.equal(jobicyAdapter.label, 'Jobicy');
  assert.equal(typeof jobicyAdapter.fetch, 'function');
});

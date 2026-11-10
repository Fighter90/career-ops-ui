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
    /expected a container/,
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

// ---------------------------------------------------------------------------
// v1.242.0 — cursor pagination (hasMore/nextCursor were read as one page),
// new salary field names (salaryMin/Max/Currency), shape guards, partials
// ---------------------------------------------------------------------------

const mkJobicy = (i, overrides = {}) => ({
  id: i,
  jobTitle: `Role ${i}`,
  companyName: `Co ${i}`,
  url: `https://jobicy.com/jobs/${i}-role`,
  jobGeo: 'Worldwide',
  pubDate: 'Wed, 25 Jun 2026 00:00:00 +0000',
  ...overrides,
});

/**
 * fetchImpl serving cursor pages. `pageFor(pageIndex, callNumber)` returns
 * `{ jobs, hasMore, nextCursor }`. Page 0 is the request without a cursor.
 */
function cursorFake(pageFor) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const cursor = new URL(url).searchParams.get('cursor');
    const page = cursor === null ? 0 : Number(cursor);
    const { jobs, hasMore, nextCursor } = pageFor(page, calls.length);
    return { ok: true, json: async () => ({ jobs, hasMore, nextCursor }) };
  };
  impl.calls = calls;
  return impl;
}

test('fetchJobicy: walks the cursor until hasMore=false, carrying count+cursor params', async () => {
  const impl = cursorFake((page) => (page < 2
    ? { jobs: [mkJobicy(page * 10), mkJobicy(page * 10 + 1)], hasMore: true, nextCursor: String(page + 1) }
    : { jobs: [], hasMore: false, nextCursor: null }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl });

  assert.equal(jobs.length, 4);
  assert.equal(impl.calls.length, 3);
  const u1 = new URL(impl.calls[0]);
  assert.equal(u1.searchParams.get('count'), '50');
  assert.equal(u1.searchParams.get('cursor'), null);
  const u2 = new URL(impl.calls[1]);
  assert.equal(u2.searchParams.get('cursor'), '1'); // the opaque nextCursor, round-tripped
  assert.equal(u2.searchParams.get('count'), '50');
});

test('fetchJobicy: page cap bounds the walk when hasMore never ends', async () => {
  let impl = cursorFake((page) => ({ jobs: [mkJobicy(1000 + page)], hasMore: true, nextCursor: String(page + 1) }));
  let jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl, maxPages: 4 });
  assert.equal(impl.calls.length, 4);
  assert.equal(jobs.length, 4);

  impl = cursorFake((page) => ({ jobs: [mkJobicy(2000 + page)], hasMore: true, nextCursor: String(page + 1) }));
  await fetchJobicy(FEED_URL, { fetchImpl: impl, company: { max_pages: 2 } });
  assert.equal(impl.calls.length, 2);
});

test('fetchJobicy: rows repeated across pages dedup by URL', async () => {
  const dup = mkJobicy(7);
  const impl = cursorFake((page) => (page === 0
    ? { jobs: [mkJobicy(1), dup], hasMore: true, nextCursor: '1' }
    : { jobs: [dup, mkJobicy(2)], hasMore: false, nextCursor: null }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl });
  assert.equal(jobs.length, 3);
});

test('fetchJobicy: a later-page failure keeps the pages already fetched', async () => {
  const impl = cursorFake((page) => {
    if (page === 0) return { jobs: [mkJobicy(1), mkJobicy(2)], hasMore: true, nextCursor: '1' };
    throw new Error('boom 500');
  });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl });
  assert.equal(jobs.length, 2); // partials kept
  assert.equal(impl.calls.length, 2); // walk ended, not aborted
});

test('fetchJobicy: throws on a 200 without the jobs container', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(() => fetchJobicy(FEED_URL, { fetchImpl }), /expected a container/);
});

test('fetchJobicy: salary builds from salaryMin/salaryMax/salaryCurrency', async () => {
  const payload = {
    jobs: [
      mkJobicy(1, { salaryMin: 114297, salaryMax: 235319, salaryCurrency: 'USD', salaryPeriod: 'yearly' }),
      mkJobicy(2, { salaryMin: 60, salaryMax: null, salaryCurrency: 'EUR' }),
      mkJobicy(3, { salaryMin: null, salaryMax: 90, salaryCurrency: 'GBP' }),
      mkJobicy(4, { salaryMin: 0, salaryMax: 0, salaryCurrency: 'USD' }),
      // legacy annual* field names still read as a fallback
      mkJobicy(5, { salaryMin: null, salaryMax: null, salaryCurrency: null, annualSalaryMin: 80000 }),
    ],
  };
  const fetchImpl = async () => ({ ok: true, json: async () => payload });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl });
  assert.equal(jobs[0].salary, '$114,297–$235,319');
  assert.equal(jobs[1].salary, 'EUR 60+');
  assert.equal(jobs[2].salary, '≤ GBP 90');
  assert.equal(jobs[3].salary, '');
  assert.equal(jobs[4].salary, '$80,000+'); // legacy annualSalaryMin
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

// ── Entity decode in the feed's text fields (parent #6492) ─────────────────
// The feed encodes its text ("Zone &#038; Co"); entities must be decoded so
// title filters and blacklist entries written with the real name match, and
// an entity that decodes to whitespace must not pass as a real name.

const okJobicyJson = (data) => async () => ({ ok: true, json: async () => data });

test('fetchJobicy: entities in title, company and location decode', async () => {
  const json = {
    jobs: [{
      id: 201,
      jobTitle: 'Platform &#038; Infra Engineer',
      companyName: 'Zone &#038; Co',
      url: 'https://jobicy.com/jobs/201-zone',
      jobGeo: 'Worldwide &#038; Remote',
    }],
  };
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: okJobicyJson(json) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Platform & Infra Engineer');
  assert.equal(jobs[0].company, 'Zone & Co');
  assert.equal(jobs[0].location, 'Worldwide & Remote');
});

test('fetchJobicy: a company name that decodes to whitespace falls back to the default', async () => {
  const json = {
    jobs: [{
      id: 202,
      jobTitle: 'Backend Developer',
      companyName: '&nbsp;',
      url: 'https://jobicy.com/jobs/202-nbsp-co',
      jobGeo: 'EU',
    }],
  };
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: okJobicyJson(json) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Jobicy');
});

test('fetchJobicy: a title that decodes to whitespace drops the row', async () => {
  const json = {
    jobs: [{
      id: 203,
      jobTitle: '&nbsp;',
      companyName: 'Acme',
      url: 'https://jobicy.com/jobs/203-nbsp-title',
    }],
  };
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: okJobicyJson(json) });
  assert.deepEqual(jobs, []);
});

// ── CAR-255 parity (upstream #6612) — entry filters + walk protections ──────

test('jobicyFilters: valid geo/industry/tag slugs are kept, tag is trimmed', async () => {
  const { jobicyFilters } = await import('../server/lib/sources/jobicy.mjs');
  assert.deepEqual(jobicyFilters({ name: 'J', geo: 'LatAm', industry: 'Engineering', tag: ' Python ' }), {
    geo: 'latam', industry: 'engineering', tag: 'Python',
  });
  assert.deepEqual(jobicyFilters({ name: 'J' }), {});
  assert.deepEqual(jobicyFilters(undefined), {});
});

test('jobicyFilters: a malformed slug or tag throws naming the list to pick from', async () => {
  const { jobicyFilters } = await import('../server/lib/sources/jobicy.mjs');
  assert.throws(() => jobicyFilters({ name: 'J', geo: 'not a slug!' }), /get=locations/);
  assert.throws(() => jobicyFilters({ name: 'J', industry: 'europe!' }), /get=industries/);
  assert.throws(() => jobicyFilters({ name: 'J', tag: 'x'.repeat(101) }), /1-100/);
  assert.throws(() => jobicyFilters({ name: 'J', tag: 'two\nlines' }), /one line/);
});

test('fetchJobicy: entry geo/industry/tag filters ride EVERY page request (#6612)', async () => {
  const impl = cursorFake((page) => (page < 1
    ? { jobs: [mkJobicy(page)], hasMore: true, nextCursor: 'next-1' }
    : { jobs: [mkJobicy(page)], hasMore: false, nextCursor: null }));
  const jobs = await fetchJobicy(FEED_URL, {
    fetchImpl: impl,
    company: { name: 'Jobicy', provider: 'jobicy', geo: 'europe', industry: 'dev', tag: 'python' },
  });
  assert.equal(jobs.length, 2);
  for (const call of impl.calls) {
    const u = new URL(call);
    assert.equal(u.searchParams.get('geo'), 'europe');
    assert.equal(u.searchParams.get('industry'), 'dev');
    assert.equal(u.searchParams.get('tag'), 'python');
  }
});

test('fetchJobicy: a malformed filter is a config error raised before any request', async () => {
  let calls = 0;
  const impl = async (url) => { calls += 1; return { ok: true, json: async () => ({ jobs: [], hasMore: false }) }; };
  await assert.rejects(
    () => fetchJobicy(FEED_URL, { fetchImpl: impl, company: { name: 'J', geo: 'nope nope' } }),
    /slug/);
  assert.equal(calls, 0, 'no request is made with a broken filter');
});

test('fetchJobicy: a repeated cursor is a broken page, not a longer board (#6612)', async () => {
  const impl = cursorFake(() => ({ jobs: [mkJobicy(1)], hasMore: true, nextCursor: 'same' }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl, company: { max_pages: 5 } });
  assert.equal(impl.calls.length, 2, 'page 2 returns the same cursor — the walk stops there');
  assert.deepEqual(jobs.truncated, { reason: 'unrecognised-page', fetched: jobs.length });
});

test('fetchJobicy: an oversized cursor stops the walk (#6612)', async () => {
  const impl = cursorFake((page) => ({ jobs: [mkJobicy(page)], hasMore: true, nextCursor: 'x'.repeat(4097) }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl, company: { max_pages: 5 } });
  assert.equal(impl.calls.length, 1, 'the oversized cursor is refused before a second request');
  assert.deepEqual(jobs.truncated, { reason: 'unrecognised-page', fetched: jobs.length });
});

test('fetchJobicy: a later-page failure marks the board partial (fetch-error)', async () => {
  const impl = cursorFake((page) => {
    if (page === 0) return { jobs: [mkJobicy(1), mkJobicy(2)], hasMore: true, nextCursor: '1' };
    throw new Error('boom 500');
  });
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl });
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.truncated, { reason: 'fetch-error', fetched: 2 });
});

test('fetchJobicy: a config cap stop marks the board partial (page-cap)', async () => {
  const impl = cursorFake((page) => ({ jobs: [mkJobicy(1000 + page)], hasMore: true, nextCursor: String(page + 1) }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl, company: { name: 'J', max_pages: 3 } });
  assert.equal(impl.calls.length, 3);
  assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: 3 });
});

test('fetchJobicy: an explicit maxPages probe cap never reads as a cap stop', async () => {
  const impl = cursorFake((page) => ({ jobs: [mkJobicy(1000 + page)], hasMore: true, nextCursor: String(page + 1) }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl, maxPages: 2 });
  assert.equal(impl.calls.length, 2);
  assert.equal(jobs.truncated, undefined, 'a probe budget is not a partial read');
});

test('fetchJobicy: a natural end carries no truncation mark', async () => {
  const impl = cursorFake((page) => (page < 1
    ? { jobs: [mkJobicy(page)], hasMore: true, nextCursor: 'next-1' }
    : { jobs: [mkJobicy(page)], hasMore: false, nextCursor: null }));
  const jobs = await fetchJobicy(FEED_URL, { fetchImpl: impl });
  assert.equal(jobs.truncated, undefined);
});

test('adapter: buildEndpoint carries the entry filters (#6612)', async () => {
  const { FEED_URL: feed } = await import('../server/lib/sources/jobicy.mjs');
  const endpoint = jobicyAdapter.buildEndpoint({
    name: 'Jobicy', provider: 'jobicy', geo: 'europe', industry: 'dev', tag: 'python',
  });
  const u = new URL(endpoint);
  assert.equal(u.origin + u.pathname, 'https://jobicy.com/api/v2/remote-jobs');
  assert.equal(u.searchParams.get('geo'), 'europe');
  assert.equal(u.searchParams.get('industry'), 'dev');
  assert.equal(u.searchParams.get('tag'), 'python');
  // A malformed filter falls back to the unfiltered feed at endpoint time
  // (fetch() is the one that throws, before any request).
  assert.equal(
    jobicyAdapter.buildEndpoint({ name: 'Jobicy', provider: 'jobicy', geo: 'nope nope' }),
    feed);
});

/**
 * 4 Day Week source + adapter — CI-isolated (fake fetchImpl, no network).
 * Covers: pagination (has_more loop), is_expired drop, no-slug drop,
 * epoch-seconds→date, 12-field shape, SSRF guard, adapter contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetch4DayWeek,
  assert4DayWeekUrl,
  FEED_BASE,
  JOB_BASE,
  meta,
} from '../server/lib/sources/4dayweek.mjs';
import { fourDayWeekAdapter } from '../server/lib/portals/adapters/4dayweek.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAGE1_JOBS = [
  {
    id: 101,
    title: 'Senior Engineer',
    slug: 'senior-engineer-acme',
    company_name: 'Acme Corp',
    work_arrangement: 'remote',
    remote: true,
    locations: [{ city: 'London', country: 'UK' }],
    posted: 1750000000, // epoch seconds
    is_expired: false,
    salary: '$100k–$130k',
  },
  {
    // is_expired → must be dropped
    id: 102,
    title: 'Expired Role',
    slug: 'expired-role',
    company_name: 'Ghost Inc',
    posted: 1750000001,
    is_expired: true,
  },
  {
    // no slug → must be dropped
    id: 103,
    title: 'No Slug Role',
    slug: '',
    company_name: 'Slugless Ltd',
    posted: 1750000002,
    is_expired: false,
  },
];

const PAGE2_JOBS = [
  {
    id: 201,
    title: 'Product Designer',
    slug: 'product-designer-beta',
    company: { name: 'Beta Studio' }, // no company_name — use nested company.name
    work_arrangement: 'hybrid',
    remote: false,
    locations: [{ city: 'Berlin', country: 'Germany' }],
    posted: 1749000000,
    is_expired: false,
    salary: '',
  },
];

/** Fake fetchImpl that serves page 1 with has_more:true then page 2 with has_more:false */
function makePagedFetch() {
  let call = 0;
  return async (_url, _opts) => {
    call += 1;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({ jobs: PAGE1_JOBS, has_more: true, page: 1 }),
      };
    }
    return {
      ok: true,
      json: async () => ({ jobs: PAGE2_JOBS, has_more: false, page: 2 }),
    };
  };
}

// ---------------------------------------------------------------------------
// Pagination + normalization
// ---------------------------------------------------------------------------

test('fetch4DayWeek: paginates across two pages, drops expired and no-slug', async () => {
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl: makePagedFetch(), maxPages: 5 });
  // PAGE1: 1 valid (101); 102 expired, 103 no-slug → dropped. PAGE2: 1 valid (201).
  assert.equal(jobs.length, 2);
});

test('fetch4DayWeek: first job has correct 12-field shape', async () => {
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl: makePagedFetch(), maxPages: 5 });
  const j = jobs[0];

  // All 12 fields present
  const REQUIRED = ['id', 'title', 'company', 'url', 'salary', 'location', 'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const f of REQUIRED) {
    assert.ok(Object.prototype.hasOwnProperty.call(j, f), `missing field: ${f}`);
  }

  assert.equal(j.id, '4dayweek-101');
  assert.equal(j.title, 'Senior Engineer');
  assert.equal(j.company, 'Acme Corp');
  assert.ok(j.url.startsWith(JOB_BASE), `url should start with JOB_BASE, got ${j.url}`);
  assert.equal(j.url, `${JOB_BASE}senior-engineer-acme`);
  assert.equal(j.salary, '$100k–$130k');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.relocates, false);
  assert.equal(j.snippet, '');
  assert.equal(j.source, '4dayweek');

  // epoch 1750000000 s → YYYY-MM-DD (just check format)
  assert.match(j.date, /^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
  // Sanity-check the year makes sense
  assert.ok(j.date >= '2025-01-01', `date ${j.date} too old`);
});

test('fetch4DayWeek: epoch seconds converted correctly', async () => {
  const EPOCH_S = 1750000000;
  const expected = new Date(EPOCH_S * 1000).toISOString().slice(0, 10);
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl: makePagedFetch(), maxPages: 5 });
  assert.equal(jobs[0].date, expected);
});

test('fetch4DayWeek: second page job uses nested company.name fallback', async () => {
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl: makePagedFetch(), maxPages: 5 });
  assert.equal(jobs[1].company, 'Beta Studio');
  assert.equal(jobs[1].isRemote, false);
});

// ---------------------------------------------------------------------------
// Single-page cap (maxPages:1 stops after page 1 even if has_more:true)
// ---------------------------------------------------------------------------

test('fetch4DayWeek: respects maxPages=1, stops after first page', async () => {
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl: makePagedFetch(), maxPages: 1 });
  assert.equal(jobs.length, 1); // only the valid job from page 1
});

// ---------------------------------------------------------------------------
// First-page HTTP error throws
// ---------------------------------------------------------------------------

test('fetch4DayWeek: throws on first-page HTTP error', async () => {
  const badFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetch4DayWeek(FEED_BASE, { fetchImpl: badFetch }),
    /HTTP 503/,
  );
});

// ── v1.242.0 phase-2: entry max_pages, query-safe page URLs, later-page partials ──

test('fetch4DayWeek: the entry max_pages (opts.company.max_pages) is honored, not just opts.maxPages', async () => {
  // The scanner threads the company entry through opts.company; previously
  // only opts.maxPages was read, so an entry's max_pages was dead config and
  // the walk defaulted to 3 pages.
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ jobs: PAGE1_JOBS, has_more: true, page: 1 }) };
  };
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl, company: { max_pages: 1 } });
  assert.equal(calls, 1);
  assert.equal(jobs.length, 1);
});

test('fetch4DayWeek: ?page=N is appended with URL() — a base that already has a query still works', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => ({ jobs: [], has_more: false }) };
  };
  await fetch4DayWeek('https://4dayweek.io/api/jobs?mirror=1', { fetchImpl });
  assert.deepEqual(urls, ['https://4dayweek.io/api/jobs?mirror=1&page=1'],
    `string-concat produced a broken URL: ${urls[0]}`);
});

test('fetch4DayWeek: a later page with unparseable JSON keeps the collected jobs (partials, logged)', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return { ok: true, json: async () => ({ jobs: PAGE1_JOBS, has_more: true, page: 1 }) };
    // a 200 whose body is not JSON — previously res.json() threw out of the
    // loop and discarded everything already collected
    return { ok: true, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } };
  };
  const jobs = await fetch4DayWeek(FEED_BASE, { fetchImpl, maxPages: 5 });
  assert.equal(jobs.length, 1, "a page-2 JSON failure must not discard page 1's jobs");
});

test('fetch4DayWeek: an unexpected-shape page 1 still throws (no silent empty board)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ listings: [] }) }); // "jobs" renamed
  await assert.rejects(
    () => fetch4DayWeek(FEED_BASE, { fetchImpl }),
    /unexpected API response on page 1/,
  );
});

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

test('assert4DayWeekUrl: accepts valid 4dayweek.io URL', () => {
  assert.equal(assert4DayWeekUrl(FEED_BASE), FEED_BASE);
  assert.equal(assert4DayWeekUrl(`${JOB_BASE}some-slug`), `${JOB_BASE}some-slug`);
});

test('assert4DayWeekUrl: rejects http (non-https)', () => {
  assert.throws(
    () => assert4DayWeekUrl('http://4dayweek.io/api/jobs'),
    /must use HTTPS/,
  );
});

test('assert4DayWeekUrl: rejects untrusted hostname', () => {
  assert.throws(
    () => assert4DayWeekUrl('https://evil.com/api/jobs'),
    /untrusted hostname/,
  );
});

test('assert4DayWeekUrl: rejects malformed URL', () => {
  assert.throws(
    () => assert4DayWeekUrl('not-a-url'),
    /invalid URL/,
  );
});

// ---------------------------------------------------------------------------
// meta export
// ---------------------------------------------------------------------------

test('meta: correct value/label/region', () => {
  assert.equal(meta.value, '4dayweek');
  assert.equal(meta.label, '4 Day Week');
  assert.equal(meta.region, 'en');
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('adapter: id and label', () => {
  assert.equal(fourDayWeekAdapter.id, '4dayweek');
  assert.equal(fourDayWeekAdapter.label, '4 Day Week');
});

test('adapter: matches only on provider=4dayweek', () => {
  assert.ok(fourDayWeekAdapter.matches({ provider: '4dayweek' }));
  assert.equal(fourDayWeekAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(fourDayWeekAdapter.matches({ careers_url: 'https://4dayweek.io' }), false);
});

test('adapter: buildEndpoint returns FEED_BASE by default', () => {
  assert.equal(fourDayWeekAdapter.buildEndpoint({ provider: '4dayweek' }), FEED_BASE);
});

test('adapter: buildEndpoint prefers 4dayweek key over api key', () => {
  const custom = 'https://4dayweek.io/api/jobs';
  assert.equal(
    fourDayWeekAdapter.buildEndpoint({ provider: '4dayweek', '4dayweek': custom }),
    custom,
  );
  assert.equal(
    fourDayWeekAdapter.buildEndpoint({ provider: '4dayweek', api: custom }),
    custom,
  );
});

test('adapter: fetch is fetch4DayWeek', async () => {
  const jobs = await fourDayWeekAdapter.fetch(FEED_BASE, { fetchImpl: makePagedFetch(), maxPages: 5 });
  assert.equal(jobs.length, 2);
});

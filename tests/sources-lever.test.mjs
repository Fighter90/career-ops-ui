/**
 * Lever source — location folding and the salaryRange port.
 *
 * Location: Lever puts a SINGLE primary city in `categories.location` and the
 * full set on multi-location postings in `categories.allLocations`; reading
 * only the primary silently hid every other eligible location from
 * location_filter (a req open in Barcelona AND Montevideo looked
 * Barcelona-only). fetchLever now merges them, deduped.
 *
 * Salary (CAR-271, parent #6907/#6922): Lever's `salaryRange` is
 * { currency, interval, min, max } with a per-{period}-{salary|wage}
 * interval; leverSalary() annualizes it into the Job.salary bounds
 * (40 h/week · 52 weeks/year basis, same as Ashby) and the posting's
 * `salary` field renders the annual string. An unknown interval leaves
 * salary OFF rather than guessing.
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLever, assertLeverUrl, leverSalary } from '../server/lib/sources/lever.mjs';
import { buildLocationFilter } from '../server/lib/location-filter.mjs';

const fake = (jobs) => async () => ({ ok: true, status: 200, json: async () => jobs });

test('lever: folds allLocations into location, deduped, primary first', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '1', text: 'Backend Engineer',
      categories: { location: 'Barcelona', allLocations: ['Barcelona', 'Montevideo'] },
      hostedUrl: 'https://jobs.lever.co/acme/1',
    }]),
  });
  assert.equal(job.location, 'Barcelona · Montevideo'); // both, deduped, primary first
});

test('lever: allLocations only (no primary) still surfaces every location', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '2', text: 'SRE',
      categories: { allLocations: ['Berlin', 'Remote - EU'] },
      hostedUrl: 'https://jobs.lever.co/acme/2',
    }]),
  });
  assert.equal(job.location, 'Berlin · Remote - EU');
  assert.equal(job.isRemote, true); // remote detection reads the merged location
});

test('lever: primary only (no allLocations) is unchanged', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '3', text: 'PM',
      categories: { location: 'London' },
      hostedUrl: 'https://jobs.lever.co/acme/3',
    }]),
  });
  assert.equal(job.location, 'London');
});

// ---------------------------------------------------------------------------
// workplaceType = remote (upstream #6138)
// ---------------------------------------------------------------------------

// workplaceType is a TOP-LEVEL posting flag (remote | hybrid | onsite), not a
// location. categories.location is the city only, so a remote London posting
// looked onsite to a location filter that allows "Remote". Hybrid stays
// city-only: the office is still the place. A location that already says
// remote (word-bounded — "Remotely in Europe" does not count) is not doubled.
test('lever: Remote is appended when workplaceType is remote and no place already says it', async () => {
  const fake = (jobs) => async () => ({ ok: true, status: 200, json: async () => jobs });
  const rows = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([
      { id: 'r1', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r1', categories: { location: 'Oslo' }, workplaceType: 'remote' },
      { id: 'r2', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r2', categories: { location: 'Oslo' }, workplaceType: 'hybrid' },
      { id: 'r3', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r3', categories: { location: 'Remote — Europe' }, workplaceType: 'remote' },
      { id: 'r4', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r4', categories: { location: 'Bend, OR', allLocations: ['Bend, OR', 'Oslo'] }, workplaceType: 'Remote' },
      { id: 'r5', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r5', categories: { location: 'Oslo' }, workplaceType: 'onsite' },
      { id: 'r6', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r6', categories: { location: 'Oslo' }, workplaceType: '  remote  ' },
      { id: 'r7', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r7', categories: {}, workplaceType: 'remote' },
      { id: 'r8', text: 'Ops Lead', hostedUrl: 'https://jobs.lever.co/acme/r8', categories: { location: 'Remotely in Europe' }, workplaceType: 'remote' },
    ]),
  });
  const locs = rows.map((r) => r.location);
  assert.deepEqual(locs, [
    'Oslo · Remote',
    'Oslo',                        // hybrid — the office is still the place
    'Remote — Europe',             // already says remote — not doubled
    'Bend, OR · Oslo · Remote',    // padded flag matched case-insensitively
    'Oslo',                        // onsite
    'Oslo · Remote',               // padded flag
    'Remote',                      // no place at all
    'Remotely in Europe · Remote', // word boundary: "Remotely" is not "remote"
  ]);
  assert.equal(rows[0].isRemote, true);
  assert.equal(rows[0].workplaceType, 'Remote');
  assert.equal(rows[1].isRemote, false);
});

// The point of the fix: ask the real consumer, not a reimplementation of it.
test('lever: the appended Remote survives a location filter that allows it and drops the city-only cell', () => {
  const allowRemote = buildLocationFilter({ allow: ['remote'] });
  assert.equal(allowRemote('London'), false, 'precondition: the city-only cell was dropped');
  assert.equal(allowRemote('London · Remote'), true, 'the marked cell passes');
});

// ---------------------------------------------------------------------------

test('assertLeverUrl: accepts the pinned API hosts over HTTPS', () => {
  assert.equal(assertLeverUrl('https://api.lever.co/v0/postings/acme'), 'https://api.lever.co/v0/postings/acme');
  assert.equal(assertLeverUrl('https://api.eu.lever.co/v0/postings/acme'), 'https://api.eu.lever.co/v0/postings/acme');
});

test('assertLeverUrl: rejects lookalikes, plain HTTP and junk', () => {
  // clever.com contains 'lever.co' — the old substring claim was the SSRF hole.
  assert.throws(() => assertLeverUrl('https://clever.com/v0/postings/x'), /untrusted hostname/);
  assert.throws(() => assertLeverUrl('https://api.lever.co.evil.com/v0/postings/x'), /untrusted hostname/);
  assert.throws(() => assertLeverUrl('https://evil.com/?q=api.lever.co'), /untrusted hostname/);
  assert.throws(() => assertLeverUrl('http://api.lever.co/v0/postings/x'), /must use HTTPS/);
  assert.throws(() => assertLeverUrl('not a url'), /invalid URL/);
});

test('fetchLever: refuses an off-host api before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => [] }; };
  await assert.rejects(
    () => fetchLever('https://evil.com/v0/postings/acme', { fetchImpl }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

test('fetchLever: sends redirect:error (a 302 can never be followed off-host)', async () => {
  let seen = null;
  const fetchImpl = async (url, opts) => {
    seen = opts;
    return { ok: true, json: async () => [] };
  };
  await fetchLever('https://api.lever.co/v0/postings/acme', { fetchImpl });
  assert.equal(seen.redirect, 'error');
  assert.equal(seen.headers['User-Agent'], 'career-ops-web-ui/1.0');
});

test('fetchLever: wrong-shape 200 throws (Phase 2), never reads as an empty board', async () => {
  await assert.rejects(
    () => fetchLever('https://api.lever.co/v0/postings/acme', {
      fetchImpl: async () => ({ ok: true, json: async () => ({ error: 'not postings' }) }),
    }),
    /Lever postings: expected an array/,
  );
});

test('lever: categories.commitment never leaks into workplaceType', async () => {
  const [job] = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([{
      id: '4', text: 'Full-stack Engineer',
      categories: { commitment: 'Full-time', location: 'Warsaw', team: 'Platform' },
      hostedUrl: 'https://jobs.lever.co/acme/4',
    }]),
  });
  assert.equal(job.workplaceType, 'Onsite'); // was 'Full-time'
  assert.equal(job.isRemote, false);
  assert.equal(job.snippet, 'Platform'); // team still feeds snippet
});

// ---------------------------------------------------------------------------
// salaryRange → Job.salary (CAR-271, parent #6907/#6922)
// ---------------------------------------------------------------------------

// Lever's salaryRange is { currency, interval, min, max }; the interval names
// the pay period. The annualization basis is the same as Ashby's: 40 h/week,
// 52 weeks/year, 5 days/week — so an hourly wage reads as a comparable annual
// figure instead of a number 2080× too small.
test('leverSalary: annualizes every documented interval on the 40h/52w basis', () => {
  const cases = [
    // [interval, min, max, multiplier, expectedMin, expectedMax]
    ['per-year-salary', 100000, 150000, 1, 100000, 150000],
    ['per-hour-wage', 50, 60, 2080, 104000, 124800],
    ['per-day-wage', 400, 500, 260, 104000, 130000],
    ['per-week-wage', 2000, 2500, 52, 104000, 130000],
    ['per-month-salary', 8000, 10000, 12, 96000, 120000],
  ];
  for (const [interval, min, max, , expMin, expMax] of cases) {
    assert.deepEqual(
      leverSalary({ salaryRange: { currency: 'USD', interval, min, max } }),
      { min: expMin, max: expMax, currency: 'USD' },
      `${interval} should annualize by its multiplier`,
    );
  }
});

test('leverSalary: a one-sided range fills the missing bound from the other', () => {
  assert.deepEqual(
    leverSalary({ salaryRange: { currency: 'USD', interval: 'per-year-salary', min: 90000 } }),
    { min: 90000, max: 90000, currency: 'USD' },
  );
  assert.deepEqual(
    leverSalary({ salaryRange: { currency: 'EUR', interval: 'per-hour-wage', max: 60 } }),
    { min: 124800, max: 124800, currency: 'EUR' },
  );
});

test('leverSalary: bounds are ordered min<=max even when the board lists them reversed', () => {
  assert.deepEqual(
    leverSalary({ salaryRange: { currency: 'USD', interval: 'per-year-salary', min: 150000, max: 100000 } }),
    { min: 100000, max: 150000, currency: 'USD' },
  );
});

// Only a real, finite, non-negative number counts. A string bound ("100k") is
// junk, not a figure in the wrong unit; a negative number is junk too.
test('leverSalary: non-number, negative and non-finite bounds are ignored', () => {
  const range = { currency: 'USD', interval: 'per-year-salary' };
  // Both bounds junk → no usable figure at all.
  assert.equal(leverSalary({ salaryRange: { ...range, min: '100k', max: null } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range, min: -5, max: -1 } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range, min: Infinity, max: NaN } }), undefined);
  // One real bound survives the junk on the other side (one-sided fill).
  assert.deepEqual(
    leverSalary({ salaryRange: { ...range, min: '100k', max: 120000 } }),
    { min: 120000, max: 120000, currency: 'USD' },
  );
  assert.deepEqual(
    leverSalary({ salaryRange: { ...range, min: 0, max: 100000 } }),
    { min: 0, max: 100000, currency: 'USD' },
    '0 is a valid non-negative bound (and the old truthy-min check silently dropped it)',
  );
});

// An interval outside the table leaves salary OFF — the parent never guesses a
// multiplier. 'constructor' resolves to a truthy non-number through the
// prototype, which would annualize to NaN without the Object.hasOwn guard.
test('leverSalary: an unknown or prototype-named interval leaves salary off', () => {
  const range = { currency: 'USD', min: 100000, max: 150000 };
  assert.equal(leverSalary({ salaryRange: { ...range, interval: 'per-fortnight-wage' } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range, interval: 'constructor' } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range, interval: 'toString' } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range, interval: 12 } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range, interval: null } }), undefined);
  assert.equal(leverSalary({ salaryRange: { ...range } }), undefined);
});

test('leverSalary: a missing or non-object salaryRange leaves salary off', () => {
  assert.equal(leverSalary({}), undefined);
  assert.equal(leverSalary({ salaryRange: null }), undefined);
  assert.equal(leverSalary({ salaryRange: '100-150k USD' }), undefined);
  assert.equal(leverSalary({ salaryRange: [] }), undefined);
  assert.equal(leverSalary(null), undefined);
  assert.equal(leverSalary(undefined), undefined);
});

test('leverSalary: currency is trimmed and uppercased; a non-string becomes ""', () => {
  assert.deepEqual(
    leverSalary({ salaryRange: { currency: ' usd ', interval: 'per-year-salary', min: 1, max: 2 } }).currency,
    'USD',
  );
  assert.deepEqual(
    leverSalary({ salaryRange: { currency: 'eur', interval: 'per-year-salary', min: 1, max: 2 } }).currency,
    'EUR',
  );
  assert.deepEqual(
    leverSalary({ salaryRange: { interval: 'per-year-salary', min: 1, max: 2 } }).currency,
    '',
  );
  assert.deepEqual(
    leverSalary({ salaryRange: { currency: 42, interval: 'per-year-salary', min: 1, max: 2 } }).currency,
    '',
  );
});

// The web-ui job shape carries salary as a display STRING (the en-scanner's
// `comp`, the pipeline column, scan-results' salaryHead). The posting field is
// the annual string: bounds en-dash joined, currency after a space.
test('fetchLever: maps salaryRange into the annual salary string, ordered, uppercased', async () => {
  const rows = await fetchLever('https://api.lever.co/v0/postings/acme', {
    fetchImpl: fake([
      {
        id: 's1', text: 'Eng', hostedUrl: 'https://jobs.lever.co/acme/s1',
        categories: { location: 'Berlin' },
        salaryRange: { currency: 'usd', interval: 'per-hour-wage', min: 60, max: 50 },
      },
      {
        id: 's2', text: 'Eng', hostedUrl: 'https://jobs.lever.co/acme/s2',
        categories: { location: 'Berlin' },
        salaryRange: { currency: 'EUR', interval: 'per-year-salary', min: 70000 },
      },
      {
        id: 's3', text: 'Eng', hostedUrl: 'https://jobs.lever.co/acme/s3',
        categories: { location: 'Berlin' },
      },
      {
        id: 's4', text: 'Eng', hostedUrl: 'https://jobs.lever.co/acme/s4',
        categories: { location: 'Berlin' },
        salaryRange: { currency: 'USD', interval: 'per-fortnight-wage', min: 1, max: 2 },
      },
    ]),
  });
  assert.equal(rows[0].salary, '104000–124800 USD', 'reversed bounds ordered + hourly annualized ×2080');
  assert.equal(rows[1].salary, '70000–70000 EUR', 'one-sided range mirrored into both bounds');
  assert.equal(rows[2].salary, '', 'no salaryRange → empty string, not undefined');
  assert.equal(rows[3].salary, '', 'unknown interval → salary OFF, never guessed');
});

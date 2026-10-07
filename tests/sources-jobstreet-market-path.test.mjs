/**
 * Jobstreet / SEEK — market-aware job-detail path, plus the opt-in
 * `appendWorkType` title suffix. Parent career-ops parity
 * (providers/jobstreet.mjs).
 *
 * THE BUG: `parseJobstreetItem` built every detail URL as
 * `${origin}/id/job/${id}`. `/id/` is the INDONESIAN LOCALE PREFIX, not a
 * literal — it is correct only for the Indonesian hosts. Every other
 * SEEK-platform host in `ALLOWED_JOBSTREET_HOSTS` (www.seek.com.au,
 * www.seek.co.nz, sg/my.jobstreet.com, hk.jobsdb.com) serves `/job/<id>` and
 * answers 404 on `/id/job/<id>`, so every Australian, New Zealand,
 * Singaporean, Malaysian and Hong Kong posting linked to a dead page.
 *
 * The fix keys the path on the hostname rather than flipping it globally —
 * a global switch either way breaks one market.
 *
 * Invariants this suite also pins, because the fix touches the same lines:
 *   - the lone-surrogate guard still leaves `url` empty (never throws), so the
 *     posting falls through to its own `item.jobUrl`;
 *   - the final ALLOWED_JOBSTREET_HOSTS check still runs on the built URL;
 *   - `export const meta` is unchanged, so the portal registry does not move.
 *
 * CI-isolated: fake fetchImpl, no network, no parent-project dependency.
 * URL assertions compare the whole string with `assert.equal` — never
 * `String.includes` and never an unanchored regex, both of which CodeQL flags
 * as incomplete URL checks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJobstreetItem,
  fetchJobstreet,
  meta,
} from '../server/lib/sources/jobstreet.mjs';

/** A lone high surrogate — what encodeURIComponent rejects. */
const LONE = '\uD800';

/** fetchImpl(url, opts) → {ok:true, json}; `handler(call, n)` returns the body. */
function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, opts) => {
    const call = { url, opts };
    calls.push(call);
    return { ok: true, json: async () => handler(call, calls.length) };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// Market-aware job-detail path
// ---------------------------------------------------------------------------

test('parseJobstreetItem: non-Indonesian markets get /job/<id>, with no /id/ locale prefix', () => {
  const cases = [
    ['https://www.seek.com.au', '94036672', 'https://www.seek.com.au/job/94036672'],
    ['https://www.seek.co.nz', '94036673', 'https://www.seek.co.nz/job/94036673'],
    ['https://sg.jobstreet.com', '94244276', 'https://sg.jobstreet.com/job/94244276'],
    ['https://my.jobstreet.com', '94244277', 'https://my.jobstreet.com/job/94244277'],
    ['https://hk.jobsdb.com', '94244278', 'https://hk.jobsdb.com/job/94244278'],
  ];
  for (const [origin, id, expected] of cases) {
    const job = parseJobstreetItem({ id, title: 'Strategy Consultant' }, origin, 'Acme');
    assert.ok(job, `${origin}: expected a parsed job, got ${JSON.stringify(job)}`);
    assert.equal(job.url, expected, `${origin}: wrong detail URL`);
  }
});

test('parseJobstreetItem: the Indonesian hosts keep the /id/ locale prefix', () => {
  const cases = [
    ['https://id.jobstreet.com', '92996157', 'https://id.jobstreet.com/id/job/92996157'],
    ['https://www.jobstreet.co.id', '92996158', 'https://www.jobstreet.co.id/id/job/92996158'],
    ['https://jobstreet.co.id', '92996159', 'https://jobstreet.co.id/id/job/92996159'],
  ];
  for (const [origin, id, expected] of cases) {
    const job = parseJobstreetItem({ id, title: 'Facility Engineer' }, origin, 'Acme');
    assert.ok(job, `${origin}: expected a parsed job, got ${JSON.stringify(job)}`);
    assert.equal(job.url, expected, `${origin}: wrong detail URL`);
  }
});

test('parseJobstreetItem: an unparseable origin falls through to the common /job/ path without throwing', () => {
  // The host lookup must not be the thing that explodes on a malformed origin.
  // The built URL is still rejected by the allowlist check below it, so the
  // observable result is a dropped posting — never a thrown parser.
  let out;
  assert.doesNotThrow(() => {
    out = parseJobstreetItem({ id: 'g-1', title: 'Good' }, 'not a url', 'Acme');
  });
  assert.equal(out, null, 'a posting on an unparseable origin is dropped, not returned');
});

// ---------------------------------------------------------------------------
// Preserved invariants — the fix rewrites these exact lines
// ---------------------------------------------------------------------------

test('parseJobstreetItem: a lone-surrogate id still falls through to item.jobUrl instead of throwing', () => {
  let job;
  assert.doesNotThrow(() => {
    job = parseJobstreetItem(
      { id: `${LONE}bad`, title: 'Has URL', jobUrl: 'https://www.seek.com.au/job/77' },
      'https://www.seek.com.au',
      'Acme',
    );
  }, 'a lone surrogate in the id must not throw URIError out of the parser');
  assert.ok(job, 'expected the posting to survive via its own jobUrl');
  assert.equal(job.url, 'https://www.seek.com.au/job/77');
});

test('parseJobstreetItem: a lone-surrogate id with no jobUrl drops just that posting', () => {
  let job;
  assert.doesNotThrow(() => {
    job = parseJobstreetItem({ id: `${LONE}bad`, title: 'Bad' }, 'https://www.seek.com.au', 'Acme');
  });
  assert.equal(job, null);
});

test('parseJobstreetItem: the allowlist check still rejects an off-platform jobUrl', () => {
  const job = parseJobstreetItem(
    { id: `${LONE}bad`, title: 'Evil', jobUrl: 'https://evil.example.com/job/77' },
    'https://www.seek.com.au',
    'Acme',
  );
  assert.equal(job, null, 'an untrusted hostname must not survive the final check');
});

test('meta is untouched — the portal registry entry must not move', () => {
  assert.deepEqual(meta, { value: 'jobstreet', label: 'Jobstreet / SEEK', region: 'en' });
});

// ---------------------------------------------------------------------------
// appendWorkType — opt-in title suffix
// ---------------------------------------------------------------------------

test('parseJobstreetItem: appendWorkType is off by default', () => {
  const item = { id: '1', title: 'Strategy Consultant', workTypes: ['Part time'] };
  assert.equal(
    parseJobstreetItem(item, 'https://www.seek.com.au', 'Acme').title,
    'Strategy Consultant',
    'the work type must not leak into the title unless asked for',
  );
  assert.equal(
    parseJobstreetItem(item, 'https://www.seek.com.au', 'Acme', {}).title,
    'Strategy Consultant',
    'an options object without the flag is still off',
  );
});

test('parseJobstreetItem: appendWorkType suffixes a single work type', () => {
  const job = parseJobstreetItem(
    { id: '1', title: 'Strategy Consultant', workTypes: ['Part time'] },
    'https://www.seek.com.au',
    'Acme',
    { appendWorkType: true },
  );
  assert.equal(job.title, 'Strategy Consultant [Part time]');
});

test('parseJobstreetItem: appendWorkType joins several work types with ", "', () => {
  const job = parseJobstreetItem(
    { id: '1', title: 'Analyst', workTypes: ['Part time', 'Contract/Temp'] },
    'https://www.seek.com.au',
    'Acme',
    { appendWorkType: true },
  );
  assert.equal(job.title, 'Analyst [Part time, Contract/Temp]');
});

test('parseJobstreetItem: appendWorkType is a no-op when workTypes is missing, empty or blank', () => {
  const at = (item) => parseJobstreetItem(item, 'https://www.seek.com.au', 'Acme', { appendWorkType: true }).title;
  assert.equal(at({ id: '2', title: 'Analyst' }), 'Analyst', 'workTypes absent');
  assert.equal(at({ id: '3', title: 'Analyst', workTypes: [] }), 'Analyst', 'workTypes empty');
  assert.equal(at({ id: '4', title: 'Analyst', workTypes: ['', '  '] }), 'Analyst', 'workTypes all blank');
  assert.equal(at({ id: '5', title: 'Analyst', workTypes: 'Part time' }), 'Analyst', 'workTypes not an array');
  assert.equal(
    at({ id: '6', title: 'Analyst', workTypes: [null, 'Full time'] }),
    'Analyst [Full time]',
    'a null entry is dropped, the real one kept',
  );
});

// ---------------------------------------------------------------------------
// fetchJobstreet wiring — the flag comes off company.jobstreet, like every
// other option this source reads
// ---------------------------------------------------------------------------

test('fetchJobstreet: builds seek.com.au /job/ links and honours company.jobstreet.appendWorkType', async () => {
  const fetchImpl = fakeFetch(() => ({
    data: [{
      id: '94036672',
      title: 'Strategy Consultant',
      workTypes: ['Part time'],
      locations: [{ label: 'Melbourne VIC' }],
      listingDate: '2026-06-29T02:53:00Z',
    }],
    totalCount: 1,
  }));

  const jobs = await fetchJobstreet('https://www.seek.com.au/api/jobsearch/v5/search', {
    fetchImpl,
    company: {
      name: 'SEEK AU',
      jobstreet: { siteKey: 'AU-Main', searchKeywords: 'strategy', appendWorkType: true },
    },
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Strategy Consultant [Part time]');
  assert.equal(jobs[0].url, 'https://www.seek.com.au/job/94036672');
});

test('fetchJobstreet: without the flag the title is untouched, and Indonesia still gets /id/job/', async () => {
  const fetchImpl = fakeFetch(() => ({
    data: [{ id: '92996157', title: 'Facility Engineer', workTypes: ['Full time'] }],
    totalCount: 1,
  }));

  const jobs = await fetchJobstreet('https://id.jobstreet.com/api/jobsearch/v5/search', {
    fetchImpl,
    company: { name: 'Jobstreet Indonesia', jobstreet: { siteKey: 'ID-Main' } },
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Facility Engineer');
  assert.equal(jobs[0].url, 'https://id.jobstreet.com/id/job/92996157');
});

// ---------------------------------------------------------------------------
// v1.242.0 — wrong-shape guards + clamped pagination config
// ---------------------------------------------------------------------------

test('fetchJobstreet: a wrong-shape 200 on page 1 throws instead of reading as an empty board', async () => {
  for (const body of [{ jobs: [] }, { totalCount: 5 }, 'unexpected string']) {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => body });
    await assert.rejects(
      () => fetchJobstreet('https://id.jobstreet.com/api/jobsearch/v5/search', { fetchImpl, company: { name: 'X' } }),
      /Jobstreet/,
    );
  }
});

test('fetchJobstreet: a later-page shape failure keeps page 1, logs, and stops the walk', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    const good = { data: [{ id: '111', title: 'Role A' }, { id: '222', title: 'Role B' }], totalCount: 9 };
    const bad = { data: { exploded: true }, totalCount: 9 }; // data is an object, not an array
    return { ok: true, status: 200, json: async () => (calls === 1 ? good : bad) };
  };
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  let jobs;
  try {
    jobs = await fetchJobstreet('https://id.jobstreet.com/api/jobsearch/v5/search', {
      fetchImpl,
      company: { name: 'X', jobstreet: { maxPages: 3, pageSize: 2 } },
    });
  } finally {
    console.warn = origWarn;
  }
  assert.equal(jobs.length, 2); // partials kept
  assert.equal(calls, 2); // walk stopped after the bad page
  // The shape failure must be LOUD, not a silent "board ended here".
  assert.ok(warns.some((w) => /jobstreet/.test(w) && /page 2/.test(w)), `expected a logged warning, got: ${warns.join(' | ')}`);
});

test('fetchJobstreet: negative / fractional maxPages and pageSize fall back to safe defaults', async () => {
  const fetchImpl = fakeFetch(() => ({
    data: [{ id: '333', title: 'Role C' }],
    totalCount: 1,
  }));
  const jobs = await fetchJobstreet('https://id.jobstreet.com/api/jobsearch/v5/search', {
    fetchImpl,
    company: { name: 'X', jobstreet: { pageSize: -30, maxPages: -3 } },
  });
  assert.equal(jobs.length, 1); // the walk ran with the defaults, not zero pages
  const u = new URL(fetchImpl.calls[0].url);
  assert.equal(u.searchParams.get('pageSize'), '30'); // DEFAULT_PAGE_SIZE
  assert.equal(u.searchParams.get('page'), '1');
});

test('fetchJobstreet: maxPages is clamped to a hard cap', async () => {
  let calls = 0;
  const fullPage = {
    data: Array.from({ length: 30 }, (_, i) => ({ id: String(9000 + i), title: `R${i}` })),
    totalCount: 999999,
  };
  // A sentinel past the cap makes an UNCLAMPED walk fail fast (it would
  // otherwise run maxPages × 200 ms of pacing before the assertion).
  const fetchImpl = async () => {
    calls += 1;
    if (calls > 20) throw new Error('CAP_SENTINEL: walked past the cap');
    return { ok: true, status: 200, json: async () => fullPage };
  };
  const jobs = await fetchJobstreet('https://id.jobstreet.com/api/jobsearch/v5/search', {
    fetchImpl,
    company: { name: 'X', jobstreet: { maxPages: 999, pageSize: 30 } },
  });
  assert.equal(calls, 20); // MAX_PAGES_CAP
  assert.equal(jobs.length, 600);
});

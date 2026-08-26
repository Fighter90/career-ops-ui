/**
 * a16z Speedrun talent-network source + adapter tests (parent career-ops
 * providers/a16z-speedrun-talent.mjs parity). Board-wide, zero-auth JSON
 * aggregator paged 0-indexed off `{FEED_URL}?page=N&source=career-ops`.
 * CI-isolated: fake fetchImpl serving canned JSON, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSpeedrunJob,
  parseSpeedrunJobs,
  fetchSpeedrunTalent,
  assertSpeedrunUrl,
  FEED_URL,
  MAX_RESULTS,
  meta,
} from '../server/lib/sources/a16z-speedrun-talent.mjs';
import { a16zSpeedrunTalentAdapter } from '../server/lib/portals/adapters/a16z-speedrun-talent.mjs';

// --- canned record + fake fetch (fetchJson expects res.ok + res.json()) -----
const mkRec = (n, page = 0) => ({
  id: `${page}-${n}`,
  title: `Role ${n}`,
  company: `Co ${n}`,
  url: `https://speedrun-talent-network.com/jobs/p${page}-${n}`,
  location: 'New York, NY',
  remote: false,
  published_at: '2026-07-01T00:00:00.000Z',
});

// pages: array indexed by 0-based page number. A page past the end → { jobs: [] }.
const mkFetch = (pages) => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const page = Number(new URL(url).searchParams.get('page'));
    const body = pages[page] ?? { jobs: [], total_pages: pages.length };
    return { ok: true, json: async () => body };
  };
  return { calls, fetchImpl };
};

// Capture console.error emitted while `fn` runs (the truncation warning path).
async function withCapturedErrors(fn) {
  const warnings = [];
  const real = console.error;
  console.error = (...args) => warnings.push(args.join(' '));
  try {
    const result = await fn();
    return { result, warnings };
  } finally {
    console.error = real;
  }
}

// ---------------------------------------------------------------------------
// meta + adapter identity
// ---------------------------------------------------------------------------
test('meta: value/label/region + adapter identity + FEED_URL', () => {
  assert.equal(meta.value, 'a16z-speedrun-talent');
  assert.equal(meta.label, 'a16z Speedrun');
  assert.equal(meta.region, 'en');
  assert.equal(a16zSpeedrunTalentAdapter.id, 'a16z-speedrun-talent');
  assert.equal(a16zSpeedrunTalentAdapter.label, 'a16z Speedrun');
  assert.equal(FEED_URL, 'https://speedrun-talent-network.com/api/v1/jobs');
});

// ---------------------------------------------------------------------------
// normalizeSpeedrunJob — field mapping into the rich web-ui job shape
// ---------------------------------------------------------------------------
test('normalizeSpeedrunJob: full record → 12-field web-ui job shape', () => {
  const job = normalizeSpeedrunJob(
    {
      id: 'abc123',
      title: '  Founding Engineer  ',
      url: 'https://speedrun-talent-network.com/jobs/founding-engineer-light-abc123',
      company: '  Light  ',
      location: '  New York, NY  ',
      remote: false,
      published_at: '2026-07-01T12:00:00.000Z',
    },
    'Fallback',
  );
  const fields = ['id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const f of fields) {
    assert.ok(Object.prototype.hasOwnProperty.call(job, f), `missing field: ${f}`);
  }
  assert.equal(job.id, 'a16z-speedrun-talent-abc123');
  assert.equal(job.title, 'Founding Engineer');
  assert.equal(job.url, 'https://speedrun-talent-network.com/jobs/founding-engineer-light-abc123');
  assert.equal(job.company, 'Light'); // record company wins over fallback
  assert.equal(job.location, 'New York, NY');
  assert.equal(job.isRemote, false);
  assert.equal(job.workplaceType, 'Onsite');
  assert.equal(job.relocates, false);
  assert.equal(job.date, '2026-07-01'); // published_at ISO → YYYY-MM-DD
  assert.equal(job.salary, '');
  assert.equal(job.snippet, '');
  assert.equal(job.source, 'a16z-speedrun-talent');
});

test('normalizeSpeedrunJob: appends "Remote" + derives isRemote/workplaceType', () => {
  const remoteLoc = normalizeSpeedrunJob({ title: 'R', url: 'https://speedrun-talent-network.com/jobs/r', location: 'SF Bay Area', remote: true });
  const remoteOnly = normalizeSpeedrunJob({ title: 'R', url: 'https://speedrun-talent-network.com/jobs/r2', location: null, remote: true });
  assert.equal(remoteLoc.location, 'SF Bay Area, Remote');
  assert.equal(remoteLoc.isRemote, true);
  assert.equal(remoteLoc.workplaceType, 'Remote');
  assert.equal(remoteOnly.location, 'Remote'); // null base location → just "Remote"
  assert.equal(remoteOnly.isRemote, true);
});

test('normalizeSpeedrunJob: company falls back entry name → constant default', () => {
  const coEntry = normalizeSpeedrunJob({ title: 'T', url: 'https://speedrun-talent-network.com/jobs/c1', company: '' }, 'Entry Name');
  const coDefault = normalizeSpeedrunJob({ title: 'T', url: 'https://speedrun-talent-network.com/jobs/c2' });
  const coBlank = normalizeSpeedrunJob({ title: 'T', url: 'https://speedrun-talent-network.com/jobs/c3' }, '   ');
  assert.equal(coEntry.company, 'Entry Name');
  assert.equal(coDefault.company, 'a16z speedrun talent network');
  assert.equal(coBlank.company, 'a16z speedrun talent network');
  // id falls back to the url when the record carries no id
  assert.equal(coDefault.id, 'a16z-speedrun-talent-https://speedrun-talent-network.com/jobs/c2');
});

test('normalizeSpeedrunJob: date "" when published_at is absent or unparseable', () => {
  const noDate = normalizeSpeedrunJob({ title: 'T', url: 'https://speedrun-talent-network.com/jobs/nd', published_at: null });
  const badDate = normalizeSpeedrunJob({ title: 'T', url: 'https://speedrun-talent-network.com/jobs/bd', published_at: 'not-a-date' });
  assert.equal(noDate.date, '');
  assert.equal(badDate.date, '');
});

test('normalizeSpeedrunJob: host-locks url; drops off-host/non-https/no-url/empty-title/non-object', () => {
  const drops = [
    normalizeSpeedrunJob({ title: 'Off host', url: 'https://evil.example/jobs/x' }),
    normalizeSpeedrunJob({ title: 'Insecure', url: 'http://speedrun-talent-network.com/jobs/x' }),
    normalizeSpeedrunJob({ title: 'No URL' }),
    normalizeSpeedrunJob({ title: '', url: 'https://speedrun-talent-network.com/jobs/x' }),
    normalizeSpeedrunJob(null),
  ];
  assert.ok(drops.every((r) => r === null));
});

// ---------------------------------------------------------------------------
// parseSpeedrunJobs — page mapper
// ---------------------------------------------------------------------------
test('parseSpeedrunJobs: maps a page, dedups repeated urls, honors cap, tolerates non-array', () => {
  const json = { jobs: [mkRec(1), mkRec(2), mkRec(1)] }; // third record repeats url
  const jobs = parseSpeedrunJobs(json);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.source === 'a16z-speedrun-talent'));
  assert.equal(parseSpeedrunJobs(json, 1).length, 1); // cap honored
  assert.deepEqual(parseSpeedrunJobs(12345), []);
  assert.deepEqual(parseSpeedrunJobs({ jobs: 'nope' }), []);
  // fallbackCompany threads through into rows missing a company
  const withFallback = parseSpeedrunJobs({ jobs: [{ title: 'T', url: 'https://speedrun-talent-network.com/jobs/fb' }] }, MAX_RESULTS, 'Fallback Co');
  assert.equal(withFallback[0].company, 'Fallback Co');
});

// ---------------------------------------------------------------------------
// fetchSpeedrunTalent — pagination orchestrator
// ---------------------------------------------------------------------------
test('fetchSpeedrunTalent: 0-based paging + source=career-ops + q, stops on short page', async () => {
  const page0 = { jobs: Array.from({ length: 100 }, (_, i) => mkRec(i, 0)), total: 133, page: 0, page_size: 100, total_pages: 2 };
  const page1 = { jobs: [mkRec(100, 1), mkRec(101, 1), { title: '', url: 'https://speedrun-talent-network.com/jobs/bad' }], total: 133, page: 1, page_size: 100, total_pages: 2 };
  const { calls, fetchImpl } = mkFetch([page0, page1]);
  const jobs = await fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { name: 'a16z speedrun talent network', max_pages: 5, q: 'engineer' } });

  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.url.startsWith('https://speedrun-talent-network.com/api/v1/jobs?')));
  assert.ok(calls.every((c) => new URL(c.url).searchParams.get('source') === 'career-ops'));
  assert.ok(calls.every((c) => new URL(c.url).searchParams.get('q') === 'engineer'));
  assert.equal(new URL(calls[0].url).searchParams.get('page'), '0'); // 0-indexed
  assert.equal(new URL(calls[1].url).searchParams.get('page'), '1');
  assert.equal(calls[0].opts.redirect, 'error'); // SSRF-safe
  assert.equal(calls[0].opts.headers.accept, 'application/json');
  assert.equal(jobs.length, 102); // 100 + 2 valid; blank-title row dropped
  assert.equal(jobs[0].title, 'Role 0');
  assert.equal(jobs[101].title, 'Role 101');
});

test('fetchSpeedrunTalent: stops when total_pages is reached before max_pages', async () => {
  // Two full pages, total_pages=2 → stops after page 1 even though max_pages=5.
  const { calls, fetchImpl } = mkFetch([
    { jobs: Array.from({ length: 100 }, (_, i) => mkRec(i, 0)), total_pages: 2 },
    { jobs: Array.from({ length: 100 }, (_, i) => mkRec(i, 1)), total_pages: 2 },
  ]);
  const jobs = await fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { max_pages: 5 } });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 200);
});

test('fetchSpeedrunTalent: max_pages caps ahead of total_pages', async () => {
  const full = (page) => ({ jobs: Array.from({ length: 100 }, (_, i) => mkRec(i, page)), total: 5000, total_pages: 50 });
  const { calls, fetchImpl } = mkFetch([full(0), full(1), full(2)]);
  const { result: jobs, warnings } = await withCapturedErrors(
    () => fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { max_pages: 2 } }),
  );
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 200);
  assert.ok(warnings.some((w) => w.includes('truncated at max_pages=2')));
});

test('fetchSpeedrunTalent: falls back to joined keywords[] when q: is absent', async () => {
  const { calls, fetchImpl } = mkFetch([{ jobs: [mkRec(0, 0)], total_pages: 1 }]);
  await fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { keywords: ['machine', '', 'learning'] } });
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'machine learning');
});

test('fetchSpeedrunTalent: clamps an oversized max_pages to the 1000-page cap + warns', async () => {
  // Same 100 urls every page → dedups to 100, so the ONLY bound is the page cap.
  const sameRec = (i) => ({ title: `Role ${i}`, company: `Co ${i}`, url: `https://speedrun-talent-network.com/jobs/same-${i}`, remote: false });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ jobs: Array.from({ length: 100 }, (_, i) => sameRec(i)), total: 5_000_000, total_pages: 50_000 }) };
  };
  const { warnings } = await withCapturedErrors(
    () => fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { max_pages: 999_999 } }),
  );
  assert.equal(calls.length, 1000); // clamped to MAX_PAGES_CAP (parent #36d0c44: 120 → 1000)
  assert.ok(warnings.some((w) => w.includes('truncated at max_pages=1000')));
});

test('fetchSpeedrunTalent: retries a transient page failure instead of aborting the board (#2506)', async () => {
  // First attempt at page 0 returns a transient 503; the retry succeeds, so the
  // board is scanned in full rather than aborting to nothing.
  const attempts = new Map();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    const n = (attempts.get(page) || 0) + 1;
    attempts.set(page, n);
    if (page === 0 && n === 1) return { ok: false, status: 503 }; // transient blip
    const body = page === 0
      ? { jobs: Array.from({ length: 100 }, (_, i) => mkRec(i, 0)), total_pages: 2 }
      : { jobs: [mkRec(100, 1), mkRec(101, 1)], total_pages: 2 };
    return { ok: true, json: async () => body };
  };
  // pageDelayMs:1 → retry backoff is 1ms (no real wait) and inter-page delay is negligible.
  const jobs = await fetchSpeedrunTalent(FEED_URL, { fetchImpl, pageDelayMs: 1, company: { max_pages: 5 } });
  assert.equal(attempts.get(0), 2); // page 0 fetched twice (1 fail + 1 retry)
  assert.equal(jobs.length, 102);   // full board, not aborted
});

test('fetchSpeedrunTalent: a PERMANENT 4xx on the first page is not retried and throws', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { ok: false, status: 404 }; };
  await assert.rejects(
    () => fetchSpeedrunTalent(FEED_URL, { fetchImpl, pageDelayMs: 1, company: { max_pages: 3 } }),
    /HTTP 404/,
  );
  assert.equal(calls.length, 1); // 404 is permanent — no retry
});

test('fetchSpeedrunTalent: throws on a malformed FIRST page (shape-change canary)', async () => {
  await assert.rejects(
    () => fetchSpeedrunTalent(FEED_URL, { fetchImpl: async () => ({ ok: true, json: async () => ({ nope: true }) }) }),
    /unexpected API response/,
  );
});

test('fetchSpeedrunTalent: fail-soft on a malformed LATER page (keeps earlier jobs)', async () => {
  const { fetchImpl } = mkFetch([
    { jobs: Array.from({ length: 100 }, (_, i) => mkRec(i, 0)), total: 500, total_pages: 5 },
    { nope: true }, // page 1 malformed → fail-soft, no throw
  ]);
  const jobs = await fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { max_pages: 3 } });
  assert.equal(jobs.length, 100);
});

// ---------------------------------------------------------------------------
// assertSpeedrunUrl — host lock (message-phrase regexes, never a bare host regex)
// ---------------------------------------------------------------------------
test('assertSpeedrunUrl: pins host over HTTPS; rejects off-host/non-https/invalid', () => {
  assert.equal(assertSpeedrunUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertSpeedrunUrl('https://evil.com/'), /untrusted hostname/);
  assert.throws(() => assertSpeedrunUrl('http://speedrun-talent-network.com/'), /must use HTTPS/);
  assert.throws(() => assertSpeedrunUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// adapter — provider-selected only; endpoint default/override
// ---------------------------------------------------------------------------
test('adapter: matches only provider=a16z-speedrun-talent; buildEndpoint default/override', () => {
  assert.ok(a16zSpeedrunTalentAdapter.matches({ provider: 'a16z-speedrun-talent' }));
  assert.equal(a16zSpeedrunTalentAdapter.matches({ provider: 'himalayas' }), false);
  assert.equal(a16zSpeedrunTalentAdapter.matches({ careers_url: 'https://speedrun-talent-network.com' }), false);
  assert.equal(a16zSpeedrunTalentAdapter.buildEndpoint({ provider: 'a16z-speedrun-talent' }), FEED_URL);
  const custom = 'https://speedrun-talent-network.com/api/v1/jobs?mirror=1';
  assert.equal(a16zSpeedrunTalentAdapter.buildEndpoint({ 'a16z-speedrun-talent': custom }), custom);
  assert.equal(a16zSpeedrunTalentAdapter.buildEndpoint({ api: custom }), custom);
});

test('adapter: buildEndpoint re-validates the override host — off-host/non-https/garbage → canonical feed', () => {
  // Parity with the cryptocurrencyjobs adapter: an off-host or non-HTTPS
  // override never reaches the fetch slot; it falls back to FEED_URL rather
  // than deferring the rejection to the fetch-time assertSpeedrunUrl guard.
  const be = (c) => a16zSpeedrunTalentAdapter.buildEndpoint(c);
  assert.equal(be({ api: 'https://evil.example.com/api/v1/jobs' }), FEED_URL, 'off-host → feed');
  assert.equal(be({ 'a16z-speedrun-talent': 'https://sub.speedrun-talent-network.com/x' }), FEED_URL, 'subdomain → feed (exact host only)');
  assert.equal(be({ api: 'http://speedrun-talent-network.com/api/v1/jobs' }), FEED_URL, 'non-https → feed');
  assert.equal(be({ api: 'not a url' }), FEED_URL, 'garbage → feed');
});

// #2547 — total_pages outranks the short-page break. A board that rotates a
// listing out mid-sweep can return a 49/50 page that is NOT the last page; the
// feed's own total_pages says so, so iteration must continue.
test('fetchSpeedrunTalent: keeps paginating past a short-but-nonempty page while total_pages says there is more (#2547)', async () => {
  const pages = Array.from({ length: 6 }, (_, p) => ({
    jobs: Array.from({ length: p === 2 ? 49 : 50 }, (_, i) => mkRec(p * 50 + i, p)),
    total: 300, page: p, page_size: 50, total_pages: 6,
  }));
  const { calls, fetchImpl } = mkFetch(pages);
  const jobs = await fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { max_pages: 6 } });
  const seen = calls.map((c) => Number(new URL(c.url).searchParams.get('page')));
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5], 'must fetch all 6 pages, not stop at the short page 2');
  assert.equal(jobs.length, 299, '50*5 + 49 = 299 jobs');
});

// #2547 — trusting total_pages is only safe because an empty page ends
// iteration unconditionally: an over-reporting feed stops at the first empty
// response instead of burning the whole page budget.
test('fetchSpeedrunTalent: stops at the first empty page when total_pages over-reports (#2547)', async () => {
  const pages = [
    { jobs: Array.from({ length: 50 }, (_, i) => mkRec(i, 0)), page: 0, page_size: 50, total_pages: 50 },
    { jobs: Array.from({ length: 50 }, (_, i) => mkRec(50 + i, 1)), page: 1, page_size: 50, total_pages: 50 },
    { jobs: Array.from({ length: 50 }, (_, i) => mkRec(100 + i, 2)), page: 2, page_size: 50, total_pages: 50 },
    { jobs: [], page: 3, page_size: 50, total_pages: 50 },
  ];
  const { calls, fetchImpl } = mkFetch(pages);
  const jobs = await fetchSpeedrunTalent(FEED_URL, { fetchImpl, company: { max_pages: 20 } });
  assert.equal(calls.length, 4, 'stops at the first empty page (0,1,2,3), not up to max_pages=20');
  assert.equal(jobs.length, 150, '3 full pages of 50');
});

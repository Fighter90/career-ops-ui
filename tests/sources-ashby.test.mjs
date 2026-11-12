/**
 * Ashby source tests — focus on the v1.75.0 (parent #1073) secondaryLocations
 * postal-address folding so EU-eligible roles surface for the location_filter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAshby } from '../server/lib/sources/ashby.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });

test('ashby: folds secondary region labels + postal locality/country, deduped', async () => {
  const data = {
    jobs: [{
      id: 'a1',
      title: 'ML Engineer',
      jobUrl: 'https://jobs.ashbyhq.com/foo/a1',
      location: 'Canada',
      secondaryLocations: [
        { location: 'Europe' },
        { address: { postalAddress: { addressLocality: 'Berlin', addressCountry: 'Germany' } } },
        { location: 'Europe' }, // duplicate label — should be deduped
      ],
    }],
  };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, 'Canada · Europe · Berlin · Germany');
});

test('ashby: primary-only location still works', async () => {
  const data = { jobs: [{ id: 'b1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/b1', location: 'Remote (US)' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Remote (US)');
});

test('ashby: missing location + secondaries yields empty string, not a crash', async () => {
  const data = { jobs: [{ id: 'c1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/c1' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, '');
});

test('ashby: workplaceType Remote appends "Remote" to the city location', async () => {
  const data = { jobs: [{ id: 'r1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r1', location: 'San Francisco', workplaceType: 'Remote' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'San Francisco · Remote');
  assert.equal(jobs[0].isRemote, true);
});

test('ashby: workplaceType wins over isRemote — Hybrid+isRemote is NOT labeled remote', async () => {
  const data = { jobs: [{ id: 'r2', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r2', location: 'Berlin', workplaceType: 'Hybrid', isRemote: true }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Berlin'); // no "Remote" appended
  assert.equal(jobs[0].isRemote, false);
});

test('ashby: isRemote true with no workplaceType falls back to remote', async () => {
  const data = { jobs: [{ id: 'r3', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r3', location: 'Tokyo', isRemote: true }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Tokyo · Remote');
  assert.equal(jobs[0].isRemote, true);
});

test('ashby: no duplicate "Remote" when the location already carries it', async () => {
  const data = { jobs: [{ id: 'r4', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/r4', location: 'Remote (US)', workplaceType: 'Remote' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].location, 'Remote (US)');
});

test('ashby: description comes from descriptionPlain (empty when absent)', async () => {
  const data = { jobs: [
    { id: 'd1', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/d1', descriptionPlain: 'Build backend services in Go.' },
    { id: 'd2', title: 'Y', jobUrl: 'https://jobs.ashbyhq.com/foo/d2' },
  ] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].description, 'Build backend services in Go.');
  assert.equal(jobs[1].description, '');
});

test('ashby: descriptionPlain is capped at DESCRIPTION_CAP (same ceiling as greenhouse/recruitee)', async () => {
  const data = { jobs: [{ id: 'cap', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/cap', descriptionPlain: 'y'.repeat(16000) }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].description.length, 4000);
});

test('ashby: plain-text `<…>` in the description survives (not tag-stripped)', async () => {
  const data = { jobs: [{ id: 'lt', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/foo/lt', descriptionPlain: 'C++ templates <T> and salary < 100k' }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].description, 'C++ templates <T> and salary < 100k');
});

// Parent parity (#4080): the posting-api fetch never follows a redirect.
test('ashby: fetch passes redirect:error', async () => {
  let seen;
  await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', {
    fetchImpl: async (_u, opts) => { seen = opts; return { ok: true, json: async () => ({ jobs: [] }) }; },
  });
  assert.equal(seen.redirect, 'error');
});

// Parent #4331 read min/max from compensationTiers[].components[] because the
// real payload carries no flat min/max. web-ui renders Ashby's own summary
// string instead, so the real (nested) shape already yields a salary — pinned
// here with the parent's fixture shape.
test('ashby: the real nested compensation payload renders the tier summary as salary', async () => {
  const data = { jobs: [{
    id: 'c1', title: 'Engineer', jobUrl: 'https://jobs.ashbyhq.com/foo/c1',
    compensation: {
      compensationTierSummary: '$128K – $180K • Offers Equity',
      scrapeableCompensationSalarySummary: '$128K - $180K',
      compensationTiers: [{ components: [
        { compensationType: 'Salary', interval: '1 YEAR', minValue: 128000, maxValue: 180000, currencyCode: 'USD', summary: '$128K – $180K' },
        { compensationType: 'EquityPercentage', interval: 'NONE', minValue: null, maxValue: null, summary: 'Offers Equity' },
      ] }],
    },
  }] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.equal(jobs[0].salary, '$128K – $180K • Offers Equity');
});

// ── v1.242.0 phase-2: URL pinning, shape canary, jobUrl validation ──────────

test('ashby: assertAshbyUrl pins https + exactly api.ashbyhq.com', async () => {
  // Dynamic import: this export is new in v1.242.0 (a static named import of a
  // missing export fails the whole module at link time).
  const { assertAshbyUrl } = await import('../server/lib/sources/ashby.mjs');
  const good = 'https://api.ashbyhq.com/posting-api/job-board/foo?includeCompensation=true';
  assert.equal(assertAshbyUrl(good), good);
  assert.throws(() => assertAshbyUrl('http://api.ashbyhq.com/posting-api/job-board/foo'), /HTTPS/);
  assert.throws(() => assertAshbyUrl('https://evil.com/posting-api/job-board/foo'), /untrusted hostname/);
  // a look-alike host (suffix match) is refused — exact host only
  assert.throws(() => assertAshbyUrl('https://api.ashbyhq.com.evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertAshbyUrl('not a url'), /invalid URL/);
});

test('ashby: fetchAshby rejects an off-host endpoint before any fetch (SSRF)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => ({ jobs: [] }) }; };
  await assert.rejects(
    () => fetchAshby('https://evil.com/posting-api/job-board/foo', { fetchImpl }),
    /untrusted hostname/,
  );
  assert.equal(calls, 0, 'the guard must fire before any request is made');
});

test('ashby: a wrong-shape 200 throws instead of reading as an empty board', async () => {
  // `{jobs:[...]}` renamed/absent (an HTML challenge served as 200 JSON, an API
  // retirement) previously read as `(data.jobs || [])` → [] → board looks
  // healthy-but-empty.
  const fetchImpl = okJson({ postings: [] });
  await assert.rejects(
    () => fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl }),
    /Ashby/,
  );
});

test('ashby: non-https jobUrls are dropped (javascript:/http:/relative), https kept', async () => {
  const data = { jobs: [
    { id: 'ok', title: 'Good', jobUrl: 'https://jobs.ashbyhq.com/foo/ok' },
    { id: 'js', title: 'Scripty', jobUrl: 'javascript:alert(1)' },
    { id: 'http', title: 'Plain', applyUrl: 'http://jobs.ashbyhq.com/foo/http' },
    { id: 'rel', title: 'Relative', jobUrl: '/foo/rel' },
    { id: 'none', title: 'No url at all' },
  ] };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl: okJson(data) });
  assert.deepEqual(jobs.map((j) => j.url), ['https://jobs.ashbyhq.com/foo/ok']);
});

// ── Parent #6674: the posting API's own body ceiling + embed fallback ────────

const { ASHBY_MAX_BYTES, buildEmbedUrl, parseEmbedAppData } = await import('../server/lib/sources/ashby.mjs');

const embedHtml = (board) => '<!DOCTYPE html><script>window.__appData = ' + JSON.stringify(board) + ';</script>';

test('ashby: the posting API reads under its own 64 MB ceiling', async () => {
  assert.equal(ASHBY_MAX_BYTES, 64 * 1024 * 1024);
  // End-to-end pin through the REAL capped read: a board whose declared
  // content-length sits past ASHBY_MAX_BYTES is refused by the transport and
  // served from the embed listing instead. Without the ceiling the uncapped
  // read would have succeeded and returned the API rows.
  const apiBoard = { ok: true, status: 200, json: async () => ({ jobs: [{ id: 'api', title: 'From API', jobUrl: 'https://jobs.ashbyhq.com/foo/api' }] }), headers: { get: (n) => (n === 'content-length' ? String(ASHBY_MAX_BYTES + 1) : null) } };
  const embedResponse = () => ({ ok: true, status: 200, text: async () => embedHtml({ jobBoard: { jobPostings: [{ id: 'emb', title: 'From Embed' }] } }) });
  const fetchImpl = async (url) => (String(url).startsWith('https://api.ashbyhq.com/') ? apiBoard : embedResponse());
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'From Embed');
});

test('ashby: buildEmbedUrl pins the embed host and encodes the slug', () => {
  assert.equal(buildEmbedUrl('openai'), 'https://jobs.ashbyhq.com/openai?embed=js');
  assert.equal(buildEmbedUrl('a b'), 'https://jobs.ashbyhq.com/a%20b?embed=js');
});

test('ashby: parseEmbedAppData reads jobBoard, and tells the three outcomes apart', () => {
  const board = { organization: { name: 'Big' }, jobBoard: { jobPostings: [{ id: 'p1' }, { id: 'p2' }] } };
  assert.deepEqual(parseEmbedAppData(embedHtml(board)), { jobPostings: [{ id: 'p1' }, { id: 'p2' }] });
  // a nonexistent slug renders jobBoard: null → null, NOT a throw
  assert.equal(parseEmbedAppData(embedHtml({ organization: null, jobBoard: null })), null);
  // no parseable __appData / broken JSON / no jobPostings array → throws
  assert.throws(() => parseEmbedAppData('<html>nothing here</html>'), /no window\.__appData/);
  assert.throws(() => parseEmbedAppData('<script>window.__appData = {"jobBoard": '), /did not parse as JSON/);
  assert.throws(() => parseEmbedAppData(embedHtml({ jobBoard: {} })), /no jobPostings array/);
});

test('ashby: parseEmbedAppData survives a `};` inside a title (brace scan skips strings)', () => {
  const board = { jobBoard: { jobPostings: [{ id: 'x', title: 'Strategy }; Lead' }] } };
  assert.equal(parseEmbedAppData(embedHtml(board)).jobPostings[0].title, 'Strategy }; Lead');
});

test('ashby: an oversized board is read from the embed listing of the SAME board', async () => {
  const tooLarge = () => Promise.reject(Object.assign(new Error('HTTP body exceeded maxBytes'), { code: 'response_too_large', maxBytes: ASHBY_MAX_BYTES }));
  // A response object that serves text() for the embed read.
  const embedResponse = (board) => ({ ok: true, status: 200, text: async () => embedHtml(board) });
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(String(url));
    if (String(url).startsWith('https://api.ashbyhq.com/')) return tooLarge();
    return embedResponse({ jobBoard: { jobPostings: [
      { id: 'p1', title: 'Strategy Lead', locationName: 'San Francisco', workplaceType: 'Remote' },
      { id: 'p2', title: 'Engineer', locationName: 'Berlin' },
    ] } });
  };
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  try {
    const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/big?includeCompensation=true', { fetchImpl, company: { name: 'Big' } });
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].title, 'Strategy Lead');
    assert.equal(jobs[0].location, 'San Francisco · Remote');
    assert.equal(jobs[0].isRemote, true);
    assert.equal(jobs[0].url, 'https://jobs.ashbyhq.com/big/p1');
    // No description or date on the embed path — nothing is invented.
    assert.equal(jobs[0].description, '');
    assert.equal(jobs[0].date, '');
    assert.match(String(seen[1]), /^https:\/\/jobs\.ashbyhq\.com\/big\?embed=js$/);
    assert.match(warns[0], /posting API body over 64 MB/);
  } finally {
    console.error = origErr;
  }
});

test('ashby: the embed fallback reads the board the posting API was asked for (api:-pinned)', async () => {
  const tooLarge = () => Promise.reject(Object.assign(new Error('HTTP body exceeded maxBytes'), { code: 'response_too_large', maxBytes: ASHBY_MAX_BYTES }));
  const embedResponse = (board) => ({ ok: true, status: 200, text: async () => embedHtml(board) });
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(String(url));
    if (String(url).startsWith('https://api.ashbyhq.com/')) return tooLarge();
    return embedResponse({ jobBoard: { jobPostings: [{ id: 'p1', title: 'Strategy Lead' }] } });
  };
  await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/big?includeCompensation=true', { fetchImpl });
  // api: pins the board while careers_url is a corporate site (or a different
  // Ashby board): the fallback takes its slug from the posting-api URL.
  assert.match(String(seen[1]), /^https:\/\/jobs\.ashbyhq\.com\/big\?embed=js$/);
});

test('ashby: embed fallback drops mangled rows and refuses an off-embed-host URL', async () => {
  const tooLarge = () => Promise.reject(Object.assign(new Error('HTTP body exceeded maxBytes'), { code: 'response_too_large', maxBytes: ASHBY_MAX_BYTES }));
  const embedResponse = (board) => ({ ok: true, status: 200, text: async () => embedHtml(board) });
  const fetchImpl = async (url) => {
    if (String(url).startsWith('https://api.ashbyhq.com/')) return tooLarge();
    return embedResponse({ jobBoard: { jobPostings: [
      { id: 'ok', title: 'Good' },
      null, // mangled row — dropped on its own, never the board
      { title: 'No id' }, // no usable id — dropped
      { id: 'no-title' }, // no title — dropped
    ] } });
  };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/big', { fetchImpl });
  assert.deepEqual(jobs.map((j) => j.title), ['Good']);
  assert.equal(jobs[0].id, 'ashby-ok');
});

test('ashby: a lone surrogate in an embed posting id drops that posting, never the board', async () => {
  const tooLarge = () => Promise.reject(Object.assign(new Error('HTTP body exceeded maxBytes'), { code: 'response_too_large', maxBytes: ASHBY_MAX_BYTES }));
  const embedResponse = (board) => ({ ok: true, status: 200, text: async () => embedHtml(board) });
  const fetchImpl = async (url) => {
    if (String(url).startsWith('https://api.ashbyhq.com/')) return tooLarge();
    return embedResponse({ jobBoard: { jobPostings: [
      { id: 'good', title: 'Good' },
      { id: 'bad\uD800id', title: 'Surrogate' }, // would make encodeURIComponent throw
    ] } });
  };
  const jobs = await fetchAshby('https://api.ashbyhq.com/posting-api/job-board/big', { fetchImpl });
  assert.deepEqual(jobs.map((j) => j.title), ['Good']);
});

test('ashby: every other failure stays loud — HTTP errors keep their label, embed failures propagate', async () => {
  // A 500 on the posting API is the board's failure: labelled and rethrown,
  // NOT swallowed into an embed read.
  await assert.rejects(
    () => fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', {
      fetchImpl: async () => ({ ok: false, status: 500 }),
    }),
    /Ashby: HTTP 500/,
  );
  // An embed read that itself fails keeps the failure loud.
  const tooLarge = () => Promise.reject(Object.assign(new Error('HTTP body exceeded maxBytes'), { code: 'response_too_large', maxBytes: ASHBY_MAX_BYTES }));
  await assert.rejects(
    () => fetchAshby('https://api.ashbyhq.com/posting-api/job-board/foo', {
      fetchImpl: async (url) => (String(url).startsWith('https://api.ashbyhq.com/') ? tooLarge() : { ok: false, status: 503 }),
    }),
    /Ashby: HTTP 503/,
  );
  // jobBoard: null on the embed page (the slug does not exist) is loud too.
  const embedResponse = () => ({ ok: true, status: 200, text: async () => embedHtml({ organization: null, jobBoard: null }) });
  await assert.rejects(
    () => fetchAshby('https://api.ashbyhq.com/posting-api/job-board/gone', {
      fetchImpl: async (url) => (String(url).startsWith('https://api.ashbyhq.com/') ? tooLarge() : embedResponse()),
    }),
    /the slug does not exist/,
  );
});

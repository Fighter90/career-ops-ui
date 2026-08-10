/**
 * Consider source + adapter — CI-isolated tests (fake fetchImpl, no network,
 * no parent-project dependency). Parent career-ops `providers/consider.mjs`
 * parity. Consider boards take their POST origin from a config-driven
 * careers_url, so the structural host guard (`resolveOrigin`) is THE security
 * boundary: it must reject non-https, IP-literal, loopback, link-local, and
 * internal-suffix hosts before any request goes out. Also covers url
 * absolutization, company attribution, dedupe, the dead-board throw, and the
 * epoch-ms / ISO timeStamp shapes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchConsider,
  normalizeConsiderJob,
  resolveOrigin,
  locationString,
  toEpochMs,
  meta,
  ENDPOINT_PATH,
  DEFAULT_SIZE,
} from '../server/lib/sources/consider.mjs';
import { considerAdapter } from '../server/lib/portals/adapters/consider.mjs';

const OK_ENTRY = {
  name: 'Founderful',
  provider: 'consider',
  consider_board: 'wingman',
  careers_url: 'https://jobs.founderful.com/jobs',
};

// A Consider search-jobs response shaped like the live board.
const cannedJobs = (jobs) => async (url, opts) => ({
  ok: true,
  status: 200,
  json: async () => ({ jobs, total: jobs.length, __url: url, __opts: opts }),
});

// ---------------------------------------------------------------------------
// meta + adapter surface: provider-selected, host-pinned endpoint
// ---------------------------------------------------------------------------

test('meta: id/label/region', () => {
  assert.equal(meta.value, 'consider');
  assert.equal(meta.label, 'Consider');
  assert.equal(meta.region, 'en');
  assert.equal(ENDPOINT_PATH, '/api-boards/search-jobs');
  assert.equal(DEFAULT_SIZE, 500);
});

test('adapter: id/label/fetch + matches ONLY provider:consider', () => {
  assert.equal(considerAdapter.id, 'consider');
  assert.equal(considerAdapter.label, 'Consider');
  assert.equal(considerAdapter.fetch, fetchConsider);

  assert.ok(considerAdapter.matches({ provider: 'consider' }));
  // careers_url alone never claims it — the board id can't be derived from the host
  assert.equal(considerAdapter.matches({ careers_url: 'https://jobs.founderful.com/jobs' }), false);
  assert.equal(considerAdapter.matches({ provider: 'greenhouse' }), false);
  assert.equal(considerAdapter.matches({}), false);
  assert.equal(considerAdapter.matches(null), false);
});

test('adapter.buildEndpoint: public https origin + consider_board → endpoint, else null', () => {
  assert.equal(
    considerAdapter.buildEndpoint(OK_ENTRY),
    'https://jobs.founderful.com/api-boards/search-jobs',
  );
  // missing board → null
  assert.equal(considerAdapter.buildEndpoint({ provider: 'consider', careers_url: 'https://jobs.founderful.com/jobs' }), null);
  // non-public / unsafe host → null (origin guard fails)
  assert.equal(considerAdapter.buildEndpoint({ provider: 'consider', consider_board: 'x', careers_url: 'http://jobs.founderful.com/jobs' }), null);
  assert.equal(considerAdapter.buildEndpoint({ provider: 'consider', consider_board: 'x', careers_url: 'https://127.0.0.1/jobs' }), null);
  assert.equal(considerAdapter.buildEndpoint({}), null);
});

// ---------------------------------------------------------------------------
// resolveOrigin — the STRUCTURAL SSRF guard (security boundary)
// ---------------------------------------------------------------------------

test('resolveOrigin: ACCEPTS a public https host', () => {
  assert.equal(resolveOrigin({ careers_url: 'https://jobs.founderful.com/jobs' }), 'https://jobs.founderful.com');
  assert.equal(resolveOrigin({ careers_url: 'https://careers.balderton.com/x?y=1' }), 'https://careers.balderton.com');
});

test('resolveOrigin: REJECTS http / IP-literal / localhost / .internal / .local / single-label', () => {
  const unsafe = [
    ['http://jobs.founderful.com/jobs', 'non-https'],
    ['https://127.0.0.1/jobs', 'IPv4 loopback'],
    ['https://169.254.169.254/jobs', 'cloud metadata IPv4'],
    ['https://[::1]/jobs', 'IPv6 loopback'],
    ['https://localhost/jobs', 'localhost'],
    ['https://stuff.internal/jobs', '.internal suffix'],
    ['https://box.local/jobs', '.local suffix'],
    ['https://intranet/jobs', 'single-label host'],
    ['not a url', 'unparseable'],
  ];
  for (const [careers_url, label] of unsafe) {
    assert.equal(resolveOrigin({ careers_url }), null, `should reject ${label}: ${careers_url}`);
  }
  assert.equal(resolveOrigin({}), null);
  assert.equal(resolveOrigin(null), null);
});

// ---------------------------------------------------------------------------
// toEpochMs — epoch-seconds / epoch-ms / ISO; non-positive → null
// ---------------------------------------------------------------------------

test('toEpochMs: handles epoch-ms, epoch-seconds, ISO; non-positive/absent → null', () => {
  assert.equal(toEpochMs(1_700_000_000_000), 1_700_000_000_000); // already ms
  assert.equal(toEpochMs(1_700_000_000), 1_700_000_000_000);     // seconds → ms
  assert.equal(toEpochMs('2026-01-02'), Date.parse('2026-01-02'));
  assert.equal(toEpochMs(0), null);
  assert.equal(toEpochMs(-5), null);
  assert.equal(toEpochMs(''), null);
  assert.equal(toEpochMs(null), null);
  assert.equal(toEpochMs('not a date'), null);
});

// ---------------------------------------------------------------------------
// locationString — locations[] / normalizedLocations / remote fallback
// ---------------------------------------------------------------------------

test('locationString: joins locations[], else normalizedLocations labels, else Remote/""', () => {
  assert.equal(locationString({ locations: ['Zurich', 'Berlin'] }), 'Zurich, Berlin');
  assert.equal(locationString({ normalizedLocations: [{ label: 'London' }, { value: 'Paris' }] }), 'London, Paris');
  assert.equal(locationString({ remote: true }), 'Remote');
  assert.equal(locationString({ remote: false }), '');
  assert.equal(locationString({}), '');
});

// ---------------------------------------------------------------------------
// normalizeConsiderJob — url absolutize, attribution, remote, date, drops
// ---------------------------------------------------------------------------

const ORIGIN = 'https://jobs.founderful.com';

test('normalizeConsiderJob: maps a row into the web-ui shape (absolute url kept)', () => {
  const n = normalizeConsiderJob(
    { title: 'AI Engineer', url: 'https://acme.com/jobs/1', companyName: 'Acme', locations: ['Remote'], timeStamp: '2026-01-02', remote: true },
    { origin: ORIGIN, company: OK_ENTRY },
  );
  assert.ok(n);
  assert.equal(n.title, 'AI Engineer');
  assert.equal(n.company, 'Acme');
  assert.equal(n.url, 'https://acme.com/jobs/1');
  assert.equal(n.location, 'Remote');
  assert.equal(n.isRemote, true);
  assert.equal(n.workplaceType, 'Remote');
  assert.equal(n.relocates, false);
  assert.equal(n.salary, '');
  assert.equal(n.snippet, '');
  assert.equal(n.source, 'consider');
  assert.equal(n.date, new Date(Date.parse('2026-01-02')).toISOString());
  assert.ok(n.id.startsWith('consider-'));
});

test('normalizeConsiderJob: absolutizes a relative url against the board origin', () => {
  const n = normalizeConsiderJob({ title: 'X', url: '/company/acme/job/42' }, { origin: ORIGIN });
  assert.equal(n.url, 'https://jobs.founderful.com/company/acme/job/42');
});

test('normalizeConsiderJob: falls back to applyUrl; drops rows with neither url', () => {
  const n = normalizeConsiderJob({ title: 'X', applyUrl: 'https://acme.com/apply/9' }, { origin: ORIGIN });
  assert.equal(n.url, 'https://acme.com/apply/9');
  assert.equal(normalizeConsiderJob({ title: 'No URL' }, { origin: ORIGIN }), null);
  assert.equal(normalizeConsiderJob(null, { origin: ORIGIN }), null);
});

test('normalizeConsiderJob: company falls back to the entry name when companyName absent', () => {
  const n = normalizeConsiderJob({ title: 'X', url: 'https://acme.com/1' }, { origin: ORIGIN, company: { name: 'Founderful' } });
  assert.equal(n.company, 'Founderful');
});

test('normalizeConsiderJob: derives workplaceType Onsite from remote:false; "" when unknown', () => {
  assert.equal(normalizeConsiderJob({ title: 'X', url: 'https://a.com/1', remote: false }, {}).workplaceType, 'Onsite');
  assert.equal(normalizeConsiderJob({ title: 'X', url: 'https://a.com/2' }, {}).workplaceType, '');
});

test('normalizeConsiderJob: an epoch-ms timeStamp maps to an ISO date; a 0 stamp → ""', () => {
  const ms = normalizeConsiderJob({ title: 'X', url: 'https://a.com/1', timeStamp: 1_700_000_000_000 }, {});
  assert.equal(ms.date, new Date(1_700_000_000_000).toISOString());
  const zero = normalizeConsiderJob({ title: 'X', url: 'https://a.com/2', timeStamp: 0 }, {});
  assert.equal(zero.date, '');
});

// ---------------------------------------------------------------------------
// fetchConsider — single POST, body/headers/redirect, normalize, dedupe, throws
// ---------------------------------------------------------------------------

test('fetchConsider: one POST to {origin}/api-boards/search-jobs with the right body/headers', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ jobs: [
      { title: 'AI Eng', url: 'https://acme.com/x', companyName: 'Acme', locations: ['Remote'], timeStamp: '2026-01-02' },
    ] }) };
  };
  const jobs = await fetchConsider(considerAdapter.buildEndpoint(OK_ENTRY), { fetchImpl, company: OK_ENTRY });

  assert.equal(calls.length, 1); // single request, no pagination
  assert.equal(calls[0].url, 'https://jobs.founderful.com/api-boards/search-jobs');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.redirect, 'error');
  assert.equal(calls[0].opts.headers.referer, 'https://jobs.founderful.com/jobs');
  const body = JSON.parse(calls[0].opts.body);
  assert.deepEqual(body, { meta: { size: 500 }, board: { id: 'wingman', isParent: true }, query: { promoteFeatured: true } });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].source, 'consider');
});

test('fetchConsider: consider_size overrides the default meta.size', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(opts); return { ok: true, status: 200, json: async () => ({ jobs: [] }) }; };
  await fetchConsider(null, { fetchImpl, company: { ...OK_ENTRY, consider_size: 42 } });
  assert.equal(JSON.parse(calls[0].body).meta.size, 42);
});

test('fetchConsider: attributes companyless rows to the entry name and dedupes by url', async () => {
  const fetchImpl = cannedJobs([
    { title: 'A', url: 'https://acme.com/1' },                         // no companyName → entry name
    { title: 'A dup', url: 'https://acme.com/1', companyName: 'Acme' }, // same url → dropped
    { title: 'B', applyUrl: 'https://acme.com/2', companyName: 'Beta' },
    { title: 'No URL' },                                                // dropped
  ]);
  const jobs = await fetchConsider(null, { fetchImpl, company: OK_ENTRY });
  assert.equal(jobs.length, 2); // dup + url-less dropped
  assert.equal(jobs[0].company, 'Founderful'); // fell back to entry name
  assert.equal(jobs[0].url, 'https://acme.com/1');
  assert.equal(jobs[1].company, 'Beta');
  assert.equal(jobs[1].url, 'https://acme.com/2');
});

test('fetchConsider: DEAD-BOARD — a fetch failure THROWS (single request, nothing succeeded)', async () => {
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchConsider(null, { fetchImpl: failing, company: OK_ENTRY }), /HTTP 503/);

  const rejecting = async () => { throw new Error('board down'); };
  await assert.rejects(() => fetchConsider(null, { fetchImpl: rejecting, company: OK_ENTRY }), /board down/);
});

test('fetchConsider: rejects an unsafe careers_url BEFORE any fetch (SSRF)', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 200, json: async () => ({ jobs: [] }) }; };
  await assert.rejects(
    () => fetchConsider(null, { fetchImpl, company: { name: 'Evil', consider_board: 'x', careers_url: 'https://169.254.169.254/jobs' } }),
    /public host|https/,
  );
  assert.equal(called, false); // guard fires before the network
});

test('fetchConsider: throws when consider_board is missing', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ jobs: [] }) });
  await assert.rejects(
    () => fetchConsider(null, { fetchImpl, company: { name: 'X', careers_url: 'https://jobs.founderful.com/jobs' } }),
    /consider_board/,
  );
});

test('fetchConsider: tolerates a malformed/empty payload → []', async () => {
  const empty = await fetchConsider(null, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }), company: OK_ENTRY });
  assert.deepEqual(empty, []);
});

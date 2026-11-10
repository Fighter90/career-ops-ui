// TurboHire source (CAR-254 port of the parent's providers/turbohire.mjs,
// upstream #6712) — CI-isolated suite.
//
// A TurboHire tenant board lives at `https://<tenant>.turbohire.co`; the
// careers page is a client-side app that makes the same three zero-auth
// requests for every visitor, all to TurboHire's API host: an anonymous
// token (sent with the tenant's own Origin/Referer), the tenant's org id
// (cached per tenant), and one POST of the full public job list (no
// pagination). The parser must fail CLOSED on a body without a Result array
// while a present-and-empty Result is []; a response holding fewer rows
// than its own Total is reported (canonical `truncated` tag + warning),
// never silently presented as the whole board. No network — fetchTurbohire
// runs on a fake fetchImpl with an injectable sleep and idCache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  TENANT_HOST_RE,
  resolveTenant,
  resolveOrigin,
  assertTurbohireUrl,
  postingSegment,
  jobLocation,
  employerName,
  parseTurbohireResponse,
  fetchTurbohire,
} from '../server/lib/sources/turbohire.mjs';
import { turbohireAdapter } from '../server/lib/portals/adapters/turbohire.mjs';

const ORIGIN = 'https://acme.turbohire.co';
const BOARD = { tenant: 'acme', origin: ORIGIN };
const API = 'https://thapi.azurewebsites.net';
const ORG_ID = '1b2c3d4e-0000-4000-8000-00000000abcd';
const TOKEN_URL = `${API}/api/token/noauth`;
const ORG_URL = `${API}/api/publicorganizations?accountName=acme`;
const JOBS_URL = `${API}/api/careerpagev2/filteredjobs?orgId=${ORG_ID}&pageType=0`;
const ENDPOINT = `${ORIGIN}/`;

/** One row in the shape the filteredjobs response returns. */
const row = (id, extra = {}) => ({
  JobId: `0000000${id}-0000-4000-8000-000000000000`,
  JobIdObfuscated: id,
  JobCode: `REQ_${id}`,
  JobTitle: `Engineer ${id}`,
  PublishedDate: '2026-10-01T07:05:00.6942708Z',
  UpdatedDate: '2026-10-27T12:54:52.6233333',
  Location: JSON.stringify([{ Address: 'Pune, Maharashtra, India', PlaceId: null }]),
  ShowClientName: false,
  ClientName: '[REDACTED]',
  JobDescV2: '<h3>Overview</h3><p>Build <b>things</b> &amp; ship</p>',
  CreatedByEmail: 'recruiter@example.com',
  CreatedByName: 'Example Recruiter',
  ...extra,
});
const envelope = (rows, total = rows.length) => ({ Total: total, Result: rows });

/** A fake fetchImpl answering by URL from an ordered route table; records every call. */
function makeFetch(routes) {
  const calls = [];
  const served = new Map();
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts });
    const list = routes[url];
    if (!list) throw new Error(`unexpected request ${url}`);
    const i = served.get(url) ?? 0;
    served.set(url, i + 1);
    const answer = list[Math.min(i, list.length - 1)];
    if (answer instanceof Error) throw answer;
    if (answer instanceof Response) return answer;
    return answer;
  };
  return { calls, impl, served };
}

/** A 200 JSON answer in the stub shape fetchJson understands. */
const okJson = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
/** A non-ok answer; `attempts` counts how many times the stub was hit. */
const badStatus = (status, body = '') => ({ ok: false, status, headers: { get: () => null }, text: async () => body });

const liveRoutes = (jobs = envelope([row('a1'), row('a2')])) => ({
  [TOKEN_URL]: [okJson({ access_token: 'anon-token', expires_in: 3600 })],
  [ORG_URL]: [okJson({ OrgID: ORG_ID, OrgName: 'Acme Group', CareerPageSubdomain: 'acme' })],
  [JOBS_URL]: [okJson(jobs)],
});

const ENTRY = { name: 'Acme', careers_url: `${ORIGIN}/` };
const SLEEP = async () => {};
/** fetchTurbohire with a fresh per-test org cache and no wall-clock waits. */
const fetchCalls = async (routes, opts = {}) => {
  const f = makeFetch(routes);
  const jobs = await fetchTurbohire(ENDPOINT, { fetchImpl: f.impl, sleep: SLEEP, idCache: new Map(), company: ENTRY, ...opts });
  return { jobs, calls: f.calls };
};

/** Capture console.error lines while `fn` runs. */
async function captureWarnings(fn) {
  const lines = [];
  const orig = console.error;
  console.error = (...args) => { lines.push(args.join(' ')); };
  try { return { result: await fn(), lines }; } finally { console.error = orig; }
}

// ── registry meta + adapter contract ─────────────────────────────────────────

test('turbohire: meta — value, label, region en; adapter contract shape', () => {
  assert.deepEqual(meta, { value: 'turbohire', label: 'TurboHire', region: 'en' });
  assert.equal(turbohireAdapter.id, 'turbohire');
  assert.equal(turbohireAdapter.label, 'TurboHire');
  assert.equal(typeof turbohireAdapter.matches, 'function');
  assert.equal(typeof turbohireAdapter.buildEndpoint, 'function');
  assert.equal(typeof turbohireAdapter.fetch, 'function');
});

test('turbohire: adapter claims tenant URLs and explicit provider entries; rejects everything else', () => {
  assert.equal(turbohireAdapter.matches({ careers_url: `${ORIGIN}/` }), true);
  assert.equal(turbohireAdapter.matches({ api: `${ORIGIN}/job/publicjobs/x` }), true);
  assert.equal(turbohireAdapter.matches({ name: 'Acme', provider: 'turbohire', careers_url: 'https://careers.example.com/' }), true);
  assert.equal(turbohireAdapter.matches({ careers_url: 'https://careers.example.com/' }), false);
  assert.equal(turbohireAdapter.matches({ careers_url: 'https://app.turbohire.co/' }), false);
  assert.equal(turbohireAdapter.matches(null), false);
  assert.equal(turbohireAdapter.buildEndpoint({ careers_url: `${ORIGIN}/dashboardv2?orgId=1` }), ENDPOINT);
  assert.equal(turbohireAdapter.buildEndpoint({ careers_url: 'http://acme.turbohire.co/' }), null);
  assert.equal(turbohireAdapter.buildEndpoint({ careers_url: 'https://www.turbohire.co/' }), null);
  assert.equal(turbohireAdapter.buildEndpoint({}), null);
});

// ── tenant resolution ────────────────────────────────────────────────────────

test('turbohire: resolveOrigin claims any path on a tenant host and rebuilds the origin', () => {
  const cases = [
    [{ careers_url: `${ORIGIN}/` }, ENDPOINT],
    [{ careers_url: ORIGIN }, ENDPOINT],
    [{ careers_url: `${ORIGIN}/dashboardv2?orgId=${ORG_ID}` }, ENDPOINT],
    [{ careers_url: `${ORIGIN}/job/publicjobs/AbC%2FdEf_gh-1` }, ENDPOINT],
    [{ careers_url: 'https://ACME.turbohire.co/x#y' }, ENDPOINT],
    [{ careers_url: 'https://acme.turbohire.co:8443/' }, ENDPOINT],
    [{ api: `${ORIGIN}/` }, ENDPOINT],
    [{ careers_url: 'https://acme-group2.turbohire.co/' }, 'https://acme-group2.turbohire.co/'],
    [{ api: 'https://www.example.com/', careers_url: `${ORIGIN}/` }, ENDPOINT],
  ];
  for (const [entry, want] of cases) assert.equal(resolveOrigin(entry), want, JSON.stringify(entry));
});

test('turbohire: resolveOrigin returns null for non-tenants', () => {
  const reject = [
    { careers_url: 'http://acme.turbohire.co/' },
    { careers_url: 'https://acme.turbohire.co.evil.example/' },
    { careers_url: 'https://evilturbohire.co/' },
    { careers_url: 'https://acme-turbohire.co/' },
    { careers_url: 'https://a.b.turbohire.co/' },
    { careers_url: 'https://-acme.turbohire.co/' },
    { careers_url: 'https://turbohire.co/' },
    { careers_url: 'https://app.turbohire.co/' },
    { careers_url: 'https://www.turbohire.co/' },
    { careers_url: 'https://api.turbohire.co/' },
    { careers_url: 'https://acme.turbohire.com/' },
    { careers_url: `${API}/api/token/noauth` },
    { careers_url: 'https://careers.example.com/jobs' },
    { careers_url: 'not a url' },
    { careers_url: null },
    { careers_url: 42 },
    {},
    null,
  ];
  for (const entry of reject) assert.equal(resolveOrigin(entry), null, JSON.stringify(entry));
  assert.match(String(TENANT_HOST_RE), /turbohire/);
});

test('turbohire: assertTurbohireUrl accepts only a clean tenant origin (no port, no path)', () => {
  assert.equal(assertTurbohireUrl(ENDPOINT), ENDPOINT);
  assert.equal(assertTurbohireUrl(ORIGIN), ORIGIN);
  assert.throws(() => assertTurbohireUrl(`${ORIGIN}:8443/`), /port|HTTPS|turbohire/i);
  assert.throws(() => assertTurbohireUrl('http://acme.turbohire.co/'), /HTTPS/);
  assert.throws(() => assertTurbohireUrl('https://careers.example.com/'), /turbohire/i);
  assert.throws(() => assertTurbohireUrl('https://app.turbohire.co/'), /turbohire/i);
});

// ── postingSegment ───────────────────────────────────────────────────────────

test('turbohire: postingSegment re-encodes the obfuscated id; malformed input drops the posting', () => {
  const cases = [
    ['uiv4JEq5%2FquZ_m-9', 'uiv4JEq5%2FquZ_m-9'],
    ['abc%2Bdef%3D', 'abc%2Bdef%3D'],
    ['abc+def/ghi', 'abc%2Bdef%2Fghi'],
    ['abc%zz', null],
    ['abc%ED%A0%80', null],
    ['\uD800bad', null],
    ['', null],
    [null, null],
    [42, '42'],
  ];
  for (const [input, want] of cases) assert.equal(postingSegment(input), want, String(input));
});

// ── jobLocation ──────────────────────────────────────────────────────────────

test('turbohire: jobLocation joins distinct sites and tolerates junk', () => {
  assert.equal(
    jobLocation(JSON.stringify([{ Address: 'Pune, India' }, { Address: 'Pune, India' }, { Address: 'Mumbai,  India' }])),
    'Pune, India; Mumbai, India',
  );
  assert.equal(jobLocation([{ Address: 'Pune, India' }]), 'Pune, India');
  assert.equal(jobLocation('Pune, India'), 'Pune, India');
  assert.equal(jobLocation('[{"Address": broken'), '');
  assert.equal(jobLocation(JSON.stringify([{ Address: null }, 42, null, { PlaceId: 'x' }])), '');
  assert.equal(jobLocation(JSON.stringify({ Address: 'Pune' })), '');
  assert.equal(jobLocation(''), '');
  assert.equal(jobLocation(undefined), '');
  assert.equal(jobLocation(null), '');
});

// ── employerName ─────────────────────────────────────────────────────────────

test('turbohire: employerName uses a shown client name, never a hidden one or the entry re-spelled', () => {
  assert.equal(employerName({ ShowClientName: true, ClientName: 'Acme Motors Limited' }, 'Acme Group'), 'Acme Motors Limited');
  assert.equal(employerName({ ShowClientName: true, ClientName: '  Acme &amp; Sons ' }, 'Acme Group'), 'Acme & Sons');
  assert.equal(employerName({ ShowClientName: false, ClientName: 'Acme Motors Limited' }, 'Acme Group'), 'Acme Group');
  assert.equal(employerName({ ShowClientName: true, ClientName: '[REDACTED]' }, 'Acme Group'), 'Acme Group');
  assert.equal(employerName({ ShowClientName: true, ClientName: '' }, 'Acme Group'), 'Acme Group');
  assert.equal(employerName({ ShowClientName: true, ClientName: 'AcmeGroup' }, 'Acme Group'), 'Acme Group');
  assert.equal(employerName({ ShowClientName: 'true', ClientName: 'Acme Motors' }, 'Acme Group'), 'Acme Group');
  assert.equal(employerName(null, 'Acme Group'), 'Acme Group');
});

// ── parseTurbohireResponse ───────────────────────────────────────────────────

test('turbohire: parse maps title/url/company/location/req/date/description and drops junk rows', () => {
  const parsed = parseTurbohireResponse(envelope([
    row('a1'),
    row('a2', { PublishedDate: '', JobCode: '', JobDescV2: '', Location: '' }),
    row('a3', { JobTitle: '   ' }),
    row(null),
    row(''),
    row('a4', { JobTitle: '  R&amp;D   Engineer  ' }),
    null,
    'junk',
  ]), 'Acme', BOARD);
  assert.equal(parsed.length, 3);
  const [j1, j2, j4] = parsed;
  assert.deepEqual(
    { title: j1.title, url: j1.url, company: j1.company, location: j1.location, requisitionId: j1.requisitionId },
    { title: 'Engineer a1', url: `${ORIGIN}/job/publicjobs/a1`, company: 'Acme', location: 'Pune, Maharashtra, India', requisitionId: 'REQ_a1' },
  );
  assert.equal(j1.postedAt, Date.parse('2026-10-01T07:05:00.694Z'));
  assert.equal(j1.description, 'Overview Build things & ship');
  assert.ok(!('postedAt' in j2) && !('requisitionId' in j2) && !('description' in j2) && j2.location === '');
  assert.equal(j4.title, 'R&D Engineer');
  const leaked = parsed.filter((j) => /recruiter|example\.com/i.test(JSON.stringify(j)));
  assert.equal(leaked.length, 0);
});

test('turbohire: an unreadable PublishedDate leaves postedAt unset (never UpdatedDate)', () => {
  const [job] = parseTurbohireResponse(envelope([row('a1', { PublishedDate: 'soon' })]), 'Acme', BOARD);
  assert.ok(job && !('postedAt' in job));
});

test('turbohire: a posting listed twice comes back once', () => {
  assert.equal(parseTurbohireResponse(envelope([row('a1'), row('a1')]), 'Acme', BOARD).length, 1);
});

test('turbohire: a present-and-empty Result is []; any other envelope throws, naming the keys', () => {
  assert.equal(parseTurbohireResponse(envelope([]), 'Acme', BOARD).length, 0);
  for (const [body, label] of [
    [{}, '{}'],
    [{ Total: 0 }, 'missing Result'],
    [{ Total: 0, Result: null }, 'null Result'],
    [{ Total: 0, Result: {} }, 'non-array Result'],
    [{ jobs: [] }, 'other container key'],
    [[], 'bare array'],
    [null, 'null'],
    ['', 'empty body'],
    [42, 'a number'],
    ['<html>', 'an HTML body'],
  ]) {
    assert.throws(() => parseTurbohireResponse(body, 'Acme', BOARD), /turbohire: unexpected response/, label);
  }
  let msg = '';
  try { parseTurbohireResponse({ error: 'x', jobs: [] }, 'Acme', BOARD); } catch (err) { msg = err.message; }
  assert.match(msg, /\[error, jobs\]/);
});

// ── fetchTurbohire ───────────────────────────────────────────────────────────

test('turbohire: fetch rejects a non-tenant endpoint before any request', async () => {
  const f = makeFetch({});
  await assert.rejects(
    () => fetchTurbohire('https://careers.example.com/', { fetchImpl: f.impl, sleep: SLEEP, idCache: new Map(), company: ENTRY }),
    /cannot derive|turbohire/,
  );
  assert.equal(f.calls.length, 0);
});

test('turbohire: fetch makes the three careers-page requests in order, with the right headers', async () => {
  const { jobs, calls } = await fetchCalls(liveRoutes());
  assert.equal(jobs.length, 2);
  assert.equal(calls.map((c) => c.url).join(' '), `${TOKEN_URL} ${ORG_URL} ${JOBS_URL}`);
  assert.ok(calls.every((c) => c.opts.redirect === 'error'));
  const [token, org, list] = calls;
  assert.equal(token.opts.headers.origin, ORIGIN);
  assert.equal(token.opts.headers.referer, `${ORIGIN}/`);
  assert.equal(token.opts.method, 'GET');
  assert.equal('origin' in org.opts.headers, false);
  assert.equal('origin' in list.opts.headers, false);
  assert.equal(org.opts.headers.authorization, 'Bearer anon-token');
  assert.equal(list.opts.headers.authorization, 'Bearer anon-token');
  assert.equal(list.opts.method, 'POST');
  assert.equal(list.opts.body, '{}');
  assert.equal(list.opts.headers['content-type'], 'application/json');
  // Only pageType=0 (the public careers page) is ever requested.
  const pageTypes = calls.map((c) => new URL(c.url).searchParams.get('pageType')).filter((v) => v !== null);
  assert.deepEqual(pageTypes, ['0']);
});

test('turbohire: fetch normalizes rows to the scanner job shape, dropping the input port and path', async () => {
  const { jobs } = await fetchCalls(liveRoutes());
  assert.equal(jobs.length, 2);
  const j1 = jobs[0];
  assert.equal(j1.id, `turbohire-${ORIGIN}/job/publicjobs/a1`);
  assert.equal(j1.title, 'Engineer a1');
  assert.equal(j1.company, 'Acme');
  assert.equal(j1.url, `${ORIGIN}/job/publicjobs/a1`);
  assert.equal(j1.location, 'Pune, Maharashtra, India');
  assert.equal(j1.date, new Date(Date.parse('2026-10-01T07:05:00.6942708Z')).toISOString());
  assert.equal(j1.snippet, 'Overview Build things & ship');
  assert.equal(j1.requisitionId, 'REQ_a1');
  assert.equal(j1.source, 'turbohire');
  assert.equal(j1.salary, '');
  assert.equal(typeof j1.isRemote, 'boolean');
});

test('turbohire: the org id is cached between fetches; a fresh id skips the lookup', async () => {
  const cache = new Map([['acme', { id: ORG_ID, checkedAt: new Date().toISOString() }]]);
  const { jobs, calls } = await fetchCalls(liveRoutes(), { idCache: cache });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 2);
  assert.ok(!calls.some((c) => c.url === ORG_URL));
});

test('turbohire: fetch stores a looked-up org id under the tenant', async () => {
  const cache = new Map();
  await fetchCalls(liveRoutes(), { idCache: cache });
  assert.equal(cache.get('acme')?.id, ORG_ID);
  assert.ok(Number.isFinite(Date.parse(cache.get('acme')?.checkedAt)));
});

test('turbohire: an unknown tenant (404) drops the cached id and requests no job list', async () => {
  const cache = new Map([['acme', { id: ORG_ID, checkedAt: '2000-01-01T00:00:00.000Z' }]]);
  const f = makeFetch({ ...liveRoutes(), [ORG_URL]: [badStatus(404, 'Not Found')] });
  await assert.rejects(
    () => fetchTurbohire(ENDPOINT, { fetchImpl: f.impl, sleep: SLEEP, idCache: cache, company: ENTRY }),
    (err) => err.status === 404 && /no TurboHire tenant "acme"/.test(err.message),
  );
  assert.equal(cache.has('acme'), false);
  assert.ok(!f.calls.some((c) => c.url === JOBS_URL));
});

test('turbohire: a token response with no usable access_token throws before any other request', async () => {
  for (const answer of [{}, { access_token: '  ' }, null]) {
    const { calls } = await (async () => {
      const f = makeFetch({ ...liveRoutes(), [TOKEN_URL]: [okJson(answer)] });
      await assert.rejects(
        () => fetchTurbohire(ENDPOINT, { fetchImpl: f.impl, sleep: SLEEP, idCache: new Map(), company: ENTRY }),
        /returned no access_token/,
      );
      return { calls: f.calls };
    })();
    assert.equal(calls.length, 1, JSON.stringify(answer));
  }
});

test('turbohire: an org response with no usable OrgID throws before the job list', async () => {
  for (const [answer, label] of [
    [{ OrgName: 'Acme' }, 'no OrgID'],
    [{ OrgID: '00000000-0000-0000-0000-000000000000' }, 'the nil GUID'],
    [{ OrgID: '../../etc' }, 'a non-GUID OrgID'],
    [null, 'null body'],
  ]) {
    const f = makeFetch({ ...liveRoutes(), [ORG_URL]: [okJson(answer)] });
    await assert.rejects(
      () => fetchTurbohire(ENDPOINT, { fetchImpl: f.impl, sleep: SLEEP, idCache: new Map(), company: ENTRY }),
      /returned no org id/,
      label,
    );
    assert.ok(!f.calls.some((c) => c.url.includes('filteredjobs')), label);
  }
});

test('turbohire: fewer rows than the response Total warns and tags the result truncated', async () => {
  const { result, lines } = await captureWarnings(() => fetchCalls(liveRoutes(envelope([row('a1')], 5))));
  assert.equal(result.jobs.length, 1);
  assert.ok(lines.some((l) => /returned 1 of 5 postings/.test(l)));
  assert.deepEqual(
    { reason: result.jobs.truncated?.reason, fetched: result.jobs.truncated?.fetched, total: result.jobs.truncated?.total },
    { reason: result.jobs.truncated?.reason, fetched: 1, total: 5 },
  );
  assert.equal(typeof result.jobs.truncated.reason, 'string');
});

test('turbohire: a complete response logs nothing and carries no truncation tag', async () => {
  const { result, lines } = await captureWarnings(() => fetchCalls(liveRoutes()));
  assert.equal(lines.length, 0);
  assert.equal(result.jobs.truncated, undefined);
});

test('turbohire: a refused token request (403) fails without retrying or going further', async () => {
  const f = makeFetch({ ...liveRoutes(), [TOKEN_URL]: [badStatus(403, '"Invalid request."')] });
  await assert.rejects(
    () => fetchTurbohire(ENDPOINT, { fetchImpl: f.impl, sleep: SLEEP, idCache: new Map(), company: ENTRY }),
    (err) => err.status === 403,
  );
  assert.equal(f.calls.length, 1);
});

test('turbohire: a broken job-list envelope throws; a live empty board is []', async () => {
  await assert.rejects(
    () => fetchCalls(liveRoutes({ message: 'maintenance' })),
    /unexpected response/,
  );
  const { jobs } = await fetchCalls(liveRoutes(envelope([])));
  assert.deepEqual(jobs, []);
});

/**
 * v1.16.0 — Workday CAPTCHA / 4xx graceful fallback.
 *
 * v1.14.0 threw on any non-OK Workday response, which aborted the
 * whole scan when a single tenant CAPTCHA'd. v1.16 swallows the
 * error, annotates `lastWorkdayFallback`, and returns []. Callers
 * can opt back into the throw via `opts.strict=true`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWorkday, lastWorkdayFallback as _initialSnapshot } from '../server/lib/sources/workday.mjs';

const ENDPOINT = 'https://example.wd5.myworkdayjobs.com/wday/cxs/example/External/jobs';

test('happy path: returns normalized jobs from CXS response', async () => {
  const stubFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      jobPostings: [
        { title: 'Senior Backend', externalPath: '/job/abc', locationsText: 'Remote', bulletFields: ['Backend','REQ-1'], postedOn: '2026-05-01' },
        { title: 'Staff Engineer', externalPath: 'https://example.com/job/def', locationsText: 'San Francisco', bulletFields: ['Engineering','REQ-2'], postedOn: '2026-05-02' },
      ],
    }),
  });
  const jobs = await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Senior Backend');
  assert.equal(jobs[0].source, 'workday');
  assert.equal(jobs[0].url, 'https://example.wd5.myworkdayjobs.com/job/abc');
  // absolute path stays absolute
  assert.equal(jobs[1].url, 'https://example.com/job/def');
});

test('CAPTCHA (403) → returns [] (no throw) + sets lastWorkdayFallback', async () => {
  const { lastWorkdayFallback: before } = await import('../server/lib/sources/workday.mjs');
  const stubFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  const jobs = await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.deepEqual(jobs, []);
  const { lastWorkdayFallback: after } = await import('../server/lib/sources/workday.mjs');
  assert.ok(after);
  assert.equal(after.apiUrl, ENDPOINT);
  assert.match(after.reason, /HTTP 403/);
});

test('429 rate-limit → returns [] (graceful)', async () => {
  const stubFetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const jobs = await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.deepEqual(jobs, []);
});

test('non-JSON HTML body → returns [] + flags non-JSON reason', async () => {
  const stubFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new Error('Unexpected token < in JSON'); },
  });
  const jobs = await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.deepEqual(jobs, []);
  const { lastWorkdayFallback } = await import('../server/lib/sources/workday.mjs');
  assert.match(lastWorkdayFallback.reason, /non-JSON|CAPTCHA/i);
});

test('network error → returns [] + flags reason', async () => {
  const stubFetch = async () => { throw new TypeError('fetch failed'); };
  const jobs = await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.deepEqual(jobs, []);
});

test('strict:true opt-in → 4xx throws like v1.14', async () => {
  const stubFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(
    fetchWorkday(ENDPOINT, { fetchImpl: stubFetch, strict: true }),
    /HTTP 403/
  );
});

test('strict:true opt-in → network error throws', async () => {
  const stubFetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(
    fetchWorkday(ENDPOINT, { fetchImpl: stubFetch, strict: true }),
    /fetch failed/
  );
});

// v1.119.0 — parent parity (#1813): Cloudflare-gated tenants (seen live:
// geico) 500 requests missing ordinary browser headers. fetchWorkday must
// send a browser-like UA + accept-language + origin/referer derived from
// the CXS URL's own tenant origin and site slug.
test('sends browser-like headers derived from the CXS URL', async () => {
  let seen = null;
  const stubFetch = async (_url, opts) => {
    seen = opts.headers;
    return { ok: true, status: 200, json: async () => ({ jobPostings: [] }) };
  };
  await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.match(seen['User-Agent'], /Mozilla\/5\.0 .*Chrome\//);
  assert.equal(seen['Accept-Language'], 'en-US,en;q=0.9');
  assert.equal(seen.Origin, 'https://example.wd5.myworkdayjobs.com');
  assert.equal(seen.Referer, 'https://example.wd5.myworkdayjobs.com/External/');
});

// Parent parity (#4080): the CXS POST never follows a redirect.
test('CXS POST passes redirect:error', async () => {
  let seen = null;
  const stubFetch = async (_url, opts) => {
    seen = opts;
    return { ok: true, status: 200, json: async () => ({ jobPostings: [] }) };
  };
  await fetchWorkday(ENDPOINT, { fetchImpl: stubFetch });
  assert.equal(seen.redirect, 'error');
});

// Parent parity (#4467): dead-board detection via Workday's own
// maintenance/outage signals on the careers page.
const CAREERS = 'https://example.wd5.myworkdayjobs.com/External';
const MAINTENANCE_BODY = '<script>window.location.href = "https://community.workday.com/maintenance-page";</script>';
function deadStub(apiStatus, careers) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url === ENDPOINT) return { ok: false, status: apiStatus, headers: new Headers(), text: async () => '{"errorCode":"HTTP_422"}' };
    assert.equal(url, CAREERS);
    return careers;
  };
  return { fetchImpl, calls };
}

test('careersPageFromApi derives the public careers page from the CXS URL', async () => {
  const { careersPageFromApi } = await import('../server/lib/sources/workday.mjs');
  assert.equal(careersPageFromApi(ENDPOINT), CAREERS);
  assert.equal(careersPageFromApi('https://evil.com/wday/cxs/x/Ext/jobs'), null);
  assert.equal(careersPageFromApi('not a url'), null);
});

test('dead board: 422 + maintenance-page body (non-2xx) → strict throws a synthetic 404; probe uses redirect:manual', async () => {
  const { fetchImpl, calls } = deadStub(422, { ok: false, status: 500, headers: new Headers(), text: async () => MAINTENANCE_BODY });
  await assert.rejects(
    fetchWorkday(ENDPOINT, { fetchImpl, strict: true, resolveMultiLocation: false }),
    (err) => err.status === 404 && /confirmed dead/.test(err.message),
  );
  assert.equal(calls[1].opts.redirect, 'manual');
});

test('dead board: 422 + maintenance marker on a 200 careers body → synthetic 404', async () => {
  const { fetchImpl } = deadStub(422, { ok: true, status: 200, headers: new Headers(), text: async () => MAINTENANCE_BODY });
  await assert.rejects(fetchWorkday(ENDPOINT, { fetchImpl, strict: true }), (err) => err.status === 404);
});

test('dead board: 403 + redirect to the myworkday outage page → synthetic 404', async () => {
  const { fetchImpl } = deadStub(403, {
    ok: false, status: 302,
    headers: new Headers({ location: 'https://wd5.myworkday.com/wday/drs/outage?t=example&s=External' }),
    text: async () => '',
  });
  await assert.rejects(fetchWorkday(ENDPOINT, { fetchImpl, strict: true }), (err) => err.status === 404);
});

test('dead board: 401 + redirect elsewhere (tenant rename) keeps the original 401', async () => {
  const { fetchImpl } = deadStub(401, {
    ok: false, status: 302,
    headers: new Headers({ location: 'https://example.wd5.myworkdayjobs.com/NewSiteName' }),
    text: async () => '',
  });
  await assert.rejects(fetchWorkday(ENDPOINT, { fetchImpl, strict: true }), (err) => err.status === 401);
});

test('dead board: 422 + clean careers page keeps the original 422', async () => {
  const { fetchImpl } = deadStub(422, { ok: true, status: 200, headers: new Headers(), text: async () => '<div id="root">careers</div>' });
  await assert.rejects(fetchWorkday(ENDPOINT, { fetchImpl, strict: true }), (err) => err.status === 422);
});

test('dead board: a 500 (not a confirmable status) never probes the careers page', async () => {
  const { fetchImpl, calls } = deadStub(500, { ok: true, status: 200, headers: new Headers(), text: async () => MAINTENANCE_BODY });
  await assert.rejects(fetchWorkday(ENDPOINT, { fetchImpl, strict: true }), (err) => err.status === 500);
  assert.equal(calls.length, 1);
});

test('dead board (non-strict): graceful [] with a "confirmed dead" fallback reason', async () => {
  const { fetchImpl } = deadStub(422, { ok: true, status: 200, headers: new Headers(), text: async () => MAINTENANCE_BODY });
  const jobs = await fetchWorkday(ENDPOINT, { fetchImpl });
  assert.deepEqual(jobs, []);
  const { lastWorkdayFallback } = await import('../server/lib/sources/workday.mjs');
  assert.match(lastWorkdayFallback.reason, /HTTP 422 — confirmed dead/);
});

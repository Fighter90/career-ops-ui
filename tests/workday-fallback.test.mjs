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

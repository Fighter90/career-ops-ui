/**
 * Liveness classifier + ATS URL resolver — pure, CI-isolated (no network,
 * no parent project). Covers the classifier's status branches and the
 * SSRF-relevant fixed-host mapping of resolveAtsApi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLiveness } from '../server/lib/liveness-core.mjs';
import { resolveAtsApi, isAtsPosting, classifyAshbyBoard } from '../server/lib/liveness-api.mjs';

// A body long enough to clear MIN_CONTENT_CHARS (300) so short-body heuristics
// don't fire when we're isolating the status-code branches.
const LONG_BODY = 'x'.repeat(400);

test('classifyLiveness: 404 and 410 → expired (http_gone)', () => {
  for (const status of [404, 410]) {
    const r = classifyLiveness({ status, bodyText: LONG_BODY });
    assert.equal(r.result, 'expired', `status ${status}`);
    assert.equal(r.code, 'http_gone');
  }
});

test('classifyLiveness: 200 with a visible apply control → active (live)', () => {
  const r = classifyLiveness({
    status: 200,
    requestedUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    finalUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    bodyText: LONG_BODY,
    applyControls: ['Apply for this job'],
  });
  assert.equal(r.result, 'active'); // the /api/liveness route maps active → live
  assert.equal(r.code, 'apply_control_visible');
});

test('classifyLiveness: 403 / 429 / 503 → uncertain (access_blocked, never expired)', () => {
  for (const status of [403, 429, 503]) {
    const r = classifyLiveness({ status, bodyText: LONG_BODY });
    assert.equal(r.result, 'uncertain', `status ${status}`);
    assert.equal(r.code, 'access_blocked');
  }
});

test('classifyLiveness: other 5xx (500/502/504) → uncertain (server_error)', () => {
  for (const status of [500, 502, 504]) {
    const r = classifyLiveness({ status, bodyText: LONG_BODY });
    assert.equal(r.result, 'uncertain', `status ${status}`);
    assert.equal(r.code, 'server_error');
  }
});

test('classifyLiveness: a hard-expired banner → expired even on 200', () => {
  const r = classifyLiveness({ status: 200, bodyText: 'This job posting has expired. ' + LONG_BODY });
  assert.equal(r.result, 'expired');
  assert.equal(r.code, 'expired_body');
});

test('classifyLiveness: 200, content present, no apply control → uncertain (conservative)', () => {
  const r = classifyLiveness({ status: 200, bodyText: LONG_BODY, applyControls: [] });
  assert.equal(r.result, 'uncertain');
  assert.equal(r.code, 'no_apply_control');
});

test('resolveAtsApi: maps each provider posting URL to its FIXED-host public API', () => {
  const cases = [
    ['https://boards.greenhouse.io/acme/jobs/123', 'greenhouse', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123'],
    ['https://jobs.lever.co/acme/abc-123', 'lever', 'https://api.lever.co/v0/postings/acme/abc-123'],
    ['https://jobs.ashbyhq.com/acme/uuid-1', 'ashby', 'https://api.ashbyhq.com/posting-api/job-board/acme'],
    ['https://acme.wd1.myworkdayjobs.com/en-US/careers/job/Remote/Engineer_R1', 'workday',
      'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/job/Remote/Engineer_R1'],
    ['https://jobs.smartrecruiters.com/Acme/744000012345678-engineer', 'smartrecruiters',
      'https://api.smartrecruiters.com/v1/companies/Acme/postings/744000012345678'],
  ];
  for (const [url, ats, apiUrl] of cases) {
    const r = resolveAtsApi(url);
    assert.ok(r, `should resolve ${url}`);
    assert.equal(r.ats, ats, url);
    assert.equal(r.apiUrl, apiUrl, url);
    assert.equal(isAtsPosting(url), true, url);
  }
});

test('resolveAtsApi: rejects non-ATS, http, and look-alike hostnames (SSRF guard)', () => {
  for (const url of [
    'https://example.com/jobs/1',
    'http://boards.greenhouse.io/acme/jobs/123',            // not https
    'https://boards.greenhouse.io.evil.com/acme/jobs/123',  // look-alike host
    'https://jobs.ashbyhq.com.evil.com/acme/uuid',          // look-alike host
    'not-a-url',
  ]) {
    assert.equal(resolveAtsApi(url), null, url);
    assert.equal(isAtsPosting(url), false, url);
  }
});

test('classifyAshbyBoard: listed → active, absent/unlisted → expired, bad shape → null', () => {
  const listed = { jobs: [{ id: 'uuid-1', isListed: true }] };
  assert.equal(classifyAshbyBoard(listed, 'uuid-1').result, 'active');
  const unlisted = { jobs: [{ id: 'uuid-1', isListed: false }] };
  assert.equal(classifyAshbyBoard(unlisted, 'uuid-1').result, 'expired');
  const absent = { jobs: [{ id: 'other', isListed: true }] };
  assert.equal(classifyAshbyBoard(absent, 'uuid-1').result, 'expired');
  assert.equal(classifyAshbyBoard(null, 'uuid-1'), null);
  assert.equal(classifyAshbyBoard({ nope: true }, 'uuid-1'), null);
});

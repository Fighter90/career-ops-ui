/**
 * Liveness classifier — the widened closed-pattern and the SOFT expiry tier.
 * Pure and CI-isolated: imports one zero-dep module, touches no network, no
 * filesystem, and no parent project (never resolves CAREER_OPS_ROOT).
 *
 * Why these cases are worth pinning: a posting classified `expired` is written
 * to scan-history as skipped_expired, and every later scan dedup-filters that
 * URL out — indefinitely, unless scan_history.recheck_after_days is set. So a
 * false "expired" silently deletes a real job, while a false "uncertain" costs
 * one wasted re-check. Every assertion below leans that way on purpose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLiveness } from '../server/lib/liveness-core.mjs';

// Padding to clear MIN_CONTENT_CHARS (300) so the short-body
// `insufficient_content` heuristic never fires and mask the branch under test.
// Deliberately content-free: no "apply", no "application", no job nouns.
const FILLER = ' ' + 'x'.repeat(400);

// A posting URL pair that keeps its job id across the redirect, so the
// `redirected_off_posting` guard stays out of the way.
const URL = 'https://boards.example.com/acme/jobs/1234567';

const post = (over = {}) => classifyLiveness({
  status: 200,
  requestedUrl: URL,
  finalUrl: URL,
  applyControls: [],
  ...over,
});

// ---------------------------------------------------------------------------
// 1. The closed-pattern, widened from "job" to job|role|position
// ---------------------------------------------------------------------------

test('closed-pattern: "role" and "position" phrasings expire like "job" does', () => {
  // The narrow /this job (listing )?is closed/i missed every one of these.
  // Boards write the same banner with whichever noun they use for the req;
  // "This role is closed" was 111 of 111 uncertain postings in one measured run.
  for (const banner of [
    'This role is closed.',
    'This position is closed.',
    'This role listing is closed.',
  ]) {
    const r = post({ bodyText: banner + FILLER });
    assert.equal(r.result, 'expired', banner);
    assert.equal(r.code, 'expired_body', banner);
  }
});

test('closed-pattern: the original "job" phrasings still expire (no regression)', () => {
  for (const banner of [
    'This job is closed.',
    'This job listing is closed.',
  ]) {
    const r = post({ bodyText: banner + FILLER });
    assert.equal(r.result, 'expired', banner);
    assert.equal(r.code, 'expired_body', banner);
  }
});

test('closed-pattern: a "closed-loop" compound adjective is NOT expired', () => {
  // Real prose from a control-systems JD. "is closed" is a substring of
  // "is closed-loop", so a pattern ending at "closed" reads a LIVE posting as
  // dead. \b alone does not save us here: d -> "-" is word -> non-word, so the
  // boundary matches; the (?!-) lookahead is what rejects it.
  const r = post({ bodyText: 'This role is closed-loop control of the platform.' + FILLER });
  assert.notEqual(r.result, 'expired');
  assert.equal(r.code, 'no_apply_control');
});

test('closed-pattern: "closedown" prose is NOT expired', () => {
  // The other half of the guard: \b rejects this one on its own (d -> o is
  // word -> word), so the boundary is load-bearing even with the lookahead.
  const r = post({ bodyText: 'This role is closedown lead for the legacy platform.' + FILLER });
  assert.notEqual(r.result, 'expired');
  assert.equal(r.code, 'no_apply_control');
});

// ---------------------------------------------------------------------------
// 2. The SOFT expiry tier — /\bjob expired\b/ below the apply-control check
// ---------------------------------------------------------------------------

test('soft expiry: a bare "JOB EXPIRED" banner with no apply control → expired_body_soft', () => {
  // The dead-page shape the phrase was added for. It must still fire, and it
  // must be attributed to the soft tier — not to `insufficient_content`, which
  // would also say "expired" but for the wrong reason (and only on short pages).
  const r = post({ bodyText: 'JOB EXPIRED' + FILLER });
  assert.equal(r.result, 'expired');
  assert.equal(r.code, 'expired_body_soft');
});

test('soft expiry: "Job Expired" page chrome loses to a visible apply control', () => {
  // classifyLiveness is handed the whole page innerText plus same-origin iframe
  // text, so a live posting routinely carries the phrase somewhere in its
  // chrome. These three shapes were all measured on genuinely live postings.
  // If /\bjob expired\b/ sat in HARD_EXPIRED_PATTERNS (checked BEFORE
  // hasApplyControl) each one would be deleted from every future scan.
  const shapes = {
    'similar-jobs carousel': 'Similar jobs: Senior Data Engineer - Job Expired. Staff SRE - 2 days ago.',
    'filter chip': 'Filters: Remote only. Hide job expired. Posted this week.',
    'footer FAQ': 'FAQ: What happens when a job expired? We remove it within 24 hours.',
  };
  for (const [shape, chrome] of Object.entries(shapes)) {
    const r = post({ bodyText: 'Senior Platform Engineer at Acme.' + FILLER + ' ' + chrome, applyControls: ['Apply now'] });
    assert.equal(r.result, 'active', shape);
    assert.equal(r.code, 'apply_control_visible', shape);
  }
});

// ---------------------------------------------------------------------------
// 3. Tier precedence: hard > apply control > soft > listing page
// ---------------------------------------------------------------------------

test('tier order: a HARD pattern still beats a visible apply control', () => {
  // Phenom-style pages keep rendering a generic Apply button on a dead req, so
  // the hard tier has to outrank it. This is the inverse of the soft tier and
  // the reason the two lists exist separately.
  const r = post({ bodyText: 'This job posting has expired.' + FILLER, applyControls: ['Apply now'] });
  assert.equal(r.result, 'expired');
  assert.equal(r.code, 'expired_body');
});

test('tier order: the soft tier is checked before the listing-page heuristic', () => {
  // Both say "expired", so only the code distinguishes them — but the order is
  // the contract: soft sits between hasApplyControl and LISTING_PAGE_PATTERNS.
  const r = post({ bodyText: 'JOB EXPIRED' + FILLER + ' 12 jobs found' });
  assert.equal(r.result, 'expired');
  assert.equal(r.code, 'expired_body_soft');
});

test('classifyLiveness keeps its {result, code, reason} shape on the new code', () => {
  const r = post({ bodyText: 'JOB EXPIRED' + FILLER });
  assert.deepEqual(Object.keys(r).sort(), ['code', 'reason', 'result']);
  assert.equal(typeof r.reason, 'string');
  assert.ok(r.reason.length > 0);
});

/**
 * A posting that says HOW it will close is still open (parent #4771, ported to
 * web-ui). Hard expired patterns name a closure without telling whether it has
 * happened, and they are checked before the apply control — so a LIVE posting
 * whose copy says "applications may be accepted until the position has been
 * filled" or "will be closed on 15 December" read as expired, and scan
 * --verify wrote it to scan-history as skipped_expired, dedup-filtering a real
 * job out of every later scan.
 *
 * The fix (parent c0264e7c; the line-break guard is parent 880a1cb4, ported
 * here too): an occurrence counts only when no time/condition word (until,
 * once, when, if…) opens its clause — none within ten words of the end of the
 * match, no clause punctuation or line break in between. Every occurrence is
 * checked, so a real banner on a page whose copy also says "until … has been
 * filled" still closes the posting.
 *
 * Pure classifier tests — no network, no server, no CAREER_OPS_ROOT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLiveness } from '../server/lib/liveness-core.mjs';

// A body long enough to clear MIN_CONTENT_CHARS (300) and read as a real JD.
const JD_BODY = 'You will support faculty research and build data pipelines across the institute. '.repeat(4);

const live = (text) => classifyLiveness({
  status: 200,
  requestedUrl: 'https://careers.example.com/job/123',
  finalUrl: 'https://careers.example.com/job/123',
  bodyText: `${JD_BODY}${text}`,
  applyControls: ['Apply'],
});

test('#4771: a posting that states the CONDITION it will close on stays active', () => {
  const cases = [
    // University of Wisconsin System posting, LinkedIn 2023.
    {
      text: 'However, applications may be accepted until the position has been filled.',
      label: '"applications may be accepted until the position has been filled"',
    },
    {
      // The job-noun window starts at "role", so the clause has to be read
      // back from the end of the match, not from its start.
      text: 'This role is open until the position has been filled.',
      label: '"This role is open until the position has been filled"',
    },
    {
      text: 'We will contact shortlisted candidates once applications have closed.',
      label: '"once applications have closed"',
    },
    {
      text: 'The advert will be removed once we are no longer accepting applications.',
      label: '"once we are no longer accepting applications"',
    },
  ];
  for (const { text, label } of cases) {
    const v = live(text);
    assert.equal(v.result, 'active', `${label} → ${v.result}/${v.code}`);
    assert.equal(v.code, 'apply_control_visible', label);
  }
});

test('#4771: a posting that states the DATE it will close on stays active', () => {
  const cases = [
    {
      text: 'This posting will be closed on December 15, 2026.',
      label: '"will be closed on December 15"',
    },
    {
      text: 'The advert is to be closed on 15 December 2026.',
      label: '"is to be closed on 15 December"',
    },
  ];
  for (const { text, label } of cases) {
    const v = live(text);
    assert.equal(v.result, 'active', `${label} → ${v.result}/${v.code}`);
    assert.equal(v.code, 'apply_control_visible', label);
  }
});

test('#4771: a future closure deadline in Russian («приём заявок до 15 октября», «дедлайн 15 октября») is not a closed state', () => {
  // Regression guard for the Russian-market phrasing that motivated the port:
  // a stated future deadline + a visible Apply control is a live posting.
  const cases = [
    'Приём заявок до 15 октября.',
    'Дедлайн 15 октября.',
  ];
  for (const text of cases) {
    const v = live(text);
    assert.equal(v.result, 'active', `${text} → ${v.result}/${v.code}`);
    assert.equal(v.code, 'apply_control_visible', text);
  }
});

test('#4810 guard: a real banner still closes the posting', () => {
  const cases = [
    {
      // Every occurrence is checked, not just the first — the page carries the
      // closing line in its copy AND a real banner above it.
      text: 'Applications will be accepted until the position has been filled. This position has been filled.',
      label: 'a filled banner on a page whose copy also says "until ... has been filled"',
    },
    {
      // normalizeForMatch() joins this line onto the banner under it. The "if"
      // is 16 words back, outside the clause — the line-break guard.
      text: 'Sign in if you already have a profile The job you are trying to apply for has been filled.',
      label: 'a filled banner right after a sign-in line containing "if"',
    },
    {
      // The comma ends the opening phrase before the banner's own clause.
      text: 'After careful consideration, the position has been filled.',
      label: '"After careful consideration, the position has been filled"',
    },
    {
      text: 'This posting has been closed on 15 September 2026.',
      label: '"has been closed on 15 September" (a past date)',
    },
  ];
  for (const { text, label } of cases) {
    const v = live(text);
    assert.equal(v.result, 'expired', `${label} → ${v.result}/${v.code}`);
    assert.equal(v.code, 'expired_body', label);
  }
});

// ---------------------------------------------------------------------------
// Parent 880a1cb4, ported: a banner on its own line is not part of the line
// above. The clause check used to read the page with its lines joined, so
// chrome ending without punctuation ("Sign in if you have an account", "Get
// notified when new jobs are posted") put its "if"/"when" within ten words of
// the banner's end — the banner read as that line's clause, and a CLOSED
// posting with an Apply control on the page came back active.
// ---------------------------------------------------------------------------

// Same page shape the parent tests: a JD body, then the chrome + banner lines.
const lineAware = (text) => classifyLiveness({
  status: 200,
  requestedUrl: 'https://careers.example.com/job/123',
  finalUrl: 'https://careers.example.com/job/123',
  bodyText: `${JD_BODY}\n${text}`,
  applyControls: ['Apply'],
});

test('#4810: a banner on its own line closes the posting despite clause words in the chrome above', () => {
  const cases = [
    {
      text: 'Sign in if you have an account\nThis job has been filled.',
      label: 'a filled banner under "Sign in if you have an account"',
    },
    {
      text: 'Get notified when new jobs are posted\nNo longer accepting applications',
      label: '"No longer accepting applications" under "Get notified when new jobs are posted"',
    },
    {
      text: 'Please read the full posting before you apply\nThis position is no longer available.',
      label: '"This position is no longer available" under a line ending "before you apply"',
    },
    {
      // A line break inside the banner does not stop the pattern: patterns
      // still match on the joined text; only the clause test sees the breaks.
      text: 'We are no longer accepting\napplications for this role.',
      label: 'a banner broken over two lines',
    },
  ];
  for (const { text, label } of cases) {
    const v = lineAware(text);
    assert.equal(v.result, 'expired', `${label} → ${v.result}/${v.code}`);
    assert.equal(v.code, 'expired_body', label);
  }
});

test('#4810: a closing clause on a line of its own still keeps the posting active (no regression)', () => {
  const cases = [
    {
      text: 'Salary: $80,000\nApplications will be accepted until the position has been filled.\nBenefits',
      label: '"accepted until the position has been filled" between two other lines',
    },
    {
      text: 'How to apply\nYou will receive final notification via email when this vacancy has been filled.',
      label: '"when this vacancy has been filled" under a heading',
    },
  ];
  for (const { text, label } of cases) {
    const v = lineAware(text);
    assert.equal(v.result, 'active', `${label} → ${v.result}/${v.code}`);
    assert.equal(v.code, 'apply_control_visible', label);
  }
});

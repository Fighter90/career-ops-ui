/**
 * Source quarantine (v1.80.0). Pure-function coverage — no PATHS writes, so it
 * stays CI-isolated (loadQuarantine/saveQuarantine touch the parent data dir and
 * are exercised via the en-scanner integration test instead).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isQuarantined, quarantineAdd, pruneQuarantine, isPermanentFailure, RETRY_AFTER_DAYS,
} from '../server/lib/scan-quarantine.mjs';

const DAY = 86_400_000;
const NOW = Date.parse('2026-06-28T00:00:00Z');

test('isPermanentFailure: only 404/410 (by status or message)', () => {
  assert.equal(isPermanentFailure({ status: 404 }), true);
  assert.equal(isPermanentFailure({ status: 410 }), true);
  assert.equal(isPermanentFailure({ message: 'Greenhouse: HTTP 404 (…)' }), true);
  assert.equal(isPermanentFailure({ message: 'Ashby: HTTP 410 (…)' }), true);
  assert.equal(isPermanentFailure({ status: 500 }), false);
  assert.equal(isPermanentFailure({ message: 'HTTP 503' }), false);
  assert.equal(isPermanentFailure(null), false);
});

test('quarantineAdd + isQuarantined: active inside the retry window, expires after', () => {
  let q = { entries: {} };
  q = quarantineAdd(q, 'Temporal', { url: 'https://…/temporal', status: 404 }, new Date(NOW).toISOString());
  assert.equal(q.entries.Temporal.status, 404);
  // same day → quarantined
  assert.equal(isQuarantined(q, 'Temporal', NOW), true);
  // 1 day before the window closes → still quarantined
  assert.equal(isQuarantined(q, 'Temporal', NOW + (RETRY_AFTER_DAYS - 1) * DAY), true);
  // past the window → retried (not quarantined)
  assert.equal(isQuarantined(q, 'Temporal', NOW + (RETRY_AFTER_DAYS + 1) * DAY), false);
  // unknown key → not quarantined
  assert.equal(isQuarantined(q, 'Stripe', NOW), false);
});

test('isQuarantined: tolerates a corrupt entry (bad since)', () => {
  const q = { entries: { Bad: { since: 'not-a-date' } } };
  assert.equal(isQuarantined(q, 'Bad', NOW), false);
});

test('pruneQuarantine: drops entries past the retry window, keeps fresh ones', () => {
  const q = {
    entries: {
      Fresh: { since: new Date(NOW).toISOString() },
      Stale: { since: new Date(NOW - (RETRY_AFTER_DAYS + 5) * DAY).toISOString() },
      Corrupt: { since: 'x' },
    },
  };
  pruneQuarantine(q, NOW);
  assert.deepEqual(Object.keys(q.entries), ['Fresh']);
});

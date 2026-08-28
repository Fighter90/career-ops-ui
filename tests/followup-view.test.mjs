/**
 * followup-view.js — which relayed follow-up entries are actionable now.
 * Loaded in a synthetic window (same pattern as company-logo-domain.test.mjs).
 *
 * Parity target: the parent career-ops `web/src/lib/core/followup-view.mjs`.
 * The decisive field is `urgency` (computed by followup-cadence.mjs), never
 * the tracker `status` — the regression these assertions exist to prevent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/followup-view.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const { isDue, selectDueFollowups, pickNextUpcoming } = w.FollowupView;

test('isDue accepts exactly urgent + overdue', () => {
  assert.equal(isDue({ urgency: 'urgent' }), true);
  assert.equal(isDue({ urgency: 'overdue' }), true);
  assert.equal(isDue({ urgency: 'waiting' }), false);
  assert.equal(isDue({ urgency: 'cold' }), false);
  assert.equal(isDue({ urgency: '' }), false);
  assert.equal(isDue({}), false);
  assert.equal(isDue(null), false);
  assert.equal(isDue(undefined), false);
});

test('a tracker status is never mistaken for an urgency', () => {
  // The parent bug (#2157): filtering on `status` matched nothing, because a
  // tracker status is applied/responded/interview — never "overdue"/"urgent".
  for (const status of ['applied', 'responded', 'interview', 'overdue', 'urgent']) {
    assert.equal(isDue({ status }), false, `status=${status} must not read as due`);
  }
});

test('selectDueFollowups keeps only due entries, urgent before overdue', () => {
  const entries = [
    { appNum: 1, urgency: 'overdue' },
    { appNum: 2, urgency: 'waiting' },
    { appNum: 3, urgency: 'urgent' },
    { appNum: 4, urgency: 'cold' },
    { appNum: 5, urgency: 'urgent' },
  ];
  const due = selectDueFollowups(entries);
  assert.deepEqual(due.map((e) => e.appNum), [3, 5, 1]);
});

test('selectDueFollowups caps at the limit (default 8)', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ appNum: i, urgency: 'urgent' }));
  assert.equal(selectDueFollowups(many).length, 8);
  assert.equal(selectDueFollowups(many, 3).length, 3);
  assert.equal(selectDueFollowups(many, 100).length, 20);
});

test('selectDueFollowups tolerates a non-array / empty relay payload', () => {
  for (const bad of [undefined, null, {}, 'nope', 0]) {
    assert.deepEqual(selectDueFollowups(bad), []);
  }
});

test('pickNextUpcoming returns the nearest NOT-yet-due dated entry', () => {
  const entries = [
    { appNum: 1, urgency: 'urgent', nextFollowupDate: '2026-01-01' },   // due → excluded
    { appNum: 2, urgency: 'waiting', nextFollowupDate: '2026-09-20' },
    { appNum: 3, urgency: 'waiting', nextFollowupDate: '2026-09-02' },  // nearest
    { appNum: 4, urgency: 'cold' },                                     // undated → excluded
  ];
  assert.equal(pickNextUpcoming(entries).appNum, 3);
});

test('pickNextUpcoming sorts undated/unparseable last instead of corrupting the order', () => {
  // An unparseable date must become Infinity, not NaN: a NaN comparator result
  // leaves the array in an arbitrary order and could surface the wrong entry.
  const entries = [
    { appNum: 1, urgency: 'waiting', nextFollowupDate: 'not-a-date' },
    { appNum: 2, urgency: 'waiting', nextFollowupDate: '2026-12-31' },
    { appNum: 3, urgency: 'waiting', nextFollowupDate: '2026-09-05' },
  ];
  assert.equal(pickNextUpcoming(entries).appNum, 3);
});

test('pickNextUpcoming returns null when nothing is scheduled', () => {
  assert.equal(pickNextUpcoming([]), null);
  assert.equal(pickNextUpcoming([{ urgency: 'urgent', nextFollowupDate: '2026-01-01' }]), null);
  assert.equal(pickNextUpcoming([{ urgency: 'cold' }]), null);
  assert.equal(pickNextUpcoming(undefined), null);
});

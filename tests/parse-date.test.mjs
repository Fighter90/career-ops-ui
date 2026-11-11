/**
 * parse-date.mjs — the strict YYYY-MM-DD calendar-date parser (mirror of the
 * parent's lib/parse-date.mjs, ported with upstream #6802).
 *
 * `Date.parse('2026-02-30')` does NOT fail: it rolls over to 2 March, so an
 * impossible date becomes a "real" timestamp. parseDate rejects anything that
 * is not a real YYYY-MM-DD calendar day: strict shape first, then a UTC
 * round-trip (`toISOString().slice(0, 10)` must return the input unchanged).
 *
 * CI-isolated: pure module, no filesystem, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDate } from '../server/lib/parse-date.mjs';

test('parseDate: a real YYYY-MM-DD calendar day parses to UTC midnight', () => {
  const d = parseDate('2026-10-05');
  assert.ok(d instanceof Date);
  assert.equal(d.getTime(), Date.UTC(2026, 9, 5));
  assert.equal(d.toISOString(), '2026-10-05T00:00:00.000Z');
});

test('parseDate: an impossible day rolls nothing — rejected (#6802 repro)', () => {
  // Date.parse would read both of these as valid timestamps (2 Mar / 1 May).
  assert.equal(parseDate('2026-02-30'), null, '2026-02-30 must not roll to 2026-03-02');
  assert.equal(parseDate('2026-04-31'), null, '2026-04-31 must not roll to 2026-05-01');
});

test('parseDate: an impossible month and a leap-day edge are rejected', () => {
  assert.equal(parseDate('2026-13-05'), null, 'month 13 does not exist');
  assert.equal(parseDate('2026-00-10'), null, 'month 0 does not exist');
  assert.equal(parseDate('2026-02-29'), null, '2026 is not a leap year');
  assert.ok(parseDate('2024-02-29') instanceof Date, '2024 IS a leap year');
  assert.equal(parseDate('2024-02-29')?.getTime(), Date.UTC(2024, 1, 29));
});

test('parseDate: the shape must be strict YYYY-MM-DD', () => {
  assert.equal(parseDate('2026-10-5'), null, 'one-digit day is not YYYY-MM-DD');
  assert.equal(parseDate('26-10-05'), null, 'two-digit year');
  assert.equal(parseDate('2026/10/05'), null, 'slashes');
  assert.equal(parseDate('October 5, 2026'), null, 'prose form');
  assert.equal(parseDate('n/a'), null, 'placeholder');
  assert.equal(parseDate(''), null, 'empty');
  assert.equal(parseDate('  2026-10-05  ')?.getTime(), Date.UTC(2026, 9, 5), 'surrounding whitespace trims');
});

test('parseDate: a non-string input is null, never a throw', () => {
  assert.equal(parseDate(undefined), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(42), null);
  assert.equal(parseDate({}), null);
});

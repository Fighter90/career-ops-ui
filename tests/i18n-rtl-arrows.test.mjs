/**
 * Arabic RTL arrow mirroring (BACKLOG v1.243.0).
 *
 * The whole UI mirrors for RTL locales ([dir="rtl"] in app.css), but four
 * `ar` strings kept the LTR arrow (→), pointing the wrong way in a
 * mirrored layout: the "first → last" range reads backwards, the
 * "Open a GitHub issue →" CTA points off-button. In RTL text an arrow
 * must point LEFT (←).
 *
 * Keys are added here when an un-mirrored → is found in the ar dict; a
 * → in these values fails the guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();

const ARROWS = [
  'scan.reposts.range',
  'cvs.mName',
  'bug.openIssue',
  'stats.sgGap',
];

test('ar arrow strings point in the RTL direction (← not →)', () => {
  const bad = [];
  for (const key of ARROWS) {
    const v = DICT[key] && DICT[key].ar;
    assert.ok(v, `${key} missing for ar`);
    if (v.includes('→')) bad.push(`ar.${key} = "${v}" (kept LTR arrow →)`);
    if (!v.includes('←')) bad.push(`ar.${key} = "${v}" (no RTL arrow ←)`);
  }
  assert.deepEqual(bad, [], 'un-mirrored arrows:\n  ' + bad.join('\n  '));
});

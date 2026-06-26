/**
 * Scan display "no cap" regression guard (v1.76.0).
 *
 * Both scanners store the full matched (post-filter) set as `filtered` in
 * data/last-scan.json. The #/scan table paginates them 200/page client-side, so
 * nothing is ever dropped — you turn pages to see everything.
 *
 * History:
 *  - Pre-v1.69.1: a hard `slice(0, 500)` per region silently truncated large
 *    sweeps (a real RU scan produced 1352 matching jobs, 852 hidden).
 *  - v1.69.1: raised to an env-overridable `MAX_STORED_RESULTS` (2000) — still a
 *    ceiling that large company lists hit.
 *  - v1.76.0: the cap was REMOVED entirely. `filtered` is stored verbatim.
 *
 * This guard makes sure the truncation never creeps back: neither scanner may
 * slice the `filtered` set, and the old `MAX_STORED_RESULTS` symbol must be gone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(ROOT, 'server', 'lib', f), 'utf8');

test('neither scanner truncates the matched `filtered` set (no slice cap)', () => {
  for (const f of ['en-scanner.mjs', 'ru-scanner.mjs']) {
    const src = read(f);
    assert.doesNotMatch(src, /slice\(0,\s*500\)/, `${f} still has the legacy hard 500 cap`);
    assert.doesNotMatch(src, /filtered:\s*filtered\.slice\(/, `${f} still slices the filtered display set`);
    assert.match(src, /\bfiltered,\s/, `${f} should store the full matched set as \`filtered,\``);
  }
});

test('the MAX_STORED_RESULTS cap symbol is fully removed (v1.76.0)', () => {
  for (const f of ['en-scanner.mjs', 'ru-scanner.mjs']) {
    assert.doesNotMatch(read(f), /MAX_STORED_RESULTS/, `${f} should no longer reference MAX_STORED_RESULTS`);
  }
});

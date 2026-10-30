/**
 * Faithful CI fake of the parent career-ops `set-status.mjs` CLI contract,
 * narrowed to the shape `POST /api/tracker/status` uses:
 *
 *   node set-status.mjs --row N <State> [--note "..."] [--dry-run] --json
 *
 * Copied into a mkdtemp CAREER_OPS_ROOT by tests/tracker-inline-status.test.mjs
 * (the real script needs its parent-checkout siblings; the route spawns
 * `<CAREER_OPS_ROOT>/set-status.mjs` relative to cwd). Mirrors the real
 * contract: `--json` prints one JSON document to stdout; a handled failure
 * prints { error } and exits non-zero. Echoes the parsed args back so the
 * test can assert the route's argv (row, state, --note, --dry-run).
 *
 * A sibling `set-status-mock.json` ({ stdout, code }) overrides the output —
 * the 502 fixtures (non-JSON stdout, non-zero exit) are driven through it.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const json = argv.includes('--json');
const dryRun = argv.includes('--dry-run');

const rowIdx = argv.indexOf('--row');
const noteIdx = argv.indexOf('--note');
const row = rowIdx !== -1 ? argv[rowIdx + 1] : null;
const note = noteIdx !== -1 ? argv[noteIdx + 1] : null;
// Positionals = everything that is not a flag or a consumed flag value.
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--row' || a === '--note') { i += 1; continue; }
  if (a.startsWith('--')) continue;
  positional.push(a);
}
const state = positional[0] || '';

// Mock override: the test controls failure modes without rewriting this file.
try {
  const ctl = JSON.parse(readFileSync(join(HERE, 'set-status-mock.json'), 'utf8'));
  if (ctl && typeof ctl.stdout === 'string') {
    process.stdout.write(ctl.stdout);
    process.exit(typeof ctl.code === 'number' ? ctl.code : 0);
  }
} catch { /* no control file → default echo behaviour */ }

if (!json) { console.log(`row ${row ?? '?'} → ${state}`); process.exit(0); }
if (row == null || !/^\d+$/.test(row) || !state) {
  console.log(JSON.stringify({ error: 'usage: --row N <state>', code: 'usage' }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, row: Number(row), state, note: note ?? null, dryRun }));
process.exit(0);

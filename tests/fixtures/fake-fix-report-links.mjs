/**
 * Faithful CI fake of the parent career-ops `fix-report-links.mjs` CLI
 * contract, narrowed to the shapes `POST /api/runners/report-links` uses:
 *
 *   node fix-report-links.mjs [--dry-run]
 *
 * Copied into a mkdtemp CAREER_OPS_ROOT by tests/report-links-runner.test.mjs
 * (the real script needs its parent-checkout siblings; the route spawns it
 * relative to cwd = the data root). The REAL parent prints plain text and
 * exits 0 — no `--json` flag exists today — so the default echo here is the
 * structured shape the route must support IF the parent ever gains one:
 * it echoes the parsed argv back as one JSON document so the test can assert
 * the route's argv (`--dry-run` present for dry-run, absent for apply).
 *
 * A sibling `report-links-mock.json` ({ stdout, code, delayMs }) overrides
 * the output — the 502 fixtures (non-zero exit, plain-text stdout) and the
 * lock-serialization fixture (delayMs) are driven through it.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

// Mock override: the test controls failure modes without rewriting this file.
try {
  const ctl = JSON.parse(readFileSync(join(HERE, 'report-links-mock.json'), 'utf8'));
  if (ctl && typeof ctl.delayMs === 'number' && ctl.delayMs > 0) {
    await new Promise((r) => setTimeout(r, ctl.delayMs));
  }
  if (ctl && typeof ctl.stdout === 'string') {
    process.stdout.write(ctl.stdout);
    process.exit(typeof ctl.code === 'number' ? ctl.code : 0);
  }
} catch { /* no control file → default echo behaviour */ }

console.log(JSON.stringify({ ok: true, argv, dryRun }));
process.exit(0);

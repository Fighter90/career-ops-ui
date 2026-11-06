/**
 * CAR-237 fixture — a fake of the parent career-ops `set-status.mjs` that
 * actually WRITES the tracker (the routes/tracker.mjs relay contract):
 * rewrites the row's Status cell and appends the `--note` to the Notes cell
 * ("; "-separated, idempotent), then prints the JSON the route expects.
 *
 * Used by tests/playwright-tracker-kanban.mjs: "a reload keeps it" must prove
 * the canonical relay wrote data/applications.md, not just client state. A
 * sibling `set-status-mock.json` ({ code: 1 }) forces a failure mode for the
 * revert gate (mirrors tests/fixtures/fake-set-status.mjs).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const dryRun = argv.includes('--dry-run');
try {
  const ctl = JSON.parse(readFileSync(process.cwd() + '/set-status-mock.json', 'utf8'));
  if (ctl && ctl.code) {
    console.log(JSON.stringify({ error: 'mocked failure', code: 'script-error' }));
    process.exit(Number(ctl.code));
  }
} catch { /* no control file → normal behaviour */ }

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

if (!json) { console.log(`row ${row ?? '?'} -> ${state}`); process.exit(0); }
if (row == null || !/^\d+$/.test(row) || !state) {
  console.log(JSON.stringify({ error: 'usage: --row N <state>', code: 'usage' }));
  process.exit(1);
}

// Rewrite the tracker the way the real writer does (Status cell + note append).
const FILE = process.cwd() + '/data/applications.md';
try {
  const lines = readFileSync(FILE, 'utf8').split('\n');
  const hdr = lines.findIndex((l) => l.includes('| # |'));
  if (hdr !== -1) {
    const cols = lines[hdr].split('|').map((c) => c.trim().toLowerCase());
    const statusCol = cols.indexOf('status');
    const notesCol = cols.indexOf('notes');
    for (let i = hdr + 2; i < lines.length; i += 1) {
      if (!/^\s*\|/.test(lines[i])) break;
      const cells = lines[i].split('|');
      if ((cells[1] || '').trim() !== String(row)) continue;
      cells[statusCol] = ' ' + state + ' ';
      if (note) {
        const existing = (cells[notesCol] || '').trim();
        const has = existing.split('; ').some((e) => e.trim() === note.trim());
        if (!has) cells[notesCol] = ' ' + (existing && existing !== '-' ? existing + '; ' + note.trim() : note.trim()) + ' ';
      }
      lines[i] = cells.join('|');
      break;
    }
    if (!dryRun) writeFileSync(FILE, lines.join('\n'));
  }
} catch (e) {
  console.log(JSON.stringify({ error: String(e && e.message), code: 'write-failure' }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, row: Number(row), state, note: note || null, dryRun }));
process.exit(0);

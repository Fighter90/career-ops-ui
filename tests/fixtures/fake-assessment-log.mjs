/**
 * Faithful CI fake of the parent career-ops `assessment-log.mjs`.
 *
 * Copied into a mkdtemp CAREER_OPS_ROOT by tests/assessments-route.test.mjs so
 * the append→read round-trip is exercised without the real parent project.
 * Mirrors the real CLI contract (verified empirically):
 *   - `add --company … --platform … --subject … [--report …] [--threshold …]
 *      [--score …] [--stale …]` → append an 8-column TSV row to
 *      data/assessments.tsv (resolved relative to THIS file, like the real
 *      script), print { added:true, row:[…8…] }.
 *   - bare invocation → parse the TSV and print
 *      { assessments:[{date,company,reportNum,platform,subject,threshold,score,
 *        staleNote}], aggregates:{byPlatform:{}}, quality:{total} }.
 */
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOG = join(dirname(fileURLToPath(import.meta.url)), 'data', 'assessments.tsv');
const args = process.argv.slice(2);

// Read a file or return null when (and only when) it does not exist. A missing
// file is the normal "no log yet" case; any OTHER error (EACCES, EISDIR, …) is a
// real problem and must surface, not be masked as an empty log.
const readOrNull = (p) => {
  try { return readFileSync(p, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; return null; }
};

const pct = (v) => {
  const s = String(v || '').replace(/%\s*$/, '').trim();
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

if (args[0] === 'add') {
  const f = {};
  for (let i = 1; i < args.length; i += 1) {
    const m = args[i].match(/^--(company|report|platform|subject|threshold|score|stale)$/);
    if (m) { f[m[1]] = args[i + 1] ?? ''; i += 1; }
  }
  const date = new Date().toISOString().slice(0, 10);
  const row = [
    date, f.company || '', f.report || '-', f.platform || '',
    f.subject || '', f.threshold || '-', f.score || '-', f.stale || '',
  ];
  mkdirSync(dirname(LOG), { recursive: true });
  // readOrNull (not existsSync-then-read) → no check-then-act file-system race.
  const existing = readOrNull(LOG);
  const prefix = existing === null ? '# assessments\n' : (existing.endsWith('\n') ? '' : '\n');
  appendFileSync(LOG, prefix + row.join('\t') + '\n');
  console.log(JSON.stringify({ added: true, row }, null, 2));
  process.exit(0);
}

const content = readOrNull(LOG) ?? '';
const assessments = [];
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const c = t.split('\t');
  if (c.length < 5) continue;
  const norm = (v) => (v === '' || v === '-') ? null : v;
  assessments.push({
    date: c[0], company: c[1], reportNum: norm(c[2]), platform: c[3],
    subject: c[4], threshold: pct(c[5]), score: pct(c[6]), staleNote: norm(c[7] || ''),
  });
}
console.log(JSON.stringify({ assessments, aggregates: { byPlatform: {} }, quality: { total: assessments.length } }));

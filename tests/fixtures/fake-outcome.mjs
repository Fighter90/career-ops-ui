/**
 * Faithful CI fake of the parent career-ops `outcome.mjs`.
 *
 * Copied into a mkdtemp CAREER_OPS_ROOT by tests/outcome-route.test.mjs so the
 * preview→write flow is exercised without the real parent. Mirrors the real CLI
 * contract (verified against outcome.mjs):
 *   node outcome.mjs <selector> <type> [--stage --feedback --note --role
 *     --cv --cover --url] [--dry-run] [--json]
 *   - <type> normalized (lowercase, '-'→'_') and validated against OUTCOME_MAP;
 *     an unknown type → { error, code:'invalid-outcome' } to stdout, exit 1.
 *   - <selector> matches a tracker row by report # (numeric) or company name,
 *     read from data/applications.md relative to THIS file's dir (like the real
 *     script resolves relative to the project root). No tracker → code
 *     'tracker-not-found' exit 2; no match → 'row-not-found'/'company-not-found'
 *     exit 2.
 *   - --dry-run --json → { dryRun:true, num, company, role, outcomeType,
 *     canonicalState, stage, feedback, note, outcomeDir }, exit 0 (NO write).
 *   - --json (real) → mkdir outcomeDir, append one line to outcome.md, print
 *     { success:true, …same fields…, postingArchived, setStatusResult }, exit 0.
 * failExit prints { error, code } to STDOUT under --json (parseable) and exits.
 */
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACKER = join(HERE, 'data', 'applications.md');
const JOURNAL = join(HERE, 'outcome.md');

const OUTCOME_MAP = {
  interview_progress: 'Interview', stage_reached: 'Interview', interview: 'Interview',
  offer_received: 'Offer', offer: 'Offer',
  hired: 'Hired', accepted: 'Hired',
  offer_declined: 'Discarded', declined: 'Discarded',
  rejected: 'Rejected', rejection: 'Rejected',
  no_response: 'Discarded', ghosted: 'Discarded',
  interview_only: 'Interview',
};

const raw = process.argv.slice(2);
const json = raw.includes('--json');
const dryRun = raw.includes('--dry-run');

function fail(msg, code, exit) {
  if (json) console.log(JSON.stringify({ error: msg, code }));
  else console.error(`x ${msg}`);
  process.exit(exit);
}

// Parse flags + positionals exactly like the real script's loop.
const VALUE_FLAGS = new Set(['--stage', '--feedback', '--note', '--role', '--cv', '--cover', '--url']);
const flags = {};
const positional = [];
for (let i = 0; i < raw.length; i += 1) {
  const a = raw[i];
  if (VALUE_FLAGS.has(a)) {
    const v = raw[i + 1];
    if (v === undefined || v.startsWith('--')) fail(`Missing value for ${a}`, 'usage', 1);
    flags[a.slice(2)] = v; i += 1;
  } else if (a === '--dry-run' || a === '--json') {
    // boolean, already captured
  } else if (a.startsWith('--')) {
    fail(`Unknown flag: ${a}`, 'usage', 1);
  } else {
    positional.push(a);
  }
}

if (positional.length !== 2) fail('Expected 2 positional arguments: <selector> <outcome_type>', 'usage', 1);
const [selector, rawType] = positional;
const type = rawType.toLowerCase().replace(/-/g, '_');
const canonicalState = OUTCOME_MAP[type];
if (!canonicalState) fail(`Invalid outcome_type "${rawType}". Valid types: ${Object.keys(OUTCOME_MAP).join(' · ')}`, 'invalid-outcome', 1);

// Read + parse the tracker (markdown table; a data row's first cell is numeric).
let tracker;
try { tracker = readFileSync(TRACKER, 'utf8'); }
catch (e) { if (e.code === 'ENOENT') fail('Tracker not found', 'tracker-not-found', 2); throw e; }

const rows = [];
for (const line of tracker.split('\n')) {
  const cells = line.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
  if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
    rows.push({ num: Number(cells[0]), company: cells[1], role: cells[2] });
  }
}
if (!rows.length) fail('Tracker is empty', 'tracker-empty', 2);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
let matched;
if (/^\d+$/.test(selector)) {
  matched = rows.find((r) => r.num === Number(selector));
  if (!matched) fail(`No tracker row with #${selector}`, 'row-not-found', 2);
} else {
  const key = norm(selector);
  let cands = rows.filter((r) => norm(r.company) === key);
  if (!cands.length) cands = rows.filter((r) => norm(r.company).includes(key) || key.includes(norm(r.company)));
  if (flags.role) cands = cands.filter((r) => norm(r.role).includes(norm(flags.role)));
  if (!cands.length) fail(`No tracker row for company matching "${selector}"`, 'company-not-found', 2);
  if (cands.length > 1) fail(`Multiple tracker rows matched "${selector}" — pass --role or row #`, 'ambiguous-match', 3);
  matched = cands[0];
}

const outcomeDir = join('outcomes', `${matched.num}-${norm(matched.company)}`);
const note = flags.note || `Outcome: ${type}`;

const common = {
  num: matched.num, company: matched.company, role: matched.role,
  outcomeType: type, canonicalState,
  stage: flags.stage || null, feedback: flags.feedback || null, note,
  outcomeDir,
};

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, ...common }, null, 2));
  process.exit(0);
}

// Real write: create the outcome dir + append a journal line, then report.
mkdirSync(join(HERE, outcomeDir), { recursive: true });
appendFileSync(JOURNAL, `- #${matched.num} ${matched.company} — ${type} (${canonicalState})\n`);
console.log(JSON.stringify({
  success: true, ...common, postingArchived: false,
  setStatusResult: { updated: true, state: canonicalState },
}, null, 2));
process.exit(0);

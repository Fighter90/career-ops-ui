/**
 * Skills self-assessment log routes.
 *
 * A companion CLI (assessment-log.mjs) treats "received a skills assessment"
 * as its own pipeline event and logs it, append-only, to the user layer at
 * data/assessments.tsv — one TSV row per event:
 *   {date}\t{company}\t{report#|-}\t{platform}\t{subject}\t{threshold%|-}\t{score%|-}\t{stale_note}
 * and reads them back as a single JSON document
 *   { assessments:[{date,company,reportNum,platform,subject,threshold,score,staleNote}],
 *     aggregates:{byPlatform:{…}}, quality:{total,…} }.
 *
 * These routes surface that CLI without reimplementing the TSV format — the
 * parent script stays the single source of truth so web-ui cannot drift:
 *
 *   GET  /api/assessments  → run assessment-log.mjs (bare = JSON list) and
 *                            relay { available:true, ...json }. When the script
 *                            is absent (CI, standalone installs) → fail-soft
 *                            { available:false }, mirroring routes/stats.mjs.
 *
 *   POST /api/assessments  → explicit user WRITE. Shells out to
 *                            `assessment-log.mjs add …` with every field passed
 *                            as an ARRAY arg (spawn, never shell-interpolated),
 *                            so the parent owns the append. Control characters
 *                            (a TAB would split an extra TSV column, a newline
 *                            would inject an extra ROW) are rejected and every
 *                            field is length-bounded BEFORE the shell-out; the
 *                            level/rating fields are whitelisted to a 0–100
 *                            numeric range rather than trusted as free text.
 *
 * Fail-soft on the read; 400 on bad input; 422 on a failing write script.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../paths.mjs';
import { runNodeScript } from '../runner.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { parseJsonStdout, sanitizeDetail } from '../parent-relay.mjs';

const SCRIPT = 'assessment-log.mjs';
const RUN_TIMEOUT_MS = 30_000;

const MAX_TEXT = 120;   // company / platform / subject
const MAX_REPORT = 40;  // report id
const MAX_NOTE = 500;   // staleness note

function scriptAvailable() {
  return existsSync(resolve(PROJECT_ROOT, SCRIPT));
}

/**
 * True if `s` contains any C0 control character (0x00–0x1F) or DEL (0x7F).
 * A charCodeAt scan — NOT a regex literal carrying raw control bytes — so TAB
 * (0x09) and newline (0x0A/0x0D), the two chars that would corrupt a TSV row,
 * are caught along with the rest of the control range.
 */
function hasControlChar(s) {
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate a percentage-like value (threshold / score). Empty → omitted.
 * Anything else must be a finite number in [0, 100]; the CLEAN numeric string
 * (String(n)) is what we hand the CLI, so no interior junk can reach the TSV.
 */
function parsePercentField(raw) {
  const s = (typeof raw === 'string' ? raw : (typeof raw === 'number' ? String(raw) : ''))
    .trim().replace(/%\s*$/, '').trim();
  if (!s) return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false };
  return { ok: true, value: String(n) };
}

export function registerAssessmentsRoutes(app) {
  // ── Read: list logged assessments (fail-soft when the script is absent) ──
  // llmRateLimit is a per-IP token bucket (no-op on loopback); reused verbatim
  // so CodeQL's rate-limiting model recognizes the guard, same as the other
  // shell-out relays.
  app.get('/api/assessments', llmRateLimit, async (_req, res) => {
    if (!scriptAvailable()) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    // Bare invocation = the script's default JSON list mode.
    const r = await runNodeScript(SCRIPT, [], { timeoutMs: RUN_TIMEOUT_MS });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // ── Write: append one assessment event (explicit user action) ──
  app.post('/api/assessments', llmRateLimit, async (req, res) => {
    if (!scriptAvailable()) {
      res.status(400).json({ error: 'assessment-log.mjs not found in the parent project' });
      return;
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const company = str(body.company);
    const platform = str(body.platform);
    const subject = str(body.subject);
    const report = str(body.report);
    const stale = str(body.stale);

    // Reject control characters in EVERY text field BEFORE writing. A TAB would
    // split into an extra TSV column; a newline would splice an extra ROW into
    // data/assessments.tsv — both corrupt the append-only log. (The parent
    // script re-rejects tab/newline too; this is the first, stricter gate.)
    for (const v of [company, platform, subject, report, stale]) {
      if (hasControlChar(v)) {
        return res.status(400).json({ error: 'control characters are not allowed' });
      }
    }

    if (!company || !platform || !subject) {
      return res.status(400).json({ error: 'company, platform and subject are required' });
    }
    if (company.length > MAX_TEXT || platform.length > MAX_TEXT || subject.length > MAX_TEXT) {
      return res.status(400).json({ error: `company, platform and subject must each be ≤ ${MAX_TEXT} chars` });
    }
    if (report.length > MAX_REPORT) {
      return res.status(400).json({ error: `report must be ≤ ${MAX_REPORT} chars` });
    }
    if (stale.length > MAX_NOTE) {
      return res.status(400).json({ error: `note must be ≤ ${MAX_NOTE} chars` });
    }

    // The level/rating fields are structured percentages, never free text.
    const threshold = parsePercentField(body.threshold);
    const score = parsePercentField(body.score);
    if (!threshold.ok) return res.status(400).json({ error: 'threshold must be a number between 0 and 100' });
    if (!score.ok) return res.status(400).json({ error: 'score must be a number between 0 and 100' });

    // Fields passed as ARRAY args — spawn, no shell → nothing is interpolated.
    const args = ['add', '--company', company, '--platform', platform, '--subject', subject];
    if (report) args.push('--report', report);
    if (threshold.value != null) args.push('--threshold', threshold.value);
    if (score.value != null) args.push('--score', score.value);
    if (stale) args.push('--stale', stale);

    const r = await runNodeScript(SCRIPT, args, { timeoutMs: RUN_TIMEOUT_MS });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data || data.added !== true) {
      return res.status(422).json({
        error: 'could not log the assessment',
        detail: (data && data.error) || sanitizeDetail(r.stderr || r.stdout),
      });
    }
    return res.json({ ok: true, added: true, row: data.row });
  });
}

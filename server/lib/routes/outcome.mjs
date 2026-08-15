/**
 * Application-outcome route.
 *
 * A companion CLI (outcome.mjs, #1722) records an application's FINAL outcome:
 * it appends to an append-only journal (outcome.md), archives the submitted CV
 * and cover-letter artifacts into an outcome folder, and syncs the tracker's
 * canonical status (via set-status.mjs). This route surfaces that CLI without
 * reimplementing any of it — the parent script stays the single source of truth
 * so web-ui cannot drift on the outcome→state mapping or the archival layout.
 *
 *   POST /api/outcome { selector, type, stage?, feedback?, note?, role?, dryRun? }
 *
 *     dryRun:true  → runs `outcome.mjs <selector> <type> … --dry-run --json`, a
 *                    READ-ONLY preview: it matches the tracker row and reports
 *                    what WOULD happen, writing nothing. Fails soft to
 *                    { available:false } when the script is absent so the UI can
 *                    hide the feature.
 *     dryRun falsy → the explicit user WRITE: `outcome.mjs … --json`. Records
 *                    the outcome, archives artifacts, syncs the tracker.
 *
 * Write-safety: every text field is passed as an ARRAY arg (spawn, never
 * shell-interpolated) and rejected up-front if it carries a control character (a
 * newline could smuggle a second CLI token or corrupt the journal). The outcome
 * `type` is whitelisted to the parent's OUTCOME_MAP keys, so a bad type is a
 * fast 400 rather than a spawn the CLI rejects. Lengths are bounded before the
 * shell-out. On a handled CLI failure the script prints { error, code } to
 * stdout under --json, which we relay with a 400; an unexpected failure → 422.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../paths.mjs';
import { runNodeScript } from '../runner.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { parseJsonStdout, sanitizeDetail } from '../parent-relay.mjs';

const SCRIPT = 'outcome.mjs';
const RUN_TIMEOUT_MS = 30_000;

// Mirrors outcome.mjs OUTCOME_MAP keys (each maps to a canonical tracker state).
// Kept as a local whitelist so an unknown type is a 400 here, not a spawn the
// CLI would reject with exit 1.
const VALID_TYPES = new Set([
  'interview_progress', 'stage_reached', 'interview', 'offer_received', 'offer',
  'hired', 'accepted', 'offer_declined', 'declined', 'rejected', 'rejection',
  'no_response', 'ghosted', 'interview_only',
]);

const MAX_SELECTOR = 120; // report # or company name
const MAX_STAGE = 120;
const MAX_ROLE = 160;
const MAX_TEXT = 1000;    // feedback / note (free text)

function scriptAvailable() {
  return existsSync(resolve(PROJECT_ROOT, SCRIPT));
}

/**
 * True if `s` carries any C0 control char (0x00–0x1F) or DEL (0x7F). A
 * charCodeAt scan (not a regex with raw control bytes) so TAB/newline — the
 * chars that could smuggle a CLI token or corrupt outcome.md — are caught.
 */
function hasControlChar(s) {
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function registerOutcomeRoutes(app) {
  // llmRateLimit is a per-IP token bucket (no-op on loopback), reused verbatim
  // so CodeQL's rate-limiting model recognizes the guard — same as the other
  // shell-out relays.
  app.post('/api/outcome', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const dryRun = body.dryRun === true;

    if (!scriptAvailable()) {
      // Preview fails soft (UI hides the feature); a real write is a hard error.
      if (dryRun) return res.json({ available: false, reason: 'script-not-found' });
      return res.status(422).json({ error: 'outcome.mjs not found in the parent project' });
    }

    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const selector = str(body.selector);
    const rawType = str(body.type);
    const stage = str(body.stage);
    const feedback = str(body.feedback);
    const note = str(body.note);
    const role = str(body.role);

    // Reject control chars in EVERY field before the spawn.
    for (const v of [selector, rawType, stage, feedback, note, role]) {
      if (hasControlChar(v)) {
        return res.status(400).json({ error: 'control characters are not allowed' });
      }
    }

    if (!selector || !rawType) {
      return res.status(400).json({ error: 'selector and type are required' });
    }
    const type = rawType.toLowerCase().replace(/-/g, '_');
    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ error: `invalid outcome type; valid: ${[...VALID_TYPES].join(', ')}` });
    }
    if (selector.length > MAX_SELECTOR) return res.status(400).json({ error: `selector must be ≤ ${MAX_SELECTOR} chars` });
    if (stage.length > MAX_STAGE) return res.status(400).json({ error: `stage must be ≤ ${MAX_STAGE} chars` });
    if (role.length > MAX_ROLE) return res.status(400).json({ error: `role must be ≤ ${MAX_ROLE} chars` });
    if (feedback.length > MAX_TEXT) return res.status(400).json({ error: `feedback must be ≤ ${MAX_TEXT} chars` });
    if (note.length > MAX_TEXT) return res.status(400).json({ error: `note must be ≤ ${MAX_TEXT} chars` });

    // Positional args first, then value flags — all array args (spawn, no shell).
    const args = [selector, type];
    if (stage) args.push('--stage', stage);
    if (feedback) args.push('--feedback', feedback);
    if (note) args.push('--note', note);
    if (role) args.push('--role', role);
    if (dryRun) args.push('--dry-run');
    args.push('--json');

    const r = await runNodeScript(SCRIPT, args, { timeoutMs: RUN_TIMEOUT_MS });
    const data = parseJsonStdout(r.stdout);

    if (r.code !== 0 || !data) {
      // The CLI prints { error, code } to stdout under --json on a HANDLED
      // failure (bad type, no matching row, ambiguous match) → surface as 400
      // so the client can show it. An unexpected/timeout failure → 422.
      const handled = !!(data && data.code);
      return res.status(handled ? 400 : 422).json({
        error: (data && data.error) || 'outcome could not be recorded',
        code: (data && data.code) || (r.killed ? 'timeout' : 'script-error'),
        detail: sanitizeDetail(r.stderr),
      });
    }

    if (dryRun) return res.json({ available: true, dryRun: true, ...data });
    return res.json({ available: true, ok: true, ...data });
  });
}

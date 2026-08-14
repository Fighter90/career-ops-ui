/**
 * Funded-company discovery relay (v1.133.0).
 *
 * Shells out to the `company-funded.mjs` script — a review-first discovery
 * script that reads a FIXED set of public, host-pinned RSS/JSON feeds
 * (TechCrunch / PRNewswire / Guardian / Hacker News), extracts recently
 * funded companies, and returns a ranked candidate list for MANUAL review.
 * That script owns the feed list, the host-pinning/SSRF guards, and the
 * funding-signal parsing — web-ui relays its JSON so it can't drift.
 *
 *   GET /api/company-funded → { available, generatedAt, sources, candidates[], diagnostics[] }
 *
 * Read-only contract:
 *   • `--dry-run` — the script writes report/JSON artifacts ONLY when NOT
 *     dry-run, so this relay never persists anything.
 *   • `--json`    — machine-readable JSON to stdout.
 *   • We deliberately do NOT thread any request input into `--sources`: the
 *     source set stays the script's fixed defaults, so no user-supplied value
 *     ever reaches an outbound fetch (no SSRF surface beyond the script's own
 *     host-pinned feeds).
 * Live network fetch (several RSS feeds) → a generous timeout + `llmRateLimit`;
 * the client panel is user-triggered (a Discover button), never on mount.
 * Fail-soft `{ available:false }` when the script is absent (CI, standalone
 * installs) so the view shows an honest note instead of erroring.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../paths.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runNodeScript } from '../runner.mjs';
import { parseJsonStdout, sanitizeDetail } from '../parent-relay.mjs';

export function registerFundedRoutes(app) {
  app.get('/api/company-funded', llmRateLimit, async (_req, res) => {
    const script = 'company-funded.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, ['--json', '--dry-run'], { timeoutMs: 45_000 });
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
}

/**
 * Liveness check (still live?) — zero-token, zero-browser.
 *
 *   GET /api/liveness?url=<encoded ATS posting URL>
 *     → { result: 'live' | 'expired' | 'uncertain', code, reason, provider }
 *
 * Confirms whether an ATS-hosted job posting (Greenhouse / Lever / Ashby /
 * Workday / SmartRecruiters) is still open by hitting the provider's PUBLIC
 * JSON endpoint — no LLM, no headless browser, no writes. Read-only viewer:
 * nothing is persisted.
 *
 * SSRF envelope (two gates, mirroring /api/pipeline + /api/logo):
 *   1. The user-supplied `url` param is gated through `isValidJobUrl()` first —
 *      rejecting loopback / file:// / private-range / template-char URLs before
 *      anything is fetched.
 *   2. `checkLivenessViaApi` builds the API URL from a FIXED host + strictly
 *      charset-validated path segments and fetches it through the DNS-pinned,
 *      redirect-revalidating `safeGet` (server/lib/safe-fetch.mjs). A raw global
 *      `fetch` is never used on a user-influenced URL.
 *
 * The parent career-ops falls back to a Playwright check when the API is
 * inconclusive; Playwright is forbidden in web-ui, so an inconclusive or
 * non-ATS URL simply reports `uncertain` (never a false `expired`).
 */
import { isValidJobUrl } from '../security.mjs';
import { checkLivenessViaApi } from '../liveness-api.mjs';

export function registerLivenessRoutes(app) {
  app.get('/api/liveness', async (req, res) => {
    const url = String((req.query && req.query.url) || '').trim();
    // Gate 1 — reject loopback / file / private / template URLs before any fetch.
    if (!isValidJobUrl(url)) {
      return res.status(400).json({ error: 'invalid or unsupported url' });
    }

    let result;
    try {
      result = await checkLivenessViaApi(url);
    } catch {
      // Defense in depth — the checker already fails soft to null, but never let
      // an unexpected throw 500 the viewer.
      result = null;
    }

    if (!result) {
      // Not a recognized ATS posting, or the ATS API was inconclusive
      // (redirect off-origin / 429 / 5xx / network / timeout). Zero-browser rung
      // only — we do NOT fall back to Playwright here.
      return res.json({
        result: 'uncertain',
        code: 'inconclusive',
        reason: 'not a recognized ATS posting, or the ATS API was inconclusive',
        provider: null,
      });
    }

    // Map the classifier's internal `active` verb to the wire/badge verb `live`.
    const wire = result.result === 'active' ? 'live' : result.result;
    return res.json({
      result: wire,
      code: result.code,
      reason: result.reason,
      provider: result.provider || null,
    });
  });
}

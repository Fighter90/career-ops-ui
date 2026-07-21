/**
 * Agentic Jobs adapter (registry contract).
 *
 * A board-wide aggregator (single server-rendered HTML listing), so it matches
 * ONLY on an explicit `provider: agenticjobs` field — never on careers_url. The
 * endpoint is the fixed public listing URL, overridable via `api:` /
 * `agenticjobs:` (host-pinned to agentic-engineering-jobs.com) for testing or a
 * mirror. The source-level assertAgenticUrl is the hard SSRF guard; pinning the
 * override here too keeps an off-host value out of the fetch slot entirely.
 *
 *   tracked_companies:
 *     - name: Agentic Jobs
 *       provider: agenticjobs
 *       enabled: true
 */
import { fetchAgenticJobs, FEED_URL } from '../../sources/agenticjobs.mjs';

// Exact host match — mirrors the source's assertAgenticUrl so an override that
// the adapter accepts can never be rejected later by the fetch-time guard.
const AGENTIC_HOST_RE = /^agentic-engineering-jobs\.com$/i;

export const agenticjobsAdapter = {
  id: 'agenticjobs',
  label: 'Agentic Jobs',
  matches(company) {
    if (!company) return false;
    return company.provider === 'agenticjobs';
  },
  buildEndpoint(company) {
    const override = company.agenticjobs || company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && AGENTIC_HOST_RE.test(u.hostname)) return override;
      } catch {
        /* fall through to the canonical listing URL */
      }
    }
    return FEED_URL;
  },
  fetch: fetchAgenticJobs,
};

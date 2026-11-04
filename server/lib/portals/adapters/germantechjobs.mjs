/**
 * GermanTechJobs adapter (registry contract).
 *
 * A board-wide aggregator (one public RSS feed covers the whole board), so it
 * matches ONLY on an explicit `provider: germantechjobs` field — never on a
 * careers_url, which would silently claim every German posting page that
 * links the board. The endpoint is the fixed public feed, overridable via
 * `feed_url:` / `api:` for a mirror (pinnedOverride enforces the same board
 * host the source's fetch-time assert enforces, so an override the adapter
 * accepts can never be rejected there — and an off-host value falls back to
 * the canonical feed).
 *
 *   tracked_companies:
 *     - name: GermanTechJobs
 *       provider: germantechjobs
 *       enabled: true
 *
 * Ported from the parent's providers/germantechjobs.mjs (upstream #6346).
 */
import { fetchGermantechjobs, FEED_URL } from '../../sources/germantechjobs.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host rule — mirrors the source's assertGermantechjobsUrl: the bare
// host or any dot-bounded subdomain form (each label dot-free), never a
// look-alike suffix/prefix. Hardcoded rather than built from TRUSTED_HOST:
// the host is a module constant and CodeQL flags RegExp-from-variable as
// incomplete escaping regardless of the input being a literal.
const GERMANTECHJOBS_HOST_RE = /^(?:[^.]+\.)*germantechjobs\.de$/i;

export const germantechjobsAdapter = {
  id: 'germantechjobs',
  label: 'GermanTechJobs',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'germantechjobs';
  },
  buildEndpoint(company) {
    return pinnedOverride(company?.feed_url, GERMANTECHJOBS_HOST_RE)
      || pinnedOverride(company?.api, GERMANTECHJOBS_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchGermantechjobs,
};

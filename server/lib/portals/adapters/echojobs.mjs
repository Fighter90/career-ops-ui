/**
 * EchoJobs adapter (registry contract). Parent career-ops parity
 * (parent `providers/echojobs.mjs`).
 *
 * Board-wide public JSON aggregator — no per-tenant host — so a tracked_companies
 * entry selects it explicitly with `provider: echojobs` (mirroring the parent's
 * detect). The feed is fixed and host-pinned to echojobs.io inside the source.
 *
 *   tracked_companies:
 *     - name: EchoJobs
 *       provider: echojobs
 */
import { fetchEchojobs, FEED_BASE } from '../../sources/echojobs.mjs';

export const echojobsAdapter = {
  id: 'echojobs',
  label: 'EchoJobs',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'echojobs';
  },
  buildEndpoint(company) {
    // Board-wide endpoint — no per-tenant config. The source pins the host.
    return company && company.provider === 'echojobs' ? FEED_BASE : null;
  },
  fetch: fetchEchojobs,
};

/**
 * Startup Jobs adapter (registry contract).
 *
 * A board-wide RSS feed (startup.jobs), so it matches an explicit
 * `provider: startup-jobs` only, like the parent provider's `detect()`.
 *
 * The endpoint is always `https://startup.jobs/feeds/jobs`, optionally scoped
 * by the entry's `startup_jobs:` block (`role` slug, `workplace: remote`). The
 * feed is a fixed ~50-posting snapshot with no pagination, so cover a search
 * with several narrow entries:
 *
 *   tracked_companies:
 *     - name: Startup Jobs - Platform
 *       provider: startup-jobs
 *       startup_jobs:
 *         role: platform-engineer
 *         workplace: remote
 *       enabled: true
 *
 * The source-level `assertStartupJobsUrl` is the hard SSRF guard.
 */
import { fetchStartupJobs, buildFeedUrl } from '../../sources/startup-jobs.mjs';

export const startupJobsAdapter = {
  id: 'startup-jobs',
  label: 'Startup Jobs',
  matches(company) {
    return !!company && company.provider === 'startup-jobs';
  },
  /**
   * @param {any} company
   * @returns {string} the feed URL — always a string, host-pinned to startup.jobs.
   */
  buildEndpoint(company) {
    return buildFeedUrl(company);
  },
  fetch: fetchStartupJobs,
};

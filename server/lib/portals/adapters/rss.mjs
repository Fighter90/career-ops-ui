/**
 * Generic RSS adapter (v1.62.0 registry contract).
 *
 * Matches any company entry that sets one of:
 *   provider: rss
 *   rss: <feed-url>
 *   feed_url: <feed-url>
 *
 * This adapter ONLY fires on those explicit fields, so it cannot
 * accidentally steal companies whose careers_url happens to serve RSS.
 * Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
 * are all matched via URL patterns on careers_url — orthogonal to the
 * rss/feed_url fields checked here.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: LaraJobs
 *       provider: rss
 *       rss: https://larajobs.com/feed
 *       enabled: true
 */
import { fetchRss } from '../../sources/rss.mjs';

export const rssAdapter = {
  id: 'rss',
  label: 'RSS',

  matches(company) {
    return company.provider === 'rss' || !!company.rss || !!company.feed_url;
  },

  buildEndpoint(company) {
    return company.rss || company.feed_url || null;
  },

  fetch: fetchRss,
};

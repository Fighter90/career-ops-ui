/**
 * Red Rover K12 adapter (registry contract).
 *
 * Red Rover hosts US school-district job boards at
 * `https://jobs.redroverk12.com/org/<orgId>`, so there is one portal entry per
 * district. It matches on either:
 *   - an explicit `provider: redrover`, or
 *   - a `careers_url` on https `jobs.redroverk12.com` with an `/org/<digits>`
 *     path (mirroring the parent provider's `detect()`; a look-alike host such
 *     as `jobs.redroverk12.com.evil.example` or an http:// URL is not claimed).
 * An explicit, DIFFERENT provider always wins.
 *
 *   tracked_companies:
 *     - name: Example School District
 *       careers_url: https://jobs.redroverk12.com/org/4242
 *       enabled: true
 *
 * `buildEndpoint` returns the canonical board URL
 * (`https://jobs.redroverk12.com/org/<id>`), or null when the careers_url
 * cannot be pinned. The source re-validates it before the request, and the
 * GraphQL POST always goes to the fixed API host. The fetch + parse lives in
 * server/lib/sources/redrover.mjs.
 */
import { fetchRedRover, buildBoardUrl } from '../../sources/redrover.mjs';

export const redroverAdapter = {
  id: 'redrover',
  label: 'Red Rover',

  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider) return company.provider === 'redrover';
    return buildBoardUrl(company.careers_url) !== null;
  },

  /**
   * @param {any} company
   * @returns {string|null} the canonical board URL, or null.
   */
  buildEndpoint(company) {
    return buildBoardUrl(company && company.careers_url);
  },

  fetch: fetchRedRover,
};

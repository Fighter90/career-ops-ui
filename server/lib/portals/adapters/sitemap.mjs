/**
 * Sitemap adapter (registry contract). Ported with the parent's
 * providers/sitemap.mjs (upstream #6631, CAR-254).
 *
 * A generic connector for employers that publish a standard job sitemap
 * (sitemaps.org 0.9) but expose no public ATS API. Explicit-only: it
 * matches `provider: sitemap` and nothing else, because any careers URL
 * could carry a sitemap and an auto-detect would steal every other
 * adapter's entries.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: ExampleCo
 *       provider: sitemap
 *       careers_url: https://careers.example.com/jobs/
 *       sitemap:
 *         url: https://careers.example.com/sitemap.xml
 *         job_path: '^/jobs/(?<posting_id>\d+)/(?<slug>[^/]+)/?$'
 *         index_filter: 'jobs'   # optional
 *         max_sitemaps: 50       # optional
 *         fetchDetails: false    # optional JSON-LD JobPosting enrichment
 *         detailLimit: 25        # optional
 *       enabled: true
 *
 * buildEndpoint returns the configured sitemap URL validated by
 * resolveSitemapUrl (public https hostname only: no IP literals, loopback
 * or internal names, credentials, custom ports), or null — resolveAdapter
 * treats null as no endpoint (fail-soft per company). The source
 * re-validates the endpoint against the entry's config before any I/O.
 *
 * Every fetch is gated by the site's robots.txt (RFC 9309, fail-closed)
 * through server/lib/robots-check.mjs. The HTTP fetch and XML parsing live
 * in server/lib/sources/sitemap.mjs.
 */
import { fetchSitemap, resolveSitemapUrl } from '../../sources/sitemap.mjs';

export const sitemapAdapter = {
  id: 'sitemap',
  label: 'Sitemap',
  matches(company) {
    return !!company && company.provider === 'sitemap';
  },
  /**
   * @param {any} company
   * @returns {string|null} the configured sitemap URL, or null when the
   *   entry names no usable public https sitemap.
   */
  buildEndpoint(company) {
    const url = resolveSitemapUrl(company?.sitemap?.url);
    return url ? url.href : null;
  },
  fetch: fetchSitemap,
};

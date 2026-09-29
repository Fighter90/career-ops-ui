/**
 * Frontline AppliTrack adapter (registry contract). One entry = one K-12
 * school district.
 *
 * Detects a district from a `careers_url` on `https://www.applitrack.com/<slug>/…`
 * (or the bare `applitrack.com`), HTTPS only, or from an explicit
 * `provider: applitrack` — but the endpoint is ALWAYS host-pinned: an explicit
 * provider on a non-applitrack host still yields a null endpoint, so an unsafe
 * value never reaches the fetch slot. Host matching is exact
 * (`resolveApplitrackSlug`), never a substring test, so
 * `https://evil.com/?x=applitrack.com` and `applitrack.com.evil.com` are refused.
 *
 * The endpoint is the district's `jobpostings/Output.asp?all=1` script, which
 * carries every posting in one response. The source re-checks it before any
 * I/O.
 *
 *   tracked_companies:
 *     - name: Example School District
 *       careers_url: https://www.applitrack.com/exampledistrict/onlineapp/
 *       default_location: Exampleville, WA   # optional
 *       enabled: true
 *
 * The HTTP fetch and parsing live in server/lib/sources/applitrack.mjs.
 */
import { fetchApplitrack, resolveApplitrackSlug, buildOutputUrl } from '../../sources/applitrack.mjs';

export const applitrackAdapter = {
  id: 'applitrack',
  label: 'AppliTrack',
  matches(company) {
    if (company && company.provider === 'applitrack') return true;
    return resolveApplitrackSlug(company && company.careers_url) !== null;
  },
  /**
   * @param {any} company
   * @returns {string|null} the Output.asp URL, or null when the careers_url is
   *   not an https applitrack.com district URL.
   */
  buildEndpoint(company) {
    const slug = resolveApplitrackSlug(company && company.careers_url);
    return slug ? buildOutputUrl(slug) : null;
  },
  fetch: fetchApplitrack,
};

/**
 * Rippling adapter (registry contract). v1.80.0.
 *
 * Detects a Rippling tenant from a `careers_url` whose host is `ats.rippling.com`
 * (e.g. `https://ats.rippling.com/<slug>/jobs`), or from an explicit
 * `provider: rippling`. The v2 board API is same-origin (parent #4353):
 *   https://ats.rippling.com/api/v2/board/<slug>/jobs?page=0&pageSize=1000
 *
 * The fetch + normalization lives in server/lib/sources/rippling.mjs.
 */
import { fetchRippling, ripplingSlugFromCareersUrl, buildRipplingEndpoint } from '../../sources/rippling.mjs';

export const ripplingAdapter = {
  id: 'rippling',
  label: 'Rippling',

  matches(company) {
    const raw = String(company.api || company.careers_url || '').trim();
    if (company.provider === 'rippling') {
      // explicit provider — still require a parseable slug if a URL is present
      return !raw || !!ripplingSlugFromCareersUrl(raw) || !!company.rippling;
    }
    return !!ripplingSlugFromCareersUrl(raw);
  },

  buildEndpoint(company) {
    const raw = String(company.api || company.careers_url || '').trim();
    const slug = ripplingSlugFromCareersUrl(raw);
    return slug ? buildRipplingEndpoint(slug) : null;
  },

  fetch: fetchRippling,
};

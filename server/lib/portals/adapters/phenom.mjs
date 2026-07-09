/**
 * Phenom People adapter (registry contract). Per-tenant ATS.
 *
 * Branded CareerConnect hosts (careers.allianz.com, …) carry no "phenom" token
 * in the URL, so auto-detection only claims literal *.phenompeople.com hosts —
 * branded tenants are wired with an explicit `provider: phenom`. The endpoint
 * is the tenant's public /widgets JSON API; the POST-paged refineSearch walk
 * lives in server/lib/sources/phenom.mjs.
 *
 *   tracked_companies:
 *     - name: Allianz
 *       provider: phenom
 *       careers_url: https://careers.allianz.com
 *       phenom:
 *         selectedFields: { country: ["Germany"] }
 *       enabled: true
 */
import { fetchPhenom, resolveConfig, PHENOM_HOST_RE } from '../../sources/phenom.mjs';

function isPhenomHost(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return false;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return PHENOM_HOST_RE.test(u.hostname);
}

export const phenomAdapter = {
  id: 'phenom',
  label: 'Phenom',
  matches(company) {
    if (company.provider === 'phenom') return true;
    return isPhenomHost(company); // hostname-anchored — never a raw-string match
  },
  buildEndpoint(company) {
    const cfg = resolveConfig(company);
    return cfg ? cfg.widgetsApi : null;
  },
  fetch: fetchPhenom,
};

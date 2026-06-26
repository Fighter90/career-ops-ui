/**
 * Breezy HR adapter (registry contract). Parent career-ops v1.13.0 parity.
 *
 * Detects a Breezy tenant from a `careers_url`/`api:` whose host matches
 * `<tenant>.breezy.hr`, or from an explicit `provider: breezy`. The HTTP fetch +
 * normalization lives in server/lib/sources/breezy.mjs.
 */
import { fetchBreezy, BREEZY_HOST_RE } from '../../sources/breezy.mjs';

function tenantOrigin(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!BREEZY_HOST_RE.test(u.hostname)) return null;
  return `https://${u.hostname}`;
}

export const breezyAdapter = {
  id: 'breezy',
  label: 'Breezy HR',
  matches(company) {
    if (company.provider === 'breezy') return true;
    return tenantOrigin(company) !== null;
  },
  buildEndpoint(company) {
    const origin = tenantOrigin(company);
    return origin ? `${origin}/json` : null;
  },
  fetch: fetchBreezy,
};

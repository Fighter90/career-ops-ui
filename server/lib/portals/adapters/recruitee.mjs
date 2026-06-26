/**
 * Recruitee adapter (registry contract). Parent career-ops parity.
 *
 * Detects a Recruitee tenant from a `careers_url`/`api:` whose host matches
 * `<slug>.recruitee.com`, or from an explicit `provider: recruitee`. The HTTP
 * fetch + normalization lives in server/lib/sources/recruitee.mjs.
 */
import { fetchRecruitee, RECRUITEE_HOST_RE } from '../../sources/recruitee.mjs';

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
  if (!RECRUITEE_HOST_RE.test(u.hostname)) return null;
  return `https://${u.hostname}`;
}

export const recruiteeAdapter = {
  id: 'recruitee',
  label: 'Recruitee',
  matches(company) {
    if (company.provider === 'recruitee') return true;
    return tenantOrigin(company) !== null;
  },
  buildEndpoint(company) {
    const origin = tenantOrigin(company);
    return origin ? `${origin}/api/offers/` : null;
  },
  fetch: fetchRecruitee,
};

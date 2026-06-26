/**
 * BambooHR adapter (registry contract). Parent career-ops v1.13.0 parity.
 *
 * Detects a BambooHR tenant from a `careers_url`/`api:` whose host matches
 * `<tenant>.bamboohr.com`, or from an explicit `provider: bamboohr`. The HTTP
 * fetch + normalization lives in server/lib/sources/bamboohr.mjs.
 */
import { fetchBambooHR, BAMBOOHR_HOST_RE } from '../../sources/bamboohr.mjs';

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
  if (!BAMBOOHR_HOST_RE.test(u.hostname)) return null;
  return `https://${u.hostname}`;
}

export const bamboohrAdapter = {
  id: 'bamboohr',
  label: 'BambooHR',
  matches(company) {
    if (company.provider === 'bamboohr') return true;
    return tenantOrigin(company) !== null;
  },
  buildEndpoint(company) {
    const origin = tenantOrigin(company);
    return origin ? `${origin}/careers/list` : null;
  },
  fetch: fetchBambooHR,
};

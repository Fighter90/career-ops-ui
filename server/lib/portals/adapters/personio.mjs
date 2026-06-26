/**
 * Personio adapter (registry contract). Parent career-ops v1.13.0 parity.
 *
 * Detects a Personio tenant from a `careers_url`/`api:` whose host matches
 * `<slug>.jobs.personio.(de|com)`, or from an explicit `provider: personio`.
 * The HTTP fetch + XML parsing lives in server/lib/sources/personio.mjs.
 */
import { fetchPersonio, PERSONIO_HOST_RE } from '../../sources/personio.mjs';

function tenantHost(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!PERSONIO_HOST_RE.test(u.hostname)) return null;
  return u.hostname;
}

export const personioAdapter = {
  id: 'personio',
  label: 'Personio',
  matches(company) {
    if (company.provider === 'personio') return true;
    return tenantHost(company) !== null;
  },
  buildEndpoint(company) {
    const host = tenantHost(company);
    return host ? `https://${host}/xml` : null;
  },
  fetch: fetchPersonio,
};

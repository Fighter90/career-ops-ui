/**
 * Teamtailor adapter (registry contract). v1.80.0.
 *
 * Detects a Teamtailor tenant from a `careers_url`/`api:` whose host matches
 * `<slug>.teamtailor.com`, or from an explicit `provider: teamtailor`. The feed
 * is the tenant's public RSS (`/jobs.rss`); the HTTP fetch + parse live in
 * server/lib/sources/teamtailor.mjs.
 */
import { fetchTeamtailor, TEAMTAILOR_HOST_RE } from '../../sources/teamtailor.mjs';

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
  if (!TEAMTAILOR_HOST_RE.test(u.hostname)) return null;
  return `https://${u.hostname}`;
}

export const teamtailorAdapter = {
  id: 'teamtailor',
  label: 'Teamtailor',
  matches(company) {
    if (company.provider === 'teamtailor') return true;
    return tenantOrigin(company) !== null;
  },
  buildEndpoint(company) {
    const origin = tenantOrigin(company);
    return origin ? `${origin}/jobs.rss` : null;
  },
  fetch: fetchTeamtailor,
};

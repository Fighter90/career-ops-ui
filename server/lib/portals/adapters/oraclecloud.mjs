/**
 * Oracle Recruiting Cloud (ORC) adapter (registry contract).
 *
 * ORC is a per-tenant ATS: each company runs its own Fusion Candidate
 * Experience host (`<tenant>.fa[.<region>][.ocs].oraclecloud.com`). It matches
 * on either:
 *   - an explicit `provider: oraclecloud` (for branded careers pages, with
 *     `api:` pointing at the ORC careers URL), or
 *   - a `careers_url` / `api:` whose host matches the ORC host pattern.
 *
 * The endpoint is host-pinned to the entry's own `api:`/`careers_url` — the
 * siteNumber (default CX_1) and language come from its
 * /hcmUI/CandidateExperience/<lang>/sites/<siteNumber>/ path. The source-level
 * assertOraclecloudUrl is the hard SSRF guard; buildEndpoint returns null for
 * anything it can't host-pin so an off-host value never reaches the fetch slot.
 *
 *   tracked_companies:
 *     - name: JPMorgan Chase
 *       careers_url: https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/jobs
 *       enabled: true
 *
 * The HTTP fetch + JSON parsing lives in server/lib/sources/oraclecloud.mjs.
 */
import { fetchOraclecloud, ORACLE_HOST_RE } from '../../sources/oraclecloud.mjs';

function tenantUrl(company) {
  const raw = String((company && (company.api || company.careers_url)) || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!ORACLE_HOST_RE.test(u.hostname)) return null;
  return raw;
}

export const oraclecloudAdapter = {
  id: 'oraclecloud',
  label: 'Oracle Cloud (ORC)',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'oraclecloud') return true;
    return tenantUrl(company) !== null;
  },
  buildEndpoint(company) {
    return tenantUrl(company);
  },
  fetch: fetchOraclecloud,
};

/**
 * JibeApply adapter (registry contract). Parent career-ops parity (v1.117.0).
 *
 * Per-tenant: matches an explicit `provider: jibeapply` OR a careers_url on a
 * *.jibeapply.com host. Branded iCIMS-hosted tenants that share the same JSON
 * schema on a custom domain are wired with an explicit `api:`. The endpoint is
 * the tenant's /api/jobs JSON API; fetch + the sequential capped pagination
 * live in server/lib/sources/jibeapply.mjs.
 *
 *   tracked_companies:
 *     - name: Global Payments
 *       provider: jibeapply
 *       careers_url: https://jobs.globalpayments.com/en/jobs/
 *       enabled: true
 */
import { fetchJibeapply, toApiUrl } from '../../sources/jibeapply.mjs';

export const jibeapplyAdapter = {
  id: 'jibeapply',
  label: 'JibeApply (iCIMS)',
  matches(company) {
    if (company.provider === 'jibeapply') return true;
    const raw = String(company.careers_url || '').trim();
    return raw ? toApiUrl(raw) !== null : false;
  },
  buildEndpoint(company) {
    const explicit = String(company.api || '').trim();
    if (explicit) {
      try { if (new URL(explicit).protocol === 'https:') return explicit; } catch { /* fall through */ }
    }
    return toApiUrl(String(company.careers_url || '').trim());
  },
  fetch: fetchJibeapply,
};

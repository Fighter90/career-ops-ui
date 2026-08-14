/**
 * Avature adapter (registry contract).
 *
 * Avature is a per-tenant ATS: each company runs its own `*.avature.net` origin
 * (or a branded custom domain proxying Avature). It matches on either:
 *   - an explicit `provider: avature` (required for branded custom domains, with
 *     `api:` pointing at the Avature origin), or
 *   - a `careers_url` / `api:` whose host is `(*.)avature.net`.
 *
 * The endpoint is host-pinned to the entry's own `api:`/`careers_url` — there is
 * no shared canonical feed. The source-level assertAvatureUrl is the hard SSRF
 * guard; buildEndpoint returns null for anything it can't host-pin so an off-host
 * value never reaches the fetch slot.
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.avature.net/careers
 *       enabled: true
 *
 * The HTTP fetch + HTML parsing lives in server/lib/sources/avature.mjs.
 */
import { fetchAvature, AVATURE_HOST_RE } from '../../sources/avature.mjs';

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
  if (!AVATURE_HOST_RE.test(u.hostname)) return null;
  return raw;
}

export const avatureAdapter = {
  id: 'avature',
  label: 'Avature',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'avature') return true;
    return tenantUrl(company) !== null;
  },
  buildEndpoint(company) {
    return tenantUrl(company);
  },
  fetch: fetchAvature,
};

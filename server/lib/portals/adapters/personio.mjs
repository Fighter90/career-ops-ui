/**
 * Personio adapter (registry contract).
 *
 * Detects a Personio tenant from an explicit `personio: <slug>` pin, from a
 * `careers_url`/`api:` whose host matches `<slug>.jobs.personio.(de|com)`, or
 * from an explicit `provider: personio`.
 * The HTTP fetch + XML parsing lives in server/lib/sources/personio.mjs.
 */
import { fetchPersonio, PERSONIO_HOST_RE } from '../../sources/personio.mjs';

// Anchored allowlist for a pinned tenant slug: the leading char must be
// alphanumeric and the whole slug is capped at 63 chars (the DNS label limit).
// Nothing that could escape the subdomain — `.`, `/`, `@`, `:`, `..`, a
// userinfo `@`, whitespace — is in the charset.
const PERSONIO_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;

/**
 * An explicit `personio: <slug>` pins the tenant directly. Needed because many
 * companies embed the Personio tenant as an IFRAME on a branded careers page,
 * so `careers_url` points at the company's own domain while the feed lives at
 * `<slug>.jobs.personio.de` — without the pin those boards resolve to nothing.
 *
 * Returns a candidate URL string, NOT a host: it goes back through the same
 * URL parse + `PERSONIO_HOST_RE` gate as `api`/`careers_url` below (and through
 * `assertPersonioUrl` at fetch time), so the host allowlist remains the only
 * way a request URL is accepted. Parsing also normalises the case, which the
 * case-sensitive `PERSONIO_HOST_RE` requires. A slug outside the allowlist
 * yields '' and falls through to the `api`/`careers_url` behaviour.
 */
function pinnedTenantUrl(company) {
  if (typeof company.personio !== 'string') return '';
  const slug = company.personio.trim();
  return PERSONIO_SLUG_RE.test(slug) ? `https://${slug}.jobs.personio.de` : '';
}

function tenantHost(company) {
  const raw = pinnedTenantUrl(company) || String(company.api || company.careers_url || '').trim();
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

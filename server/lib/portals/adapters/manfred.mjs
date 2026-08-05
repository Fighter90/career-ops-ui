/**
 * getManfred adapter (registry contract). Parent career-ops parity.
 *
 * A board-wide feed of Spanish/EU tech jobs, so it matches ONLY on an explicit
 * `provider: manfred` field — never on careers_url (the parent provider's
 * `detect` is provider-selection only). The endpoint is the fixed public offers
 * feed, overridable via `manfred:` / `api:` (host-pinned to www.getmanfred.com)
 * for testing or a mirror. The required `lang` query parameter is appended by
 * the source from the portal entry, so the adapter's endpoint stays the bare
 * host-pinned base. The source-level assertManfredUrl is the hard SSRF guard;
 * pinning the override here too keeps an off-host value out of the fetch slot.
 *
 *   tracked_companies:
 *     - name: getManfred
 *       provider: manfred
 *       lang: EN        # EN (default) or ES
 *       enabled: true
 */
import { fetchManfred, FEED_BASE } from '../../sources/manfred.mjs';

// Exact host match — mirrors the source's assertManfredUrl so an override the
// adapter accepts can never be rejected later by the fetch-time guard.
const MANFRED_HOST_RE = /^www\.getmanfred\.com$/i;

export const manfredAdapter = {
  id: 'manfred',
  label: 'getManfred',
  matches(company) {
    if (!company) return false;
    return company.provider === 'manfred';
  },
  buildEndpoint(company) {
    const override = (company && (company.manfred || company.api)) || '';
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && MANFRED_HOST_RE.test(u.hostname)) return override;
      } catch {
        /* fall through to the canonical feed */
      }
    }
    return FEED_BASE;
  },
  fetch: fetchManfred,
};

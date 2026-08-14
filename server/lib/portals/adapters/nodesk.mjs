/**
 * NoDesk adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit `provider: nodesk`
 * field — never on careers_url. The endpoint is the fixed public RSS feed,
 * overridable via `api:` / `nodesk:` (host-pinned to nodesk.co) for testing or
 * a mirror. The source-level assertNodeskUrl is the hard SSRF guard; pinning the
 * override here too keeps an off-host value out of the fetch slot entirely.
 *
 *   tracked_companies:
 *     - name: NoDesk
 *       provider: nodesk
 *       enabled: true
 */
import { fetchNodesk, FEED_URL } from '../../sources/nodesk.mjs';

// Exact host match — mirrors the source's assertNodeskUrl so an override that
// the adapter accepts can never be rejected later by the fetch-time guard.
const NODESK_HOST_RE = /^nodesk\.co$/i;

export const nodeskAdapter = {
  id: 'nodesk',
  label: 'NoDesk',
  matches(company) {
    return company.provider === 'nodesk';
  },
  buildEndpoint(company) {
    const override = company.nodesk || company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && NODESK_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical feed */ }
    }
    return FEED_URL;
  },
  fetch: fetchNodesk,
};

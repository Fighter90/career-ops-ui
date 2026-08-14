/**
 * JOIN (join.com) adapter (registry contract).
 *
 * join.com hosts one board per company at https://join.com/companies/<slug>, so
 * detection is host-based: the entry
 * matches when its careers_url is a join.com/companies/<slug> URL. The endpoint
 * is the bare careers_url — the source (server/lib/sources/join.mjs) re-extracts
 * the slug and rebuilds the host-pinned https://join.com/companies/<slug> base,
 * so an off-host or path-varied careers_url can never reach the fetch slot.
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://join.com/companies/acme-corp   # auto-detected
 *       max_pages: 20                                       # optional cap
 *       enabled: true
 */
import { fetchJoin, extractSlug } from '../../sources/join.mjs';

export const joinAdapter = {
  id: 'join',
  label: 'JOIN',
  matches(company) {
    if (!company) return false;
    return !!extractSlug(company.careers_url);
  },
  buildEndpoint(company) {
    const raw = String((company && company.careers_url) || '').trim();
    return extractSlug(raw) ? raw : null;
  },
  fetch: fetchJoin,
};

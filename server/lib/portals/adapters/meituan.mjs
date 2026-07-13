/**
 * Meituan adapter (registry contract). Parent career-ops parity (#1818).
 *
 * Single-company Chinese tech board. Matches on an explicit
 * `provider: meituan` OR a careers_url/api whose host is zhaopin.meituan.com
 * (mirroring the parent's `detect`). The JSON API endpoint is fixed; per-entry
 * search config (`keywords` / `max_pages`) is read by the source from
 * `opts.company`. The source-level assertMeituanUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: 美团
 *       careers_url: https://zhaopin.meituan.com/web/social
 *       keywords: ["AI", "大模型"]
 *       max_pages: 30
 */
import { fetchMeituan, DEFAULT_API } from '../../sources/meituan.mjs';

function isMeituanHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value).hostname.toLowerCase() === 'zhaopin.meituan.com';
  } catch {
    return false;
  }
}

export const meituanAdapter = {
  id: 'meituan',
  label: 'Meituan',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'meituan') return true;
    return isMeituanHost(company.api) || isMeituanHost(company.careers_url);
  },
  buildEndpoint() {
    return DEFAULT_API;
  },
  fetch: fetchMeituan,
};

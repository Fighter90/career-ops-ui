/**
 * Tencent adapter (registry contract). Parent career-ops parity (#230).
 *
 * Single-company Chinese tech board. Matches on an explicit
 * `provider: tencent` OR a careers_url/api whose host is careers.tencent.com
 * (mirroring the parent's `detect`). The JSON API endpoint is fixed; per-entry
 * search config (`keywords` / `max_pages`) is read by the source from
 * `opts.company`. The source-level assertTencentUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: 腾讯
 *       careers_url: https://careers.tencent.com/search.html
 *       keywords: ["AI", "大模型"]
 *       max_pages: 20
 */
import { fetchTencent, DEFAULT_API } from '../../sources/tencent.mjs';

function isTencentHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value).hostname.toLowerCase() === 'careers.tencent.com';
  } catch {
    return false;
  }
}

export const tencentAdapter = {
  id: 'tencent',
  label: 'Tencent',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'tencent') return true;
    return isTencentHost(company.api) || isTencentHost(company.careers_url);
  },
  buildEndpoint() {
    return DEFAULT_API;
  },
  fetch: fetchTencent,
};

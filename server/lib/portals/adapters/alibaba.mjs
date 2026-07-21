/**
 * Alibaba adapter (registry contract). Parent career-ops parity.
 *
 * Single-company Chinese tech board. Matches on an explicit
 * `provider: alibaba` OR a careers_url/api whose host is talent.alibaba.com
 * (mirroring the parent's `detect`). The JSON API endpoint is fixed; per-entry
 * search config (`keywords` / `max_pages`) is read by the source from
 * `opts.company`. The source-level assertAlibabaUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: 阿里巴巴
 *       careers_url: https://talent.alibaba.com/off-campus/position-list
 *       keywords: ["AI", "大模型"]
 *       max_pages: 50
 */
import { fetchAlibaba, DEFAULT_API } from '../../sources/alibaba.mjs';

function isAlibabaHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value).hostname.toLowerCase() === 'talent.alibaba.com';
  } catch {
    return false;
  }
}

export const alibabaAdapter = {
  id: 'alibaba',
  label: 'Alibaba',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'alibaba') return true;
    return isAlibabaHost(company.api) || isAlibabaHost(company.careers_url);
  },
  buildEndpoint() {
    return DEFAULT_API;
  },
  fetch: fetchAlibaba,
};

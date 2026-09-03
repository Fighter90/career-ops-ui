/**
 * Feishu Jobs adapter (registry contract).
 *
 * Per-tenant, so an entry needs a careers_url naming the origin:
 *
 *   tracked_companies:
 *     - name: ByteDance
 *       provider: feishu-jobs
 *       careers_url: https://jobs.bytedance.com
 *       keywords: ["product manager"]    # optional — server-side search
 *
 * Two host shapes and nothing else: `jobs.bytedance.com` exactly, or a
 * `*.jobs.feishu.cn` tenant. The source-level `resolveFeishuOrigin` is the
 * SSRF guard and is re-checked before the request.
 */
import { fetchFeishuJobs, buildFeishuUrl, resolveFeishuOrigin } from '../../sources/feishu-jobs.mjs';

export const feishuJobsAdapter = {
  id: 'feishu-jobs',
  label: 'Feishu Jobs',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'feishu-jobs') return true;
    // Auto-detect from a careers_url on either accepted host shape.
    return !!resolveFeishuOrigin(company.careers_url) || !!resolveFeishuOrigin(company.api);
  },
  buildEndpoint(company) {
    return buildFeishuUrl(company);
  },
  fetch: fetchFeishuJobs,
};

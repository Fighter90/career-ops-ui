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

/**
 * The entry with `careers_url` set to the first of careers_url / api that
 * `parse` accepts (unchanged when neither does, so the source's own error
 * stands).
 * @param {any} company
 * @param {(v: unknown) => unknown} parse
 */
function withTenantUrl(company, parse) {
  if (!company || typeof company !== 'object') return company;
  if (parse(company.careers_url) || !parse(company.api)) return company;
  return { ...company, careers_url: company.api };
}

export const feishuJobsAdapter = {
  id: 'feishu-jobs',
  label: 'Feishu Jobs',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'feishu-jobs') return true;
    // Auto-detect from a careers_url on either accepted host shape.
    return !!resolveFeishuOrigin(company.careers_url) || !!resolveFeishuOrigin(company.api);
  },
  // `string | null` contract: a refused entry is "no endpoint", never a throw
  // that aborts the whole scan. matches() accepts the tenant URL in either
  // careers_url or api, so build from whichever one actually resolves — the
  // source reads `careers_url ?? api`, and an unrelated careers_url would
  // otherwise hide a valid api.
  buildEndpoint(company) {
    try {
      return buildFeishuUrl(withTenantUrl(company, resolveFeishuOrigin));
    } catch {
      return null;
    }
  },
  fetch: fetchFeishuJobs,
};

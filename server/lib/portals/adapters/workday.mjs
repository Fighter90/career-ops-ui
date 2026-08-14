/**
 * Workday CXS adapter (v1.14.0 registry contract, BETA).
 *
 * Workday hosts each customer on `<tenant>.wd<N>.myworkdayjobs.com/<site>`.
 * The unauthenticated jobs feed for a given site is at
 *   /wday/cxs/<tenant>/<site>/jobs
 *
 * Detection from `careers_url`:
 *   https://<tenant>.wd5.myworkdayjobs.com/en-US/External
 *   →  tenant=<tenant>, wdN=wd5, site=External
 *   →  endpoint:  https://<tenant>.wd5.myworkdayjobs.com/wday/cxs/<tenant>/External/jobs
 *
 * If the customer's site lives behind a CAPTCHA or non-standard path,
 * the adapter throws — we recommend falling back to `/career-ops scan`
 * (drives a real browser via Playwright).
 */
import { fetchWorkday } from '../../sources/workday.mjs';

// Path shape: /<lang>/<site>, /<site>, or just /. We capture the LAST
// non-empty path segment as the site identifier (External / Careers / etc).
const URL_PATTERN = /https?:\/\/([^./]+)\.(wd\d+)\.myworkdayjobs\.com(?:\/[^/]+)?(?:\/([^/?#]+))?/;

export const workdayAdapter = {
  id: 'workday',
  label: 'Workday',
  matches(company) {
    if (company.api && company.api.includes('myworkdayjobs.com')) return true;
    return URL_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('myworkdayjobs.com')) return company.api;
    const m = (company.careers_url || '').match(URL_PATTERN);
    if (!m) return null;
    const [, tenant, wdN, site] = m;
    // Default site name when the careers_url doesn't include one. Most
    // tenants expose `External` as the public board — verified across
    // several public Workday sites.
    const siteName = site && site !== 'en-US' ? site : 'External';
    return `https://${tenant}.${wdN}.myworkdayjobs.com/wday/cxs/${tenant}/${siteName}/jobs`;
  },
  fetch: fetchWorkday,
};

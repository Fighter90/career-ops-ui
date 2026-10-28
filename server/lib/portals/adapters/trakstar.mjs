/**
 * Trakstar Hire adapter (registry contract).
 *
 * Single-company ATS — matches on an explicit `provider: trakstar` OR a
 * `careers_url`/`api:` that names a client on its own hosts:
 *   https://<client>.hire.trakstar.com        (current board host)
 *   https://<client>.recruiterbox.com         (legacy host)
 *   https://jsapi.recruiterbox.com/v1/openings?client_name=<client>  (api:)
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.hire.trakstar.com
 *       enabled: true
 *       max_pages: 20        # optional page cap (100 openings/page, default 20, max 50)
 *
 * buildEndpoint resolves the client from the entry and returns the page-1
 * Frontend API URL (the fetch loop appends `&limit=&offset=`); an entry that
 * does not name a client yields null, which resolveAdapter treats as no
 * endpoint (fail-soft per company). Ported from the parent's
 * providers/trakstar.mjs (upstream #6131).
 */
import { fetchTrakstar, resolveClient, apiUrlFor } from '../../sources/trakstar.mjs';

export const trakstarAdapter = {
  id: 'trakstar',
  label: 'Trakstar Hire',
  // `provider: trakstar` selects explicitly; a careers_url on one of the
  // client board hosts (or an api: Frontend URL) auto-detects —
  // resolveClient does the https + suffix + slug checks and null-guards
  // the entry itself.
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'trakstar') return true;
    return !!resolveClient(company);
  },
  buildEndpoint(company) {
    const client = resolveClient(company);
    return client ? apiUrlFor(client) : null;
  },
  fetch: fetchTrakstar,
};

/**
 * Arbeitsagentur adapter (registry contract).
 *
 * Matches ONLY on `provider: arbeitsagentur`. The base API URL is fixed
 * (overridable via `api:`); per-entry keyword/location config lives in the
 * `arbeitsagentur:` block, which the source reads from `opts.company`.
 */
import { fetchArbeitsagentur, API_URL } from '../../sources/arbeitsagentur.mjs';

export const arbeitsagenturAdapter = {
  id: 'arbeitsagentur',
  label: 'Arbeitsagentur',
  matches(company) {
    return company.provider === 'arbeitsagentur';
  },
  buildEndpoint(company) {
    return company.api || API_URL;
  },
  fetch: fetchArbeitsagentur,
};

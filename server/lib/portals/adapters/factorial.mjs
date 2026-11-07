/**
 * Factorial adapter (registry contract).
 *
 * The careers sites the Factorial ATS hosts for each customer — one tenant
 * per `tracked_companies:` entry. Matches on the exact board hosts
 * (`<tenant>.factorialhr.com`, `<tenant>.factorial.com` and the other
 * Factorial domains — resolveFactorialOrigin does the https + one-label
 * tenant checks and null-guards the entry itself); `provider: factorial` is
 * accepted as an explicit override.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.factorialhr.com
 *       enabled: true
 *
 * buildEndpoint returns the board-origin string (the board's home page
 * server-renders the whole inventory — the source parses it in one request);
 * an entry that does not name a Factorial tenant board yields null, which
 * resolveAdapter treats as no endpoint (fail-soft per company).
 * Ported from the parent's providers/factorial.mjs (upstream #6394).
 */
import { fetchFactorial, resolveFactorialOrigin } from '../../sources/factorial.mjs';

export const factorialAdapter = {
  id: 'factorial',
  label: 'Factorial',
  // `provider: factorial` selects explicitly; a careers_url on a Factorial
  // tenant host auto-detects. Factorial's product hosts (www, app, api, help,
  // blog) and any look-alike host never match — resolveFactorialOrigin is
  // strict.
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'factorial') return true;
    return !!resolveFactorialOrigin(company.api) || !!resolveFactorialOrigin(company.careers_url);
  },
  buildEndpoint(company) {
    return resolveFactorialOrigin(company?.api) || resolveFactorialOrigin(company?.careers_url);
  },
  fetch: fetchFactorial,
};

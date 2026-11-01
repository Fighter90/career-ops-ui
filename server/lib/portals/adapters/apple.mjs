/**
 * Apple adapter (registry contract). Ported with the parent's providers/apple.mjs
 * (upstream #5496 + #6196).
 *
 * Apple runs ONE careers board on `jobs.apple.com`. Matches on the exact host —
 * `provider: apple` is accepted as an explicit override; a `careers_url`/`api:`
 * naming jobs.apple.com auto-detects.
 *
 * buildEndpoint returns the search URL string; the source reads the SSR
 * hydration blob from it and pages `/en-us/search?...&page=N` itself (the
 * entry's `apple.queries` / `apple.teams` lists drive the axes). An entry
 * without a jobs.apple.com URL yields null, which resolveAdapter treats as no
 * endpoint (fail-soft per company).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Apple
 *       careers_url: https://jobs.apple.com/en-us/search
 *       apple:
 *         queries: ["business operations"]
 *         teams: ["business-process-management-OPMFG-BPM"]
 *       max_pages: 2
 *       enabled: true
 */
import { fetchApple, assertAppleUrl } from '../../sources/apple.mjs';

const APPLE_HOST_RE = /(^|\.)jobs\.apple\.com$/i;

export const appleAdapter = {
  id: 'apple',
  label: 'Apple',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'apple') return true;
    const raw = company.careers_url || company.api || '';
    try {
      return APPLE_HOST_RE.test(new URL(String(raw)).hostname);
    } catch {
      return false;
    }
  },
  buildEndpoint(company) {
    const raw = company?.careers_url || company?.api || '';
    if (!raw) return null;
    try {
      return assertAppleUrl(String(raw));
    } catch {
      return null;
    }
  },
  fetch: fetchApple,
};

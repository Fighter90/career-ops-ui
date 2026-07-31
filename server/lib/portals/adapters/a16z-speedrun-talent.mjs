/**
 * a16z Speedrun talent-network adapter (registry contract).
 *
 * Board-wide, zero-auth JSON aggregator — matches ONLY on
 * `provider: a16z-speedrun-talent`. Endpoint is the fixed public feed,
 * overridable via `api:` / `a16z-speedrun-talent:`. The source-level
 * assertSpeedrunUrl is the hard SSRF guard at fetch time.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: a16z Speedrun
 *       provider: a16z-speedrun-talent
 *       enabled: true
 */
import { fetchSpeedrunTalent, FEED_URL } from '../../sources/a16z-speedrun-talent.mjs';

export const a16zSpeedrunTalentAdapter = {
  id: 'a16z-speedrun-talent',
  label: 'a16z Speedrun',
  matches(company) {
    return company.provider === 'a16z-speedrun-talent';
  },
  buildEndpoint(company) {
    return company['a16z-speedrun-talent'] || company.api || FEED_URL;
  },
  fetch: fetchSpeedrunTalent,
};

/**
 * a16z Speedrun talent-network adapter (registry contract).
 *
 * Board-wide, zero-auth JSON aggregator — matches ONLY on
 * `provider: a16z-speedrun-talent`. Endpoint is the fixed public feed,
 * overridable via `api:` / `a16z-speedrun-talent:` (host-pinned to
 * speedrun-talent-network.com) for testing or a mirror. The source-level
 * assertSpeedrunUrl is the hard SSRF guard at fetch time; pinning the override
 * here too keeps an off-host value out of the fetch slot entirely (parity with
 * the cryptocurrencyjobs adapter).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: a16z Speedrun
 *       provider: a16z-speedrun-talent
 *       enabled: true
 */
import { fetchSpeedrunTalent, FEED_URL, SPEEDRUN_TALENT_HOST_RE } from '../../sources/a16z-speedrun-talent.mjs';

export const a16zSpeedrunTalentAdapter = {
  id: 'a16z-speedrun-talent',
  label: 'a16z Speedrun',
  matches(company) {
    return company.provider === 'a16z-speedrun-talent';
  },
  buildEndpoint(company) {
    const override = company['a16z-speedrun-talent'] || company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && SPEEDRUN_TALENT_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical feed */ }
    }
    return FEED_URL;
  },
  fetch: fetchSpeedrunTalent,
};

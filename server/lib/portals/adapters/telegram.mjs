/**
 * Telegram channel adapter (registry contract).
 *
 * Matches ONLY on an explicit `provider: telegram` — never on careers_url.
 * A channel is not a company careers page, and auto-detecting one from a URL
 * would silently turn any t.me link in a config into a scan target.
 *
 *   tracked_companies:
 *     - name: PHP вакансии
 *       provider: telegram
 *       channel: rabotaphp        # handle, @handle or full t.me link
 *       max_posts: 100            # optional cap (default 100, ceiling 300)
 *       enabled: true
 *
 * The endpoint is the channel's public web preview, `https://t.me/s/<handle>`.
 * `api:` may override it for a mirror or a test double, but is host-pinned to
 * t.me here as well: the source's assertTelegramUrl is the hard SSRF guard,
 * and pinning at the adapter keeps an off-host value out of the fetch slot in
 * the first place.
 */
import { fetchTelegram, buildChannelUrl } from '../../sources/telegram.mjs';

// Exact host, mirroring assertTelegramUrl — `endsWith` would accept
// `t.me.evil.test`, which is the whole reason this is anchored.
const TELEGRAM_HOST_RE = /^t\.me$/i;

export const telegramAdapter = {
  id: 'telegram',
  label: 'Telegram',
  matches(company) {
    return !!company && company.provider === 'telegram';
  },
  buildEndpoint(company) {
    const override = company && company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && TELEGRAM_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the derived endpoint */ }
    }
    return buildChannelUrl(company);
  },
  fetch: fetchTelegram,
};

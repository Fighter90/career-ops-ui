/**
 * Telegram public-channel adapter — the STRICT reader.
 *
 *   tracked_companies:
 *     - name: "@job_python"
 *       provider: telegram-channel
 *       channel: job_python
 *       since_days: 30      # optional, default 30
 *       max_pages: 10       # optional, capped at 10
 *
 * `provider:`-selected ONLY. web-ui also ships `telegram`, which reads the same
 * t.me preview pages with a looser policy, so a bare `t.me` URL is ambiguous
 * between the two and must never auto-select one of them.
 *
 * The source-level `resolveChannel` is the hard guard: the handle is the only
 * value that reaches the URL.
 */
import { fetchTelegramChannel, buildTelegramChannelUrl } from '../../sources/telegram-channel.mjs';

export const telegramChannelAdapter = {
  id: 'telegram-channel',
  label: 'Telegram (strict)',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'telegram-channel';
  },
  buildEndpoint(company) {
    return buildTelegramChannelUrl(company);
  },
  fetch: fetchTelegramChannel,
};

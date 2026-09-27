/**
 * Keep the production host out of public CI logs.
 *
 * GitHub masks a secret only where its exact value appears. A finding is cut
 * to a fixed length, so a stack line like `at call (https://<host>/js/api.js)`
 * could be cut mid-host — `https://<ho` — and slip past the mask (it did on
 * 2026-09-27). Every message is redacted BEFORE it is truncated.
 */
export function makeRedactor(baseUrl) {
  let hostname = '';
  try { hostname = new URL(baseUrl).hostname; } catch { /* no base → nothing to hide */ }
  if (!hostname) return (s) => String(s);
  const esc = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:https?://)?${esc}(?::\\d+)?`, 'gi');
  return (s) => String(s).replace(re, '<prod>');
}

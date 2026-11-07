// @ts-check
/**
 * #6582 (parent career-ops `lib/entry-timeout.mjs`) — a portals.yml entry can
 * raise its request timeout with `timeout_ms`.
 *
 * A board that returns its whole catalogue in one response can need more time
 * than the scanner's default budget allows, and the scan then reports it as a
 * network error. Such a board sets `timeout_ms` on its own portals.yml entry.
 * The setting is the user's, so it wins over any other timeout on that entry's
 * fetches, and every other entry keeps the default. An entry without the key
 * keeps the given fetchImpl as it is. So does a value that is not a whole
 * number from 1 to 2147483647, with a warning naming the entry: setTimeout
 * rewrites a longer delay to 1ms (and below 1ms to 1ms too), which would abort
 * every request of the entry — the exact failure the range guard prevents.
 *
 * web-ui's transport takes its budget from the injected `makeTimeoutFetch`
 * wrapper rather than a ctx of fetch helpers, so this module injects a
 * per-call `timeoutMs` into the fetch opts instead of replacing ctx methods;
 * `fetch-timeout.mjs` honours that key. Side-effect free on purpose: the
 * server loads the data root's .env after these modules are imported, so the
 * per-entry value travels as data, never as a module-load env snapshot.
 */

// setTimeout rewrites a longer delay to 1ms, which would abort every request of the entry.
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Validate one entry's `timeout_ms`. Null when absent, or when unusable (with
 * a warning naming the entry — a typo must not stop the scan).
 * @param {{ name?: unknown, timeout_ms?: unknown }|null|undefined} entry
 * @returns {number|null} whole milliseconds, or null for "no override".
 */
export function resolveEntryTimeoutMs(entry) {
  const raw = entry?.timeout_ms;
  if (raw === undefined || raw === null) return null;
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_TIMER_MS) {
    console.error(`⚠️  ${entry?.name}: timeout_ms must be a whole number from 1 to ${MAX_TIMER_MS}, got ${JSON.stringify(raw)} — ignored`);
    return null;
  }
  return raw;
}

/**
 * Wrap a fetchImpl so every call of THIS entry carries its `timeout_ms`.
 * Returns the original fetchImpl unchanged when the entry sets no usable key.
 * @param {typeof fetch} fetchImpl the run's shared fetch transport
 * @param {{ name?: unknown, timeout_ms?: unknown }|null|undefined} entry the portals.yml entry
 * @returns {typeof fetch} the same transport with the entry's budget applied
 */
export function applyEntryTimeout(fetchImpl, entry) {
  const timeoutMs = resolveEntryTimeoutMs(entry);
  if (timeoutMs === null) return fetchImpl;
  return (url, opts = {}) => fetchImpl(url, { ...opts, timeoutMs });
}

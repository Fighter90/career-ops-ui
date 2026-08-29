/**
 * Shared benign-console filter for the Playwright suites — one source of truth
 * so the per-file copies can't drift apart (this benign 404 has flaked several
 * suites as each grew its own, or no, filter).
 *
 * Deliberately narrow so it hides ONLY noise that is never a real client bug:
 *   - a favicon URL (`favicon.ico`), and
 *   - a "Failed to load resource" whose HTTP status is exactly 404 or 410
 *     (anchored to `status of <n>` so a 500 on a URL that merely contains
 *     "404" is NOT swallowed), and
 *   - an aborted / empty-response network teardown (`net::ERR_ABORTED`,
 *     `net::ERR_EMPTY_RESPONSE`, `net::ERR_SOCKET_NOT_CONNECTED`) — the request
 *     was cancelled, not failed. The three are one event with different timing:
 *     a suite that calls `window.stop()` to halt in-flight requests gets
 *     ERR_ABORTED when Chromium cancels the request, and
 *     ERR_SOCKET_NOT_CONNECTED when the socket was already torn down by the
 *     time the request reached it. Only the first was listed, so the same
 *     deliberate teardown failed a run at random — it flaked the locale sweep
 *     on `tr` (the suite with the most navigations, so the most chances to lose
 *     the race) while forms and smoke, which also call `window.stop()`, were
 *     one unlucky run away from the same thing.
 * A 500 (a genuine server error), any other status, and every uncaught JS
 * exception all still surface, so the assertion keeps its real value.
 *
 * Other connection-teardown noise (a test that deliberately kills a live
 * connection: ERR_CONNECTION_REFUSED / "Failed to fetch" / "connection lost")
 * is NOT benign by default — the suite that induces it opts in via `extra`.
 */
export const BENIGN_CONSOLE =
  /favicon\.ico|net::ERR_(?:ABORTED|EMPTY_RESPONSE|SOCKET_NOT_CONNECTED)|Failed to load resource:.*?status of (?:404|410)\b/i;

/**
 * Drop benign network noise from a collected console-error list. Pass an
 * optional NON-GLOBAL `extra` RegExp to also treat suite-specific noise as
 * benign (e.g. a deliberately-killed connection). Real errors survive.
 * @param {string[]} errors
 * @param {RegExp} [extra] must not carry the `g`/`y` flag (stateful lastIndex)
 * @returns {string[]}
 */
export const realConsoleErrors = (errors, extra = null) =>
  (errors || []).filter((e) => !BENIGN_CONSOLE.test(e) && !(extra && extra.test(e)));

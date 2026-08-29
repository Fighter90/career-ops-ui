/**
 * Unit coverage for the shared benign-console filter (tests/helpers/console-noise.mjs).
 * It gates every Playwright console-error assertion, so its edges matter:
 * benign 404s drop, but a real 500 / uncaught exception must survive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realConsoleErrors, BENIGN_CONSOLE } from './helpers/console-noise.mjs';

test('drops the favicon/asset 404 noise that flaked the suites', () => {
  const benign = [
    'Failed to load resource: the server responded with a status of 404 ()',
    'Failed to load resource: the server responded with a status of 410 ()',
    'http://localhost:4317/favicon.ico: Failed to load resource: the server responded with a status of 404 ()',
    'Failed to load resource: net::ERR_ABORTED',
  ];
  assert.deepEqual(realConsoleErrors(benign), []);
  for (const b of benign) assert.ok(BENIGN_CONSOLE.test(b), `should match: ${b}`);
});

test('keeps a real 500, a non-404/410 status, and an uncaught exception', () => {
  const real = [
    'Failed to load resource: the server responded with a status of 500 ()',
    // status is 500 even though the URL path contains "404" — must NOT be dropped
    'http://localhost/api/jobs/404: Failed to load resource: the server responded with a status of 500 ()',
    'Uncaught TypeError: x is not a function',
    'ReferenceError: y is not defined',
  ];
  assert.deepEqual(realConsoleErrors(real), real);
});

test('connection-teardown noise survives by default, drops only via `extra`', () => {
  const errs = ['net::ERR_CONNECTION_REFUSED', 'TypeError: Failed to fetch', 'Uncaught Error: real'];
  // Default: ERR_CONNECTION_REFUSED / "Failed to fetch" are NOT benign — all survive.
  assert.deepEqual(realConsoleErrors(errs), errs);
  // With an opt-in extra pattern, the connection noise drops; the real error stays.
  assert.deepEqual(
    realConsoleErrors(errs, /ERR_CONNECTION_REFUSED|Failed to fetch/i),
    ['Uncaught Error: real'],
  );
});

test('tolerates an empty / missing list', () => {
  assert.deepEqual(realConsoleErrors([]), []);
  assert.deepEqual(realConsoleErrors(undefined), []);
});

test('window.stop() teardown is benign in all three of its Chromium spellings', () => {
  // A suite that calls window.stop() to halt in-flight requests gets a
  // different error string depending on where the socket was at that instant:
  // ERR_ABORTED when Chromium cancels the request, ERR_SOCKET_NOT_CONNECTED
  // when the socket was already gone by the time the request reached it, and
  // ERR_EMPTY_RESPONSE when it was mid-flight. One event, three spellings.
  //
  // Only the first two were listed, so the same deliberate teardown failed a
  // run at random. It surfaced as a flake in the locale sweep on `tr` — the
  // suite with the most navigations, hence the most chances to lose the race —
  // while playwright-forms and playwright-smoke, which also call window.stop(),
  // were one unlucky run away from the same failure.
  const teardown = [
    'Failed to load resource: net::ERR_ABORTED',
    'Failed to load resource: net::ERR_EMPTY_RESPONSE',
    'Failed to load resource: net::ERR_SOCKET_NOT_CONNECTED',
  ];
  assert.deepEqual(realConsoleErrors(teardown), []);
});

test('a genuine socket-level failure is NOT swallowed with it', () => {
  // Only the cancelled-request family is benign. A refused connection, a DNS
  // failure, a reset and a 5xx all still mean something is actually broken.
  const real = [
    'Failed to load resource: net::ERR_CONNECTION_REFUSED',
    'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
    'Failed to load resource: net::ERR_CONNECTION_RESET',
    'Failed to load resource: the server responded with a status of 500 ()',
  ];
  assert.deepEqual(realConsoleErrors(real), real);
});

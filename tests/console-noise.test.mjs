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

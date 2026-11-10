/**
 * CAR-256 (parent-sync #6675) — the fetch-error classifier behind the
 * post-sweep retry. A transient failure (network-level, or HTTP 5xx) is
 * worth ONE retry after the sweep; a 404/410 (slug gone), a 401/403 (auth)
 * or anything unrecognized is not. Unit-level branch coverage: the scanner
 * suite (en-scanner-retry-transient.test.mjs) drives the retry behavior;
 * this file pins every classification branch the classifier itself names.
 *
 * CI-isolated: the module is pure — no files, no network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

let classifyFetchErrorKind;
let isTransientFetchError;

test('before', async () => {
  ({ classifyFetchErrorKind, isTransientFetchError } = await import('../server/lib/fetch-error-kind.mjs'));
});

// ── falsy / non-error input ─────────────────────────────────────────

test('a falsy error classifies unknown and is never retried', () => {
  assert.equal(classifyFetchErrorKind(null), 'unknown');
  assert.equal(classifyFetchErrorKind(undefined), 'unknown');
  assert.equal(classifyFetchErrorKind(0), 'unknown');
  assert.equal(isTransientFetchError(null), false);
});

// ── network kind ────────────────────────────────────────────────────

test('an AbortError (timeout/abort) classifies network', () => {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  assert.equal(classifyFetchErrorKind(err), 'network');
  assert.equal(isTransientFetchError(err), true);
});

test('network-level failure messages classify network (every named token)', () => {
  for (const msg of ['ECONNREFUSED', 'getaddrinfo ENOTFOUND', 'socket hang up ETIMEDOUT', 'fetch failed', 'network error while reading']) {
    assert.equal(classifyFetchErrorKind(new Error(msg)), 'network', msg);
    assert.equal(isTransientFetchError(new Error(msg)), true, msg);
  }
});

// ── status-number kinds ─────────────────────────────────────────────

test('a status number drives slug_gone / auth / server', () => {
  assert.equal(classifyFetchErrorKind({ status: 404 }), 'slug_gone');
  assert.equal(classifyFetchErrorKind({ status: 410 }), 'slug_gone');
  assert.equal(classifyFetchErrorKind({ status: 401 }), 'auth');
  assert.equal(classifyFetchErrorKind({ status: 403 }), 'auth');
  assert.equal(classifyFetchErrorKind({ status: 500 }), 'server');
  assert.equal(classifyFetchErrorKind({ status: 502 }), 'server');
});

test('a 4xx status that is none of the named ones falls through to unknown', () => {
  assert.equal(classifyFetchErrorKind({ status: 429, message: 'HTTP 429' }), 'unknown',
    'a rate-limit without a named token is unknown (the parent names no 429 kind)');
  assert.equal(isTransientFetchError({ status: 429 }), false);
});

test('a non-numeric status never reaches the server branch', () => {
  assert.equal(classifyFetchErrorKind({ status: '500' }), 'unknown',
    'a string status is not a number status');
});

// ── message-encoded HTTP kinds (err.message || err fallback) ────────

test('HTTP codes inside the MESSAGE classify even without a status field', () => {
  assert.equal(classifyFetchErrorKind(new Error('upstream said HTTP 404')), 'slug_gone');
  assert.equal(classifyFetchErrorKind(new Error('upstream said HTTP 410')), 'slug_gone');
  assert.equal(classifyFetchErrorKind(new Error('upstream said HTTP 401')), 'auth');
  assert.equal(classifyFetchErrorKind(new Error('upstream said HTTP 403')), 'auth');
  assert.equal(classifyFetchErrorKind(new Error('upstream said HTTP 504 gateway')), 'server');
  assert.equal(isTransientFetchError(new Error('HTTP 503')), true);
});

test('a plain STRING error reads through the err.message || err fallback', () => {
  // A string has no .message, so String(message || err) reads the string itself.
  assert.equal(classifyFetchErrorKind('fetch failed'), 'network');
  assert.equal(classifyFetchErrorKind('HTTP 502 from upstream'), 'server');
  assert.equal(classifyFetchErrorKind('something odd happened'), 'unknown');
  assert.equal(isTransientFetchError('HTTP 500'), true);
});

// ── unknown ─────────────────────────────────────────────────────────

test('an object with no usable shape classifies unknown and is not retried', () => {
  assert.equal(classifyFetchErrorKind({}), 'unknown');
  assert.equal(isTransientFetchError({}), false);
});

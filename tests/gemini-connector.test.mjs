/**
 * v1.74.0 — direct unit coverage for the generic Gemini connector
 * (server/lib/gemini.mjs). The provider-matrix test exercises the happy path
 * through the route; this hits every other branch (no key, API error, empty /
 * blocked completion, timeout) via the `fetchImpl` + `apiKey` injection points,
 * with no network and no env mutation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGemini, hasGeminiKey } from '../server/lib/gemini.mjs';

const KEY = 'AIzaFakeGeminiKey0123456789abcdefghij';
const okBody = (text) => ({
  candidates: [{ content: { parts: [{ text }] } }],
  usageMetadata: { totalTokenCount: 12 },
});
const mkFetch = (status, json) => async () => new Response(JSON.stringify(json), {
  status, headers: { 'content-type': 'application/json' },
});

test('runGemini: no key → error, no fetch', async () => {
  let called = false;
  const r = await runGemini('hi', { apiKey: '', fetchImpl: async () => { called = true; return new Response('{}'); } });
  assert.equal(r.error, 'Gemini key not set');
  assert.equal(r.markdown, '');
  assert.equal(called, false);
});

test('runGemini: success → markdown + usage', async () => {
  const r = await runGemini('write a letter', { apiKey: KEY, fetchImpl: mkFetch(200, okBody('Dear team,\nHello.')) });
  assert.equal(r.error, null);
  assert.match(r.markdown, /Dear team/);
  assert.ok(r.usage && r.usage.totalTokenCount === 12);
});

test('runGemini: non-OK response → "Gemini API: <message>"', async () => {
  const r = await runGemini('x', { apiKey: KEY, fetchImpl: mkFetch(400, { error: { message: 'bad request' } }) });
  assert.equal(r.markdown, '');
  assert.match(r.error, /Gemini API: bad request/);
});

test('runGemini: empty/blocked completion → "returned no text" with reason', async () => {
  const r = await runGemini('x', { apiKey: KEY, fetchImpl: mkFetch(200, { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }) });
  assert.equal(r.markdown, '');
  assert.match(r.error, /returned no text/);
  assert.match(r.error, /SAFETY/);
});

test('runGemini: malformed (non-JSON) body on error surfaces HTTP status', async () => {
  const r = await runGemini('x', {
    apiKey: KEY,
    fetchImpl: async () => new Response('<<not json>>', { status: 503 }),
  });
  assert.match(r.error, /Gemini API: HTTP 503/);
});

test('runGemini: abort/timeout → "timeout"', async () => {
  const r = await runGemini('x', {
    apiKey: KEY,
    fetchImpl: async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; },
  });
  assert.equal(r.error, 'timeout');
});

test('runGemini: network error → message surfaced', async () => {
  const r = await runGemini('x', { apiKey: KEY, fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  assert.equal(r.error, 'ECONNREFUSED');
});

test('hasGeminiKey: false without env, true with a usable key', () => {
  const saved = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.equal(hasGeminiKey(), false);
    process.env.GEMINI_API_KEY = KEY;
    assert.equal(hasGeminiKey(), true);
  } finally {
    if (saved === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved;
  }
});

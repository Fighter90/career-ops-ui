/**
 * Hermes LLM provider (v1.151.0, Phase 5 — Shape A).
 *
 * Nous Research's Hermes API Server (`hermes gateway`) is OpenAI-compatible, so
 * career-ops-ui reaches it via the shared runOpenAICompatible client at a
 * user-configured local base URL. These tests use an injected fetch stub — no
 * network, no env dependency, no parent project — so they're fully CI-isolated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHermes, hermesChatUrl } from '../server/lib/openai.mjs';

test('hermesChatUrl resolves a /v1 base or a full URL', () => {
  assert.equal(hermesChatUrl(), 'http://127.0.0.1:8642/v1/chat/completions');       // default loopback bind
  assert.equal(hermesChatUrl('http://127.0.0.1:9000/v1'), 'http://127.0.0.1:9000/v1/chat/completions'); // custom port
  assert.equal(hermesChatUrl('http://127.0.0.1:9000/v1/'), 'http://127.0.0.1:9000/v1/chat/completions'); // trailing slash
  assert.equal(hermesChatUrl('http://h/v1/chat/completions'), 'http://h/v1/chat/completions'); // full URL passthrough
  // Defense-in-depth: a non-http(s) scheme (user-writable HERMES_BASE_URL) must
  // never reach fetch — it falls back to the loopback default.
  assert.equal(hermesChatUrl('file:///etc/passwd'), 'http://127.0.0.1:8642/v1/chat/completions');
  assert.equal(hermesChatUrl('gopher://x/y'), 'http://127.0.0.1:8642/v1/chat/completions');
  assert.equal(hermesChatUrl('https://remote-hermes.example/v1'), 'https://remote-hermes.example/v1/chat/completions'); // https allowed
  // v1.151.1 — a bare host with no path (a mis-paste that drops the `/v1`) is
  // completed to the full `/v1/chat/completions`, not a `/v1`-less 404 URL.
  assert.equal(hermesChatUrl('http://127.0.0.1:8642'), 'http://127.0.0.1:8642/v1/chat/completions');
  assert.equal(hermesChatUrl('http://127.0.0.1:8642/'), 'http://127.0.0.1:8642/v1/chat/completions');
});

test('runHermes POSTs OpenAI-compatible JSON with a Bearer key and default model', async () => {
  let captured = null;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'hi from hermes' } }], usage: { input_tokens: 3, output_tokens: 2 } }),
    };
  };
  const r = await runHermes('ping', { apiKey: 'sk-hermes-test-key-123456', fetchImpl });
  assert.equal(r.error, null);
  assert.equal(r.markdown, 'hi from hermes');
  // URL is the default loopback chat/completions endpoint.
  assert.equal(captured.url, 'http://127.0.0.1:8642/v1/chat/completions');
  // Bearer auth carries the key; content-type is JSON.
  assert.equal(captured.init.headers.Authorization, 'Bearer sk-hermes-test-key-123456');
  assert.equal(captured.init.headers['Content-Type'], 'application/json');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, 'hermes-agent'); // default profile id
  assert.deepEqual(body.messages, [{ role: 'user', content: 'ping' }]);
});

test('runHermes honors a custom base URL + model', async () => {
  let url = null;
  const fetchImpl = async (u) => { url = u; return { ok: true, status: 200, text: async () => '{"choices":[{"message":{"content":"ok"}}]}' }; };
  await runHermes('x', { apiKey: 'sk-hermes-test-key-123456', url: hermesChatUrl('http://127.0.0.1:7000/v1'), model: 'my-profile', fetchImpl });
  assert.equal(url, 'http://127.0.0.1:7000/v1/chat/completions');
});

test('runHermes surfaces a clear error when no key is set', async () => {
  const r = await runHermes('x', { apiKey: '', fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.match(r.error, /Hermes key not set/);
  assert.equal(r.markdown, '');
});

test('runHermes maps a non-2xx to a labelled error', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'invalid API_SERVER_KEY' } }) });
  const r = await runHermes('x', { apiKey: 'sk-hermes-test-key-123456', fetchImpl });
  assert.match(r.error, /Hermes API: invalid API_SERVER_KEY/);
});

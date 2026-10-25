/**
 * CAR-111 — Anthropic prompt caching for /api/evaluate (and the auto-pipeline
 * evaluate step). Every evaluation shipped ~37k tokens of prompt (CV + profile
 * + mode files + instructions + JD) as ONE uncached user message, so each run
 * paid full input price. The fix splits the request: the byte-stable prefix
 * (project context + instructions — everything that does not depend on this
 * posting) ships as the FIRST content block of the user message with a
 * `cache_control: { type: 'ephemeral' }` breakpoint at its end; the volatile
 * tail (the fenced JD — its fence tag is random per prompt) rides the last
 * block uncached.
 *
 * What is locked here:
 *   - runAnthropic's request shape: two blocks, breakpoint on block 0, the
 *     JD never inside the cached block; no cachePrefix → the old single
 *     string (other callers unchanged); a non-prefix or exact-prefix
 *     cachePrefix fails open instead of erroring.
 *   - buildEvaluationPromptParts: stable + volatile is byte-identical to the
 *     full prompt (en and a non-en locale); two different JDs share one
 *     byte-identical stable prefix.
 *   - Route level: two /api/evaluate calls with different JDs hit Anthropic
 *     with byte-identical cached blocks; usage fields pass through untouched.
 *
 * Caching is implemented on the Anthropic Messages path ONLY — the
 * OpenAI-compatible tail providers cache server-side automatically and are
 * deliberately unchanged.
 *
 * CI-isolated: CAREER_OPS_ROOT → mkdtemp (cv.md present) before import;
 * provider HTTP via an injected fetchImpl or a host-matched global fetch
 * stub. No network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runAnthropic, buildEvaluationPrompt, buildEvaluationPromptParts, createApp;
let ROOT;
const realFetch = globalThis.fetch;
const ENV_KEYS = ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'ANTHROPIC_API_KEY'];
const saved = {};

const reply = (json, status = 200) => async () =>
  new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });

/** Capture the JSON body runAnthropic sends. */
function capture(fetchImpl) {
  const seen = { bodies: [] };
  seen.fetchImpl = async (url, opts) => {
    seen.bodies.push(JSON.parse(opts.body));
    return fetchImpl();
  };
  return seen;
}

const JD_A = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call rotation, platform tooling. '.repeat(3);
const JD_B = 'Staff Backend Engineer at Globex. Rust, distributed systems, data pipelines, observability. '.repeat(3);

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'eval-cache-'));
  mkdirSync(resolve(ROOT, 'config'), { recursive: true });
  mkdirSync(resolve(ROOT, 'modes'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nTen years of platform engineering.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'modes', '_shared.md'), '# shared rules\n');
  writeFileSync(resolve(ROOT, 'modes', 'oferta.md'), '# oferta rules\n');
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ runAnthropic } = await import('../server/lib/anthropic.mjs'));
  ({ buildEvaluationPrompt, buildEvaluationPromptParts } = await import('../server/lib/prompts.mjs'));
});

after(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

// ── runAnthropic request shape ──────────────────────────────────────────────

test('runAnthropic with a cachePrefix ships two blocks — breakpoint on the stable prefix, JD uncached after it', async () => {
  const prefix = 'STABLE CONTEXT AND INSTRUCTIONS — identical on every call.\n';
  const full = `${prefix}JD (untrusted data): """JD-abc\nhiring blacksmith\nJD-abc"""\n`;
  const cap = capture(reply({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }));
  const r = await runAnthropic(full, { apiKey: 'k', fetchImpl: cap.fetchImpl, cachePrefix: prefix });
  assert.equal(r.error, null);
  assert.equal(cap.bodies.length, 1);
  const msg = cap.bodies[0].messages[0];
  assert.equal(msg.role, 'user');
  assert.ok(Array.isArray(msg.content), 'content must be content blocks, not a bare string');
  assert.equal(msg.content.length, 2);
  const [stable, tail] = msg.content;
  assert.equal(stable.type, 'text');
  assert.equal(stable.text, prefix);
  assert.deepEqual(stable.cache_control, { type: 'ephemeral' }, 'breakpoint at the end of the stable block');
  assert.equal(tail.type, 'text');
  assert.equal(tail.text, full.slice(prefix.length));
  assert.equal(tail.cache_control, undefined, 'the JD tail stays uncached');
  // Byte identity: the two blocks concatenate back to the exact prompt.
  assert.equal(stable.text + tail.text, full);
  assert.ok(!stable.text.includes('blacksmith'), 'the JD must never sit inside the cached block');
});

test('runAnthropic without a cachePrefix keeps the old single-string shape (other callers unchanged)', async () => {
  const cap = capture(reply({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }));
  await runAnthropic('plain prompt', { apiKey: 'k', fetchImpl: cap.fetchImpl });
  const content = cap.bodies[0].messages[0].content;
  assert.equal(content, 'plain prompt');
  assert.equal(typeof content, 'string');
});

test('runAnthropic fails open when cachePrefix is not a prefix of the prompt', async () => {
  const cap = capture(reply({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }));
  await runAnthropic('the actual prompt', { apiKey: 'k', fetchImpl: cap.fetchImpl, cachePrefix: 'mismatched' });
  assert.equal(cap.bodies[0].messages[0].content, 'the actual prompt');
  // Empty / non-string cachePrefix → same fallback.
  await runAnthropic('p2', { apiKey: 'k', fetchImpl: cap.fetchImpl, cachePrefix: '' });
  await runAnthropic('p3', { apiKey: 'k', fetchImpl: cap.fetchImpl, cachePrefix: 42 });
  assert.deepEqual(cap.bodies.slice(1).map((b) => b.messages[0].content), ['p2', 'p3']);
});

test('runAnthropic with a cachePrefix equal to the whole prompt caches one block — never an empty text block', async () => {
  const cap = capture(reply({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }));
  await runAnthropic('all stable', { apiKey: 'k', fetchImpl: cap.fetchImpl, cachePrefix: 'all stable' });
  const content = cap.bodies[0].messages[0].content;
  assert.deepEqual(content, [{ type: 'text', text: 'all stable', cache_control: { type: 'ephemeral' } }]);
});

// ── buildEvaluationPromptParts — the split contract ─────────────────────────

test('stable + volatile is byte-identical to the full prompt (en and ru)', () => {
  // untrustedJd stamps a random fence tag into EVERY call, so the full
  // prompt is only comparable with the tag normalized out — the newline /
  // section structure around it must still match exactly.
  const normalizeTag = (s) => s.replace(/JD-[0-9a-f]{12}/g, 'JD-TAG');
  for (const lang of ['en', 'ru']) {
    for (const jd of [JD_A, JD_B]) {
      const { stable, volatile } = buildEvaluationPromptParts(jd, lang);
      assert.equal(normalizeTag(stable + volatile), normalizeTag(buildEvaluationPrompt(jd, lang)), `lang=${lang}`);
    }
  }
});

test('the stable part is JD-free and ends at the SCORE_SUMMARY template; the volatile part starts at the JD fence', () => {
  const { stable, volatile } = buildEvaluationPromptParts(JD_A, 'en');
  assert.ok(stable.includes('---SCORE_SUMMARY---') && stable.includes('---END_SUMMARY---'));
  assert.ok(!stable.includes(JD_A.trim()), 'no JD text in the stable part');
  assert.ok(!stable.includes('JD (untrusted data'), 'no JD fence in the stable part');
  assert.ok(volatile.startsWith('JD (untrusted data copied from a job posting'), 'the split point is the JD block');
  assert.ok(volatile.includes(JD_A.trim()));
  assert.match(stable, /---END_SUMMARY---\n\n$/, 'stable ends right before the JD block');
});

test('two different JDs produce a byte-identical stable prefix (en and ru)', () => {
  for (const lang of ['en', 'ru']) {
    const a = buildEvaluationPromptParts(JD_A, lang);
    const b = buildEvaluationPromptParts(JD_B, lang);
    assert.equal(a.stable, b.stable, `stable prefix must be byte-identical (lang=${lang})`);
    assert.notEqual(a.volatile, b.volatile);
  }
});

// ── Route level: /api/evaluate through the Anthropic path ───────────────────

test('two /api/evaluate calls with different JDs send byte-identical cached prefixes; usage passes through', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake0123456789abcdefghijklmnop';
  const sent = [];
  const anthropicJson = () => ({
    content: [{ type: 'text', text: '## A) ok\n\n---SCORE_SUMMARY---\nCOMPANY: Acme\nROLE: Eng\nSCORE: 3.5\nARCHETYPE: Platform\nLEGITIMACY: High Confidence\n---END_SUMMARY---\n' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 37000, output_tokens: 900, cache_read_input_tokens: 36999 },
  });
  globalThis.fetch = async (u, o = {}) => {
    if (new URL(String(u)).host === 'api.anthropic.com') {
      sent.push(JSON.parse(o.body));
      return reply(anthropicJson())();
    }
    return realFetch(u, o);
  };
  ({ createApp } = await import('../server/index.mjs'));
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const post = (jd) => fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jd }),
    }).then((res) => Promise.all([res.status, res.json()]));
    const [s1, b1] = await post(JD_A);
    const [s2, b2] = await post(JD_B);
    assert.equal(s1, 200, JSON.stringify(b1).slice(0, 200));
    assert.equal(s2, 200, JSON.stringify(b2).slice(0, 200));
    assert.equal(sent.length, 2);

    for (const [i, body] of sent.entries()) {
      const blocks = body.messages[0].content;
      assert.ok(Array.isArray(blocks) && blocks.length === 2, `request ${i + 1}: two content blocks`);
      assert.deepEqual(blocks[0].cache_control, { type: 'ephemeral' });
      assert.ok(blocks[0].text.includes('<project_context>'), 'the cached prefix carries the inlined project context');
      assert.ok(blocks[0].text.includes('modes/oferta.md'), '…and the mode files');
      assert.ok(blocks[0].text.includes('---SCORE_SUMMARY---'), '…and the machine-format instructions');
      const jdText = i === 0 ? JD_A.trim() : JD_B.trim();
      assert.ok(!blocks[0].text.includes(jdText), `request ${i + 1}: this JD is not inside the cached block`);
      assert.ok(blocks[1].text.includes(jdText), `request ${i + 1}: this JD rides the uncached tail`);
    }
    // The whole point of CAR-111: same bytes cached across different JDs.
    assert.equal(sent[0].messages[0].content[0].text, sent[1].messages[0].content[0].text,
      'cached prefix must be byte-identical across calls with different JDs');
    assert.notEqual(sent[0].messages[0].content[1].text, sent[1].messages[0].content[1].text);

    // The client-facing echo still shows the full prompt (manual-copy parity).
    assert.ok(b1.prompt.includes(JD_A.trim()));
    // Usage fields pass through untouched (no changes to usage recording).
    assert.equal(b1.usage.cache_read_input_tokens, 36999);
    assert.equal(b1.usage.input_tokens, 37000);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    globalThis.fetch = realFetch;
    delete process.env.LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

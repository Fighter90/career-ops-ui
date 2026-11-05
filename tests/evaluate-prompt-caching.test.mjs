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
import { twoShapeAnswers, scoringFixture, renderBodyFixture } from './helpers/eval-two-step-stub.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runAnthropic, buildEvaluationPrompt, buildEvaluationPromptParts, createApp;
const sent = [];
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


const scoringJson8 = JSON.stringify(scoringFixture({ company: 'Acme', role: 'Eng', score: 3.5 }));
const renderBody8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## ${L}) ok`).join('\n\n');
const anthropicReply = (promptText) => {
  const content = promptText.includes('Output ONLY a JSON object') ? scoringJson8 : renderBody8;
  return {
    content: [{ type: 'text', text: content }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 37000, output_tokens: 900, cache_read_input_tokens: 36999 },
  };
};
async function evaluateFetchStub(u, o = {}) {
  if (new URL(String(u)).host === 'api.anthropic.com') {
    const body = JSON.parse(o.body);
    const promptText = (body.messages || []).map((m) => (Array.isArray(m.content) ? m.content.map((b2) => b2.text).join('\n') : String(m.content || ''))).join('\n');
    sent.push(body);
    return { ok: true, status: 200, text: async () => JSON.stringify(anthropicReply(promptText)) };
  }
  return realFetch(u, o);
}

const JD_A = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call rotation, platform tooling. '.repeat(3);
const JD_B = 'Staff Backend Engineer at Globex. Rust, distributed systems, data pipelines, observability. '.repeat(3);

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'eval-cache-'));
  mkdirSync(resolve(ROOT, 'config'), { recursive: true });
  mkdirSync(resolve(ROOT, 'modes'), { recursive: true });
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  writeFileSync(resolve(ROOT, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nTen years of platform engineering.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'modes', '_shared.md'), '# shared rules\n');
  writeFileSync(resolve(ROOT, 'modes', 'oferta.md'), '# oferta rules\n');
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ runAnthropic } = await import('../server/lib/anthropic.mjs'));
  ({ buildEvaluationPrompt, buildEvaluationPromptParts } = await import('../server/lib/prompts.mjs'));
  globalThis.fetch = evaluateFetchStub;
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
  // v1.268.0 — TWO provider calls per evaluate (scoring en-JSON, render
  // locale body); the stub answers each with what its step expects.
  const scoringJson = JSON.stringify(scoringFixture({ company: 'Acme', role: 'Eng', score: 3.5 }));
  const renderBody = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## ${L}) ok`).join('\n\n');
  const anthropicReply = (promptText) => {
    const content = promptText.includes('Output ONLY a JSON object')
      ? scoringJson
      : renderBody;
    return {
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 37000, output_tokens: 900, cache_read_input_tokens: 36999 },
    };
  };
  sent.length = 0;
  ({ createApp } = await import('../server/index.mjs'));
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  const drainDone = async (jd) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jd }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    const frame = text.split('\n\n').find((f) => f.startsWith('event: done'));
    if (!frame) {
      throw new Error(`no done frame — providerCalls=${sent.length} raw tail: ${text.slice(-400)}`);
    }
    return JSON.parse((frame.match(/^data:\s*([\s\S]+)$/m) || [])[1] || '{}');
  };
  try {
    const b1 = await drainDone(JD_A);
    const b2 = await drainDone(JD_B);
    assert.equal(sent.length, 4, 'two evaluate runs × two steps');

    // The Anthropic request shape: [cached prefix block, uncached tail block].
    for (const [i, body] of sent.entries()) {
      const blocks = body.messages[0].content;
      assert.ok(Array.isArray(blocks) && blocks.length === 2, `request ${i + 1}: two content blocks`);
      assert.deepEqual(blocks[0].cache_control, { type: 'ephemeral' });
      assert.ok(blocks[0].text.includes('<project_context>'), 'the cached prefix carries the inlined project context');
      assert.ok(blocks[0].text.includes('modes/oferta.md'), '…and the mode files');
      const jdText = i < 2 ? JD_A.trim() : JD_B.trim();
      assert.ok(!blocks[0].text.includes(jdText), `request ${i + 1}: this JD is not inside the cached block`);
      assert.ok(blocks[1].text.includes(jdText), `request ${i + 1}: this JD rides the uncached tail`);
    }

    // CAR-111's whole point, now STRONGER: the stable prefixes are
    // byte-identical across different JDs for BOTH steps — so the provider
    // cache covers every locale and every posting after the first call.
    const [scoreA, renderA, scoreB, renderB] = sent.map((b2) => b2.messages[0].content[0].text);
    assert.equal(scoreA, scoreB, 'scoring prefix byte-identical across JDs');
    assert.equal(renderA, renderB, 'render prefix byte-identical across JDs');
    assert.notEqual(sent[0].messages[0].content[1].text, sent[1].messages[0].content[1].text, 'the JD tails differ');
    // Cross-step: the shared EN instruction header opens both prefixes.
    assert.equal(scoreA.split('\n\n')[0], renderA.split('\n\n')[0].slice(0, scoreA.split('\n\n')[0].length), 'both steps open with the shared instruction header');

    // Usage fields pass through aggregated: both steps' cache reads sum up.
    assert.equal(b1.usage.cached, 73998, '36999 × 2 steps');
    assert.equal(b1.usage.in, 74000);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    globalThis.fetch = realFetch;
    delete process.env.LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

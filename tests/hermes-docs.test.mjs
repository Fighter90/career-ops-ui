/**
 * Hermes integration docs + skill canary (v1.146.0, Phase 5b part i).
 *
 * The Hermes *provider* is deliberately NOT wired (blocked on the Phase 5
 * API-contract spike). What ships is the integration design doc, the README
 * teaser, and the `hermes-bridge` skill. These source-static canaries lock that
 * deliverable in place and — critically — assert the "planned / not-yet-wired"
 * honesty markers so a future refactor can't silently imply Hermes is live.
 *
 * CI-isolated: reads only files inside this repo, no parent-project dependency,
 * no network, no server boot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('docs/integrations/HERMES.md exists with the required structure + honesty markers', () => {
  const p = 'docs/integrations/HERMES.md';
  assert.ok(existsSync(resolve(ROOT, p)), 'HERMES.md is present');
  const doc = read(p);
  // The two integration shapes from Phase 5 must both be described.
  assert.match(doc, /Shape A/, 'documents Shape A (OpenAI-compatible endpoint)');
  assert.match(doc, /Shape B/, 'documents Shape B (agent runtime)');
  // The three deep-dive pillars.
  assert.match(doc, /[Cc]loud-server deployment/, 'covers cloud-server deployment');
  assert.match(doc, /Telegram/, 'covers Telegram');
  assert.match(doc, /what NOT to expose/i, 'has the threat-model "what NOT to expose" list');
  // v1.151.0 — Shape A is now WIRED; the doc must say so (was "planned/not-yet-wired").
  assert.match(doc, /WIRED/i, 'marks the Shape A provider as wired');
  assert.match(doc, /shipped.*v1\.151\.0|v1\.151\.0.*shipped|Shape A.*shipped/i, 'attributes the provider to v1.151.0');
  // Security invariants that must survive the move off loopback are named.
  assert.match(doc, /SSRF/, 'names the SSRF guard');
  assert.match(doc, /CSP/, 'names CSP');
  assert.match(doc, /127\.0\.0\.1/, 'references the loopback default');
  assert.match(doc, /stripDangerousMarkdown/, 'names the markdown/XSS boundary');
});

test('the README (EN) carries the Hermes teaser and links the deep-dive', () => {
  const r = read('README.md');
  assert.match(r, /^## Hermes agent \+ Telegram$/m, 'has the Hermes H2 section');
  assert.match(r, /docs\/integrations\/HERMES\.md/, 'links the deep-dive doc');
  assert.match(r, /wired \(v1\.151\.0\)/i, 'teaser reflects the wired provider (v1.151.0)');
  assert.match(r, /hermes-bridge/, 'mentions the hermes-bridge skill');
});

test('the hermes-bridge skill exists with valid frontmatter and a scoping gate', () => {
  const p = '.claude/skills/hermes-bridge/SKILL.md';
  assert.ok(existsSync(resolve(ROOT, p)), 'SKILL.md is present');
  const s = read(p);
  assert.match(s, /^name:\s*hermes-bridge\s*$/m, 'frontmatter name is hermes-bridge');
  assert.match(s, /^description:\s*.+/m, 'frontmatter has a description');
  // v1.151.0 — Shape A shipped; the skill reflects that + keeps the security guardrail.
  assert.match(s, /Shape A.*WIRED|WIRED.*Shape A/i, 'skill states Shape A is wired');
  assert.match(s, /docs\/integrations\/HERMES\.md/, 'skill cross-links the single source of truth');
  assert.match(s, /never/i, 'skill states a hard guardrail (secrets never to disk/logs)');
});

test('the Hermes provider is now wired into the dispatch cascade (v1.151.0)', () => {
  // v1.146.0 shipped docs-ahead-of-code and this canary asserted NO Hermes
  // branch existed. v1.151.0 confirmed the Nous Portal / Hermes API Server is
  // OpenAI-compatible (Shape A) and wired it as the 7th provider — so the guard
  // inverts: Hermes must now be in the cascade, via the shared OpenAI-compatible
  // client (not a bespoke agent-runtime relay). If someone rips it out, this
  // fails and the docs/roadmap must be reconciled in the same change.
  const dispatch = read('server/lib/llm-dispatch.mjs');
  assert.match(dispatch, /wantHermes/, 'llm-dispatch gates a Hermes provider');
  assert.match(dispatch, /mode: 'hermes', run: runHermes/, 'llm-dispatch runs Hermes via the shared client');
  assert.match(read('server/lib/openai.mjs'), /export async function runHermes/, 'Hermes rides runOpenAICompatible');
});
